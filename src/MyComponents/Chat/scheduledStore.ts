/**
 * scheduledStore — localStorage-backed queue of "send later" messages.
 *
 * Each item carries everything the inserter needs to drop the message
 * into the right table at the right time. A global tick in __root.tsx
 * polls every 30s and fires due items.
 *
 * No Zustand — this is purely IO, the in-flight state is owned by the
 * user's browser localStorage. Survives reloads.
 */

const STORAGE_KEY = "cwa-scheduled-messages";

export interface ScheduledMessage {
  id: string;
  /** ISO timestamp of when to send. */
  dueAt: string;
  table: "cwa_chat" | "cwa_dm_chat";
  group: string;              // "General" or dm_group
  payload: Record<string, unknown>;
  createdBy: string;          // username — so only the author can cancel
  preview: string;            // short preview for UI
}

function read(): ScheduledMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScheduledMessage[];
  } catch {
    return [];
  }
}

function write(items: ScheduledMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cwa-scheduled-changed"));
  } catch (err) {
    console.warn("[scheduled] write failed:", err);
  }
}

export function listScheduled(): ScheduledMessage[] {
  return read();
}

export function listScheduledForGroup(group: string): ScheduledMessage[] {
  return read().filter((m) => m.group === group);
}

export function addScheduled(msg: Omit<ScheduledMessage, "id">): ScheduledMessage {
  const item: ScheduledMessage = {
    ...msg,
    id: crypto.randomUUID(),
  };
  const items = read();
  items.push(item);
  write(items);
  return item;
}

export function removeScheduled(id: string): void {
  const items = read().filter((m) => m.id !== id);
  write(items);
}

/** Return any items due on or before `now` (default Date.now). Does NOT
 *  remove them — caller must call removeScheduled after successful send. */
export function dueScheduled(now = Date.now()): ScheduledMessage[] {
  return read().filter((m) => new Date(m.dueAt).getTime() <= now);
}
