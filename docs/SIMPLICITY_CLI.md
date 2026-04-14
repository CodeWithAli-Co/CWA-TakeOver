# Simplicity CLI — Resource Hub & Code Pattern Library

Documentation for the Supabase-backed **Pattern Library** and **Resource Hub** sections of the Simplicity CLI (`/budgetary` route).

---

## What changed

Both features were previously stored in **browser localStorage** under a single `simplicity-mission-control` key. This meant:
- Data lived only in one browser on one machine
- Dummy initial patterns always showed on first load
- No multi-device sync

Now both are **persisted to Supabase**:
- No dummy data — starts empty
- Full CRUD (create, edit, delete, favorite)
- Syntax highlighting on saved code via `react-syntax-highlighter`
- Dynamic language tabs in the Pattern Library (tab appears per-language only when patterns exist for it)

Other Simplicity sections (decisions, quick captures, schedule) still use localStorage — they weren't part of this migration.

---

## Required Supabase Schema

Run these migrations in Supabase SQL Editor before using the page:

```sql
-- ─── Pattern Library ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS simplicity_patterns (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  code TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'typescript',
  tags TEXT[] DEFAULT '{}',
  favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Resource Hub ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS simplicity_resources (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'other',
  type TEXT DEFAULT 'docs',
  tags TEXT[] DEFAULT '{}',
  read_later BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  favorite BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  snippet TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Without these tables, the pages will render but add/edit/delete will fail with a console warning.

---

## File Structure

```
src/
├── MyComponents/Simplicity/
│   ├── simplicityQueries.ts   # Supabase CRUD + types + language constants
│   ├── CodeBlock.tsx          # react-syntax-highlighter wrapper (Void theme)
│   ├── PatternLibrary.tsx     # Full pattern UI — tabs, search, add/edit/delete
│   └── ResourceHub.tsx        # Full resource UI — filters, search, add/edit/delete
└── routes/
    └── budgetary.lazy.tsx     # Simplicity CLI — renders <PatternLibrary /> & <ResourceHub />
```

### Files deleted
- `src/MyComponents/ResourceStation.tsx` (old localStorage-backed resource component)

### Files modified
- `src/routes/budgetary.lazy.tsx` — removed:
  - `initialPatterns` dummy data
  - `CodePattern` interface (moved to simplicityQueries.ts as `Pattern`)
  - `patterns`, `setPatterns` state
  - `resources`, `setResources` state
  - `showNewPattern`, `newPattern` state
  - `handleAddPattern` function
  - `copyToClipboard`, `copiedId` state
  - Old pattern modal (~85 lines)
  - Old pattern display grid (~55 lines)

---

## How the Pattern Library Works

### Language tabs
Tabs are **dynamic** — they only appear for languages that have at least one saved pattern. So:
- Start empty → no tabs, just "All" (always present)
- Create a TypeScript pattern → `TypeScript (1)` tab appears
- Create a Rust pattern → `Rust (1)` tab appears alongside TypeScript
- Delete the only Rust pattern → Rust tab disappears

Language list (15 supported) comes from `SUPPORTED_LANGUAGES` in `simplicityQueries.ts`:
TypeScript, JavaScript, Rust, Python, Go, Java, C#, C++, SQL, HTML, CSS, Bash, JSON, YAML, Markdown.

### Code formatter / syntax highlighting
Code blocks use [`react-syntax-highlighter`](https://github.com/react-syntax-highlighter/react-syntax-highlighter) (Prism-based) with the `atomDark` style. The wrapper is in `CodeBlock.tsx` — it normalizes a few language aliases (e.g. `csharp` → `cs`) and applies Void theme padding/fonts.

### Live preview in the modal
When creating/editing a pattern, the modal shows a **live preview** below the code textarea — as you type, the highlighting updates in real-time so you can verify the language is correct before saving. The preview is capped at 200px height with a scroll.

### Tab + textarea indent
The code textarea catches the Tab key so pressing Tab inserts 2 spaces instead of moving focus away — essential for code editing. Cursor position is preserved.

### Pattern card hover actions
Hovering a pattern card reveals (in order): Favorite, Edit, Delete, Copy. The Copy button shows a green checkmark for 2 seconds after clicking.

### Search
Searches across title, description, and tags in a case-insensitive manner.

---

## How the Resource Hub Works

### Quick filter pills
Four status filters with live counts:
- **All** — everything
- **Read Later** — only items marked read-later
- **Starred** — favorites only
- **Done** — completed items

### Type filter dropdown
Separate select for filtering by resource type: Docs, Tutorial, Article, Video, Snippet, Tool.

### Card features per resource
- **Checkbox** on the left toggles completed state (strikethrough + fade on complete)
- **Type icon** (FileText, Video, Wrench, etc) next to title
- **URL** as a clickable link with external-link icon
- **Description** below the URL
- **Personal notes** (if present) shown in an amber-accented quote block
- **Code snippet** (if present) shown as a highlighted code block (capped at 150px)
- **Tags** as pill badges
- **Hover actions**: Read Later, Favorite, Edit, Delete

### Form fields
Required: title, URL. Optional: description, type, category (free-text), tags, personal notes, code snippet.

---

## The Tab Interaction (dynamic language tabs)

```typescript
// In PatternLibrary.tsx
const availableLanguages = useMemo(() => {
  const langs = new Set<string>();
  patterns.forEach((p) => langs.add(p.language));
  return Array.from(langs);
}, [patterns]);
```

The tabs render like this:
```jsx
{patterns.length > 0 && (
  <div className="flex items-center gap-1 overflow-x-auto">
    <button onClick={() => setActiveTab("all")}>All ({counts.all})</button>
    {availableLanguages.map((lang) => (
      <button key={lang} onClick={() => setActiveTab(lang)}>
        {getLanguageLabel(lang)} ({counts[lang]})
      </button>
    ))}
  </div>
)}
```

So the tab bar only renders at all once you have ≥1 pattern, and each language tab only exists if that language has content. This matches the requested behavior: "the tabs don't have to exist unless we choose that option in the modal."

---

## Adding a New Supported Language

Edit `SUPPORTED_LANGUAGES` in `src/MyComponents/Simplicity/simplicityQueries.ts`:

```typescript
export const SUPPORTED_LANGUAGES = [
  { key: "typescript", label: "TypeScript" },
  // ... existing
  { key: "ruby", label: "Ruby" },  // <-- add here
] as const;
```

The key must match a Prism language identifier (see [Prism's supported languages list](https://prismjs.com/#supported-languages)). The dropdown in the form picks it up automatically; so does the language tab in the library.

---

## Troubleshooting

**Patterns/resources don't save, console shows column errors**
→ Schema migration hasn't been run. See [Required Supabase Schema](#required-supabase-schema).

**Syntax highlighting doesn't work for some language**
→ Either the language isn't supported by Prism, or the `key` in `SUPPORTED_LANGUAGES` doesn't match Prism's identifier. Check Prism docs.

**Tabs show a language I deleted**
→ Refetch happens automatically after delete; try a page refresh if you're in a stuck state. The list is computed from live data, so phantom tabs mean the DB query is cached/stale.

**Code textarea loses focus when pressing Tab**
→ Shouldn't happen — we prevent default on Tab. If it does, check that the `onKeyDown` handler in `PatternLibrary.tsx` wasn't removed.
