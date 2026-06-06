const SERVICE_NAME: &str = "PromptCraft";
const API_KEY_USER: &str = "api_key";

fn credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_NAME, API_KEY_USER)
        .map_err(|e| format!("无法访问系统凭据存储: {}", e))
}

pub fn store_api_key(api_key: &str) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return delete_api_key();
    }

    credential_entry()?
        .set_password(api_key)
        .map_err(|e| format!("保存 API Key 到系统凭据存储失败: {}", e))
}

pub fn load_api_key() -> Result<String, String> {
    match credential_entry()?.get_password() {
        Ok(api_key) => Ok(api_key),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(format!("读取系统凭据存储中的 API Key 失败: {}", e)),
    }
}

pub fn delete_api_key() -> Result<(), String> {
    match credential_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("删除系统凭据存储中的 API Key 失败: {}", e)),
    }
}

fn get_machine_key_bytes() -> Vec<u8> {
    let machine_id = format!(
        "{}-{}-promptcraft-salt",
        hostname::get().unwrap_or_default().to_string_lossy(),
        std::env::var("USERNAME").unwrap_or_else(|_| std::env::var("USER").unwrap_or_default())
    );
    machine_id.into_bytes()
}

pub fn decrypt_legacy_api_key(encrypted_hex: &str) -> Option<String> {
    if encrypted_hex.is_empty() {
        return Some(String::new());
    }

    if encrypted_hex.len() % 2 != 0 {
        return None;
    }

    let encrypted: Vec<u8> = (0..encrypted_hex.len())
        .step_by(2)
        .map(|i| encrypted_hex.get(i..i + 2).and_then(|hex| u8::from_str_radix(hex, 16).ok()))
        .collect::<Option<Vec<u8>>>()?;

    let key = get_machine_key_bytes();
    let decrypted: Vec<u8> = encrypted
        .iter()
        .enumerate()
        .map(|(i, &b)| b ^ key[i % key.len()])
        .collect();

    String::from_utf8(decrypted).ok()
}

#[cfg(test)]
pub fn encrypt_legacy_api_key_for_test(api_key: &str) -> String {
    if api_key.is_empty() {
        return String::new();
    }

    let key = get_machine_key_bytes();
    api_key
        .bytes()
        .enumerate()
        .map(|(i, b)| format!("{:02x}", b ^ key[i % key.len()]))
        .collect()
}

mod hostname {
    pub fn get() -> Result<std::ffi::OsString, std::io::Error> {
        #[cfg(target_os = "windows")]
        {
            std::env::var("COMPUTERNAME")
                .map(std::ffi::OsString::from)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::env::var("HOSTNAME")
                .map(std::ffi::OsString::from)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decrypts_legacy_api_key() {
        let api_key = "sk-test123456789";
        let encrypted = encrypt_legacy_api_key_for_test(api_key);

        let decrypted = decrypt_legacy_api_key(&encrypted).unwrap();

        assert_eq!(decrypted, api_key);
    }

    #[test]
    fn rejects_malformed_legacy_api_key() {
        assert!(decrypt_legacy_api_key("not-hex").is_none());
    }
}
