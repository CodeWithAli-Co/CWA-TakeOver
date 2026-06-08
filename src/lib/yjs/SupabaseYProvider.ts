/**
 * SupabaseYProvider.ts — Custom Y.js provider that uses Supabase
 * Realtime broadcast channels as the transport.
 *
 * Why this exists:
 *   Y.js is the CRDT we use for collaborative editing. The standard
 *   transports (y-websocket, y-webrtc) all require either a separate
 *   server we'd have to host, or NAT-traversal pain. Supabase Realtime
 *   is already wired up everywhere else in the app and supports
 *   bidirectional broadcast over a channel — perfect fit, no extra
 *   infra to deploy.
 *
 * Wire protocol (all payloads are base64-encoded Uint8Array):
 *   · doc-update   — incremental Y.Doc update from a client
 *   · awareness    — incremental Y.Awareness update (cursor, selection)
 *   · sync-request — sent on first subscribe, asks existing clients
 *                    to share their full Y.Doc state so we catch up
 *
 * Sync flow:
 *   1. New client subscribes → broadcasts sync-request
 *   2. Any client already in the room responds with a doc-update
 *      carrying Y.encodeStateAsUpdate(doc) — the full current state
 *   3. New client applies, marks itself synced
 *   4. From that point on, both clients exchange incremental updates
 *      via the doc-update event
 *
 * Awareness mirrors the same pattern: changes broadcast as encoded
 * updates, peers apply them on receive.
 */

import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { companySupabase } from "@/routes/index.lazy";

type Listener = () => void;

export class SupabaseYProvider {
  /** The Y document being synced. */
  readonly doc: Y.Doc;
  /** The Awareness instance — exposed so CollaborationCursor can read it. */
  readonly awareness: Awareness;
  /** Becomes true once we've either received state or timed out waiting. */
  synced = false;

  private channel: RealtimeChannel;
  private channelName: string;
  private destroyed = false;
  private syncListeners = new Set<Listener>();
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(doc: Y.Doc, channelName: string) {
    this.doc = doc;
    this.awareness = new Awareness(doc);
    this.channelName = `workspace-yjs:${channelName}`;

    this.channel = companySupabase.channel(this.channelName, {
      config: {
        broadcast: {
          // We don't want our own broadcasts echoed back — Y.js already
          // emits the update locally before we ever serialize.
          self: false,
          ack: false,
        },
      },
    });

    // ── Inbound: doc updates ────────────────────────────────────
    this.channel.on("broadcast", { event: "doc-update" }, ({ payload }: any) => {
      if (this.destroyed) return;
      try {
        const bytes = b64ToBytes(payload?.data ?? "");
        Y.applyUpdate(this.doc, bytes, this);
        // Receiving any update means at least one peer is alive —
        // mark ourselves synced so the editor doesn't keep waiting.
        this.markSynced();
      } catch (e) {
        console.warn("[SupabaseYProvider] bad doc-update payload:", e);
      }
    });

    // ── Inbound: awareness updates ──────────────────────────────
    this.channel.on("broadcast", { event: "awareness" }, ({ payload }: any) => {
      if (this.destroyed) return;
      try {
        applyAwarenessUpdate(this.awareness, b64ToBytes(payload?.data ?? ""), this);
      } catch (e) {
        console.warn("[SupabaseYProvider] bad awareness payload:", e);
      }
    });

    // ── Inbound: sync requests from new joiners ─────────────────
    this.channel.on("broadcast", { event: "sync-request" }, () => {
      if (this.destroyed) return;
      try {
        const fullState = Y.encodeStateAsUpdate(this.doc);
        this.channel.send({
          type: "broadcast",
          event: "doc-update",
          payload: { data: bytesToB64(fullState) },
        });
      } catch (e) {
        console.warn("[SupabaseYProvider] sync-request response failed:", e);
      }
    });

    // ── Local listeners ─────────────────────────────────────────
    this.doc.on("update", this.handleLocalDocUpdate);
    this.awareness.on("update", this.handleLocalAwarenessUpdate);

    // ── Subscribe + send sync-request ───────────────────────────
    this.channel.subscribe(async (status) => {
      if (this.destroyed) return;
      if (status !== "SUBSCRIBED") return;
      try {
        await this.channel.send({
          type: "broadcast",
          event: "sync-request",
          payload: {},
        });
      } catch (e) {
        console.warn("[SupabaseYProvider] sync-request send failed:", e);
      }
      // If no peer answers within 800ms, assume we're the only client
      // and consider ourselves synced. The room can still receive
      // updates from late joiners later.
      this.syncTimeout = setTimeout(() => this.markSynced(), 800);
    });
  }

  onSynced(fn: Listener): () => void {
    if (this.synced) {
      // Fire async to keep semantics consistent with the not-yet-synced path
      Promise.resolve().then(fn);
      return () => {};
    }
    this.syncListeners.add(fn);
    return () => this.syncListeners.delete(fn);
  }

  /** Sets cursor color + display name on awareness so peers can render us. */
  setUser(user: { name: string; color: string }) {
    this.awareness.setLocalStateField("user", user);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.doc.off("update", this.handleLocalDocUpdate);
    this.awareness.off("update", this.handleLocalAwarenessUpdate);
    // Tell peers we're gone so they remove our cursor.
    try {
      removeAwarenessStates(this.awareness, [this.doc.clientID], this);
    } catch { /* noop */ }
    try {
      this.channel.unsubscribe();
    } catch { /* noop */ }
    this.syncListeners.clear();
  }

  // ── private ─────────────────────────────────────────────────

  private markSynced() {
    if (this.synced) return;
    this.synced = true;
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    for (const fn of this.syncListeners) {
      try { fn(); } catch (e) { console.error("[SupabaseYProvider] listener threw:", e); }
    }
    this.syncListeners.clear();
  }

  private handleLocalDocUpdate = (update: Uint8Array, origin: any) => {
    if (origin === this || this.destroyed) return;
    this.channel.send({
      type: "broadcast",
      event: "doc-update",
      payload: { data: bytesToB64(update) },
    });
  };

  private handleLocalAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: any,
  ) => {
    if (origin === this || this.destroyed) return;
    const changedClients = [...added, ...updated, ...removed];
    if (changedClients.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, changedClients);
    this.channel.send({
      type: "broadcast",
      event: "awareness",
      payload: { data: bytesToB64(update) },
    });
  };
}

// ── base64 ⇄ Uint8Array (no Buffer dep, runs in browser + Tauri WV) ─
export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  // chunk to avoid call-stack overflow on very large Uint8Arrays
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)) as any,
    );
  }
  return btoa(s);
}

export function b64ToBytes(b64: string): Uint8Array {
  if (!b64) return new Uint8Array(0);
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
