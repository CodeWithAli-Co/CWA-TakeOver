/**
 * useHuddle — WebRTC mesh voice + video room, signalled through a
 * Supabase Realtime broadcast channel.
 *
 * Topology: every peer holds an RTCPeerConnection to every other peer
 * (mesh). Works well up to 5–6 participants; beyond that you'd want an
 * SFU. Signalling uses three broadcast event kinds: "offer", "answer",
 * and "ice", all keyed by a huddle id derived from the channel name.
 *
 * Keeps things flat: no connecting / reconnecting logic beyond what
 * the browser gives us. If a peer drops, their RTCPeerConnection fires
 * `iceconnectionstatechange` and we clean up on "disconnected".
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
  kind: "offer" | "answer" | "ice" | "state" | "renegotiate";
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
  peers: HuddlePeer[];        // remote peers only
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  sharing: boolean;
  error: string | null;
}

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

  // ── helpers -----------------------------------------------------------

  const updatePeersState = useCallback(() => {
    const out: HuddlePeer[] = [];
    // Aggregate ids from both regular streams + screen streams so we still
    // track peers that only have one of the two.
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

  // Create (or return) a peer connection keyed by the other user.
  const ensurePeer = useCallback((peerId: string, polite: boolean): RTCPeerConnection => {
    const existing = connectionsRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    connectionsRef.current.set(peerId, pc);

    // Attach local tracks
    const local = localStreamRef.current;
    if (local) {
      for (const track of local.getTracks()) pc.addTrack(track, local);
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
      // Discriminate screen-share tracks by transceiver mid or track label
      // — the remote advertises `sharing` via the state payload; we bucket
      // video tracks into screen vs camera based on remoteState.
      const remoteState = remoteStatesRef.current.get(peerId);
      const isScreenVideo =
        e.track.kind === "video" && !!remoteState?.sharing && (e.streams[0]?.id?.startsWith("screen-") || false);

      // Prefer the remote-supplied stream id heuristic. If the remote's
      // stream id matches the screen namespace we created (`screen-...`),
      // treat as screen; else treat as camera/audio.
      const streamId = e.streams[0]?.id ?? "";
      const goesToScreen = streamId.startsWith("screen-") || isScreenVideo;

      const bucket = goesToScreen ? remoteScreenStreamsRef : remoteStreamsRef;
      let stream = bucket.current.get(peerId);
      if (!stream) {
        stream = new MediaStream();
        bucket.current.set(peerId, stream);
      }
      stream.addTrack(e.track);

      // When the remote stops a track, drop it from our aggregated stream.
      e.track.onended = () => {
        const s = bucket.current.get(peerId);
        if (s) {
          try { s.removeTrack(e.track); } catch { /* noop */ }
          if (s.getTracks().length === 0) bucket.current.delete(peerId);
        }
        updatePeersState();
      };

      updatePeersState();
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        console.warn(`[huddle] peer ${peerId} disconnected`);
        pc.close();
        connectionsRef.current.delete(peerId);
        remoteStreamsRef.current.delete(peerId);
        remoteScreenStreamsRef.current.delete(peerId);
        remoteStatesRef.current.delete(peerId);
        screenSenderMapRef.current.delete(peerId);
        updatePeersState();
      }
    };

    // When the negotiation needs to refresh (e.g. screen share added /
    // removed), kick off a new offer if we are the impolite peer.
    pc.onnegotiationneeded = async () => {
      if (polite) {
        // Polite peer: notify impolite peer to start renegotiation.
        broadcast({ from: username, to: peerId, kind: "renegotiate" });
        return;
      }
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        broadcast({
          from: username,
          to: peerId,
          kind: "offer",
          sdp: pc.localDescription!.toJSON(),
        });
      } catch (err) {
        console.warn("[huddle] renegotiation failed:", err);
      }
    };

    // Negotiation — polite peer waits for the other to initiate.
    if (!polite) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          broadcast({
            from: username,
            to: peerId,
            kind: "offer",
            sdp: pc.localDescription!.toJSON(),
          });
        } catch (err) {
          console.error("[huddle] createOffer failed:", err);
        }
      })();
    }

    return pc;
  }, [broadcast, username, updatePeersState]);

  // ── Manage mic capture (start when joined, stop when not) ------------

  useEffect(() => {
    if (!joined) {
      if (localStreamRef.current) {
        for (const t of localStreamRef.current.getTracks()) t.stop();
      }
      localStreamRef.current = null;
      setLocalStream(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: camera,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        // Attach to any already-open peers
        for (const pc of connectionsRef.current.values()) {
          for (const track of stream.getTracks()) pc.addTrack(track, stream);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [joined, camera]);

  // Track mute state: enable/disable local audio track on toggle.
  useEffect(() => {
    const s = localStreamRef.current;
    if (!s) return;
    for (const t of s.getAudioTracks()) t.enabled = !muted;
    broadcast({ from: username, kind: "state", state: { muted, camera, sharing } });
  }, [muted, camera, sharing, broadcast, username]);

  // ── Screen share --------------------------------------------------------

  const stopScreenShare = useCallback(() => {
    const s = localScreenStreamRef.current;
    if (s) {
      for (const t of s.getTracks()) {
        try { t.stop(); } catch { /* noop */ }
      }
    }
    // Remove senders from every peer connection.
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
    broadcast({ from: username, kind: "state", state: { muted, camera, sharing: false } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast, camera, muted, username]);

  const startScreenShare = useCallback(async () => {
    try {
      // Ask for display media. `browser support`: returns a MediaStream
      // whose video tracks represent the chosen surface (screen/window/tab).
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      // Wrap in a fresh MediaStream we control so receivers can bucket
      // it as screen by inspecting the id prefix.
      const routedStream = new MediaStream();
      Object.defineProperty(routedStream, "id", {
        value: `screen-${crypto.randomUUID()}`,
      });
      for (const t of screenStream.getTracks()) routedStream.addTrack(t);

      localScreenStreamRef.current = routedStream;
      setLocalScreenStream(routedStream);
      setSharing(true);

      // Push tracks into every peer connection.
      for (const [peerId, pc] of connectionsRef.current.entries()) {
        const senders: RTCRtpSender[] = [];
        for (const track of routedStream.getTracks()) {
          const sender = pc.addTrack(track, routedStream);
          senders.push(sender);
        }
        screenSenderMapRef.current.set(peerId, senders);
      }

      // When the user stops sharing via the browser UI, clean up.
      routedStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopScreenShare();
      });

      broadcast({ from: username, kind: "state", state: { muted, camera, sharing: true } });
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") return;
      console.error("[huddle] startScreenShare failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast, camera, muted, username, stopScreenShare]);

  // ── Subscribe to the signalling channel ------------------------------

  useEffect(() => {
    if (!joined || !username) return;
    const channel = supabase.channel(`huddle:${group}`, {
      config: { presence: { key: username } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "huddle-signal" }, (evt) => {
        const msg = evt.payload as SignalPayload;
        if (!msg || !msg.from || msg.from === username) return;
        if (msg.to && msg.to !== username) return;

        if (msg.kind === "offer" && msg.sdp) {
          const pc = ensurePeer(msg.from, /* polite */ true);
          (async () => {
            try {
              await pc.setRemoteDescription(msg.sdp!);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              broadcast({
                from: username,
                to: msg.from,
                kind: "answer",
                sdp: pc.localDescription!.toJSON(),
              });
            } catch (err) {
              console.error("[huddle] answer failed:", err);
            }
          })();
        } else if (msg.kind === "answer" && msg.sdp) {
          const pc = connectionsRef.current.get(msg.from);
          if (pc) {
            pc.setRemoteDescription(msg.sdp).catch((err) =>
              console.error("[huddle] setRemote(answer) failed:", err),
            );
          }
        } else if (msg.kind === "ice" && msg.candidate) {
          const pc = connectionsRef.current.get(msg.from);
          if (pc) {
            pc.addIceCandidate(msg.candidate).catch((err) =>
              console.warn("[huddle] addIceCandidate failed:", err),
            );
          }
        } else if (msg.kind === "state" && msg.state) {
          remoteStatesRef.current.set(msg.from, msg.state);
          updatePeersState();
        } else if (msg.kind === "renegotiate") {
          // The polite peer asked us to start a new offer cycle.
          const pc = connectionsRef.current.get(msg.from);
          if (!pc) return;
          (async () => {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              broadcast({
                from: username,
                to: msg.from,
                kind: "offer",
                sdp: pc.localDescription!.toJSON(),
              });
            } catch (err) {
              console.warn("[huddle] renegotiate→offer failed:", err);
            }
          })();
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        // For every other participant, ensure a peer connection exists.
        // We use username comparison to decide who initiates (lex < = impolite).
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
        remoteStatesRef.current.delete(key);
        updatePeersState();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ muted, camera, sharing });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      for (const pc of connectionsRef.current.values()) pc.close();
      connectionsRef.current.clear();
      remoteStreamsRef.current.clear();
      remoteScreenStreamsRef.current.clear();
      remoteStatesRef.current.clear();
      screenSenderMapRef.current.clear();
      // Also stop any local screen share on unmount.
      const s = localScreenStreamRef.current;
      if (s) {
        for (const t of s.getTracks()) {
          try { t.stop(); } catch { /* noop */ }
        }
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
