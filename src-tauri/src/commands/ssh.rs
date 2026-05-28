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

fn parse_connection_string(connection_string: &str) -> Result<(&str, &str), AppError> {
    let parts: Vec<&str> = connection_string.splitn(2, '@').collect();
    match parts.as_slice() {
        [user, host] if !user.is_empty() && !host.is_empty() => Ok((user, host)),
        _ => Err(AppError::InvalidConnectionString),
    }
}

#[tauri::command]
pub async fn ssh_test_connection(
    pem_path: String,
    connection_string: String,
) -> Result<(), AppError> {
    let (username, host) = parse_connection_string(&connection_string)?;

    let secret_key = load_secret_key(&pem_path, None).map_err(|e| {
        if std::path::Path::new(&pem_path).exists() {
            AppError::PemParseFailed(pem_path.clone())
        } else {
            AppError::PemReadFailed {
                path: pem_path.clone(),
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
    use super::parse_connection_string;
    use crate::errors::AppError;

    #[test]
    fn parse_connection_string_should_return_user_and_host_for_valid_input() {
        let (user, host) = parse_connection_string("ubuntu@ec2-1-2-3-4.compute-1.amazonaws.com")
            .expect("debe parsear correctamente");
        assert_eq!(user, "ubuntu");
        assert_eq!(host, "ec2-1-2-3-4.compute-1.amazonaws.com");
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
        let (user, host) = parse_connection_string("user@host@extra")
            .expect("splitn(2) toma el resto como host");
        assert_eq!(user, "user");
        assert_eq!(host, "host@extra");
    }
}