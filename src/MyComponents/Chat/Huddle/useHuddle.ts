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
}

interface SignalPayload {
  from: string;
  to?: string;
  kind: "offer" | "answer" | "ice" | "state";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  state?: { muted: boolean; camera: boolean; sharing: boolean };
}

// Public Google STUN — fine for LAN + most consumer NAT traversal.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

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
      for (const track of local.getTracks()) pc.addTrack(track, local);
    }
    // Attach existing screen share if active.
    const screen = localScreenStreamRef.current;
    if (screen) {
      const senders: RTCRtpSender[] = [];
      for (const track of screen.getTracks()) {
        senders.push(pc.addTrack(track, screen));
      }
      screenSenderMapRef.current.set(peerId, senders);
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
      const streamId = e.streams[0]?.id ?? "";
      const isScreen = streamId.startsWith("screen-");
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
    broadcast({
      from: username,
      kind: "state",
      state: { muted: stateRef.current.muted, camera: stateRef.current.camera, sharing: false },
    });
  }, [broadcast, username]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      // Wrap so we can control the id (used by receivers to bucket).
      const routedStream = new MediaStream();
      Object.defineProperty(routedStream, "id", {
        value: `screen-${crypto.randomUUID()}`,
      });
      for (const t of screenStream.getTracks()) routedStream.addTrack(t);

      localScreenStreamRef.current = routedStream;
      setLocalScreenStream(routedStream);
      setSharing(true);

      for (const [peerId, pc] of connectionsRef.current.entries()) {
        const senders: RTCRtpSender[] = [];
        for (const track of routedStream.getTracks()) {
          senders.push(pc.addTrack(track, routedStream));
        }
        screenSenderMapRef.current.set(peerId, senders);
      }

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
      // 1. Get audio. Required.
      let audioStream: MediaStream;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true, video: false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Microphone access denied");
        return;
      }
      if (cancelled) {
        for (const t of audioStream.getTracks()) t.stop();
        return;
      }

      // 2. Try video. Optional — some users have no camera.
      let videoStream: MediaStream | null = null;
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: true, audio: false,
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
            }
            remoteStatesRef.current.set(msg.from, msg.state);
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
