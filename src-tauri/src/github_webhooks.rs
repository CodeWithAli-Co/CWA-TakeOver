use tauri::{command, State, Manager};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha1::Sha1;
use std::collections::HashMap;

// Type alias for HMAC-SHA1
type HmacSha1 = Hmac<Sha1>;

// GitHub webhook event data types
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GitHubCommit {
    pub id: String,
    pub message: String,
    pub author: GitHubAuthor,
    pub timestamp: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GitHubAuthor {
    pub name: String,
    pub email: String,
    pub username: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GitHubRepository {
    pub id: i64,
    pub name: String,
    pub full_name: String,
    pub owner: GitHubOwner,
    pub html_url: String,
    pub description: Option<String>,
    pub fork: bool,
    pub default_branch: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GitHubOwner {
    pub login: String,
    pub id: i64,
    pub avatar_url: String,
    pub html_url: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PushEvent {
    pub ref_name: String,
    pub before: String,
    pub after: String,
    pub repository: GitHubRepository,
    pub pusher: HashMap<String, String>,
    pub sender: GitHubOwner,
    pub commits: Vec<GitHubCommit>,
}

// For our frontend
#[derive(Clone, Debug, Serialize)]
pub struct GitHubWebhookEvent {
    pub id: String,
    pub event_type: String,
    pub repo: String,
    pub branch: String,
    pub author: String,
    pub author_avatar: String,
    pub timestamp: String,
    pub commits: Vec<GitHubWebhookCommit>,
}

#[derive(Clone, Debug, Serialize)]
pub struct GitHubWebhookCommit {
    pub id: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
}

// In-memory storage for webhook events
pub struct WebhookState {
    pub github_events: Mutex<Vec<GitHubWebhookEvent>>,
    pub github_webhook_secret: String,
}

impl WebhookState {
    pub fn new(github_webhook_secret: &str) -> Self {
        Self {
            github_events: Mutex::new(Vec::new()),
            github_webhook_secret: github_webhook_secret.to_string(),
        }
    }
}

// Command to get GitHub webhook events
#[command]
pub fn get_github_webhooks(state: State<WebhookState>) -> Vec<GitHubWebhookEvent> {
    let events = state.github_events.lock().unwrap();
    events.clone()
}

// Handle incoming GitHub webhook
#[command]
pub fn handle_github_webhook(
    state: State<WebhookState>,
    payload: String,
    signature: String,
    event_type: String,
) -> Result<(), String> {
    // Verify webhook signature
    let secret = &state.github_webhook_secret;
    
    // Create a new HMAC-SHA1 instance
    let mut mac = HmacSha1::new_from_slice(secret.as_bytes())
        .map_err(|_| "Invalid key length".to_string())?;
    
    // Update the MAC with the payload
    mac.update(payload.as_bytes());
    
    // Calculate signature
    let calculated_signature = format!("sha1={}", hex::encode(mac.finalize().into_bytes()));
    
    // Compare signatures (constant-time comparison to prevent timing attacks)
    if calculated_signature != signature {
        return Err("Invalid webhook signature".to_string());
    }
    
    // Parse the payload based on event type
    if event_type == "push" {
        if let Ok(push_event) = serde_json::from_str::<PushEvent>(&payload) {
            // Extract branch name from ref (refs/heads/main -> main)
            let branch = push_event.ref_name
                .split('/')
                .last()
                .unwrap_or("unknown")
                .to_string();
            
            // Transform commits to our format
            let commits: Vec<GitHubWebhookCommit> = push_event.commits
                .iter()
                .map(|commit| GitHubWebhookCommit {
                    id: commit.id.clone(),
                    message: commit.message.clone(),
                    author: commit.author.name.clone(),
                    timestamp: commit.timestamp.clone(),
                })
                .collect();
            
            // Create the webhook event
            let webhook_event = GitHubWebhookEvent {
                id: format!("github_{}", Utc::now().timestamp()),
                event_type: "push".to_string(),
                repo: push_event.repository.full_name,
                branch,
                author: push_event.pusher.get("name").unwrap_or(&"unknown".to_string()).clone(),
                author_avatar: push_event.sender.avatar_url,
                timestamp: Utc::now().to_rfc3339(),
                commits,
            };
            
            // Store the event
            let mut events = state.github_events.lock().unwrap();
            events.push(webhook_event);
            
            // Keep only the most recent 100 events
            if events.len() > 100 {
                *events = events.clone().into_iter().skip(events.len() - 100).collect();
            }
            
            Ok(())
        } else {
            Err("Failed to parse push event".to_string())
        }
    } else {
        // Handle other event types if needed
        Ok(())
    }
}

// Register this with Tauri in your main.rs
pub fn register_github_webhook_commands(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Get the webhook secret from environment or config
    let github_webhook_secret = std::env::var("GITHUB_WEBHOOK_SECRET")
        .unwrap_or_else(|_| "your_webhook_secret".to_string());
    
    // Initialize webhook state
    app.manage(WebhookState::new(&github_webhook_secret));
    
    Ok(())
}