mod parse;
mod pty;
mod session;
#[cfg(test)]
mod tests;

use russh::{Channel, ChannelMsg, Disconnect};
use tauri::{AppHandle, Emitter};

use crate::errors::AppError;
use parse::parse_connection_string;
use pty::{drain_pty_buffer, strip_ansi, TerminalLine};
use session::open_ssh_session;

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

    let session = open_ssh_session(&effective_pem, username, host).await?;

    let mut channel: Channel<russh::client::Msg> = session
        .channel_open_session()
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    channel
        .request_pty(
            true,
            "xterm-256color",
            220,
            50,
            0,
            0,
            &[],
        )
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    channel
        .request_shell(true)
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    let mut buf: Vec<u8> = Vec::new();
    let mut exit_code: u32 = 0;

    let mut emit = |line: TerminalLine| {
        let _ = app.emit("terminal:line", line);
    };

    let banner_deadline = tokio::time::Instant::now()
        + std::time::Duration::from_millis(800);

    loop {
        let remaining = banner_deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        match tokio::time::timeout(remaining, channel.wait()).await {
            Ok(Some(ChannelMsg::Data { data })) => {
                buf.extend_from_slice(&data);
            }
            Ok(Some(ChannelMsg::ExitStatus { exit_status })) => {
                exit_code = exit_status;
            }
            Ok(Some(ChannelMsg::Eof)) | Ok(None) => {
                drain_pty_buffer(&mut buf, &mut emit);
                let _ = session
                    .disconnect(Disconnect::ByApplication, "connect completed", "en")
                    .await;
                return Ok(());
            }
            Ok(_) => {}
            Err(_) => {
                break;
            }
        }
    }

    drain_pty_buffer(&mut buf, &mut emit);

    channel
        .data(b"ls\n" as &[u8])
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    let ls_deadline = tokio::time::Instant::now()
        + std::time::Duration::from_millis(3000);

    loop {
        let remaining = ls_deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        match tokio::time::timeout(remaining, channel.wait()).await {
            Ok(Some(ChannelMsg::Data { data })) => {
                buf.extend_from_slice(&data);
                drain_pty_buffer(&mut buf, &mut emit);

                let tail = String::from_utf8_lossy(&buf);
                if tail.contains('$') {
                    break;
                }
            }
            Ok(Some(ChannelMsg::ExitStatus { exit_status })) => {
                exit_code = exit_status;
            }
            Ok(Some(ChannelMsg::Eof)) | Ok(None) => {
                drain_pty_buffer(&mut buf, &mut emit);
                let _ = session
                    .disconnect(Disconnect::ByApplication, "connect completed", "en")
                    .await;
                return Ok(());
            }
            Ok(_) => {}
            Err(_) => break,
        }
    }

    drain_pty_buffer(&mut buf, &mut emit);

    channel
        .data(b"exit\n" as &[u8])
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    let exit_deadline = tokio::time::Instant::now()
        + std::time::Duration::from_millis(2000);

    loop {
        let remaining = exit_deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        match tokio::time::timeout(remaining, channel.wait()).await {
            Ok(Some(ChannelMsg::Data { data })) => {
                buf.extend_from_slice(&data);
                drain_pty_buffer(&mut buf, &mut emit);
            }
            Ok(Some(ChannelMsg::ExitStatus { exit_status })) => {
                exit_code = exit_status;
            }
            Ok(Some(ChannelMsg::Eof)) | Ok(None) => {
                break;
            }
            Ok(_) => {}
            Err(_) => break,
        }
    }

    drain_pty_buffer(&mut buf, &mut emit);

    if !buf.is_empty() {
        let text = strip_ansi(&buf);
        if !text.is_empty() {
            emit(TerminalLine::Out { text });
        }
    }

    let _ = session
        .disconnect(Disconnect::ByApplication, "connect completed", "en")
        .await;

    let _ = exit_code;

    Ok(())
}
