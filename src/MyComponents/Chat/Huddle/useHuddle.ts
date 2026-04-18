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
  muted: boolean;
  camera: boolean;
}

interface SignalPayload {
  from: string;
  to?: string;
  kind: "offer" | "answer" | "ice" | "state";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  state?: { muted: boolean; camera: boolean };
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
  error: string | null;
}

export function useHuddle({ group, username, joined, muted, camera }: UseHuddleOpts): UseHuddleResult {
  const [peers, setPeers] = useState<HuddlePeer[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const connectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteStatesRef = useRef<Map<string, { muted: boolean; camera: boolean }>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // ── helpers -----------------------------------------------------------

  const updatePeersState = useCallback(() => {
    const out: HuddlePeer[] = [];
    for (const [id, stream] of remoteStreamsRef.current.entries()) {
      const st = remoteStatesRef.current.get(id);
      out.push({
        id,
        stream,
        muted: st?.muted ?? false,
        camera: st?.camera ?? false,
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
      let stream = remoteStreamsRef.current.get(peerId);
      if (!stream) {
        stream = new MediaStream();
        remoteStreamsRef.current.set(peerId, stream);
      }
      stream.addTrack(e.track);
      updatePeersState();
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        console.warn(`[huddle] peer ${peerId} disconnected`);
        pc.close();
        connectionsRef.current.delete(peerId);
        remoteStreamsRef.current.delete(peerId);
        remoteStatesRef.current.delete(peerId);
        updatePeersState();
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
    broadcast({ from: username, kind: "state", state: { muted, camera } });
  }, [muted, camera, broadcast, username]);

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
          channel.track({ muted, camera });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      for (const pc of connectionsRef.current.values()) pc.close();
      connectionsRef.current.clear();
      remoteStreamsRef.current.clear();
      remoteStatesRef.current.clear();
      setPeers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, group, username]);

  return { peers, localStream, error };
}
