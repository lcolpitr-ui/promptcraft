/// 简单的 XOR 加密（基于机器特征）
/// 注意：这不是军事级加密，只是防止明文存储
/// 生产环境应使用系统密钥链（Windows Credential Manager）

/// 获取机器特定的密钥字节
fn get_machine_key_bytes() -> Vec<u8> {
    let machine_id = format!(
        "{}-{}-promptcraft-salt",
        hostname::get().unwrap_or_default().to_string_lossy(),
        std::env::var("USERNAME").unwrap_or_else(|_| std::env::var("USER").unwrap_or_default())
    );
    machine_id.into_bytes()
}

/// 简单 XOR 加密 + Base64 编码
pub fn encrypt_api_key(api_key: &str) -> String {
    if api_key.is_empty() {
        return String::new();
    }

    let key = get_machine_key_bytes();
    let encrypted: Vec<u8> = api_key
        .bytes()
        .enumerate()
        .map(|(i, b)| b ^ key[i % key.len()])
        .collect();

    // 转换为十六进制字符串
    encrypted.iter().map(|b| format!("{:02x}", b)).collect()
}

/// 解密十六进制编码的 API Key
pub fn decrypt_api_key(encrypted_hex: &str) -> Option<String> {
    if encrypted_hex.is_empty() {
        return Some(String::new());
    }

    // 从十六进制解码
    let encrypted: Vec<u8> = (0..encrypted_hex.len())
        .step_by(2)
        .filter_map(|i| encrypted_hex.get(i..i + 2))
        .filter_map(|hex| u8::from_str_radix(hex, 16).ok())
        .collect();

    let key = get_machine_key_bytes();
    let decrypted: Vec<u8> = encrypted
        .iter()
        .enumerate()
        .map(|(i, &b)| b ^ key[i % key.len()])
        .collect();

    String::from_utf8(decrypted).ok()
}

// hostname 模块（简化版，避免外部依赖）
mod hostname {
    pub fn get() -> Result<std::ffi::OsString, std::io::Error> {
        #[cfg(target_os = "windows")]
        {
            std::env::var("COMPUTERNAME")
                .map(|s| std::ffi::OsString::from(s))
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::env::var("HOSTNAME")
                .map(|s| std::ffi::OsString::from(s))
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let api_key = "sk-test123456789";
        let encrypted = encrypt_api_key(api_key);
        assert_ne!(encrypted, api_key);

        let decrypted = decrypt_api_key(&encrypted).unwrap();
        assert_eq!(decrypted, api_key);
    }

    #[test]
    fn test_empty_key() {
        let encrypted = encrypt_api_key("");
        assert!(encrypted.is_empty());

        let decrypted = decrypt_api_key("").unwrap();
        assert!(decrypted.is_empty());
    }
}
