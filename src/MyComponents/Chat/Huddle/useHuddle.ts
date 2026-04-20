/**
 * useHuddle — WebRTC mesh voice + video room, signalled through a
 * Supabase Realtime broadcast channel.
 *
 * Topology: every peer holds an RTCPeerConnection to every other peer
 * (mesh). Works well up to 5–6 participants; beyond that you'd want an
 * SFU. Signalling uses four broadcast event kinds: "offer", "answer",
 * "ice", and "state", all keyed by a huddle id derived from the channel
 * name.
 *
 * Design notes (lessons learned from the v1):
 *   1. Always grab audio + video together at join time and use
 *      `track.enabled` for mute / camera toggles. Re-running
 *      getUserMedia on every toggle was breaking SDP state and
 *      "kicking out" peers when one of them turned on their camera.
 *   2. Don't subscribe to the channel until local media is ready —
 *      otherwise the first offer/answer round trip happens with no
 *      tracks attached and audio never flows.
 *   3. Perfect negotiation: both sides handle simultaneous offers
 *      without crashing. The polite peer rolls back; the impolite
 *      peer ignores stale offers.
 *   4. Only close a peer connection on `failed` (not `disconnected`),
 *      because the latter can be a transient blip during renegotiation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "@/MyComponents/supabase";

export interface HuddlePeer {
  id: string;              // presence key (username)
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  muted: boolean;
  camera: boolean;
  sharing: boolean;
  /** Current audio RMS 0..1 for active-speaker detection. */
  level?: number;
}

interface SignalPayload {
  from: string;
  to?: string;
  kind: "offer" | "answer" | "ice" | "state" | "screen-tracks";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  state?: { muted: boolean; camera: boolean; sharing: boolean };
  /** List of MediaStreamTrack IDs the sender is currently pushing as
   *  screen-share tracks. Receivers use this to bucket incoming tracks
   *  into the screen stream vs the camera stream — SDP msid spoofing
   *  via Object.defineProperty is unreliable. */
  screenTrackIds?: string[];
}

// Public Google STUN — fine for LAN + most consumer NAT traversal.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * Aggressive quality tuning for video senders.
 *
 *   Screen share   → 4K60, maintain-resolution (text-heavy content).
 *                    Cap ~20 Mbps so we don't saturate the uplink.
 *   Camera video   → 4K60 if the hardware supports it, otherwise the
 *                    browser downshifts. Cap ~12 Mbps; motion priority.
 *
 * Real-world sustained rates will be well below these caps — the
 * browser's congestion controller (GCC) owns the throttle. These
 * numbers are the ceiling, not the target.
 *
 * Codec preference: VP9 > H.264 > VP8 for screen (sharp text),
 *                   H.264 > VP9 > VP8 for camera (HW accel everywhere).
 * AV1 is skipped — encoder cost on Chromium is still too high for 60fps.
 */
function tuneVideoSender(
  sender: RTCRtpSender,
  kind: "camera" | "screen",
): void {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    const maxBitrate = kind === "screen" ? 20_000_000 : 12_000_000;
    for (const enc of params.encodings) {
      enc.maxBitrate = maxBitrate;
      enc.maxFramerate = 60;
      (enc as any).networkPriority = "high";
      (enc as any).priority = "high";
    }
    // Trade off resolution vs framerate under pressure. Screen = keep
    // pixels (text stays legible). Camera = keep motion (faces move).
    (params as any).degradationPreference =
      kind === "screen" ? "maintain-resolution" : "maintain-framerate";
    void sender.setParameters(params);
  } catch { /* noop — unsupported in some engines */ }

  // Prefer a codec that handles the load well. setCodecPreferences lives
  // on the transceiver; find it from the sender.
  try {
    const transceiver = (sender as any).transport
      ? null
      : (function findTransceiver() {
          // RTCPeerConnection.getTransceivers() is the real source.
          // We don't have the pc here, so we stash the transceiver on
          // the sender when available — otherwise this is a no-op.
          return (sender as any)._cwaTransceiver ?? null;
        })();
    if (transceiver && typeof transceiver.setCodecPreferences === "function") {
      const caps = (RTCRtpSender as any).getCapabilities?.("video");
      const codecs: RTCRtpCodecCapability[] = caps?.codecs ?? [];
      if (codecs.length > 0) {
        const want = kind === "screen"
          ? ["video/VP9", "video/H264", "video/VP8"]
          : ["video/H264", "video/VP9", "video/VP8"];
        const ordered = [
          ...want.flatMap((m) => codecs.filter((c) => c.mimeType === m)),
          ...codecs.filter((c) => !want.includes(c.mimeType)),
        ];
        transceiver.setCodecPreferences(ordered);
      }
    }
  } catch { /* noop */ }
}

