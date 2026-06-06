use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::Manager;
use tokio::sync::Mutex;

mod crypto;
use crypto::{encrypt_api_key, decrypt_api_key};

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
    pub title: String,
    pub concept: String,
    pub messages: Vec<ChatMessage>,
    pub framework: Option<String>,
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
    pub request_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomFramework {
    pub id: String,
    pub name: String,
    pub description: String,
    pub best_for: Vec<String>,
    pub template: String,
    pub created_at: String,
}

fn normalize_api_endpoint(endpoint: &str) -> Result<String, String> {
    let endpoint = endpoint.trim().trim_end_matches('/');
    if endpoint.is_empty() {
        return Err("API 端点不能为空".to_string());
    }

    if !endpoint.starts_with("https://") && !endpoint.starts_with("http://localhost") {
        return Err("API 端点必须使用 HTTPS 协议".to_string());
    }

    let lower = endpoint.to_ascii_lowercase();
    if lower.ends_with("/chat/completions") {
        return Ok(endpoint.to_string());
    }

    if lower.contains("api.openai.com") {
        if lower.ends_with("/v1") {
            return Ok(format!("{}/chat/completions", endpoint));
        }
        return Ok(format!("{}/v1/chat/completions", endpoint));
    }

    Ok(format!("{}/chat/completions", endpoint))
}

