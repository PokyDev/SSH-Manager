use russh::client::{self, Handler};
use russh::keys::{load_secret_key, PrivateKeyWithHashAlg};
use russh::Disconnect;
use std::sync::Arc;
use tokio::net::TcpStream;

use crate::errors::AppError;

const SSH_PORT: u16 = 22;
const TCP_TIMEOUT_SECS: u64 = 10;

struct MinimalHandler;

impl Handler for MinimalHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

struct ParsedConnection {
    username: String,
    host: String,
    pem_path: Option<String>,
}

fn parse_connection_string(connection_string: &str) -> Result<ParsedConnection, AppError> {
    let trimmed = connection_string.trim();

    if trimmed.starts_with("ssh ") {
        parse_ssh_command(trimmed)
    } else {
        let (user, host) = split_user_host(trimmed)?;
        Ok(ParsedConnection {
            username: user.to_owned(),
            host: host.to_owned(),
            pem_path: None,
        })
    }
}

fn split_user_host(s: &str) -> Result<(&str, &str), AppError> {
    let parts: Vec<&str> = s.splitn(2, '@').collect();
    match parts.as_slice() {
        [user, host] if !user.is_empty() && !host.is_empty() => Ok((user, host)),
        _ => Err(AppError::InvalidConnectionString),
    }
}

fn parse_ssh_command(input: &str) -> Result<ParsedConnection, AppError> {
    let tokens = shell_words_split(input)?;
    let mut pem_path: Option<String> = None;
    let mut user_host: Option<String> = None;

    let mut i = 1;
    while i < tokens.len() {
        let token = &tokens[i];
        if token == "-i" {
            i += 1;
            if i < tokens.len() {
                pem_path = Some(tokens[i].clone());
            }
        } else if token == "-p" || token == "-P" || token == "-l" || token == "-o" {
            i += 1;
        } else if !token.starts_with('-') {
            user_host = Some(token.clone());
        }
        i += 1;
    }

    let user_host_str = user_host.ok_or(AppError::InvalidConnectionString)?;
    let (user, host) = split_user_host(&user_host_str)?;

    Ok(ParsedConnection {
        username: user.to_owned(),
        host: host.to_owned(),
        pem_path,
    })
}

fn shell_words_split(input: &str) -> Result<Vec<String>, AppError> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_single_quote = false;
    let mut in_double_quote = false;
    let chars = input.chars();

    for ch in chars {
        match ch {
            '\'' if !in_double_quote => {
                in_single_quote = !in_single_quote;
            }
            '"' if !in_single_quote => {
                in_double_quote = !in_double_quote;
            }
            ' ' | '\t' if !in_single_quote && !in_double_quote => {
                if !current.is_empty() {
                    tokens.push(current.clone());
                    current.clear();
                }
            }
            _ => {
                current.push(ch);
            }
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }

    Ok(tokens)
}

