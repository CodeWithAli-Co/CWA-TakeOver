# Invoicer + Chat + Background Notifications + Weekly Quotas Revamp

Comprehensive documentation of the four-phase overhaul that consolidated the invoicer, rebuilt the chat system, added true background notifications via system tray, and restyled the weekly quotas page with productivity features.

---

## Table of Contents

1. [Overview](#overview)
2. [Required Schema Migrations](#required-schema-migrations)
3. [Phase 1 — Invoicer (Single Unified Page)](#phase-1--invoicer-single-unified-page)
4. [Phase 2 — Chat System Revamp](#phase-2--chat-system-revamp)
5. [Phase 3 — Background Notifications + System Tray](#phase-3--background-notifications--system-tray)
6. [Phase 4 — Weekly Quotas Page](#phase-4--weekly-quotas-page)
7. [Files Changed Summary](#files-changed-summary)
8. [Verification + Testing](#verification--testing)

---

## Overview

This was a major coordinated revamp touching four feature areas, designed to:
- **Reduce route fragmentation** (invoicer was 4 routes → now 1)
- **Add modern collaboration features to chat** (reactions, replies, typing indicators, read receipts)
- **Make notifications work when window is closed** (system tray + close-to-tray)
- **Modernize weekly quotas** with Kanban view, priority levels, week-over-week comparison

All UI work follows the established **Void design language** — pure black background, `bg-[#0a0a0a]` cards with `border-white/[0.04]`, red-500 accents, `rounded-sm` everywhere, white-opacity text hierarchy.

---

## Required Schema Migrations

Before deploying, run these additive Supabase migrations. **All changes are non-destructive** — old rows continue to work.

### Invoices — dynamic line items
```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb;
```

### Chat — reactions, replies, read receipts
```sql
-- Reactions: { "👍": ["alice", "bob"], "❤️": ["carol"] }
ALTER TABLE cwa_chat ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}'::jsonb;
ALTER TABLE cwa_dm_chat ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}'::jsonb;

-- Read receipts: ["alice", "bob"] — usernames who have read this message
ALTER TABLE cwa_chat ADD COLUMN IF NOT EXISTS read_by jsonb DEFAULT '[]'::jsonb;
ALTER TABLE cwa_dm_chat ADD COLUMN IF NOT EXISTS read_by jsonb DEFAULT '[]'::jsonb;

-- Reply target: msg_id of the message this is replying to
ALTER TABLE cwa_chat ADD COLUMN IF NOT EXISTS reply_to bigint;
ALTER TABLE cwa_dm_chat ADD COLUMN IF NOT EXISTS reply_to bigint;
```

### Quotas — priority and carryover tracking
```sql
ALTER TABLE weekly_quotas ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE weekly_quotas ADD COLUMN IF NOT EXISTS carried_from_week text;
```

---

## Phase 1 — Invoicer (Single Unified Page)

### What changed
The old invoicer was spread across **4 separate routes** with sliding Sheet panels and a global variable hack (`myInv`) for passing invoice data between routes. It was consolidated into **one route** with three coordinated panes and a centered modal for input.

### Files deleted
| File | Why |
|------|-----|
| `src/routes/invoiceClients.lazy.tsx` | Client list moved into ClientSidebar component |
| `src/routes/middle.lazy.tsx` | Intermediate route was a hack to pass data via global var |
| `src/routes/invoicePreview.lazy.tsx` | PDF preview now embedded in InvoicePreviewPane |
| `src/MyComponents/subForms/InvoiceForms/createInvoice.tsx` | Replaced by InvoiceFormDialog |

### Files created (in `src/MyComponents/Invoicer/`)

#### `ClientSidebar.tsx`
Left pane (260px wide). Lists all clients with search. Inline collapsible "Add Client" form replaces the slide-in Sheet — feels less janky.

**Key logic:**
- Pulls clients via `Clients()` query from `invoiceQuery.ts`
- Filters via local `searchQuery` state
- Selecting a client calls `setName()` + `setEmail()` on `useClientStore` Zustand store
- Inline form uses TanStack Form, inserts directly to `clients` table, then refetches

#### `InvoiceList.tsx`
Middle pane. Shows all invoices for the selected client. Features:
- **Quick stats strip** at top: total count, paid total, pending total
- **Search box** to filter by title or invoice ID
- **Status badge** per row (paid = emerald, pending = red)
- **Hover-revealed actions**: preview eye, email button (uses existing `EmailBtn`)
- **Status accent bar** on left edge of each row (color matches status)

#### `InvoiceFormDialog.tsx` — the big one
Centered modal dialog (replaces sliding Sheet) with **dynamic line items**.

**State management** — uses local `useState` (no library):
```typescript
const [lineItems, setLineItems] = useState<LineItem[]>([
  { name: "", qty: 1, price: 0, total: 0 },
]);
```

**Add/remove logic:**
```typescript
const addLine = () => setLineItems((prev) => [...prev, { name: "", qty: 1, price: 0, total: 0 }]);
const removeLine = (i: number) =>
  setLineItems((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
```

**Live total calculation** — every keystroke recalculates:
```typescript
const updateLine = (i: number, patch: Partial<LineItem>) => {
  setLineItems((prev) => prev.map((item, idx) => {
    if (idx !== i) return item;
    const updated = { ...item, ...patch };
    updated.total = Number(updated.qty) * Number(updated.price);
    return updated;
  }));
};

const subtotal = lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
const outcome = subtotal + Number(adjustment || 0) - Number(discount || 0);
```

**Backward compatibility on submit** — writes both new `line_items` JSON column AND the legacy `item_1/2/3` columns (so the first 3 items appear in any old code that reads the legacy columns):
```typescript
const legacyFields: Record<string, any> = {};
for (let i = 0; i < 3; i++) {
  const item = lineItems[i];
  const idx = i + 1;
  legacyFields[`item_${idx}`] = item?.name || "";
  legacyFields[`qty_${idx}`] = item?.qty || 0;
  legacyFields[`price_${idx}`] = item?.price || 0;
  legacyFields[`total_${idx}`] = item?.total || 0;
}

await supabase.from("invoices").insert({
  ...legacyFields,
  line_items: lineItems.filter((l) => l.name),
  // ... rest
});
```

#### `InvoicePreviewPane.tsx`
Right pane (480px). Slides in when an invoice is selected. Shows the PDF inline using `<PDFViewer>` from `@react-pdf/renderer`. Has a Download button in the header that triggers `downloadInvoice()`.

**Key logic:**
- Calls `ClientInvoice(invoiceId)` query to fetch the full invoice row
- Passes the invoice to `<Invoice>` component (the PDF Document)
- Replaces the old `/middle` → `/invoicePreview` navigation hack

### Files modified

#### `src/routes/invoicer.lazy.tsx` (full rewrite)
Now an 80-line orchestrator. Manages two pieces of state: `selectedInvoiceId` and `showCreateForm`. Uses CSS grid that animates between 2-pane and 3-pane layouts:
```jsx
<div style={{
  gridTemplateColumns: selectedInvoiceId
    ? "260px minmax(0, 1fr) 480px"
    : "260px minmax(0, 1fr)",
  transition: "grid-template-columns 300ms ease",
}}>
```

#### `src/MyComponents/invoice.tsx` (PDF generation)
Restyled and refactored:
- **No longer relies on global `myInv` variable** — accepts invoice as a prop
- Uses `getLineItems()` helper to handle BOTH the new `line_items` column AND legacy `item_1/2/3` fields automatically
- Renders dynamic table rows: `lineItems.map((item, i) => <View>...</View>)`
- `downloadInvoice(invoice, filename)` now takes invoice as a parameter

#### `src/stores/invoiceQuery.ts`
- Added `LineItem` interface
- Made `item_1/2/3` fields optional on `InvoiceType` (since new invoices can use `line_items`)
- Added `getLineItems(inv)` helper:
```typescript
export function getLineItems(inv: InvoiceType): LineItem[] {
  if (inv.line_items && inv.line_items.length > 0) return inv.line_items;
  // Fall back to legacy columns
  const items: LineItem[] = [];
  for (let i = 1; i <= 3; i++) {
    const name = (inv as any)[`item_${i}`];
    if (name) items.push({
      name,
      qty: (inv as any)[`qty_${i}`] || 0,
      price: (inv as any)[`price_${i}`] || 0,
      total: (inv as any)[`total_${i}`] || 0,
    });
  }
  return items;
}
```

#### `src/MyComponents/Reusables/emailBtn.tsx`
Removed the `/middle` navigation hack. Now fetches the invoice directly via Supabase, builds the PDF, sends it. No more 5-second delays.

#### `src/components/ui/Dashboard/role-datas.tsx`
Flattened the "Invoicer → Client / Preview" dropdown to a single "Invoicer" link → `/invoicer`. Applied across all 4 roles that have it (Project Manager, Security Engineer, COO, CEO).

---

## Phase 2 — Chat System Revamp

### What changed
The 611-line `chat.lazy.tsx` monolith was broken into 9 focused components in `MyComponents/Chat/`. Added all four requested features: **unread badges, message reactions, replies/threads, typing indicators + read receipts**.

### Files created (in `src/MyComponents/Chat/`)

#### `UnreadBadge.tsx`
Small reusable red badge component. Caps at "99+". Returns `null` if count is 0.

#### `TypingIndicator.tsx`
Renders "X is typing..." + 3 animated dots. Pulls typing state from `chatStore.typingByGroup`. Filters out the current user and expired entries.

#### `ReactionPicker.tsx`
8 quick-pick emojis (`👍 ❤️ 😂 🎉 🔥 👀 🙏 💯`) in a horizontal popover. Calls `onPick(emoji)` callback.

#### `MessageBubble.tsx`
The big one. Renders a single message with:
- **Hover-revealed action bar** (right edge): React, Reply, More
- **Message grouping**: consecutive messages from same user within 5 minutes hide the avatar+name
- **Reply preview**: if `msg.reply_to` is set, shows clickable quote of the original message above
- **Reactions row**: each emoji shown as a clickable pill with count, highlighted if current user reacted
- **Read receipts** (own messages only): "Read by N people" with check mark

**Grouping logic:**
```typescript
const isGrouped = prevMsg
  && prevMsg.sent_by === msg.sent_by
  && (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 5 * 60 * 1000;
```

#### `MessageList.tsx`
Scrollable feed wrapper. Auto-scrolls on new messages, marks group as read when viewed, marks individual messages as read in Supabase via `read_by` array.

**React toggle logic:**
```typescript
const handleReact = async (msgId: number, emoji: string) => {
  const msg = messages.find((m) => m.msg_id === msgId);
  const reactions = { ...(msg.reactions || {}) };
  const users = reactions[emoji] || [];
  if (users.includes(currentUsername)) {
    // Remove reaction
    reactions[emoji] = users.filter((u) => u !== currentUsername);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  } else {
    // Add reaction
    reactions[emoji] = [...users, currentUsername];
  }
  await supabase.from(table).update({ reactions }).eq("msg_id", msgId);
};
```

#### `MessageComposer.tsx`
Bottom input area. Features:
- **Reply quote pill** appears at top when `replyingTo` is set in store
- **Auto-resize textarea**, Enter to send, Shift+Enter for newline
- **Typing indicator broadcast** via Supabase Realtime presence (no schema needed)

**Typing presence setup:**
```typescript
const channel = supabase.channel(`typing-${group}`, {
  config: { presence: { key: currentUsername } },
});
channel.on("presence", { event: "sync" }, () => {
  const state = channel.presenceState();
  const typers = []; // build from state, filter expired
  setTyping(group, typers);
}).subscribe();

// On input
typingChannelRef.current.track({
  typing: val.length > 0,
  expiresAt: Date.now() + 5000,
});
```

#### `ChatHeader.tsx`
Title bar. Shows hash icon for General channel or avatar for DMs, group name, member count, search/pin/more buttons.

#### `ChatSidebar.tsx`
Left pane (288px). Lists all conversations with search. Each conversation shows:
- Hash icon (General) or avatar (DMs)
- Group name (bolder if unread)
- Member count or "Company-wide"
- **`<UnreadBadge>` on the right** showing per-group unread count
- Selecting a group calls `markRead(group)` to clear that group's badge

#### `ChatLayout.tsx`
Top-level layout (replaces 611 lines of chat.lazy.tsx). Just composes:
```jsx
<ChatSidebar groups={...} employees={...} />
<div className="flex-1 flex flex-col">
  <ChatHeader ... />
  <MessageList ... />
  <MessageComposer ... />
</div>
```

### Store created

#### `src/stores/chatStore.ts`
Zustand store with `persist` middleware. Stores:
- `unreadCounts: { [group]: number }` — persisted to localStorage
- `lastReadAt: { [group]: ISO string }` — persisted
- `replyingTo` — transient, the message being replied to in the composer
- `typingByGroup` — transient, populated by Supabase presence

```typescript
export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({ /* ... */ }),
    {
      name: "cwa-chat-store",
      partialize: (state) => ({
        unreadCounts: state.unreadCounts,
        lastReadAt: state.lastReadAt,
      }), // only persist these two fields
    }
  )
);
```

The `partialize` is critical — it tells Zustand to only save the long-lived counters to localStorage, not the transient typing/reply state.

### Sidebar nav badge

`src/components/ui/Dashboard/nav-main.tsx` modified to:
1. Import `useChatStore` and `UnreadBadge`
2. Subscribe to total unread count: `const totalUnread = useChatStore((s) => Object.values(s.unreadCounts).reduce((sum, n) => sum + n, 0))`
3. Render `<UnreadBadge count={totalUnread} />` next to the Chat icon (only if title === "Chat")

### Real-time message tracking (the wiring)

`src/routes/__root.tsx` subscribes to all message INSERTs and:
- Skips messages from the current user
- If user is NOT viewing that group, calls `incrementUnread(group)` and fires an OS notification

```typescript
const unreadChannel = supabase
  .channel("unread-tracker")
  .on("postgres_changes",
    { event: "INSERT", schema: "public", table: "cwa_dm_chat" },
    (payload) => {
      const groupName = payload.new.dm_group;
      const sentBy = payload.new.sent_by;
      if (sentBy === currentUsername) return;
      if (GroupName !== groupName) {
        incrementUnread(groupName);
        sendNotification({
          title: `New message in ${groupName}`,
          body: `${sentBy}: ${payload.new.message}`,
        });
      }
    }
  )
  // ... same for cwa_chat (General)
  .subscribe();
```

### Files modified

| File | Change |
|------|--------|
| `src/routes/chat.lazy.tsx` | Slimmed to 18 lines, just renders `<ChatLayout />` |
| `src/stores/query.ts` | Added `MessageReactions` type + extended `MessageInterface` with `reply_to`, `reactions`, `read_by` |
| `src/components/ui/Dashboard/nav-main.tsx` | Wires `UnreadBadge` to Chat nav item |
| `src/routes/__root.tsx` | Replaced old per-group notification logic with unread-tracker channel |

---

## Phase 3 — Background Notifications + System Tray

### What this actually does

> **Important caveat:** True "app process is fully terminated → still receive push" requires platform-specific push services (FCM for Android, APNS for iOS, Web Push API). That's out of scope for a Tauri desktop app.
>
> What this implementation gives you:
> - Close window → app **hides to system tray** instead of quitting
> - Tray icon stays running, Supabase realtime channel keeps firing
> - OS notifications continue to appear normally
> - Unread badges persist via localStorage even after a full restart
> - With autostart enabled, app launches on system boot and goes straight to tray
>
> User's experience: clicking the X to close the app no longer means "no notifications". They have to actively quit via tray menu to fully stop.

### Files modified

#### `src-tauri/Cargo.toml`
Added `tauri-plugin-autostart = "2"` to the desktop-targets dependencies block.

#### `src-tauri/src/lib.rs` — the heavy lifter

**New imports + global state:**
```rust
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

// Global flag — when true, app fully exits on window close.
// Default false → window close hides to tray.
static SHOULD_EXIT: AtomicBool = AtomicBool::new(false);
```

**Why `AtomicBool`?** Because both the window-close handler and the tray "Quit" handler need to coordinate, and they run on different threads. `AtomicBool` with `Ordering::SeqCst` is the simplest thread-safe primitive.

**New `quit_app` command** (callable from JS):
```rust
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    SHOULD_EXIT.store(true, Ordering::SeqCst);
    app.exit(0);
}
```

This is what the "Quit App Fully" button calls. Sets the flag, then exits — the window-close handler sees the flag and lets the app die.

**Autostart plugin registration:**
```rust
.plugin(tauri_plugin_autostart::init(
    MacosLauncher::LaunchAgent,
    None, // no extra args
))
```

`MacosLauncher::LaunchAgent` is the macOS-specific launcher type. On Windows it uses the registry, on Linux it uses `.desktop` files. The plugin abstracts this so the JS-side `enable()` / `disable()` calls work the same way everywhere.

**System tray setup** (inside the `setup` closure):
```rust
.setup(|app| {
    // Build the menu — Open and Quit items
    let open_item = MenuItem::with_id(app, "open", "Open Window", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let tray_menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&tray_menu)
        .show_menu_on_left_click(false) // left-click toggles window instead
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.unminimize();
                }
            }
            "quit" => {
                SHOULD_EXIT.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click → toggle window visibility
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    // Window starts hidden in tauri.conf.json (visible: false)
    // so we explicitly show it on first launch
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
    }

    Ok(())
})
```

**Window-close interception** — the most important piece:
```rust
.on_window_event(|window, event| {
    if let WindowEvent::CloseRequested { api, .. } = event {
        if !SHOULD_EXIT.load(Ordering::SeqCst) {
            api.prevent_close();  // ← cancel the close
            let _ = window.hide(); // ← hide instead
        }
    }
})
```

**How this works step-by-step:**
1. User clicks the X button on the window
2. Tauri fires `WindowEvent::CloseRequested`
3. Our handler reads the `SHOULD_EXIT` flag — it's `false` by default
4. We call `api.prevent_close()` to cancel the OS-level close
5. We call `window.hide()` to remove it from screen
6. The Tauri process keeps running. Supabase channels keep firing. Notifications continue.
7. To fully quit: user right-clicks the tray icon → "Quit" → handler sets `SHOULD_EXIT = true` → calls `app.exit(0)`. This time around, the close handler sees the flag is true and doesn't intervene, so the process actually dies.

#### `src-tauri/capabilities/default.json`
Added permissions needed for the new tray and window operations:
```json
{
  "permissions": [
    "core:default",
    "core:tray:default",                  // NEW — tray icon
    "core:window:allow-show",             // NEW — window.show() from menu
    "core:window:allow-hide",             // NEW — window.hide() from close
    "core:window:allow-set-focus",        // NEW — window.set_focus()
    "core:window:allow-unminimize",       // NEW
    "core:window:allow-is-visible",       // NEW — toggle logic
    "autostart:default",                  // NEW — autostart plugin
    // ... existing permissions
  ]
}
```

#### `package.json`
Added `@tauri-apps/plugin-autostart` (npm-side companion to the Rust plugin). Installed via `npm install @tauri-apps/plugin-autostart --legacy-peer-deps`.

### Frontend — `NotificationSettings.tsx`

A user-facing settings card with toggles. Created at `src/MyComponents/Settings/NotificationSettings.tsx`.

**State:**
```typescript
interface NotificationPrefs {
  enableNotifications: boolean;
  enableSound: boolean;
  enableAutostart: boolean;
}
```

Persisted to `localStorage` under key `cwa-notification-prefs`.

**Autostart toggle** — calls into the JS-side plugin which talks to Rust:
```typescript
const toggleAutostart = async () => {
  const { enable, disable } = await import("@tauri-apps/plugin-autostart");
  if (prefs.enableAutostart) {
    await disable();
  } else {
    await enable();
  }
};
```

**On mount, syncs from system state:**
```typescript
useEffect(() => {
  const { isEnabled } = await import("@tauri-apps/plugin-autostart");
  const enabled = await isEnabled();
  setPrefs((p) => ({ ...p, enableAutostart: enabled }));
}, []);
```

**Quit Fully button** — invokes the Rust command:
```typescript
const handleQuitFully = async () => {
  await invoke("quit_app");
};
```

**Info banner** explaining the close-to-tray behavior to users so they're not confused why the app didn't quit when they clicked X.

---

## Phase 4 — Weekly Quotas Page

### What changed
The full-page `WeeklyQuota.tsx` (622 lines, amber/zinc theme) was completely rewritten with the Void theme and several productivity features added.

### File modified
`src/MyComponents/WeeklyQuota.tsx` (full rewrite, ~520 lines)

### New features

#### 1. Progress bar at top
Animated bar showing weekly completion %:
```jsx
<motion.div
  initial={{ width: 0 }}
  animate={{ width: `${completionPct}%` }}
  transition={{ duration: 0.6, ease: "easeOut" }}
  className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full"
/>
```

#### 2. Week-over-week comparison
Loads previous week's quotas separately, calculates delta:
```typescript
const lastTotal = lastWeekQuotas.length;
const lastCompleted = lastWeekQuotas.filter((q) => q.status === "completed").length;
const lastPct = lastTotal > 0 ? (lastCompleted / lastTotal) * 100 : 0;
const pctDelta = completionPct - lastPct;
```
Displays as `+15%` (emerald) or `-10%` (red) badge.

#### 3. View toggle: List ↔ Kanban
Local state `view: "list" | "kanban"` switches between:
- **List view**: vertical list of `<QuotaItem>` rows (similar to before)
- **Kanban view**: 3 columns (Pending / Active / Done) of `<KanbanCard>` components, each with a "Move →" button that advances the status

```jsx
{view === "list" ? (
  filtered.map((q) => <QuotaItem ... />)
) : (
  // 3-column grid
  ["pending", "in-progress", "completed"].map((status) => (
    <div className="bg-[#0a0a0a] border border-white/[0.04]">
      {filtered.filter(q => q.status === status).map(q => <KanbanCard ... />)}
    </div>
  ))
)}
```

#### 4. Priority levels
Added `priority: "low" | "medium" | "high"` to the schema. UI shows a colored pill on each quota:
```typescript
const priorityColors = {
  high: "bg-red-500/[0.08] text-red-400 border-red-500/15",
  medium: "bg-amber-500/[0.06] text-amber-400/80 border-amber-500/10",
  low: "bg-white/[0.04] text-white/40 border-white/[0.06]",
};
```

#### 5. Carryover indicator
If `carried_from_week` is set on a quota (meaning it was brought from the previous week), shows a `↻ carried over` badge.

#### 6. Status filter pills with live counts
```jsx
{["all", "pending", "in-progress", "completed"].map((s) => (
  <button onClick={() => setStatusFilter(s)}>
    {label} ({counts[s]})
  </button>
))}
```

#### 7. Week navigation
Compact pill button group: `[<] [Today] [>]` instead of three separate buttons.

#### 8. Empty state
When no quotas exist or filter returns nothing, shows centered icon + message + helpful CTA.

### Form dialog updated
`<QuotaFormDialog>` now has a Priority dropdown alongside Status, both restyled with Void theme.

---

## Files Changed Summary

### Created
| Path | Purpose |
|------|---------|
| `src/MyComponents/Invoicer/ClientSidebar.tsx` | Left pane — clients list |
| `src/MyComponents/Invoicer/InvoiceList.tsx` | Middle pane — invoices for client |
| `src/MyComponents/Invoicer/InvoiceFormDialog.tsx` | Modal — dynamic line items |
| `src/MyComponents/Invoicer/InvoicePreviewPane.tsx` | Right pane — embedded PDF |
| `src/MyComponents/Chat/UnreadBadge.tsx` | Reusable count badge |
| `src/MyComponents/Chat/TypingIndicator.tsx` | "X is typing" |
| `src/MyComponents/Chat/ReactionPicker.tsx` | Emoji picker |
| `src/MyComponents/Chat/MessageBubble.tsx` | Single message + reactions + replies |
| `src/MyComponents/Chat/MessageList.tsx` | Scrollable feed |
| `src/MyComponents/Chat/MessageComposer.tsx` | Input area |
| `src/MyComponents/Chat/ChatHeader.tsx` | Active chat title bar |
| `src/MyComponents/Chat/ChatSidebar.tsx` | Conversations list |
| `src/MyComponents/Chat/ChatLayout.tsx` | Main 2-pane layout |
| `src/MyComponents/Settings/NotificationSettings.tsx` | Notification + autostart UI |
| `src/stores/chatStore.ts` | Unread counts, typing, reply state |

### Modified
| Path | What |
|------|------|
| `src/routes/invoicer.lazy.tsx` | Full rewrite — 3-pane layout |
| `src/routes/chat.lazy.tsx` | Slimmed to 18 lines |
| `src/routes/__root.tsx` | Replaced notification logic with unread-tracker |
| `src/MyComponents/invoice.tsx` | Removed global var, accepts invoice as prop, dynamic line items |
| `src/MyComponents/WeeklyQuota.tsx` | Full rewrite — Void theme + Kanban + priority + comparison |
| `src/MyComponents/Reusables/emailBtn.tsx` | Removed `/middle` hack, fetches invoice directly |
| `src/stores/invoiceQuery.ts` | Added `LineItem`, `getLineItems()`, `line_items` field |
| `src/stores/query.ts` | Extended `MessageInterface` with reactions/replies/read_by |
| `src/components/ui/Dashboard/role-datas.tsx` | Flattened Invoicer dropdown to single link |
| `src/components/ui/Dashboard/nav-main.tsx` | Wired chat unread badge |
| `src-tauri/Cargo.toml` | Added `tauri-plugin-autostart` |
| `src-tauri/src/lib.rs` | Tray icon + window close handler + autostart + quit_app command |
| `src-tauri/capabilities/default.json` | Added tray + window + autostart permissions |
| `package.json` | Added `@tauri-apps/plugin-autostart` |

### Deleted
| Path | Why |
|------|-----|
| `src/routes/invoiceClients.lazy.tsx` | Merged into ClientSidebar |
| `src/routes/middle.lazy.tsx` | Hack route — no longer needed |
| `src/routes/invoicePreview.lazy.tsx` | Now embedded in InvoicePreviewPane |
| `src/MyComponents/subForms/InvoiceForms/createInvoice.tsx` | Replaced by InvoiceFormDialog |

---

## Verification + Testing

### Type checking
```bash
cd "c:/Dev/Python GitHub/CWA-Manager"
npx tsc --noEmit
```
Zero new errors introduced by these changes. All errors in the output are pre-existing in unrelated files (`logs.tsx`, `Scheduling/`, `bluePinPage`, etc.).

### Dev server
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:1420
# Should return 200
```

### Manual testing checklist

**Invoicer (`/invoicer`):**
- [ ] Click a client in left pane → middle pane shows their invoices
- [ ] Click "Create Invoice" → modal opens
- [ ] Click "+ Add Line" → new row appears
- [ ] Type in qty/price → total updates live, footer total updates
- [ ] Click trash on a line → row disappears (cannot delete last row)
- [ ] Submit → invoice appears in middle pane
- [ ] Click an invoice row → preview pane slides in on right
- [ ] Click X in preview → pane slides out
- [ ] Click "Add Client" + symbol → inline form expands at top of left pane

**Chat (`/chat`):**
- [ ] Send a message → appears in feed
- [ ] Hover a message → reaction/reply/more buttons appear on right
- [ ] Click smile icon → 8 emojis appear → click one → reaction pill appears below message
- [ ] Click reaction pill again → it disappears (toggle)
- [ ] Click reply icon → quote pill appears in composer
- [ ] Send → message appears with reply quote above
- [ ] Click reply quote on a message → scrolls to original
- [ ] Open from another account/browser → start typing → original sees "X is typing..." with dots
- [ ] Sidebar nav: when on another page and someone sends a chat message → red badge appears on Chat icon with count

**Notifications + Tray (Tauri build only — not visible in dev browser):**
- [ ] Launch app → window appears, tray icon visible in system tray
- [ ] Click X to close window → window disappears, tray icon stays
- [ ] Send a message from another account → OS notification fires
- [ ] Left-click tray icon → window comes back
- [ ] Right-click tray icon → menu shows "Open Window" / "Quit"
- [ ] Click "Quit" → process actually exits
- [ ] In Settings UI: toggle Autostart → on next system boot, app launches and goes to tray

**Weekly Quotas (`/quota`):**
- [ ] Add a quota with priority "high" → red badge appears
- [ ] Click List/Kanban toggle → switches view
- [ ] In Kanban: click "Move →" on a Pending quota → it moves to Active column
- [ ] Click status filter pills (Pending / Active / Done) → filters work
- [ ] Use week nav (← / Today / →) → loads different week's data
- [ ] Progress bar reflects completion % accurately
- [ ] Week-over-week delta shows correctly

### Build verification (Tauri)
After running schema migrations + `npm install`:
```bash
npm run tauri build
```
This compiles the Rust code with the new tray + autostart code. If anything fails to compile, it'll be obvious from the cargo output.

---

## Known Limitations

1. **Background notifications require window to remain hidden**, not fully terminated. For true push-when-fully-closed, you'd need FCM/APNS integration — not implemented.
2. **Schema migrations must be run manually** on Supabase. The app will work without them but reactions/reply/read_by features will silently no-op.
3. **`@tauri-apps/plugin-autostart` requires `--legacy-peer-deps`** for npm install due to a peer dependency conflict with `react-day-picker@8.10.1`.
4. **Pre-existing TypeScript errors remain** in unrelated files (`logs.tsx`, `Scheduling/*`, `bluePinPage.tsx`, `app-sidebar.tsx`'s role-data type issues). These were not introduced by this revamp.
