// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use aes_gcm::{
    Aes256Gcm, Key, Nonce,
    aead::{Aead, AeadCore, KeyInit, OsRng},
};
use std::fs::File;
use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    Manager, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_updater::UpdaterExt;

// Global flag — when true, app fully exits on window close.
// When false (default), window close → hide to tray.
static SHOULD_EXIT: AtomicBool = AtomicBool::new(false);

use dotenv::dotenv;
use resend_rs::{
    Resend, Result,
    types::{
        ContactChanges, CreateAttachment, CreateBroadcastOptions, CreateContactOptions,
        CreateEmailBaseOptions, SendBroadcastOptions,
    },
};

// Add GitHub webhook module
mod github_webhooks;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn encrypt(key_str: String, plaintext: String) -> String {
    let key = Key::<Aes256Gcm>::from_slice(key_str.as_bytes());

    // Generates a random nonce (12 bytes) using OsRng (secure random generator)
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let cipher = Aes256Gcm::new(key);
    let ciphered_data = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .expect("failed to encrypt");
    // combining nonce and encrypted data together
    // for storage purpose
    let mut encrypted_data: Vec<u8> = nonce.to_vec();
    encrypted_data.extend_from_slice(&ciphered_data);

    hex::encode(encrypted_data)
}

#[tauri::command]
fn decrypt(key_str: String, encrypted_data: String) -> String {
    let encrypted_data = hex::decode(encrypted_data).expect("failed to decode hex string into vec");
    let key = Key::<Aes256Gcm>::from_slice(key_str.as_bytes());
    let (nonce_arr, ciphered_data) = encrypted_data.split_at(12);
    let nonce = Nonce::from_slice(nonce_arr);
    let cipher = Aes256Gcm::new(key);
    let plaintext = cipher
        .decrypt(nonce, ciphered_data)
        .expect("failed to decrypt data");
    String::from_utf8(plaintext).expect("failed to convert vector of bytes to string")
}

#[tauri::command(async)]
async fn add_contact(email: &str, f_name: &str, l_name: &str, status: bool) -> Result<(), String> {
    let _env = dotenv().unwrap();

    let resend = Resend::default();
    let contact = CreateContactOptions::new(email)
        .with_first_name(f_name)
        .with_last_name(l_name)
        .with_unsubscribed(status);

    let _contact = resend
        .contacts
        .create(contact)
        .await
        .map_err(|e| e.to_string())?; // Convert error to string

    Ok(())
}

#[tauri::command(async)]
async fn edit_contact(email: &str, status: bool) -> Result<(), String> {
    let _env = dotenv().unwrap();

    let resend = Resend::default();
    let changes = ContactChanges::new().with_unsubscribed(status);
    let _contact = resend
        .contacts
        .update(email, changes)
        .await
        .map_err(|e| e.to_string())?; // Convert error to string

    Ok(())
}

#[tauri::command(async)]
async fn del_contact(email: &str) -> Result<bool, String> {
    let _env = dotenv().unwrap();

    let resend = Resend::default();
    let deleted = resend
        .contacts
        .delete(email)
        .await
        .map_err(|e| e.to_string())?; // Convert error to string

    Ok(deleted)
}

#[tauri::command(async)]
async fn create_broadcast() -> Result<String, String> {
    let _env = dotenv().unwrap();

    let resend = Resend::default();

    let segment_id = "fa2d33ed-9f00-4b51-ad6c-a6e858c7f1bf";
    let from = "CodeWithAli unfold@codewithali.com";
    let subject = "Welcome to CWA TakeOver Test";
    let html = "Hi {{{contact.first_name|there}}}, Welcome to CWA TakeOver. You can unsubscribe here: {{{RESEND_UNSUBSCRIBE_URL}}}";

    let opts = CreateBroadcastOptions::new(segment_id, from, subject).with_html(html);

    let broadcast = resend
        .broadcasts
        .create(opts.clone())
        .await
        .map_err(|e| e.to_string())?; // Convert error to string

    Ok(broadcast.id.to_string()) // Assuming the API response has an `id` field
}