#[tauri::command]
pub async fn ssh_test_connection(
    pem_path: String,
    connection_string: String,
) -> Result<(), AppError> {
    let parsed = parse_connection_string(&connection_string)?;
    let username = parsed.username.as_str();
    let host = parsed.host.as_str();
    let effective_pem = if pem_path.is_empty() {
        parsed.pem_path.unwrap_or_default()
    } else {
        pem_path
    };

    let secret_key = load_secret_key(&effective_pem, None).map_err(|e| {
        if std::path::Path::new(&effective_pem).exists() {
            AppError::PemParseFailed(effective_pem.clone())
        } else {
            AppError::PemReadFailed {
                path: effective_pem.clone(),
                reason: e.to_string(),
            }
        }
    })?;

    let addr = format!("{}:{}", host, SSH_PORT);
    let tcp = tokio::time::timeout(
        std::time::Duration::from_secs(TCP_TIMEOUT_SECS),
        TcpStream::connect(&addr),
    )
    .await
    .map_err(|_| AppError::TcpConnectionFailed {
        host: host.to_owned(),
        port: SSH_PORT,
        reason: format!("timeout después de {}s", TCP_TIMEOUT_SECS),
    })?
    .map_err(|e| AppError::TcpConnectionFailed {
        host: host.to_owned(),
        port: SSH_PORT,
        reason: e.to_string(),
    })?;

    let config = Arc::new(client::Config::default());
    let mut session = client::connect_stream(config, tcp, MinimalHandler)
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    let hash_alg = session
        .best_supported_rsa_hash()
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?
        .flatten();

    let key_pair = PrivateKeyWithHashAlg::new(Arc::new(secret_key), hash_alg);

    let auth_result = session
        .authenticate_publickey(username, key_pair)
        .await
        .map_err(|e| AppError::SshAuthFailed(format!("{}: {}", username, e)))?;

    if !auth_result.success() {
        return Err(AppError::SshAuthFailed(username.to_owned()));
    }

    let _ = session
        .disconnect(Disconnect::ByApplication, "test completed", "en")
        .await;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{parse_connection_string, shell_words_split};
    use crate::errors::AppError;

    #[test]
    fn parse_connection_string_should_return_user_and_host_for_valid_input() {
        let parsed = parse_connection_string("ubuntu@ec2-1-2-3-4.compute-1.amazonaws.com")
            .expect("debe parsear correctamente");
        assert_eq!(parsed.username, "ubuntu");
        assert_eq!(parsed.host, "ec2-1-2-3-4.compute-1.amazonaws.com");
        assert!(parsed.pem_path.is_none());
    }

    #[test]
    fn parse_connection_string_should_fail_when_missing_at_symbol() {
        let result = parse_connection_string("ubuntu-no-at-symbol");
        assert!(matches!(result, Err(AppError::InvalidConnectionString)));
    }

    #[test]
    fn parse_connection_string_should_fail_when_user_is_empty() {
        let result = parse_connection_string("@host.example.com");
        assert!(matches!(result, Err(AppError::InvalidConnectionString)));
    }

    #[test]
    fn parse_connection_string_should_fail_when_host_is_empty() {
        let result = parse_connection_string("ubuntu@");
        assert!(matches!(result, Err(AppError::InvalidConnectionString)));
    }

    #[test]
    fn parse_connection_string_should_handle_host_with_at_in_it() {
        let parsed = parse_connection_string("user@host@extra")
            .expect("splitn(2) toma el resto como host");
        assert_eq!(parsed.username, "user");
        assert_eq!(parsed.host, "host@extra");
    }

    #[test]
    fn parse_ssh_command_should_extract_user_host_and_pem() {
        let parsed = parse_connection_string(
            r#"ssh -i "Coragem.pem" ubuntu@ec2-3-223-213-238.compute-1.amazonaws.com"#,
        )
        .expect("debe parsear comando ssh");
        assert_eq!(parsed.username, "ubuntu");
        assert_eq!(parsed.host, "ec2-3-223-213-238.compute-1.amazonaws.com");
        assert_eq!(parsed.pem_path.as_deref(), Some("Coragem.pem"));
    }

    #[test]
    fn parse_ssh_command_should_extract_user_host_without_i_flag() {
        let parsed = parse_connection_string("ssh ubuntu@192.168.1.100")
            .expect("debe parsear comando ssh sin flags");
        assert_eq!(parsed.username, "ubuntu");
        assert_eq!(parsed.host, "192.168.1.100");
        assert!(parsed.pem_path.is_none());
    }

    #[test]
    fn parse_ssh_command_should_handle_single_quoted_pem() {
        let parsed = parse_connection_string(
            "ssh -i 'my key.pem' admin@server.com",
        )
        .expect("debe parsear comillas simples");
        assert_eq!(parsed.username, "admin");
        assert_eq!(parsed.host, "server.com");
        assert_eq!(parsed.pem_path.as_deref(), Some("my key.pem"));
    }

    #[test]
    fn parse_ssh_command_should_skip_known_flags_with_values() {
        let parsed = parse_connection_string(
            "ssh -p 2222 -i key.pem root@example.com",
        )
        .expect("debe saltar flag -p");
        assert_eq!(parsed.username, "root");
        assert_eq!(parsed.host, "example.com");
        assert_eq!(parsed.pem_path.as_deref(), Some("key.pem"));
    }

    #[test]
    fn parse_ssh_command_should_fail_without_user_host() {
        let result = parse_connection_string("ssh -i key.pem");
        assert!(matches!(result, Err(AppError::InvalidConnectionString)));
    }

    #[test]
    fn shell_words_split_should_handle_double_quotes() {
        let tokens = shell_words_split(r#"ssh -i "My Key.pem" user@host"#)
            .expect("debe separar tokens");
        assert_eq!(tokens, vec!["ssh", "-i", "My Key.pem", "user@host"]);
    }

    #[test]
    fn shell_words_split_should_handle_single_quotes() {
        let tokens = shell_words_split("ssh -i 'My Key.pem' user@host")
            .expect("debe separar tokens");
        assert_eq!(tokens, vec!["ssh", "-i", "My Key.pem", "user@host"]);
    }
}