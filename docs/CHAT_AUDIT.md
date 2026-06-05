# TakeOver Chat — Slack Replacement Audit

## 1. Headline verdict

TakeOver Chat is **further along than I expected** — it ships about 80% of Slack's day-one surface (channels, DMs, threads, reactions, mentions, search, presence, typing, pins, stars, voice notes, polls, slash commands, scheduled messages, forward, huddle voice/video, webhooks, an AXON drafting hook). What it is **not** is multi-tenant safe or enterprise-grade: there are no private channels (every "channel" subscribes every employee), no chat-side RLS migrations in the repo, no proper push (OS toasts only work inside the Tauri desktop shell), no mobile surface, no audit log, and the data model leans on `cwa_chat` + `cwa_dm_chat` plus embedded text markers (`{rx:...}`, `{reply:...}`, `{poll:...}`) as fallbacks for missing columns. That's perfectly fine for an internal tool — but if the founder wants to position this as "Slack but ours" externally, the gating work is privacy + permissions + a real mobile/push story, not features. As a **demo** of "we replaced Slack for ourselves and bolted AXON to it," it's already credible. As a **sellable product**, it's two focused months from there.

## 2. What's already great

1. **Threads are a real first-class surface.** Both inline and side-panel modes (`ThreadPanel.tsx` + `ThreadInline.tsx`), a dedicated global `ThreadsView` inbox that rolls up every thread you've touched, and realtime subscriptions filtered by `thread_root_id`. This is the hardest Slack feature to get right and it's done.
2. **Huddle (voice + video) is a full WebRTC mesh implementation, not a stub.** `Huddle/useHuddle.ts` has perfect-negotiation, screen-share, per-peer audio levels, quality presets, a global store so calls survive route changes, and a ring/announcement system. Most "Slack clones" punt this entirely.
3. **The composer is rich.** Drafts persisted per channel, `/axon` drafting via the in-house agent, mention autocomplete, slash command picker, paste-to-upload images, drag-and-drop, folder uploads (both `webkitdirectory` and Tauri-native pickers), voice recording, GIF picker, scheduled send, `/remind` with relative + absolute parsing, poll dialog.
4. **Graceful schema-drift handling.** `MessageList.tsx` and `MessageComposer.tsx` both keep a `missingColumns` cache, so when a deploy targets an older DB it falls back to text-embedded reaction/reply markers instead of crashing. Real production hygiene.
5. **Search has a ranked RPC path with a transparent ilike fallback.** `GlobalSearch.tsx` tries `chat_search` RPC first and degrades. Cmd+K opens it globally. The keyword-alerts + per-channel notif levels (`all` / `mentions` / `none`) in `chatStore` are also above-Slack-baseline UX.

## 3. What's missing or weak

### Phase 2 — Table stakes

| Feature | Verdict | Note | Effort |
|---|---|---|---|
| Channels (public) | Partial | Only one shape: name prefixed `#`, subscribers = every employee. No real "join/leave," no description, no topic, no archive. | M |
| Channels (private) | **Missing** | No `is_private` column, no membership gating, no UI. Every channel is public-to-everyone. | L |
| DMs (1:1) | Present | Canonical `dm::a::b` naming via `DMPickerDialog`, well-handled. | — |
| Group DMs (mpim) | Present | `AddDMGroup` creates multi-person rooms. No size cap or display heuristics beyond the displayName helper. | — |
| Threads | Present | Side panel + inline + global Threads inbox. Best-built feature here. | — |
| Reactions | Present | Native `reactions` jsonb column + text-marker fallback. Picker with recent emojis + custom emoji registry. | — |
| @mentions + notifications | Present | `MentionPicker`, word-boundary correct via `chatNotify.ts`, `@here` supported. | — |
| File uploads | Present | Images, files, folder bundles (with manifest), voice notes. Previews render inline. No file thumbnails for non-images (PDFs etc). | S |
| Search (full-text) | Present | `chat_search` RPC ranked + ilike fallback. No filters (by channel, by user, by date). | M |
| Unread state | Present | Per-channel counters in `chatStore` + lastReadAt snapshot. No per-message read receipts surfaced clearly. | — |
| Presence | Present | Heartbeat-based, 1m=online / 5m=away / >5m=offline, custom status with expiry. | — |
| Typing indicators | Present | Supabase Realtime presence channel per group. | — |
| Pinned messages | Present | `pinned_at` / `pinned_by` columns + `PinnedBar`, admin-gated. | — |
| Starred / saved | Present | Per-user, persisted in localStorage (not synced cross-device). | S |
| Edit / delete | Present | Soft-delete tombstone, preserves reply chain. Edit preserves embedded markers. | — |
| Push notifications (OS) | **Partial — desktop only** | Uses `@tauri-apps/plugin-notification`. No browser `Notification` API, no service worker, no FCM/APNs. Web users get only in-app toasts. | L |