#[tauri::command(async)]
async fn send_broadcast(broadcast_id: &str) -> Result<(), ()> {
    let _env = dotenv().unwrap();

    let resend = Resend::default();

    let opts = SendBroadcastOptions::new(broadcast_id).with_scheduled_at("in 1 min");

    let _broadcast = resend.broadcasts.send(opts).await;

    Ok(())
}

async fn update(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    if let Some(update) = app.updater()?.check().await? {
        let mut downloaded = 0;

        // alternatively we could also call update.download() and update.install() separately
        update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    println!("downloaded {downloaded} from {content_length:?}");
                },
                || {
                    println!("download finished");
                },
            )
            .await?;

        println!("update installed");
        app.restart();
    }

    Ok(())
}

#[tauri::command(async)]
async fn send_invoice(
    client_email: &str,
    subject_msg: &str,
    file_path: &str,
    html: &str,
) -> Result<String, String> {
    // This grabs the value of 'RESEND_API_KEY' from the .env in src/tauri folder
    let _env = dotenv().unwrap();

    let resend = Resend::default();

    let from = "CodeWithAli <mailer@codewithali.com>";
    let to = [client_email];
    let subject = subject_msg;

    let filename = "Invoice.pdf";
    let filepath = file_path;
    let mut f = File::open(filepath).unwrap();
    let mut invoice = Vec::new();
    f.read_to_end(&mut invoice).unwrap();

    let email = CreateEmailBaseOptions::new(from, to, subject)
        .with_html(html)
        .with_attachment(CreateAttachment::from_content(invoice).with_filename(filename));

    let _email = resend.emails.send(email).await.map_err(|e| e.to_string())?;

    Ok(client_email.to_string())
}

// Tauri command — called from frontend to fully quit the app
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    SHOULD_EXIT.store(true, Ordering::SeqCst);
    app.exit(0);
}

// Brings the main window to the foreground. Invoked from the OS-notification
// click handler so a toast click reveals the app even when it's hidden to tray
// or minimized.
#[tauri::command]
fn focus_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init()) //register the plugin in the builder chain ( basically allows axon to work with the terminal and add commands )
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Autostart — launches app on system boot.
        // Default disabled. User toggles via Settings UI which calls
        // tauri-plugin-autostart's enable()/disable() commands.
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            github_webhooks::get_github_webhooks
        ])
        .invoke_handler(tauri::generate_handler![
            github_webhooks::handle_github_webhook
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // ── Windows: register the AppUserModelID at runtime ──
            // Without this, OS toasts dispatched from a `tauri dev`
            // binary silently disappear because Windows doesn't
            // recognize the dev exe path as a notification source.
            // Calling SetCurrentProcessExplicitAppUserModelID claims
            // the AUMID (matching tauri.conf.json `identifier`)
            // for the running process so toasts surface even in
            // dev mode, AND the installed production exe still
            // works as before.
            #[cfg(windows)]
            {
                use windows::core::PCWSTR;
                use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
                // Must match `bundle.identifier` in tauri.conf.json.
                let aumid: Vec<u16> = "com.cwa-takeover.app\0"
                    .encode_utf16()
                    .collect();
                unsafe {
                    let _ = SetCurrentProcessExplicitAppUserModelID(PCWSTR(aumid.as_ptr()));
                }
            }

            // Register GitHub webhook commands and initialize state
            github_webhooks::register_github_webhook_commands(app)?;

            // ─── System Tray Setup ─────────────────────────────────────────
            // Tray menu: Open / Quit
            let open_item = MenuItem::with_id(app, "open", "Open Window", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
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
                    // Left-click tray icon → toggle window
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
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

            // Show window on startup (we set visible: false in tauri.conf.json
            // for tray-startup support, so we manually show it here)
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }

            // Spawn updater check in background.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = update(handle).await {
                    eprintln!("updater check failed: {e}");
                }
            });

            Ok(())
        })
        // ─── Window close → hide to tray instead of quit ──────────────
        // Background notifications continue working because window stays
        // alive (just hidden). Supabase realtime channels keep firing,
        // tauri-plugin-notification continues to send OS notifications.
        // True quit only via tray menu "Quit" or quit_app() command.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !SHOULD_EXIT.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            encrypt,
            decrypt,
            create_broadcast,
            send_broadcast,
            add_contact,
            edit_contact,
            del_contact,
            send_invoice,
            quit_app,
            focus_window,
            // GitHub webhook commands
            github_webhooks::get_github_webhooks,
            github_webhooks::handle_github_webhook,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ─── Tests ──────────────────────────────────────────────────────────
