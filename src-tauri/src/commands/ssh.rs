use russh::client::{self, Handler};
use russh::keys::{load_secret_key, PrivateKeyWithHashAlg};
use russh::{Channel, ChannelMsg, Disconnect};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

use tauri::{AppHandle, Emitter};

use crate::errors::AppError;

const SSH_PORT: u16 = 22;
const TCP_TIMEOUT_SECS: u64 = 10;

// ── Payload del evento terminal:line ─────────────────────────────────────────

/// Tipo de línea emitida al frontend via el evento `terminal:line`.
#[derive(serde::Serialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum TerminalLine {
    /// Línea estándar de output del servidor
    Out { text: String },
    /// Línea de error (stderr)
    Error { text: String },
    /// Línea en blanco
    Blank,
}

// ── Handler mínimo para russh ─────────────────────────────────────────────────

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

// ── Parsing de cadena de conexión ─────────────────────────────────────────────

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

    for ch in input.chars() {
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

// ── Helper: abrir sesión SSH autenticada ──────────────────────────────────────

/// Abre una sesión SSH y devuelve el cliente autenticado.
/// Reutilizado tanto por `ssh_test_connection` como por `ssh_connect`.
async fn open_ssh_session(
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

// ── Helper: ejecutar un comando y recolectar su output ───────────────────────

/// Ejecuta `cmd` en el servidor y devuelve (stdout_lines, exit_code).
/// El output se emite línea a línea via `emit_line` para streaming en tiempo real.
async fn run_remote_command(
    session: &client::Handle<MinimalHandler>,
    cmd: &str,
    emit_line: impl Fn(TerminalLine),
) -> Result<u32, AppError> {
    let mut channel: Channel<client::Msg> = session
        .channel_open_session()
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    channel
        .exec(true, cmd)
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    let mut exit_code = 0u32;
    let mut stdout_buf = Vec::new();
    let mut stderr_buf = Vec::new();

    loop {
        let Some(msg) = channel.wait().await else {
            break;
        };

        match msg {
            ChannelMsg::Data { data } => {
                stdout_buf.extend_from_slice(&data);
                // Emitir líneas completas (terminadas en \n) en tiempo real
                while let Some(pos) = stdout_buf.iter().position(|&b| b == b'\n') {
                    let line_bytes = stdout_buf.drain(..=pos).collect::<Vec<_>>();
                    let line = String::from_utf8_lossy(&line_bytes)
                        .trim_end_matches(['\n', '\r'])
                        .to_owned();
                    if line.is_empty() {
                        emit_line(TerminalLine::Blank);
                    } else {
                        emit_line(TerminalLine::Out { text: line });
                    }
                }
            }
            ChannelMsg::ExtendedData { data, .. } => {
                stderr_buf.extend_from_slice(&data);
                while let Some(pos) = stderr_buf.iter().position(|&b| b == b'\n') {
                    let line_bytes = stderr_buf.drain(..=pos).collect::<Vec<_>>();
                    let line = String::from_utf8_lossy(&line_bytes)
                        .trim_end_matches(['\n', '\r'])
                        .to_owned();
                    if !line.is_empty() {
                        emit_line(TerminalLine::Error { text: line });
                    }
                }
            }
            ChannelMsg::ExitStatus { exit_status } => {
                exit_code = exit_status;
            }
            ChannelMsg::Eof => {}
            _ => {}
        }
    }

    // Emitir cualquier resto en el buffer sin \n final
    if !stdout_buf.is_empty() {
        let line = String::from_utf8_lossy(&stdout_buf)
            .trim_end_matches(['\n', '\r'])
            .to_owned();
        if !line.is_empty() {
            emit_line(TerminalLine::Out { text: line });
        }
    }
    if !stderr_buf.is_empty() {
        let line = String::from_utf8_lossy(&stderr_buf)
            .trim_end_matches(['\n', '\r'])
            .to_owned();
        if !line.is_empty() {
            emit_line(TerminalLine::Error { text: line });
        }
    }

    Ok(exit_code)
}

// ── Comandos Tauri ────────────────────────────────────────────────────────────

/// Prueba la conexión SSH sin streaming: solo verifica que la autenticación
/// sea correcta. Usado por el botón "Probar conexión".
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

    let session = open_ssh_session(&effective_pem, username, host).await?;

    let _ = session
        .disconnect(Disconnect::ByApplication, "test completed", "en")
        .await;

    Ok(())
}

/// Conecta al servidor SSH, ejecuta `ls`, emite el output línea a línea via
/// el evento `terminal:line`, luego cierra la sesión. Usado por el botón
/// "Conectar".
///
/// Las líneas cosméticas del lado del cliente (`cd`, `ssh -i …`) las genera
/// el frontend antes de invocar este comando; aquí solo emitimos lo que
/// viene del servidor.
#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
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

    // Abrir sesión SSH
    let session = open_ssh_session(&effective_pem, username, host).await?;

    // Emitir mensaje de conexión exitosa
    let _ = app.emit(
        "terminal:line",
        TerminalLine::Out {
            text: "Conexión exitosa. Ya puedes usar la consola.".to_owned(),
        },
    );
    let _ = app.emit("terminal:line", TerminalLine::Blank);

    // Ejecutar `ls` y emitir output en tiempo real
    {
        let app_ref = app.clone();
        run_remote_command(&session, "ls", move |line| {
            let _ = app_ref.emit("terminal:line", line);
        })
        .await?;
    }

    // Línea en blanco + mensaje de recordatorio para el desarrollador
    let _ = app.emit("terminal:line", TerminalLine::Blank);
    let _ = app.emit(
        "terminal:line",
        TerminalLine::Out {
            text: "[ DEV ] La conexión y ejecución de comandos es correcta.".to_owned(),
        },
    );
    let _ = app.emit(
        "terminal:line",
        TerminalLine::Out {
            text: "[ DEV ] Siguiente paso: configurar el sistema para aceptar input del usuario.".to_owned(),
        },
    );
    let _ = app.emit("terminal:line", TerminalLine::Blank);

    // Ejecutar exit y cerrar la sesión limpiamente
    {
        let app_ref = app.clone();
        run_remote_command(&session, "exit", move |line| {
            let _ = app_ref.emit("terminal:line", line);
        })
        .await
        .ok(); // exit puede devolver código != 0, lo ignoramos
    }

    let _ = session
        .disconnect(Disconnect::ByApplication, "connect completed", "en")
        .await;

    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

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
        let parsed =
            parse_connection_string("ssh -i 'my key.pem' admin@server.com")
                .expect("debe parsear comillas simples");
        assert_eq!(parsed.username, "admin");
        assert_eq!(parsed.host, "server.com");
        assert_eq!(parsed.pem_path.as_deref(), Some("my key.pem"));
    }

    #[test]
    fn parse_ssh_command_should_skip_known_flags_with_values() {
        let parsed = parse_connection_string("ssh -p 2222 -i key.pem root@example.com")
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