### Phase 3 — Differentiation

| Feature | Verdict | Note | Effort |
|---|---|---|---|
| AXON in chat | Partial | `/axon <prompt>` calls `draftChatReply` and fills the textarea with a draft. Read-only — no action execution from chat, no AXON-posted summaries, no `@axon` mentions that trigger work. | M |
| Voice messages | Present | `useVoiceRecorder` + `VoicePlayer`. **No transcript** — recording uploads as audio only. | M |
| Polls | Present | Full `PollDialog` + `PollMessage`, multi-select supported, encoded as `{poll:...}` text marker. | — |
| Slash commands | Present | `/axon /poll /remind /status /dnd /away /clear /shortcuts` with a picker. Solid baseline. | — |
| Webhooks (incoming) | Present | `chat_webhooks` table, admin UI with rotate/revoke, server handler stub in the migration. Needs the Express route actually wired in `webhook-server.ts`. | S |
| Scheduled messages | Present | localStorage queue + 30s tick. **Client-side only — won't fire if the user closes the app.** | M |
| Forward messages | Present | `ForwardDialog` picks any group, preserves attribution. | — |

### Phase 4 — Reach

| Feature | Verdict | Note | Effort |
|---|---|---|---|
| Mobile / PWA | **Missing** | No `manifest.json`, no service worker, no responsive media queries in Chat components, layout is fixed 3-pane with 288px sidebar. | XL |
| Federation / bridge | **Missing** | Nothing here. No Matrix, no IRC, no XMPP. | XL |
| External-user channels (Slack Connect) | **Missing** | All identity flows through `app_users`. No shared-channel concept, no external invite. | XL |

### Phase 5 — Enterprise

| Feature | Verdict | Note | Effort |
|---|---|---|---|
| Audit log | **Missing** | No `chat_audit` table; edits/deletes/pins don't write to any log. Only AXON has `auditLog.ts` for its own actions. | M |
| Retention policy | **Missing** | No TTL, no purge job, no per-channel retention settings. | M |
| RBAC on channels | Partial | Admin-gated create/delete/pin/webhook via hardcoded `ADMIN_ROLES = ["CEO","COO","CFO","Admin"]` in `ChatLayout.tsx`. No per-channel roles, no member management UI after create. | L |
| SSO / SCIM | **Missing** | Auth flows through Supabase Auth. No SAML, no SCIM provisioning. | XL |

## 4. The 8 highest-leverage gaps

In order of "ship this and TakeOver Chat becomes a real daily driver":

