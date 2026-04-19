# Transcription sidecar — compilable stub

The frontend calls `invoke("transcribe_audio", { path })`. Until you
wire whisper.cpp, the Rust side just needs a stub that **compiles** and
returns `Err(...)` so the UI shows its "not installed yet" tooltip
instead of silent failure.

## Step 1 — stub command

Put this in `src-tauri/src/lib.rs` (NOT `main.rs` — your app uses a lib
crate via `cwa_takeover_lib::run()`):

```rust
// Add near your other #[tauri::command] blocks.
#[tauri::command]
async fn transcribe_audio(_path: String) -> Result<String, String> {
    // TODO: replace with real whisper.cpp sidecar invocation.
    Err("Whisper sidecar not installed yet".to_string())
}
```

## Step 2 — register it

In the same file, find `tauri::generate_handler![...]` inside the
`run()` function and add the command name to the list:

```rust
.invoke_handler(tauri::generate_handler![
    // ...your existing commands...
    transcribe_audio,
])
```

That's it — the build errors go away and clicking the 📄 button on a
voice message will show the "not installed yet" tooltip.

## Step 3 — real implementation (later)

When you want actual transcription, swap the stub for a whisper.cpp
sidecar. Quick path using `tauri-plugin-shell`:

```rust
#[tauri::command]
async fn transcribe_audio(
    app: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    use tauri_plugin_shell::ShellExt;

    // `whisper` must be in PATH or in src-tauri/binaries/
    let output = app.shell()
        .command("whisper")
        .args(["--model", "base", "--language", "en", "--output-format", "txt", &path])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
```

You'll also need `tauri-plugin-shell = "2"` in `Cargo.toml` and the
whisper.cpp binary (from https://github.com/ggerganov/whisper.cpp)
either in PATH or bundled as a sidecar.

## Why `main.rs` failed

The file you were editing is the Windows entry stub that just calls
`cwa_takeover_lib::run()`. Adding a `#[tauri::command]` there without a
body and without registering it in the builder won't work — commands
have to live in the lib crate and be listed in `generate_handler!`.
