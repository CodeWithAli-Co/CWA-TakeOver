# Enabling Axon to execute `cwa` commands in a terminal

The `run_cwa_command` Axon action can either **copy the command to
your clipboard** (works today, no setup) or **actually execute the
command via Tauri** (requires the shell plugin). This doc is the
one-time setup for the latter.

Until you do this, any voice request that fires `run_cwa_command`
gracefully falls back to copy-to-clipboard and tells you so.

---

## 1. Add the Rust dependency

Open `src-tauri/Cargo.toml` and add to the `[dependencies]` block:

```toml
tauri-plugin-shell = "2"
```

## 2. Register the plugin

Open `src-tauri/src/lib.rs` (or `main.rs` — wherever `Builder::default()`
is called) and register the plugin in the builder chain:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())   // ← add this line
    .plugin(tauri_plugin_notification::init())
    // …other plugins…
```

## 3. Grant the capability

Open `src-tauri/capabilities/default.json` and add a shell permission.
**Scope it narrowly** — we only want `cwa` to be executable, not
arbitrary commands:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "…",
  "windows": ["main"],
  "permissions": [
    "core:default",
    // …existing permissions…
    "shell:allow-execute",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "cwa",
          "cmd": "cwa",
          "args": true,
          "sidecar": false
        }
      ]
    }
  ]
}
```

The `"args": true` allows any arguments to `cwa` — necessary so Axon
can pass `add <name>`, `publish <name> --bump=minor`, etc.

## 4. Install the TypeScript binding

From `CWA-Manager`:

```bash
bun add @tauri-apps/plugin-shell
```

## 5. Rebuild

```bash
bun run tauri dev
```

Once the app rebuilds, Axon's `run_cwa_command` will use the shell
plugin. Try: **"Axon, run cwa ls"** — you should hear the first few
items read back.

---

## How it works

`run_cwa_command` takes two args:
- `subcommand` — everything after the literal `cwa`, e.g.
  `"add cwa-sidebar"` or `"publish my-template --bump=minor"`
- `cwd` — (optional) absolute path to run the command in. Required
  for subcommands that operate on a project folder (`add`, `publish`,
  `store`, `update`).

Extra safety: any command starting with `delete` / `remove` /
`publish` / `store` triggers a confirm prompt even if autoApprove is
on. Reads like `ls`, `info`, `search`, `whoami` execute without
prompting.

Output: the handler captures stdout + stderr from the real process
and summarizes the first ~3 lines so Axon can read them aloud. The
full output is available in the action's `data` field for downstream
display.

---

## Usage examples (voice)

> "Axon, run cwa ls"
>
> → `run_cwa_command({ subcommand: "ls" })`
> → Axon speaks the first items from the output.

> "Axon, install cwa-sidebar into my current project at C:/Dev/MyApp"
>
> → `run_cwa_command({ subcommand: "add cwa-sidebar", cwd: "C:/Dev/MyApp" })`
> → Confirmation prompt (because `add` mutates the project), then
>   runs and reports success.

> "Axon, what did cwa doctor say?"
>
> → `run_cwa_command({ subcommand: "doctor" })`
> → Full diagnostic summary read aloud.

---

## Why not just spawn a terminal window?

Opening a new cmd.exe / Windows Terminal window *would* feel more
like "pasted into the terminal" — but has two downsides:

1. Axon can't read the output back to you (stdout lives in the
   spawned window, not in-process).
2. You have to manually close the terminal window after.

Direct `Command` execution is the sweet spot: the command runs,
Axon captures + speaks the result, no window management.

If you specifically WANT a visible terminal window for something (e.g.,
an interactive prompt), just say "Axon, copy the install command" —
that puts it on the clipboard and you paste into your own terminal.

---

## Security model

- Only `cwa` is allowed to execute. Any other command Axon might try
  to invoke (npm, git, rm, etc.) is blocked by the capability
  allowlist.
- Destructive `cwa` subcommands (`delete`, `remove`, `publish`,
  `store`) require a confirmation prompt from the operator even when
  autoApprove is globally on — because `publish` ships code to the
  registry where other devs can install it.
- The capability is scoped to the `main` window only.

To revoke at any time: remove the `shell:allow-execute` entry from
`capabilities/default.json` and rebuild. Axon will gracefully degrade
back to clipboard-copy mode.