1. **Private channels + member management.** (L) Add `is_private boolean` + `members text[]` to `dm_groups`, RLS that gates reads on membership, an "Add people" UI. Without this, you can't honestly call this multi-tenant chat. Single biggest unlock.
2. **Browser push + a service worker.** (L) Right now only Tauri desktop gets OS notifications. Add `Notification.requestPermission()`, a SW, and FCM for mobile web. This is what makes "did you see my message?" stop being a question.
3. **Server-side scheduled send + reminders.** (M) Move `scheduledStore` from localStorage to a `chat_scheduled` table + cron / pg_cron job. Today, closing the app silently drops scheduled messages.
4. **AXON as a first-class chat participant.** (M) `@axon summarize today`, `@axon who's on shift`, `@axon book that meeting` — invoke AXON actions from chat, post results back as messages. The /axon draft helper is the easy half; action execution + posting back is the differentiator.
5. **Voice message transcription.** (M) You already have `Axon/engine/transcription.ts`. Wire it into `useVoiceRecorder` so voice notes ship with a searchable transcript. This is a stand-out feature Slack lacks.
6. **Search filters + jump-to-message.** (M) The RPC already returns the row; add `from:`, `in:`, `before:`/`after:` parsers and surface a "Show in channel" jump that scrolls + highlights. Cheap multiplier on existing infra.
7. **Audit log + soft-delete retention.** (M) `chat_audit (action, msg_id, actor, ts, prev_value)`. Investors and any compliance-curious customer will ask. Pair with admin-visible deleted-message recovery.
8. **A mobile shell — even a thin PWA.** (XL but huge) The current 3-pane fixed layout is desktop-only. Wrap ChatLayout in a media-query split that collapses to a single-pane stack on `<768px` and ship a basic `manifest.json`. Doesn't need feature parity, just "I can read and reply on my phone."

## 5. Architecture notes (matters for ripout)

- **Two tables, not one.** `cwa_chat` (the General channel) and `cwa_dm_chat` (everything else, distinguished by `dm_group`). Every action handler in `ChatLayout.tsx` branches on `isGeneral` to pick the table. If you ever extract Chat as a product, **merge into one `chat_messages` table** with `channel_id` FK — the current split is technical debt that bleeds into every query, edit, delete, react, pin path.
- **No RLS on chat tables in this repo.** `chat_schema_baseline.sql` adds columns but never enables RLS or writes policies. `chat_webhooks.sql` is the only file that enables RLS, and only on that one table. Anyone authenticated can currently read every message in every DM via the REST API. **This is a P0 before any external use.**
- **Multi-tenant scoping is by `company` text column,** added in the baseline migration. It's set client-side from `getActiveCompanyLabel()` on insert, but there's no DB-level guarantee — meaning a misconfigured client could write the wrong company tag and there's no policy stopping reads across companies. If TakeOver is sold to a second customer, this is also a P0.
- **Text-embedded markers as fallback** (`{rx:...}`, `{reply:N|user}`, `{poll:...}`, folder tokens) make the system robust to schema drift but also mean the message body is **not** clean text. Any downstream consumer (search, exports, AI ingest) needs the same `parse/strip` helpers from `MessageBubble.tsx` and `PollMessage.tsx`. Worth consolidating into a single `parseMessage()` module.
- **localStorage is doing real work.** `chatStore` persists unread counts, lastReadAt, categories, starred messages, custom status, notification levels, keyword alerts, custom emojis. Plus `scheduledStore`. Plus per-channel composer drafts. Means a clean browser = lost state. Pre-ripout, identify what should be `user_settings` table rows vs. truly device-local.
- **Realtime is Supabase channels per group.** Every group switch sets up a new subscription. This works at <100 concurrent users; at scale you'll want a fan-out broker. Not urgent.
- **No message_id stability.** `msg_id` is a serial bigint. Forwards and quotes use it as a hard reference, but the soft-delete + edit model means historical references can point at tombstones. Fine for now, worth noting before federation work.

**Bottom line for ripout strategy:** features are dense and good; the *plumbing* (single table, real RLS, server-side scheduled jobs, push, mobile shell) is what you'd rebuild. Plan 6–8 weeks of plumbing before this becomes a sellable Slack alternative; plan ~2 weeks to make it a credible internal-tool demo.
