use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tokio::sync::Mutex;

mod crypto;
use crypto::{delete_api_key, decrypt_legacy_api_key, load_api_key, store_api_key};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Prompt {
    pub id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub tags: Vec<String>,
    #[serde(default)]
    pub is_favorite: bool,
    #[serde(default)]
    pub is_pinned: bool,
    #[serde(default)]
    pub source_session_id: Option<String>,
    #[serde(default)]
    pub source_session_title: Option<String>,
    #[serde(default)]
    pub source_framework: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub updated_at: Option<String>,
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
    #[serde(default)]
    pub api_key: String,
    pub api_endpoint: String,
    pub model: String,
    pub language: String,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[serde(default = "default_request_timeout_secs")]
    pub request_timeout_secs: u64,
    #[serde(default)]
    pub enable_streaming: bool,
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
    pub request_id: String,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[serde(default = "default_request_timeout_secs")]
    pub request_timeout_secs: u64,
    #[serde(default)]
    pub stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiResponse {
    pub content: String,
    pub request_id: String,
    pub stream_used: bool,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct DataBackup {
    pub version: u32,
    pub exported_at: String,
    pub conversations: Vec<Conversation>,
    pub prompts: Vec<Prompt>,
    pub custom_frameworks: Vec<CustomFramework>,
    pub settings: Settings,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub conversations: usize,
    pub prompts: usize,
    pub custom_frameworks: usize,
}

fn default_temperature() -> f32 {
    0.7
}

fn default_max_tokens() -> u32 {
    2000
}

fn default_request_timeout_secs() -> u64 {
    60
}

fn clamp_temperature(value: f32) -> f32 {
    if value.is_finite() {
        value.clamp(0.0, 2.0)
    } else {
        default_temperature()
    }
}

fn clamp_max_tokens(value: u32) -> u32 {
    value.clamp(1, 128_000)
}

fn clamp_timeout_secs(value: u64) -> u64 {
    value.clamp(5, 300)
}

fn preview_text(value: &str) -> String {
    value.chars().take(500).collect()
}

fn extract_error_message(json: &serde_json::Value) -> Option<String> {
    json.get("error")
        .and_then(|error| {
            error.get("message")
                .or_else(|| error.get("detail"))
                .and_then(|value| value.as_str())
                .or_else(|| error.as_str())
        })
        .map(ToString::to_string)
}

fn format_api_error(status: reqwest::StatusCode, error_text: &str) -> String {
    let provider_message = serde_json::from_str::<serde_json::Value>(error_text)
        .ok()
        .and_then(|json| extract_error_message(&json))
        .unwrap_or_else(|| preview_text(error_text));
    let detail = if provider_message.trim().is_empty() {
        "服务商没有返回错误详情".to_string()
    } else {
        provider_message
    };

    match status.as_u16() {
        401 => format!("API Key 无效或已过期，请检查设置中的 API Key。服务商返回：{}", detail),
        403 => format!("当前 API Key 没有权限、额度不足或账号受限。服务商返回：{}", detail),
        404 => format!("模型或 API Endpoint 不存在，请检查模型名称和端点地址。服务商返回：{}", detail),
        429 => format!("请求过于频繁或额度达到限制，请稍后重试。服务商返回：{}", detail),
        400 => format!("请求参数不被服务商接受，请检查模型、temperature、max tokens 和 endpoint。服务商返回：{}", detail),
        _ => format!("API 返回错误 ({}): {}", status, detail),
    }
}

fn extract_response_content(json: &serde_json::Value) -> Result<String, String> {
    if let Some(content) = json
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
    {
        return Ok(content.to_string());
    }

    if let Some(content) = json
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("text"))
        .and_then(|content| content.as_str())
    {
        return Ok(content.to_string());
    }

    if let Some(content) = json.get("output_text").and_then(|content| content.as_str()) {
        return Ok(content.to_string());
    }

    if let Some(output) = json.get("output").and_then(|output| output.as_array()) {
        let text = output
            .iter()
            .filter_map(|item| item.get("content").and_then(|content| content.as_array()))
            .flat_map(|content| content.iter())
            .filter_map(|part| {
                part.get("text")
                    .or_else(|| part.get("content"))
                    .and_then(|value| value.as_str())
            })
            .collect::<Vec<_>>()
            .join("");
        if !text.trim().is_empty() {
            return Ok(text);
        }
    }

    Err(format!(
        "响应格式不兼容：没有找到 choices[0].message.content、choices[0].text 或 output_text。响应预览：{}",
        preview_text(&json.to_string())
    ))
}

fn parse_json_field<T>(record_type: &str, record_id: &str, field_name: &str, value: &str) -> Result<T, String>
where
    T: for<'de> Deserialize<'de>,
{
    serde_json::from_str(value).map_err(|e| {
        format!(
            "{} 记录 {} 的 {} 字段 JSON 解析失败: {}",
            record_type, record_id, field_name, e
        )
    })
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

async fn wait_until_cancelled(cancel_flag: Arc<AtomicBool>) {
    while !cancel_flag.load(Ordering::SeqCst) {
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

#[tauri::command]
async fn save_prompt(state: tauri::State<'_, AppState>, prompt: Prompt) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO prompts (
            id, title, content, category, tags, is_favorite, is_pinned,
            source_session_id, source_session_title, source_framework, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            prompt.id,
            prompt.title,
            prompt.content,
            prompt.category,
            serde_json::to_string(&prompt.tags).map_err(|e| e.to_string())?,
            prompt.is_favorite,
            prompt.is_pinned,
            prompt.source_session_id,
            prompt.source_session_title,
            prompt.source_framework,
            prompt.created_at,
            prompt.updated_at
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_prompts(state: tauri::State<'_, AppState>) -> Result<Vec<Prompt>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, title, content, category, tags, is_favorite, is_pinned,
                source_session_id, source_session_title, source_framework, created_at, updated_at
            FROM prompts
            ORDER BY is_pinned DESC, created_at DESC"
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, bool>(5)?,
                row.get::<_, bool>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, Option<String>>(11)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut prompts = Vec::new();
    for row in rows {
        let (
            id,
            title,
            content,
            category,
            tags_str,
            is_favorite,
            is_pinned,
            source_session_id,
            source_session_title,
            source_framework,
            created_at,
            updated_at,
        ) = row.map_err(|e| e.to_string())?;
        prompts.push(Prompt {
            tags: parse_json_field("prompt", &id, "tags", &tags_str)?,
            id,
            title,
            content,
            category,
            is_favorite,
            is_pinned,
            source_session_id,
            source_session_title,
            source_framework,
            created_at,
            updated_at,
        });
    }
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
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut convs = Vec::new();
    for row in rows {
        let (id, title, concept, msg_str, framework, created_at) = row.map_err(|e| e.to_string())?;
        convs.push(Conversation {
            messages: parse_json_field("conversation", &id, "messages", &msg_str)?,
            id,
            title,
            concept,
            framework,
            created_at,
        });
    }
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
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut frameworks = Vec::new();
    for row in rows {
        let (id, name, description, best_for_str, template, created_at) = row.map_err(|e| e.to_string())?;
        frameworks.push(CustomFramework {
            best_for: parse_json_field("custom_framework", &id, "best_for", &best_for_str)?,
            id,
            name,
            description,
            template,
            created_at,
        });
    }
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
async fn export_data(state: tauri::State<'_, AppState>) -> Result<DataBackup, String> {
    let mut settings = get_settings().await?;
    settings.api_key.clear();

    Ok(DataBackup {
        version: 1,
        exported_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs().to_string())
            .unwrap_or_else(|_| "0".to_string()),
        conversations: get_conversations(state.clone()).await?,
        prompts: get_prompts(state.clone()).await?,
        custom_frameworks: get_custom_frameworks(state).await?,
        settings,
    })
}

fn validate_backup(backup: &DataBackup) -> Result<(), String> {
    if backup.version == 0 {
        return Err("导入文件版本无效".to_string());
    }
    for prompt in &backup.prompts {
        if prompt.id.trim().is_empty() || prompt.title.trim().is_empty() {
            return Err("导入文件包含无效提示词：id/title 不能为空".to_string());
        }
    }
    for conv in &backup.conversations {
        if conv.id.trim().is_empty() || conv.title.trim().is_empty() {
            return Err("导入文件包含无效会话：id/title 不能为空".to_string());
        }
    }
    for framework in &backup.custom_frameworks {
        if framework.id.trim().is_empty() || framework.name.trim().is_empty() || framework.template.trim().is_empty() {
            return Err("导入文件包含无效自定义框架：id/name/template 不能为空".to_string());
        }
    }
    Ok(())
}

#[tauri::command]
async fn import_data(
    state: tauri::State<'_, AppState>,
    backup: DataBackup,
    mode: String,
) -> Result<ImportResult, String> {
    validate_backup(&backup)?;
    let overwrite = mode == "overwrite";

    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        if overwrite {
            db.execute("DELETE FROM prompts", []).map_err(|e| e.to_string())?;
            db.execute("DELETE FROM conversations", []).map_err(|e| e.to_string())?;
            db.execute("DELETE FROM custom_frameworks", []).map_err(|e| e.to_string())?;
        }
    }

    let prompt_count = backup.prompts.len();
    let conversation_count = backup.conversations.len();
    let framework_count = backup.custom_frameworks.len();

    for prompt in backup.prompts {
        save_prompt(state.clone(), prompt).await?;
    }
    for conversation in backup.conversations {
        save_conversation(state.clone(), conversation).await?;
    }
    for framework in backup.custom_frameworks {
        save_custom_framework(state.clone(), framework).await?;
    }

    let mut settings = backup.settings;
    settings.api_key.clear();
    if !settings.api_endpoint.trim().is_empty() {
        save_non_sensitive_settings(settings)?;
    }

    Ok(ImportResult {
        conversations: conversation_count,
        prompts: prompt_count,
        custom_frameworks: framework_count,
    })
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
            let legacy_api_key = decrypt_legacy_api_key(&settings.api_key)
                .ok_or("旧版 API Key 解密失败，请重新在设置中保存 API Key")?;
            if !legacy_api_key.is_empty() {
                store_api_key(&legacy_api_key)?;
            }
            settings.api_key.clear();
            let sanitized = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
            std::fs::write(&settings_path, sanitized).map_err(|e| e.to_string())?;
        }

        settings.api_key = load_api_key()?;
        Ok(settings)
    } else {
        Ok(Settings {
            api_key: load_api_key()?,
            api_endpoint: "https://api.deepseek.com".to_string(),
            model: "deepseek-chat".to_string(),
            language: "zh".to_string(),
            temperature: default_temperature(),
            max_tokens: default_max_tokens(),
            request_timeout_secs: default_request_timeout_secs(),
            enable_streaming: false,
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
    settings_to_save.temperature = clamp_temperature(settings_to_save.temperature);
    settings_to_save.max_tokens = clamp_max_tokens(settings_to_save.max_tokens);
    settings_to_save.request_timeout_secs = clamp_timeout_secs(settings_to_save.request_timeout_secs);
    if settings_to_save.api_key.trim().is_empty() {
        delete_api_key()?;
    } else {
        store_api_key(&settings_to_save.api_key)?;
    }
    settings_to_save.api_key.clear();

    let content = serde_json::to_string_pretty(&settings_to_save).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

fn save_non_sensitive_settings(mut settings: Settings) -> Result<(), String> {
    let settings_path = dirs::config_dir()
        .ok_or("Cannot find config dir")?
        .join("promptcraft");
    std::fs::create_dir_all(&settings_path).map_err(|e| e.to_string())?;
    let file_path = settings_path.join("settings.json");

    settings.api_key.clear();
    settings.api_endpoint = normalize_api_endpoint(&settings.api_endpoint)?;
    settings.temperature = clamp_temperature(settings.temperature);
    settings.max_tokens = clamp_max_tokens(settings.max_tokens);
    settings.request_timeout_secs = clamp_timeout_secs(settings.request_timeout_secs);

    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn call_ai_api(
    request: AiRequest,
    state: tauri::State<'_, AppState>,
) -> Result<AiResponse, String> {
    let api_endpoint = normalize_api_endpoint(&request.api_endpoint)?;

    // 生成请求 ID
    let request_id = request.request_id.trim().to_string();
    if request_id.is_empty() {
        return Err("request_id 不能为空".to_string());
    }

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
        .timeout(Duration::from_secs(clamp_timeout_secs(request.request_timeout_secs)))
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
        "temperature": clamp_temperature(request.temperature),
        "max_tokens": clamp_max_tokens(request.max_tokens),
        "stream": false
    });

    // 发送请求
    let response_future = client
        .post(&api_endpoint)
        .header("Authorization", format!("Bearer {}", request.api_key))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&body)
        .send();

    let response = tokio::select! {
        result = response_future => result.map_err(|e| {
            if cancel_flag.load(Ordering::SeqCst) {
                "REQUEST_CANCELLED".to_string()
            } else if e.is_timeout() {
                format!("网络超时：请求超过 {} 秒未完成，请检查网络、endpoint 或调大请求超时。", clamp_timeout_secs(request.request_timeout_secs))
            } else if e.is_connect() {
                format!("连接失败：无法连接到 API Endpoint，请检查地址是否正确。详细错误：{}", e)
            } else {
                format!("请求失败: {}", e)
            }
        })?,
        _ = wait_until_cancelled(cancel_flag.clone()) => {
            state.task_manager.remove_task(&request_id).await;
            return Err("REQUEST_CANCELLED".to_string());
        }
    };

    // 检查是否被取消
    if cancel_flag.load(Ordering::SeqCst) {
        state.task_manager.remove_task(&request_id).await;
        return Err("REQUEST_CANCELLED".to_string());
    }

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        state.task_manager.remove_task(&request_id).await;
        return Err(format_api_error(status, &error_text));
    }

    let response_text = tokio::select! {
        result = response.text() => result.map_err(|e| format!("读取响应失败: {}", e))?,
        _ = wait_until_cancelled(cancel_flag.clone()) => {
            state.task_manager.remove_task(&request_id).await;
            return Err("REQUEST_CANCELLED".to_string());
        }
    };

    // 再次检查是否被取消
    if cancel_flag.load(Ordering::SeqCst) {
        state.task_manager.remove_task(&request_id).await;
        return Err("REQUEST_CANCELLED".to_string());
    }

    let json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("响应格式不兼容：服务商没有返回有效 JSON。解析错误：{}；响应预览：{}", e, preview_text(&response_text)))?;

    let content = extract_response_content(&json)?;

    // 清理任务
    state.task_manager.remove_task(&request_id).await;

    Ok(AiResponse {
        content,
        request_id,
        stream_used: false,
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
                    is_favorite INTEGER NOT NULL DEFAULT 0,
                    is_pinned INTEGER NOT NULL DEFAULT 0,
                    source_session_id TEXT,
                    source_session_title TEXT,
                    source_framework TEXT,
                    updated_at DATETIME,
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
            let _ = db.execute("ALTER TABLE prompts ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0", rusqlite::params![]);
            let _ = db.execute("ALTER TABLE prompts ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0", rusqlite::params![]);
            let _ = db.execute("ALTER TABLE prompts ADD COLUMN source_session_id TEXT", rusqlite::params![]);
            let _ = db.execute("ALTER TABLE prompts ADD COLUMN source_session_title TEXT", rusqlite::params![]);
            let _ = db.execute("ALTER TABLE prompts ADD COLUMN source_framework TEXT", rusqlite::params![]);
            let _ = db.execute("ALTER TABLE prompts ADD COLUMN updated_at DATETIME", rusqlite::params![]);

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
            export_data,
            import_data,
            call_ai_api,
            cancel_ai_request,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_deepseek_base_endpoint() {
        let endpoint = normalize_api_endpoint("https://api.deepseek.com").unwrap();

        assert_eq!(endpoint, "https://api.deepseek.com/chat/completions");
    }

    #[test]
    fn normalizes_openai_base_endpoint() {
        let endpoint = normalize_api_endpoint("https://api.openai.com").unwrap();

        assert_eq!(endpoint, "https://api.openai.com/v1/chat/completions");
    }

    #[test]
    fn keeps_complete_chat_completions_endpoint() {
        let endpoint = normalize_api_endpoint("https://example.com/v1/chat/completions").unwrap();

        assert_eq!(endpoint, "https://example.com/v1/chat/completions");
    }

    #[test]
    fn rejects_non_https_non_localhost_endpoint() {
        let error = normalize_api_endpoint("http://example.com").unwrap_err();

        assert!(error.contains("HTTPS"));
    }

    #[test]
    fn parse_json_field_returns_record_context_on_failure() {
        let error = parse_json_field::<Vec<String>>("prompt", "bad-id", "tags", "not-json")
            .unwrap_err();

        assert!(error.contains("prompt"));
        assert!(error.contains("bad-id"));
        assert!(error.contains("tags"));
    }
}
