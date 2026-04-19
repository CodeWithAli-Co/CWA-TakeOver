// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cwa_takeover_lib::run();
}


#[tauri::command]
async fn transcribe_audio(_path: String) -> Result<String, String> {
    Err("Whisper sidecar not installed yet".to_string())
}