function tuneAudioSender(sender: RTCRtpSender): void {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    for (const enc of params.encodings) {
      // 128 kbps stereo Opus is music-grade; plenty of headroom for voice.
      enc.maxBitrate = 128_000;
      (enc as any).networkPriority = "high";
      (enc as any).priority = "high";
    }
    void sender.setParameters(params);
  } catch { /* noop */ }
}

export interface UseHuddleOpts {
  group: string;             // which channel's huddle
  username: string;          // presence key
  /** true = joined the huddle (opens mic), false = not in huddle */
  joined: boolean;
  /** Local mute state */
  muted: boolean;
  /** Local camera state */
  camera: boolean;
}

export interface UseHuddleResult {
  peers: HuddlePeer[];
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  sharing: boolean;
  error: string | null;
}

/**
 * Per-peer negotiation state, kept on the PC instance via WeakMap
 * (so we don't have to subclass).
 */
interface PeerMeta {
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
}
const peerMetaMap = new WeakMap<RTCPeerConnection, PeerMeta>();

export function useHuddle({ group, username, joined, muted, camera }: UseHuddleOpts): UseHuddleResult {
  const [peers, setPeers] = useState<HuddlePeer[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const connectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteScreenStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteStatesRef = useRef<Map<string, { muted: boolean; camera: boolean; sharing: boolean }>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const screenSenderMapRef = useRef<Map<string, RTCRtpSender[]>>(new Map());
  // Remote screen track IDs keyed by peer — populated via the
  // "screen-tracks" signal. Used in ontrack to bucket a new track
  // into the screen stream vs camera stream.
  const remoteScreenTrackIdsRef = useRef<Map<string, Set<string>>>(new Map());

  // Latest local input state — broadcasts read these instead of stale closures.
  const stateRef = useRef({ muted, camera, sharing });
  stateRef.current = { muted, camera, sharing };

  // ── helpers -----------------------------------------------------------

  const updatePeersState = useCallback(() => {
    const out: HuddlePeer[] = [];
    const ids = new Set<string>([
      ...remoteStreamsRef.current.keys(),
      ...remoteScreenStreamsRef.current.keys(),
      ...remoteStatesRef.current.keys(),
    ]);
    for (const id of ids) {
      const st = remoteStatesRef.current.get(id);
      out.push({
        id,
        stream: remoteStreamsRef.current.get(id) ?? null,
        screenStream: remoteScreenStreamsRef.current.get(id) ?? null,
        muted: st?.muted ?? false,
        camera: st?.camera ?? false,
        sharing: st?.sharing ?? false,
      });
    }
    setPeers(out);
  }, []);

  const broadcast = useCallback((payload: SignalPayload) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: "broadcast", event: "huddle-signal", payload });
  }, []);

  // ── Create (or return) a peer connection keyed by the other user. ────
  const ensurePeer = useCallback((peerId: string, polite: boolean): RTCPeerConnection => {
    const existing = connectionsRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    connectionsRef.current.set(peerId, pc);
    peerMetaMap.set(pc, {
      polite,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
    });

    // Attach local audio + video tracks. localStream is guaranteed set
    // by the time ensurePeer is ever called (channel subscribe is gated
    // on media readiness).
    const local = localStreamRef.current;
    if (local) {
      for (const track of local.getTracks()) {
        const sender = pc.addTrack(track, local);
        // Stash the transceiver so tuneVideoSender can set codec prefs.
        const tx = pc.getTransceivers().find((t) => t.sender === sender);
        if (tx) (sender as any)._cwaTransceiver = tx;
        if (track.kind === "video") tuneVideoSender(sender, "camera");
        else if (track.kind === "audio") tuneAudioSender(sender);
      }
    }
    // Attach existing screen share if active.
    const screen = localScreenStreamRef.current;
    if (screen) {
      const senders: RTCRtpSender[] = [];
      for (const track of screen.getTracks()) {
        const sender = pc.addTrack(track, screen);
        const tx = pc.getTransceivers().find((t) => t.sender === sender);
        if (tx) (sender as any)._cwaTransceiver = tx;
        if (track.kind === "video") tuneVideoSender(sender, "screen");
        else if (track.kind === "audio") tuneAudioSender(sender);
        senders.push(sender);
      }
      screenSenderMapRef.current.set(peerId, senders);
      // Let the new peer know which tracks are the screen share so
      // their ontrack can bucket them correctly.
      broadcast({
        from: username,
        to: peerId,
        kind: "screen-tracks",
        screenTrackIds: screen.getTracks().map((t) => t.id),
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        broadcast({
          from: username,
          to: peerId,
          kind: "ice",
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      // Bucket by explicit signal (screen-tracks) first; only video
      // tracks ever end up in the screen bucket. Audio is always camera.
      const screenSet = remoteScreenTrackIdsRef.current.get(peerId);
      const isScreen = e.track.kind === "video" && !!screenSet?.has(e.track.id);
      const bucket = isScreen ? remoteScreenStreamsRef : remoteStreamsRef;
      let stream = bucket.current.get(peerId);
      if (!stream) {
        stream = new MediaStream();
        bucket.current.set(peerId, stream);
      }
      stream.addTrack(e.track);

      e.track.onended = () => {
        const s = bucket.current.get(peerId);
        if (s) {
          try { s.removeTrack(e.track); } catch { /* noop */ }
          if (s.getTracks().length === 0) bucket.current.delete(peerId);
        }
        updatePeersState();
      };

      // Remote requested stream-removal via mute event (Chrome fires this
      // when sender removeTrack happens). Treat as track ended.
      e.track.onmute = () => {
        // Don't tear down — the user might be switching cam off but
        // staying in the huddle. Just trigger a re-render so PeerTile
        // can fall back to the avatar.
        updatePeersState();
      };
      e.track.onunmute = () => {
        updatePeersState();
      };

      updatePeersState();
    };

    // Only tear down on `failed`. `disconnected` is a transient blip
    // during renegotiation (camera toggle, screen share, etc.).
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        console.warn(`[huddle] peer ${peerId} ICE failed, closing`);
        try { pc.restartIce(); } catch { /* noop */ }
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        console.warn(`[huddle] peer ${peerId} connection ${pc.connectionState}`);
        // Only fully tear down if the peer actually left presence.
        // Presence-leave handler does the cleanup.
      }
    };

    // Perfect negotiation: this side spontaneously needs a new offer
    // (because tracks were added/removed). Both sides may fire this
    // simultaneously; perfect-negotiation guards the resulting state.
    pc.onnegotiationneeded = async () => {
      const meta = peerMetaMap.get(pc);
      if (!meta) return;
      try {
        meta.makingOffer = true;
        await pc.setLocalDescription(); // auto-creates the right description
        broadcast({
          from: username,
          to: peerId,
          kind: "offer",
          sdp: pc.localDescription!.toJSON(),
        });
        // After every renegotiation, re-send our screen track IDs so
        // the peer always has the latest bucketing info — fixes the
        // "first sharer can't see second sharer" race.
        const screen = localScreenStreamRef.current;
        if (screen) {
          broadcast({
            from: username,
            to: peerId,
            kind: "screen-tracks",
            screenTrackIds: screen.getTracks().map((t) => t.id),
          });
        }
      } catch (err) {
        console.warn("[huddle] negotiation failed:", err);
      } finally {
        meta.makingOffer = false;
      }
    };

    return pc;
  }, [broadcast, username, updatePeersState]);

  // ── Mute / camera toggles — flip enabled flags in place. ─────────────
  // No getUserMedia re-call, no addTrack, no renegotiation.

  useEffect(() => {
    const s = localStreamRef.current;
    if (!s) return;
    for (const t of s.getAudioTracks()) t.enabled = !muted;
    broadcast({
      from: username,
      kind: "state",
      state: { muted, camera, sharing: stateRef.current.sharing },
    });
  }, [muted, broadcast, username, camera]);

  useEffect(() => {
    const s = localStreamRef.current;
    if (!s) return;
    for (const t of s.getVideoTracks()) t.enabled = camera;
    broadcast({
      from: username,
      kind: "state",
      state: { muted, camera, sharing: stateRef.current.sharing },
    });
  }, [camera, broadcast, username, muted]);

  // ── Screen share --------------------------------------------------------

  const stopScreenShare = useCallback(() => {
    const s = localScreenStreamRef.current;
    if (s) {
      for (const t of s.getTracks()) {
        try { t.stop(); } catch { /* noop */ }
      }
    }
    for (const [peerId, senders] of screenSenderMapRef.current.entries()) {
      const pc = connectionsRef.current.get(peerId);
      if (!pc) continue;
      for (const sender of senders) {
        try { pc.removeTrack(sender); } catch { /* noop */ }
      }
    }
    screenSenderMapRef.current.clear();
    localScreenStreamRef.current = null;
    setLocalScreenStream(null);
    setSharing(false);
    broadcast({ from: username, kind: "screen-tracks", screenTrackIds: [] });
    broadcast({
      from: username,
      kind: "state",
      state: { muted: stateRef.current.muted, camera: stateRef.current.camera, sharing: false },
    });
  }, [broadcast, username]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // 4K60 when the source + GPU can sustain it. `ideal` lets the
          // browser downshift gracefully on weaker machines. The bitrate
          // cap (20 Mbps, set in tuneVideoSender) is what actually
          // governs on-the-wire quality — without it a 4K capture would
          // be compressed down to ~2.5 Mbps and look worse than 1080p.
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
          frameRate: { ideal: 60, max: 60 },
        } as MediaTrackConstraints,
        // Include system audio when the browser supports it (Chromium
        // on Windows/ChromeOS). Falls through silently elsewhere.
        audio: true,
      } as MediaStreamConstraints);
      // Wrap for local bookkeeping. Bucketing is done via the
      // screen-tracks signal, not the stream id. Hint the encoder to
      // favor detail (text sharpness) over motion smoothing.
      const routedStream = new MediaStream();
      Object.defineProperty(routedStream, "id", {
        value: `screen-${crypto.randomUUID()}`,
      });
      for (const t of screenStream.getTracks()) {
        if (t.kind === "video") {
          try { (t as any).contentHint = "detail"; } catch { /* noop */ }
        }
        routedStream.addTrack(t);
      }

      localScreenStreamRef.current = routedStream;
      setLocalScreenStream(routedStream);
      setSharing(true);

      for (const [peerId, pc] of connectionsRef.current.entries()) {
        const senders: RTCRtpSender[] = [];
        for (const track of routedStream.getTracks()) {
          const sender = pc.addTrack(track, routedStream);
          const tx = pc.getTransceivers().find((t) => t.sender === sender);
          if (tx) (sender as any)._cwaTransceiver = tx;
          if (track.kind === "video") tuneVideoSender(sender, "screen");
          else if (track.kind === "audio") tuneAudioSender(sender);
          senders.push(sender);
        }
        screenSenderMapRef.current.set(peerId, senders);
      }

      // Announce which track IDs are the screen share so receivers can
      // bucket them correctly (SDP msid spoofing isn't reliable).
      const screenIds = routedStream.getTracks().map((t) => t.id);
      broadcast({
        from: username,
        kind: "screen-tracks",
        screenTrackIds: screenIds,
      });

      routedStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopScreenShare();
      });

      broadcast({
        from: username,
        kind: "state",
        state: { muted: stateRef.current.muted, camera: stateRef.current.camera, sharing: true },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") return;
      console.error("[huddle] startScreenShare failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [broadcast, username, stopScreenShare]);

  // ── Combined media + signalling lifecycle ────────────────────────────
  // One effect, fires only on join/leave/group change. NO camera dep —
  // toggles are handled by enable-flag effects above.

  useEffect(() => {
    if (!joined || !username) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      // 1. Get audio. Required. Use Discord/Meet-grade constraints:
      // echo cancellation + noise suppression + AGC for clean voice,
      // mono (channelCount: 1) for consistent volumes across peers,
      // and 48 kHz where supported for lower-latency Opus encoding.
      let audioStream: MediaStream;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
            // Chromium-specific but harmless when unsupported.
            googEchoCancellation: true,
            googAutoGainControl: true,
            googNoiseSuppression: true,
            googHighpassFilter: true,
            googTypingNoiseDetection: true,
          } as any,
          video: false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Microphone access denied");
        return;
      }
      if (cancelled) {
        for (const t of audioStream.getTracks()) t.stop();
        return;
      }

      // 2. Try video. Optional — some users have no camera. Ask for 4K60
      // ideally; the browser downshifts to the camera's real max (most
      // consumer webcams cap at 1080p, some pro/phone cams hit 4K).
      let videoStream: MediaStream | null = null;
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 3840, max: 3840 },
            height: { ideal: 2160, max: 2160 },
            frameRate: { ideal: 60, max: 60 },
            aspectRatio: { ideal: 16 / 9 },
            // facingMode biased toward front camera on mobile.
            facingMode: "user",
          } as MediaTrackConstraints,
          audio: false,
        });
      } catch (err) {
        console.warn("[huddle] no camera available:", err);
      }
      if (cancelled) {
        for (const t of audioStream.getTracks()) t.stop();
        if (videoStream) for (const t of videoStream.getTracks()) t.stop();
        return;
      }

      // 3. Combine. Apply initial enabled state from current props.
      const combined = new MediaStream();
      for (const t of audioStream.getTracks()) {
        t.enabled = !stateRef.current.muted;
        combined.addTrack(t);
      }
      if (videoStream) {
        for (const t of videoStream.getTracks()) {
          t.enabled = stateRef.current.camera;
          // Hint the encoder: camera = motion priority (smooth faces).
          try { (t as any).contentHint = "motion"; } catch { /* noop */ }
          combined.addTrack(t);
        }
      }

      localStreamRef.current = combined;
      setLocalStream(combined);

      // 4. NOW it's safe to subscribe. Initial offers will include tracks.
      channel = supabase.channel(`huddle:${group}`, {
        config: { presence: { key: username } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "huddle-signal" }, async (evt) => {
          const msg = evt.payload as SignalPayload;
          if (!msg || !msg.from || msg.from === username) return;
          if (msg.to && msg.to !== username) return;

          if (msg.kind === "state" && msg.state) {
            // If they stopped screen sharing, drop the cached stream so
            // we don't keep showing a frozen frame.
            if (!msg.state.sharing) {
              remoteScreenStreamsRef.current.delete(msg.from);
              remoteScreenTrackIdsRef.current.delete(msg.from);
            }
            remoteStatesRef.current.set(msg.from, msg.state);
            updatePeersState();

            // If THEY are sharing and we're also sharing, proactively
            // re-announce OUR screen track IDs to them so both sides
            // have bucketing info even if earlier signals were lost.
            if (msg.state.sharing) {
              const screen = localScreenStreamRef.current;
              if (screen) {
                broadcast({
                  from: username,
                  to: msg.from,
                  kind: "screen-tracks",
                  screenTrackIds: screen.getTracks().map((t) => t.id),
                });
              }
            }
            return;
          }

          if (msg.kind === "screen-tracks") {
            const ids = new Set<string>(msg.screenTrackIds ?? []);
            if (ids.size === 0) {
              remoteScreenTrackIdsRef.current.delete(msg.from);
              remoteScreenStreamsRef.current.delete(msg.from);
            } else {
              remoteScreenTrackIdsRef.current.set(msg.from, ids);
              // If tracks already landed before the signal, rebucket them
              // retroactively: walk the camera stream for this peer and
              // move any track whose id is in the screen set.
              const cam = remoteStreamsRef.current.get(msg.from);
              if (cam) {
                const movers = cam.getTracks().filter((t) => ids.has(t.id));
                if (movers.length > 0) {
                  let scr = remoteScreenStreamsRef.current.get(msg.from);
                  if (!scr) {
                    scr = new MediaStream();
                    remoteScreenStreamsRef.current.set(msg.from, scr);
                  }
                  for (const t of movers) {
                    try { cam.removeTrack(t); } catch { /* noop */ }
                    try { scr.addTrack(t); } catch { /* noop */ }
                  }
                }
              }
            }
            updatePeersState();
            return;
          }

          if (msg.kind === "ice" && msg.candidate) {
            const pc = connectionsRef.current.get(msg.from);
            if (!pc) return;
            try {
              await pc.addIceCandidate(msg.candidate);
            } catch (err) {
              const meta = peerMetaMap.get(pc);
              if (!meta?.ignoreOffer) {
                console.warn("[huddle] addIceCandidate failed:", err);
              }
            }
            return;
          }

          // Perfect negotiation for offer/answer.
          // We always ensurePeer here so a peer that says hi via offer
          // (e.g. they joined and we missed presence sync) gets a PC.
          const polite = username < msg.from;
          const pc = ensurePeer(msg.from, polite);
          const meta = peerMetaMap.get(pc);
          if (!meta) return;

          if (msg.kind === "offer" && msg.sdp) {
            const readyForOffer =
              !meta.makingOffer &&
              (pc.signalingState === "stable" || meta.isSettingRemoteAnswerPending);
            const offerCollision = !readyForOffer;
            meta.ignoreOffer = !meta.polite && offerCollision;
            if (meta.ignoreOffer) return;

            try {
              await pc.setRemoteDescription(msg.sdp);
              await pc.setLocalDescription(); // auto-creates an answer
              broadcast({
                from: username,
                to: msg.from,
                kind: "answer",
                sdp: pc.localDescription!.toJSON(),
              });
            } catch (err) {
              console.error("[huddle] handle offer failed:", err);
            }
          } else if (msg.kind === "answer" && msg.sdp) {
            try {
              meta.isSettingRemoteAnswerPending = true;
              await pc.setRemoteDescription(msg.sdp);
            } catch (err) {
              console.error("[huddle] setRemote(answer) failed:", err);
            } finally {
              meta.isSettingRemoteAnswerPending = false;
            }
          }
        })
        .on("presence", { event: "sync" }, () => {
          if (!channel) return;
          const state = channel.presenceState();
          // Ensure a PC for every other participant. The PC's
          // onnegotiationneeded will fire (because we attach tracks
          // inside ensurePeer) and produce the initial offer.
          for (const key of Object.keys(state)) {
            if (key === username) continue;
            const polite = username < key;
            ensurePeer(key, polite);
          }
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          if (typeof key !== "string") return;
          const pc = connectionsRef.current.get(key);
          if (pc) pc.close();
          connectionsRef.current.delete(key);
          remoteStreamsRef.current.delete(key);
          remoteScreenStreamsRef.current.delete(key);
          remoteStatesRef.current.delete(key);
          screenSenderMapRef.current.delete(key);
          updatePeersState();
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && channel) {
            channel.track({
              muted: stateRef.current.muted,
              camera: stateRef.current.camera,
              sharing: stateRef.current.sharing,
            });
            // Broadcast initial state so peers see our flags.
            broadcast({
              from: username,
              kind: "state",
              state: {
                muted: stateRef.current.muted,
                camera: stateRef.current.camera,
                sharing: stateRef.current.sharing,
              },
            });
          }
        });
    };

    void setup();

    return () => {
      cancelled = true;
      if (channel) channel.unsubscribe();
      channelRef.current = null;
      for (const pc of connectionsRef.current.values()) pc.close();
      connectionsRef.current.clear();
      remoteStreamsRef.current.clear();
      remoteScreenStreamsRef.current.clear();
      remoteStatesRef.current.clear();
      screenSenderMapRef.current.clear();
      // Stop local audio+video stream.
      const s = localStreamRef.current;
      if (s) for (const t of s.getTracks()) {
        try { t.stop(); } catch { /* noop */ }
      }
      localStreamRef.current = null;
      setLocalStream(null);
      // Stop screen share if any.
      const ss = localScreenStreamRef.current;
      if (ss) for (const t of ss.getTracks()) {
        try { t.stop(); } catch { /* noop */ }
      }
      localScreenStreamRef.current = null;
      setLocalScreenStream(null);
      setSharing(false);
      setPeers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, group, username]);

  return {
    peers,
    localStream,
    localScreenStream,
    startScreenShare,
    stopScreenShare,
    sharing,
    error,
  };
}