//
// Crypto round-trip + invariants. The encrypt/decrypt pair is the
// only thing standing between the raw secret material the app
// stores and the user's data — a regression here doesn't just
// corrupt a feature, it permanently destroys data (no decryption =
// no recovery).
//
// We assert four properties:
//   1. Round-trip stability — decrypt(encrypt(x, k), k) == x.
//   2. Nonce uniqueness — encrypting the same plaintext twice
//      produces different ciphertexts (else AES-GCM is broken).
//   3. Empty plaintext round-trips (degenerate but possible input).
//   4. Unicode plaintext round-trips byte-perfectly.
#[cfg(test)]
mod tests {
    use super::{decrypt, encrypt};

    // 32 bytes — AES-256 requires a 256-bit key.
    const TEST_KEY: &str = "01234567890123456789012345678901";

    #[test]
    fn round_trip_basic_ascii() {
        let plaintext = "hello world".to_string();
        let ciphertext = encrypt(TEST_KEY.to_string(), plaintext.clone());
        let decrypted = decrypt(TEST_KEY.to_string(), ciphertext);
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn round_trip_empty_plaintext() {
        let plaintext = String::new();
        let ciphertext = encrypt(TEST_KEY.to_string(), plaintext.clone());
        // Even empty input must produce non-empty output (nonce + tag).
        assert!(!ciphertext.is_empty());
        let decrypted = decrypt(TEST_KEY.to_string(), ciphertext);
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn round_trip_unicode() {
        // Byte-level fidelity for multi-byte UTF-8 sequences.
        let plaintext = "日本語 émoji 🚀 password!".to_string();
        let ciphertext = encrypt(TEST_KEY.to_string(), plaintext.clone());
        let decrypted = decrypt(TEST_KEY.to_string(), ciphertext);
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn nonce_is_random_per_encryption() {
        // AES-GCM requires unique nonces per (key, plaintext) pair.
        // Encrypting the same plaintext twice MUST yield different
        // ciphertexts — otherwise the implementation is reusing
        // nonces and AES-GCM's confidentiality guarantees collapse.
        let plaintext = "same input twice".to_string();
        let c1 = encrypt(TEST_KEY.to_string(), plaintext.clone());
        let c2 = encrypt(TEST_KEY.to_string(), plaintext);
        assert_ne!(
            c1, c2,
            "nonce reuse detected — same plaintext produced same ciphertext",
        );
    }

    #[test]
    fn ciphertext_starts_with_a_12_byte_nonce() {
        // The Rust impl prepends a 12-byte AES-GCM nonce to the
        // ciphertext. The hex-encoded blob's first 24 chars are
        // therefore the nonce. We check length sanity here so a
        // future refactor that drops the prepend (or uses a
        // different nonce size) trips the test before it ships.
        let ciphertext = encrypt(TEST_KEY.to_string(), "x".to_string());
        // 12 nonce bytes + ≥1 ciphertext byte + 16 GCM tag bytes
        // → ≥ 29 bytes → ≥ 58 hex chars.
        assert!(ciphertext.len() >= 58, "ciphertext shorter than expected");
        // First 24 hex chars decode cleanly as the nonce.
        assert!(hex::decode(&ciphertext[..24]).is_ok());
    }

    #[test]
    fn round_trip_long_plaintext() {
        // Stress: a large body should round-trip without loss. Catches
        // chunking bugs or off-by-one tag-length issues.
        let plaintext = "abc".repeat(10_000);
        let ciphertext = encrypt(TEST_KEY.to_string(), plaintext.clone());
        let decrypted = decrypt(TEST_KEY.to_string(), ciphertext);
        assert_eq!(decrypted, plaintext);
    }
}
