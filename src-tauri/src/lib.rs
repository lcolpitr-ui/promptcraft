use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Prompt {
    pub id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub tags: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    pub concept: String,
    pub messages: Vec<ChatMessage>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Settings {
    pub api_key: String,
    pub api_endpoint: String,
    pub model: String,
    pub language: String,
    #[serde(default)]
    pub framework_mode: String,
    #[serde(default)]
    pub default_framework: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiRequest {
    pub messages: Vec<ChatMessage>,
    pub model: String,
    pub api_key: String,
    pub api_endpoint: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiResponse {
    pub content: String,
}

#[tauri::command]
async fn save_prompt(state: tauri::State<'_, AppState>, prompt: Prompt) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO prompts (id, title, content, category, tags, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![prompt.id, prompt.title, prompt.content, prompt.category, serde_json::to_string(&prompt.tags).unwrap(), prompt.created_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_prompts(state: tauri::State<'_, AppState>) -> Result<Vec<Prompt>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, title, content, category, tags, created_at FROM prompts ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let prompts = stmt
        .query_map([], |row| {
            let tags_str: String = row.get(4)?;
            Ok(Prompt {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                category: row.get(3)?,
                tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(prompts)
}

#[tauri::command]
async fn delete_prompt(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM prompts WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn save_conversation(state: tauri::State<'_, AppState>, conv: Conversation) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO conversations (id, concept, messages, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![conv.id, conv.concept, serde_json::to_string(&conv.messages).unwrap(), conv.created_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_conversations(state: tauri::State<'_, AppState>) -> Result<Vec<Conversation>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, concept, messages, created_at FROM conversations ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let convs = stmt
        .query_map([], |row| {
            let msg_str: String = row.get(2)?;
            Ok(Conversation {
                id: row.get(0)?,
                concept: row.get(1)?,
                messages: serde_json::from_str(&msg_str).unwrap_or_default(),
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(convs)
}

#[tauri::command]
async fn get_settings() -> Result<Settings, String> {
    let settings_path = dirs::config_dir()
        .ok_or("Cannot find config dir")?
        .join("promptcraft")
        .join("settings.json");
    if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        let settings: Settings = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(settings)
    } else {
        Ok(Settings {
            api_key: String::new(),
            api_endpoint: "https://api.openai.com/v1/chat/completions".to_string(),
            model: "gpt-4o-mini".to_string(),
            language: "zh".to_string(),
            framework_mode: "auto".to_string(),
            default_framework: None,
        })
    }
}

#[tauri::command]
async fn save_settings(settings: Settings) -> Result<(), String> {
    let settings_path = dirs::config_dir()
        .ok_or("Cannot find config dir")?
        .join("promptcraft");
    std::fs::create_dir_all(&settings_path).map_err(|e| e.to_string())?;
    let file_path = settings_path.join("settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn call_ai_api(request: AiRequest) -> Result<AiResponse, String> {
    let client = reqwest::Client::new();

    let messages_json: Vec<serde_json::Value> = request
        .messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content
            })
        })
        .collect();

    let body = serde_json::json!({
        "model": request.model,
        "messages": messages_json,
        "temperature": 0.7,
        "max_tokens": 2000
    });

    let response = client
        .post(&request.api_endpoint)
        .header("Authorization", format!("Bearer {}", request.api_key))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API 返回错误 ({}): {}", status, error_text));
    }

    let response_text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

    let json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("解析响应失败: {} - 原始响应: {}", e, &response_text[..200.min(response_text.len())]))?;

    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("无法从响应中提取内容")?
        .to_string();

    Ok(AiResponse { content })
}

struct AppState {
    db: std::sync::Mutex<rusqlite::Connection>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Initialize SQLite database
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            let db_path = app_dir.join("promptcraft.db");
            let db = rusqlite::Connection::open(&db_path).expect("Failed to open database");

            // Create tables
            db.execute_batch(
                "CREATE TABLE IF NOT EXISTS prompts (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    category TEXT,
                    tags TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    concept TEXT NOT NULL,
                    messages TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );",
            )
            .expect("Failed to create tables");

            app.manage(AppState {
                db: std::sync::Mutex::new(db),
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_prompt,
            get_prompts,
            delete_prompt,
            save_conversation,
            get_conversations,
            get_settings,
            save_settings,
            call_ai_api,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
