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
import { QUALITY_PRESETS, type HuddleQuality, type QualitySpec } from "@/stores/huddleStore";

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
 * Quality tuning for video senders, driven by the active preset.
 *
 *   spec.bitrate      → encoder cap (the real lever; pixels alone
 *                       don't make things sharp).
 *   spec.framerate    → maxFramerate hint.
 *   spec.degrade      → which axis collapses under CPU/network pressure.
 *                       maintain-framerate = smooth scrolling, pixels
 *                       drop. maintain-resolution = sharp text, frames
 *                       drop (this is what made scrolling feel rough).
 *   spec.hint         → contentHint: "motion" prefers smoothness,
 *                       "detail" prefers clarity on static frames.
 *
 * Camera uses the same spec but a lower bitrate ceiling since faces
 * compress well. Codec preference: VP9 > H.264 > VP8 for screen (sharp
 * text), H.264 > VP9 > VP8 for camera (HW accel is near-universal).
 * AV1 is skipped — encoder cost on Chromium is still too high for 60fps.
 */
function tuneVideoSender(
  sender: RTCRtpSender,
  kind: "camera" | "screen",
  spec: QualitySpec,
): void {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    // Camera gets 60% of the screen-share ceiling — same preset, less
    // raw data (faces compress well, we don't need 20 Mbps).
    const maxBitrate = kind === "screen"
      ? spec.bitrate
      : Math.round(spec.bitrate * 0.6);
    for (const enc of params.encodings) {
      enc.maxBitrate = maxBitrate;
      enc.maxFramerate = spec.framerate;
      (enc as any).networkPriority = "high";
      (enc as any).priority = "high";
    }
    (params as any).degradationPreference = spec.degrade;
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
      const codecs: Array<{ mimeType: string }> = caps?.codecs ?? [];
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
  /** Video quality preset. Defaults to "smooth". */
  quality?: HuddleQuality;
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

export function useHuddle({ group, username, joined, muted, camera, quality = "smooth" }: UseHuddleOpts): UseHuddleResult {
  // Live reference to the active spec. Refs (not state) so it's always
  // read fresh from tuning callsites, and updates-while-sharing use the
  // dedicated effect below to re-apply setParameters on running senders.
  const qualityRef = useRef<QualitySpec>(QUALITY_PRESETS[quality]);
  qualityRef.current = QUALITY_PRESETS[quality];
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

  // ── Reliability timers ──────────────────────────────────────────
  // Both maps are keyed by peer username. Tracking the actual
  // setTimeout IDs (not booleans) so we can cancel + replace cleanly.
  //
  //   pendingLeaveTimersRef — when presence reports a peer has "left",
  //     we don't tear the PC down immediately. WebSocket + presence
  //     can blip for sub-second reasons (mobile network switch, tab
  //     focus loss, brief packet loss) and instantly closing the PC
  //     means a fresh handshake on every blip → audio/video flicker
  //     or full disconnect. Instead we schedule a 4s teardown and
  //     cancel it if the peer reappears on the next sync.
  //
  //   iceDisconnectTimersRef — when ICE transitions to "disconnected"
  //     we wait 3s before forcing a restartIce(). Many real-world
  //     blips recover on their own within that window; restarting
  //     prematurely just churns the connection.
  const pendingLeaveTimersRef = useRef<Map<string, number>>(new Map());
  const iceDisconnectTimersRef = useRef<Map<string, number>>(new Map());

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
        if (track.kind === "video") tuneVideoSender(sender, "camera", qualityRef.current);
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
        if (track.kind === "video") tuneVideoSender(sender, "screen", qualityRef.current);
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

    // ── Replay our current state TO the new peer ────────────────
    // State broadcasts otherwise only fire on local state changes.
    // That means a reconnecting peer never learns we're sharing
    // (they missed the broadcast at our subscribe time). The result
    // visible to the user: "Hasan's icon doesn't show as sharing
    // and his screen never appears" — we have the PC, the tracks
    // arrive, but peers[id].sharing stays false because no state
    // message ever arrives. Push it to them directly on PC creation.
    broadcast({
      from: username,
      to: peerId,
      kind: "state",
      state: {
        muted: stateRef.current.muted,
        camera: stateRef.current.camera,
        sharing: stateRef.current.sharing,
      },
    });

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
      //
      // Critical: we MINT a fresh MediaStream on every track add rather
      // than mutating the existing one in place. React's `<video>`
      // srcObject binding is keyed on the stream's JS reference; if we
      // mutate-in-place, PeerTile/ScreenShareTile never see a prop
      // change and the video element keeps pointing at a stale track
      // layout. Copy-on-write makes every bucketing event generate a
      // fresh reference so child tiles re-bind.
      const screenSet = remoteScreenTrackIdsRef.current.get(peerId);
      const isScreen = e.track.kind === "video" && !!screenSet?.has(e.track.id);
      const bucket = isScreen ? remoteScreenStreamsRef : remoteStreamsRef;
      const existing = bucket.current.get(peerId);
      const tracks = existing ? [...existing.getTracks(), e.track] : [e.track];
      const fresh = new MediaStream(tracks);
      bucket.current.set(peerId, fresh);

      e.track.onended = () => {
        const s = bucket.current.get(peerId);
        if (s) {
          const remaining = s.getTracks().filter((t) => t !== e.track);
          if (remaining.length === 0) {
            bucket.current.delete(peerId);
          } else {
            bucket.current.set(peerId, new MediaStream(remaining));
          }
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

    // ICE state lifecycle:
    //   · "disconnected" — common transient blip (network hiccup, brief
    //     packet loss). Most of these self-recover within 1-2 seconds.
    //     We arm a 3s timer; if we're STILL disconnected when it fires,
    //     proactively restartIce() to probe fresh candidates. If we
    //     recover before then, the next state-change cancels the timer.
    //   · "failed" — ICE has given up. Immediately restartIce so we
    //     don't wait the full disconnect timer.
    //   · anything else — clear any pending disconnect timer.
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "disconnected") {
        // Don't double-schedule. Only arm if no timer is already pending.
        if (!iceDisconnectTimersRef.current.has(peerId)) {
          const timerId = window.setTimeout(() => {
            iceDisconnectTimersRef.current.delete(peerId);
            // Still disconnected after the grace window? Force a fresh
            // ICE gather. Skip if the PC has already moved on (closed,
            // back to connected, etc.).
            if (pc.iceConnectionState === "disconnected") {
              console.warn(`[huddle] peer ${peerId} ICE stuck disconnected, restarting`);
              try { pc.restartIce(); } catch { /* noop */ }
            }
          }, 3000);
          iceDisconnectTimersRef.current.set(peerId, timerId);
        }
      } else if (state === "failed") {
        const existing = iceDisconnectTimersRef.current.get(peerId);
        if (existing) {
          clearTimeout(existing);
          iceDisconnectTimersRef.current.delete(peerId);
        }
        console.warn(`[huddle] peer ${peerId} ICE failed, restarting`);
        try { pc.restartIce(); } catch { /* noop */ }
      } else {
        // connected / completed / new / checking — cancel any pending
        // restart, since the connection is on its way back.
        const existing = iceDisconnectTimersRef.current.get(peerId);
        if (existing) {
          clearTimeout(existing);
          iceDisconnectTimersRef.current.delete(peerId);
        }
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        console.warn(`[huddle] peer ${peerId} connection ${pc.connectionState}`);
        // Only fully tear down if the peer actually left presence.
        // Presence-leave handler does the cleanup (with debounce).
      }
    };

    // Perfect negotiation: this side spontaneously needs a new offer
    // (because tracks were added/removed). Both sides may fire this
    // simultaneously; perfect-negotiation guards the resulting state.
    pc.onnegotiationneeded = async () => {
      const meta = peerMetaMap.get(pc);
      if (!meta) return;

      // Initial-connect latency cut: on the VERY first negotiation,
      // only the impolite peer drives the offer. The polite peer
      // waits for the offer to arrive. This skips the
      // offer/answer-then-rollback round-trip the polite side would
      // otherwise do (because attaching tracks on mount fires this
      // handler on BOTH sides at once). Saves ~300-500ms to first
      // audio packet.
      //
      // For any SUBSEQUENT negotiation (camera toggle, screen share,
      // track replacement), pc.remoteDescription is set, so either
      // side is free to drive renegotiation — the polite peer can
      // initiate too, and perfect-negotiation handles any collision
      // the normal way.
      if (meta.polite && !pc.remoteDescription) return;

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

  // Camera toggle — flips enabled on the existing video track. If the
  // local stream never got a video track in the first place (the
  // initial getUserMedia failed with NotReadableError because the
  // camera was in use by another app / OS-locked at huddle startup),
  // this effect LAZILY ACQUIRES it when the user toggles camera on:
  //   1. Calls getUserMedia with the current quality preset.
  //   2. Adds the new track to the local stream (mint a fresh
  //      MediaStream so React sees a new reference — PeerTile's ref
  //      callback then rebinds srcObject for the self-view).
  //   3. Attaches the new track as a sender on every live peer
  //      connection, which fires onnegotiationneeded and renegotiates.
  //   4. Broadcasts the new state.
  // If getUserMedia still fails, surfaces the error and leaves camera
  // state alone so the UI doesn't show a stuck "on" indicator.
  useEffect(() => {
    const s = localStreamRef.current;
    if (!s) return;

    const hasVideo = s.getVideoTracks().length > 0;

    if (!camera) {
      // Going off — flip enabled on whatever video tracks exist.
      for (const t of s.getVideoTracks()) t.enabled = false;
      broadcast({
        from: username,
        kind: "state",
        state: { muted, camera, sharing: stateRef.current.sharing },
      });
      return;
    }

    if (hasVideo) {
      // Camera already acquired — just enable existing tracks.
      for (const t of s.getVideoTracks()) t.enabled = true;
      broadcast({
        from: username,
        kind: "state",
        state: { muted, camera, sharing: stateRef.current.sharing },
      });
      return;
    }

    // Camera ON but no video track exists — lazy-acquire.
    let cancelled = false;
    (async () => {
      try {
        const spec = qualityRef.current;
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: spec.width, max: spec.width },
            height: { ideal: spec.height, max: spec.height },
            frameRate: { ideal: spec.framerate, max: spec.framerate },
            aspectRatio: { ideal: 16 / 9 },
            facingMode: "user",
          } as MediaTrackConstraints,
          audio: false,
        });
        if (cancelled) {
          for (const t of videoStream.getTracks()) t.stop();
          return;
        }
        const newVideoTrack = videoStream.getVideoTracks()[0];
        if (!newVideoTrack) return;
        try { (newVideoTrack as any).contentHint = "motion"; } catch { /* noop */ }
        newVideoTrack.enabled = true;

        // Rebuild localStream with a fresh reference (COW) so PeerTile
        // notices the change. Preserve existing audio tracks.
        const freshLocal = new MediaStream([
          ...s.getAudioTracks(),
          newVideoTrack,
        ]);
        localStreamRef.current = freshLocal;
        setLocalStream(freshLocal);

        // Attach to every existing peer connection. addTrack fires
        // onnegotiationneeded; perfect negotiation handles collisions.
        for (const pc of connectionsRef.current.values()) {
          try {
            const sender = pc.addTrack(newVideoTrack, freshLocal);
            const tx = pc.getTransceivers().find((t) => t.sender === sender);
            if (tx) (sender as any)._cwaTransceiver = tx;
            tuneVideoSender(sender, "camera", qualityRef.current);
          } catch (err) {
            console.warn("[huddle] addTrack(camera) failed:", err);
          }
        }

        // Clean up if the track ends from the OS side (unplugged, etc).
        newVideoTrack.addEventListener("ended", () => {
          const live = localStreamRef.current;
          if (!live) return;
          const remaining = live.getTracks().filter((t) => t !== newVideoTrack);
          const rebuilt = new MediaStream(remaining);
          localStreamRef.current = rebuilt;
          setLocalStream(rebuilt);
        });

        broadcast({
          from: username,
          kind: "state",
          state: { muted, camera: true, sharing: stateRef.current.sharing },
        });
      } catch (err) {
        console.error("[huddle] lazy camera acquire failed:", err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(
          err instanceof Error && err.name === "NotReadableError"
            ? "Camera is in use by another app. Close it and try again."
            : err instanceof Error && err.name === "NotAllowedError"
              ? "Camera permission denied."
              : msg,
        );
      }
    })();

    return () => { cancelled = true; };
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
      const spec = qualityRef.current;
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // Capture size + framerate come from the active preset. Browser
          // downshifts via `ideal` if the source can't provide it. The
          // bitrate cap in tuneVideoSender is what actually governs
          // on-the-wire quality — raw pixel count alone doesn't help.
          width: { ideal: spec.width, max: spec.width },
          height: { ideal: spec.height, max: spec.height },
          frameRate: { ideal: spec.framerate, max: spec.framerate },
        } as MediaTrackConstraints,
        // Include system audio when the browser supports it (Chromium
        // on Windows/ChromeOS). Falls through silently elsewhere.
        audio: true,
      } as MediaStreamConstraints);
      // Wrap for local bookkeeping. Bucketing is done via the
      // screen-tracks signal, not the stream id. contentHint comes from
      // the preset: "motion" = smooth scrolling, "detail" = sharp text.
      const routedStream = new MediaStream();
      Object.defineProperty(routedStream, "id", {
        value: `screen-${crypto.randomUUID()}`,
      });
      for (const t of screenStream.getTracks()) {
        if (t.kind === "video") {
          try { (t as any).contentHint = spec.hint; } catch { /* noop */ }
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
          if (track.kind === "video") tuneVideoSender(sender, "screen", spec);
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

  // ── Live quality re-tune ─────────────────────────────────────────
  // When the user flips the quality preset mid-call, re-apply the new
  // spec to every already-attached sender + update the outbound
  // contentHint on the local screen track. Capture resolution can't
  // change without re-calling getDisplayMedia — we document that limit
  // and fire applyConstraints() as a best-effort reshape.
  useEffect(() => {
    const spec = QUALITY_PRESETS[quality];
    // Re-parameterize every live video sender across every peer.
    for (const pc of connectionsRef.current.values()) {
      for (const sender of pc.getSenders()) {
        const track = sender.track;
        if (!track) continue;
        if (track.kind === "video") {
          const isScreen = track.id !== undefined
            && Array.from(screenSenderMapRef.current.values())
              .some((arr) => arr.includes(sender));
          tuneVideoSender(sender, isScreen ? "screen" : "camera", spec);
        }
      }
    }
    // Best-effort reshape of the running screen-share source. Chrome
    // and Edge honor applyConstraints on display tracks; Firefox
    // usually doesn't — it'll just keep the original resolution.
    const screen = localScreenStreamRef.current;
    if (screen) {
      for (const t of screen.getVideoTracks()) {
        try { (t as any).contentHint = spec.hint; } catch { /* noop */ }
        t.applyConstraints({
          width: { ideal: spec.width, max: spec.width },
          height: { ideal: spec.height, max: spec.height },
          frameRate: { ideal: spec.framerate, max: spec.framerate },
        } as MediaTrackConstraints).catch(() => { /* noop */ });
      }
    }
  }, [quality]);

  // ── Combined media + signalling lifecycle ────────────────────────────
  // One effect, fires only on join/leave/group change. NO camera dep —
  // toggles are handled by enable-flag effects above.

  useEffect(() => {
    if (!joined || !username) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      // ── Pre-flight: WebView media-device support ──────────────────────
      // navigator.mediaDevices is undefined when:
      //   · macOSPrivateApi isn't enabled in tauri.conf.json (WKWebView
      //     strips the API on macOS by default)
      //   · the entitlements / Info.plist usage strings are missing
      //   · the page isn't served from a secure context
      //
      // The raw WebKit error ("undefined is not an object…") is opaque
      // to end users, so we catch it here and surface a fix path.
      if (
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setError(
          "This app build doesn't have media access. Update or reinstall the latest version of TakeOver and try again.",
        );
        return;
      }

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

      // 2. Try video. Optional — some users have no camera. Size +
      // framerate track the active quality preset; browser downshifts
      // to the camera's real max.
      let videoStream: MediaStream | null = null;
      try {
        const spec = qualityRef.current;
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: spec.width, max: spec.width },
            height: { ideal: spec.height, max: spec.height },
            frameRate: { ideal: spec.framerate, max: spec.framerate },
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
          // Camera prefers motion regardless of preset — faces are always
          // motion-oriented. (Screen share is the one that tracks detail.)
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
              //
              // Both buckets are REPLACED with fresh MediaStream objects
              // — never mutated in place — so React sees new references
              // on the next updatePeersState and PeerTile/ScreenShareTile
              // re-bind their <video> srcObject to the correct layout.
              // Without this the first sharer's tiles freeze pointing at
              // the stale mutated stream and the second sharer's screen
              // never renders for them.
              const cam = remoteStreamsRef.current.get(msg.from);
              if (cam) {
                const movers = cam.getTracks().filter((t) => ids.has(t.id));
                if (movers.length > 0) {
                  const camRemaining = cam.getTracks().filter((t) => !ids.has(t.id));
                  if (camRemaining.length === 0) {
                    remoteStreamsRef.current.delete(msg.from);
                  } else {
                    remoteStreamsRef.current.set(msg.from, new MediaStream(camRemaining));
                  }
                  const scrExisting = remoteScreenStreamsRef.current.get(msg.from);
                  const scrTracks = scrExisting
                    ? [...scrExisting.getTracks(), ...movers]
                    : movers;
                  remoteScreenStreamsRef.current.set(msg.from, new MediaStream(scrTracks));
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
            // ── Bucketing-signal repair ─────────────────────────
            // Handshake is settled. If we're sharing, re-broadcast
            // our screen-tracks signal to the peer so they have it
            // even if the original signal raced ahead of (or behind)
            // the SDP exchange. This is the fix for the "both peers
            // sharing simultaneously and one stream goes to the
            // wrong bucket" race. Cheap to send, harmless if it's
            // a redundant repeat.
            if (stateRef.current.sharing) {
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
          }
        })
        .on("presence", { event: "sync" }, () => {
          if (!channel) return;
          const state = channel.presenceState();
          // Ensure a PC for every other participant. The PC's
          // onnegotiationneeded will fire (because we attach tracks
          // inside ensurePeer) and produce the initial offer.
          //
          // If a peer is currently in the "about to be torn down"
          // grace window (we saw a leave event but haven't pulled
          // the trigger yet), the fact that they're back in presence
          // cancels the teardown. This is the main reason huddles
          // appeared to "drop" peers during brief network blips.
          for (const key of Object.keys(state)) {
            if (key === username) continue;
            const pending = pendingLeaveTimersRef.current.get(key);
            if (pending) {
              clearTimeout(pending);
              pendingLeaveTimersRef.current.delete(key);
              console.log(`[huddle] peer ${key} reappeared, canceling teardown`);
            }
            const polite = username < key;
            ensurePeer(key, polite);
          }
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          if (typeof key !== "string") return;
          // DEBOUNCED TEARDOWN. Presence "leave" fires for a bunch of
          // reasons that aren't "the user actually left":
          //   · tab focus loss on Chromium (websocket throttling)
          //   · mobile network switching (wifi → cellular)
          //   · brief packet loss on the realtime channel
          //   · the user navigating between routes within the app
          // Closing the RTCPeerConnection on every one of these means
          // a full handshake the moment they come back — costly, slow,
          // and visible as "lost the call" to the operator.
          //
          // Schedule the teardown 4s in the future. If presence sync
          // sees them again before then, we cancel and keep the PC
          // alive — restartIce() handles any ICE drift during the gap.
          const existing = pendingLeaveTimersRef.current.get(key);
          if (existing) clearTimeout(existing);
          const timerId = window.setTimeout(() => {
            pendingLeaveTimersRef.current.delete(key);
            const pc = connectionsRef.current.get(key);
            if (pc) pc.close();
            connectionsRef.current.delete(key);
            remoteStreamsRef.current.delete(key);
            remoteScreenStreamsRef.current.delete(key);
            remoteStatesRef.current.delete(key);
            screenSenderMapRef.current.delete(key);
            const t = iceDisconnectTimersRef.current.get(key);
            if (t) {
              clearTimeout(t);
              iceDisconnectTimersRef.current.delete(key);
            }
            console.log(`[huddle] peer ${key} stayed gone, tearing down`);
            updatePeersState();
          }, 4000);
          pendingLeaveTimersRef.current.set(key, timerId);
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

    // Tab visibility: when the user comes back to the huddle tab after
    // it being hidden, browsers may have throttled the WebRTC stack
    // (timers slowed, AudioContext suspended, ICE liveness checks
    // skipped). Proactively poke every peer connection — restart ICE
    // on anything that isn't connected, so audio/video resume the
    // moment the user looks at the tab again.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      for (const [peerId, pc] of connectionsRef.current.entries()) {
        const s = pc.iceConnectionState;
        if (s === "disconnected" || s === "failed" || s === "checking") {
          console.log(`[huddle] tab visible — restarting ICE for ${peerId} (was ${s})`);
          try { pc.restartIce(); } catch { /* noop */ }
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      // Clear all reliability timers so they can't fire after teardown.
      for (const t of pendingLeaveTimersRef.current.values()) clearTimeout(t);
      pendingLeaveTimersRef.current.clear();
      for (const t of iceDisconnectTimersRef.current.values()) clearTimeout(t);
      iceDisconnectTimersRef.current.clear();
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