// 任务管理器 - 用于跟踪和取消请求
struct TaskManager {
    cancel_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl TaskManager {
    fn new() -> Self {
        Self {
            cancel_flags: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn create_task(&self, request_id: String) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        let mut flags = self.cancel_flags.lock().await;
        flags.insert(request_id, flag.clone());
        flag
    }

    async fn cancel_task(&self, request_id: &str) -> bool {
        let mut flags = self.cancel_flags.lock().await;
        if let Some(flag) = flags.remove(request_id) {
            flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    async fn remove_task(&self, request_id: &str) {
        let mut flags = self.cancel_flags.lock().await;
        flags.remove(request_id);
    }
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
        "INSERT OR REPLACE INTO conversations (id, title, concept, messages, framework, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            conv.id,
            conv.title,
            conv.concept,
            serde_json::to_string(&conv.messages).unwrap(),
            conv.framework,
            conv.created_at
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_conversations(state: tauri::State<'_, AppState>) -> Result<Vec<Conversation>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, title, concept, messages, framework, created_at FROM conversations ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let convs = stmt
        .query_map([], |row| {
            let msg_str: String = row.get(3)?;
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                concept: row.get(2)?,
                messages: serde_json::from_str(&msg_str).unwrap_or_default(),
                framework: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(convs)
}

#[tauri::command]
async fn delete_conversation(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM conversations WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn save_custom_framework(state: tauri::State<'_, AppState>, framework: CustomFramework) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO custom_frameworks (id, name, description, best_for, template, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            framework.id,
            framework.name,
            framework.description,
            serde_json::to_string(&framework.best_for).unwrap(),
            framework.template,
            framework.created_at
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_custom_frameworks(state: tauri::State<'_, AppState>) -> Result<Vec<CustomFramework>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, name, description, best_for, template, created_at FROM custom_frameworks ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let frameworks = stmt
        .query_map([], |row| {
            let best_for_str: String = row.get(3)?;
            Ok(CustomFramework {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                best_for: serde_json::from_str(&best_for_str).unwrap_or_default(),
                template: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(frameworks)
}

#[tauri::command]
async fn delete_custom_framework(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM custom_frameworks WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_settings() -> Result<Settings, String> {
    let settings_path = dirs::config_dir()
        .ok_or("Cannot find config dir")?
        .join("promptcraft")
        .join("settings.json");
    if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        let mut settings: Settings = serde_json::from_str(&content).map_err(|e| e.to_string())?;

        if !settings.api_key.is_empty() {
            settings.api_key = decrypt_api_key(&settings.api_key).unwrap_or_default();
        }

        Ok(settings)
    } else {
        Ok(Settings {
            api_key: String::new(),
            api_endpoint: "https://api.deepseek.com".to_string(),
            model: "deepseek-chat".to_string(),
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

    let mut settings_to_save = settings;
    settings_to_save.api_endpoint = normalize_api_endpoint(&settings_to_save.api_endpoint)?;
    if !settings_to_save.api_key.is_empty() {
        settings_to_save.api_key = encrypt_api_key(&settings_to_save.api_key);
    }

    let content = serde_json::to_string_pretty(&settings_to_save).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn call_ai_api(
    request: AiRequest,
    state: tauri::State<'_, AppState>,
) -> Result<AiResponse, String> {
    let api_endpoint = normalize_api_endpoint(&request.api_endpoint)?;

    // 生成请求 ID
    let request_id = uuid::Uuid::new_v4().to_string();

    // 创建取消标志
    let cancel_flag = state.task_manager.create_task(request_id.clone()).await;

    // 检查是否已取消
    if cancel_flag.load(Ordering::SeqCst) {
        state.task_manager.remove_task(&request_id).await;
        return Err("REQUEST_CANCELLED".to_string());
    }

    // 创建 HTTP 客户端
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

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

    // 发送请求
    let response = client
        .post(&api_endpoint)
        .header("Authorization", format!("Bearer {}", request.api_key))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if cancel_flag.load(Ordering::SeqCst) {
                "REQUEST_CANCELLED".to_string()
            } else if e.is_timeout() {
                "请求超时，请检查网络或稍后重试".to_string()
            } else if e.is_connect() {
                format!("连接失败: {}", e)
            } else {
                format!("请求失败: {}", e)
            }
        })?;

    // 检查是否被取消
    if cancel_flag.load(Ordering::SeqCst) {
        state.task_manager.remove_task(&request_id).await;
        return Err("REQUEST_CANCELLED".to_string());
    }

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        state.task_manager.remove_task(&request_id).await;
        return Err(format!("API 返回错误 ({}): {}", status, error_text));
    }

    let response_text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

    // 再次检查是否被取消
    if cancel_flag.load(Ordering::SeqCst) {
        state.task_manager.remove_task(&request_id).await;
        return Err("REQUEST_CANCELLED".to_string());
    }

    let json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("解析响应失败: {} - 原始响应: {}", e, &response_text[..200.min(response_text.len())]))?;

    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("无法从响应中提取内容")?
        .to_string();

    // 清理任务
    state.task_manager.remove_task(&request_id).await;

    Ok(AiResponse {
        content,
        request_id,
    })
}

#[tauri::command]
async fn cancel_ai_request(
    request_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    Ok(state.task_manager.cancel_task(&request_id).await)
}

struct AppState {
    db: std::sync::Mutex<rusqlite::Connection>,
    task_manager: TaskManager,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            let db_path = app_dir.join("promptcraft.db");
            let db = rusqlite::Connection::open(&db_path).expect("Failed to open database");

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
                    title TEXT NOT NULL DEFAULT '新对话',
                    concept TEXT NOT NULL DEFAULT '',
                    messages TEXT NOT NULL DEFAULT '[]',
                    framework TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS custom_frameworks (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    best_for TEXT,
                    template TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );",
            )
            .expect("Failed to create tables");

            let _ = db.execute("ALTER TABLE conversations ADD COLUMN title TEXT NOT NULL DEFAULT '新对话'", rusqlite::params![]);
            let _ = db.execute("ALTER TABLE conversations ADD COLUMN framework TEXT", rusqlite::params![]);

            app.manage(AppState {
                db: std::sync::Mutex::new(db),
                task_manager: TaskManager::new(),
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
            delete_conversation,
            save_custom_framework,
            get_custom_frameworks,
            delete_custom_framework,
            get_settings,
            save_settings,
            call_ai_api,
            cancel_ai_request,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
