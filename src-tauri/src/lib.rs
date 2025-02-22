// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};

use dotenv::dotenv;
use resend_rs::{
    types::{ContactChanges, ContactData, CreateBroadcastOptions, SendBroadcastOptions},
    Resend, Result,
};
// use serde::{Deserialize, Serialize};

// // Define the structures to match the API response
// #[derive(Debug, Serialize, Deserialize)]
// pub struct ContactsResponse {
//     pub object: String,
//     pub data: Vec<Contact>,
// }

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

// #[tauri::command(async)]
// async fn list_contacts() -> Result<ContactsResponse, String> {
//     let _env = dotenv().unwrap();
//     let resend = Resend::default();

//     let contacts = resend
//         .contacts
//         .list("fa2d33ed-9f00-4b51-ad6c-a6e858c7f1bf")
//         .await
//         .map_err(|e| e.to_string())?;

//     Ok(ContactsResponse {
//         object: String::from("list"),
//         data: contacts,
//     })
// }

#[tauri::command(async)]
async fn add_contact(email: &str, f_name: &str, l_name: &str, status: bool) -> Result<(), String> {
    let _env = dotenv().unwrap();

    let resend = Resend::default();
    let contact = ContactData::new(email)
        .with_first_name(f_name)
        .with_last_name(l_name)
        .with_unsubscribed(status);

    let _contact = resend
        .contacts
        .create("fa2d33ed-9f00-4b51-ad6c-a6e858c7f1bf", contact)
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
        .update_by_email(email, "fa2d33ed-9f00-4b51-ad6c-a6e858c7f1bf", changes)
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
        .delete_by_email("fa2d33ed-9f00-4b51-ad6c-a6e858c7f1bf", email)
        .await
        .map_err(|e| e.to_string())?; // Convert error to string

    Ok(deleted)
}

#[tauri::command(async)]
async fn create_broadcast() -> Result<String, String> {
    let _env = dotenv().unwrap();

    let resend = Resend::default();

    let audience_id = "fa2d33ed-9f00-4b51-ad6c-a6e858c7f1bf";
    let from = "CodeWithAli unfold@codewithali.com";
    let subject = "Welcome to CWA Manager Test";
    let html = "Hi {{{FIRST_NAME|there}}}, Welcome to CWA Manager. You can unsubscribe here: {{{RESEND_UNSUBSCRIBE_URL}}}";

    let opts = CreateBroadcastOptions::new(audience_id, from, subject).with_html(html);

    let broadcast = resend
        .broadcasts
        .create(opts)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            encrypt,
            decrypt,
            create_broadcast,
            send_broadcast,
            // list_contacts,
            add_contact,
            edit_contact,
            del_contact,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
