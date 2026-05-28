use russh::client::{self, Handler};
use russh::keys::{load_secret_key, PrivateKeyWithHashAlg};
use std::sync::Arc;
use tokio::net::TcpStream;

use crate::errors::AppError;

const SSH_PORT: u16 = 22;
const TCP_TIMEOUT_SECS: u64 = 10;

pub(super) struct MinimalHandler;

impl Handler for MinimalHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

pub async fn open_ssh_session(
    pem_path: &str,
    username: &str,
    host: &str,
) -> Result<client::Handle<MinimalHandler>, AppError> {
    let secret_key = load_secret_key(pem_path, None).map_err(|e| {
        if std::path::Path::new(pem_path).exists() {
            AppError::PemParseFailed(pem_path.to_owned())
        } else {
            AppError::PemReadFailed {
                path: pem_path.to_owned(),
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

    Ok(session)
}
