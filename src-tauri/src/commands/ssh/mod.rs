mod parse;
mod pty;
mod session;
#[cfg(test)]
mod tests;

use russh::{Channel, ChannelMsg, Disconnect};
use tauri::{AppHandle, Emitter};

use crate::errors::AppError;
use parse::parse_connection_string;
use pty::{drain_pty_buffer_ansi, looks_like_prompt, strip_ansi, text_with_ansi, TerminalLine};
use session::open_ssh_session;

// ── Constantes de tiempo ──────────────────────────────────────────────────────

/// Tiempo máximo para recibir el banner de bienvenida del servidor.
const BANNER_TIMEOUT_MS: u64 = 800;

/// Tiempo máximo para que `exec` finalice (incluyendo `ls`).
const EXEC_TIMEOUT_MS: u64 = 5_000;

// ── ssh_test_connection ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn ssh_test_connection(
    pem_path: String,
    connection_string: String,
) -> Result<(), AppError> {
    let parsed = parse_connection_string(&connection_string)?;
    let effective_pem = resolve_pem(&pem_path, parsed.pem_path);

    let session = open_ssh_session(&effective_pem, &parsed.username, &parsed.host).await?;
    let _ = session
        .disconnect(Disconnect::ByApplication, "test completed", "en")
        .await;

    Ok(())
}

// ── ssh_connect ───────────────────────────────────────────────────────────────
//
// Abre una sesión PTY+shell solo para capturar el banner de bienvenida
// (MOTD, last login, etc.) que el servidor envía automáticamente.
// El banner no se puede obtener con `exec` porque requiere un TTY.
// La ejecución de comandos posteriores se realiza vía `ssh_exec`.

#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    pem_path: String,
    connection_string: String,
) -> Result<Option<String>, AppError> {
    let parsed = parse_connection_string(&connection_string)?;
    let effective_pem = resolve_pem(&pem_path, parsed.pem_path);

    let emit = |line: TerminalLine| {
        let _ = app.emit("terminal:line", line);
    };

    let prompt = collect_banner(&effective_pem, &parsed.username, &parsed.host, &emit).await?;
    Ok(prompt)
}

// ── ssh_exec ──────────────────────────────────────────────────────────────────
//
// Ejecuta un comando arbitrario en una sesión SSH nueva usando `exec`
// (sin PTY, sin shell interactivo). Emite cada línea de stdout/stderr
// vía `terminal:line`. El frontend orquesta la secuencia de comandos.

#[tauri::command]
pub async fn ssh_exec(
    app: AppHandle,
    pem_path: String,
    connection_string: String,
    command: String,
) -> Result<(), AppError> {
    let parsed = parse_connection_string(&connection_string)?;
    let effective_pem = resolve_pem(&pem_path, parsed.pem_path);

    let emit = |line: TerminalLine| {
        let _ = app.emit("terminal:line", line);
    };

    run_exec_command(&effective_pem, &parsed.username, &parsed.host, &command, &emit).await?;

    Ok(())
}

// ── Helpers privados ──────────────────────────────────────────────────────────

/// Usa el `pem_path` explícito si no está vacío; si no, el extraído del
/// connection string (puede estar vacío en conexiones sin -i).
fn resolve_pem(explicit: &str, from_string: Option<String>) -> String {
    if explicit.is_empty() {
        from_string.unwrap_or_default()
    } else {
        explicit.to_owned()
    }
}

/// Abre un canal PTY+shell, espera el banner inicial durante `BANNER_TIMEOUT_MS`
/// y emite las líneas recibidas. Cierra el canal al terminar.
///
/// El banner es el contenido que el servidor envía automáticamente al conectar
/// (MOTD, "Welcome to Ubuntu …", etc.). Solo es accesible con un TTY real.
///
/// Si el fragmento final del banner parece un prompt de shell (p.ej.
/// `ubuntu@ip-172-31-19-136:~$`), se detecta y se retorna sin emitirlo como
/// línea de output. El frontend puede usarlo como prompt para los comandos
/// posteriores, evitando duplicar la línea del prompt.
async fn collect_banner(
    pem_path: &str,
    username: &str,
    host: &str,
    emit: &impl Fn(TerminalLine),
) -> Result<Option<String>, AppError> {
    let session = open_ssh_session(pem_path, username, host).await?;

    let mut channel: Channel<russh::client::Msg> = session
        .channel_open_session()
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    channel
        .request_pty(true, "xterm-256color", 220, 50, 0, 0, &[])
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    channel
        .request_shell(true)
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    let deadline = tokio::time::Instant::now()
        + std::time::Duration::from_millis(BANNER_TIMEOUT_MS);

    let mut buf: Vec<u8> = Vec::new();

    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        match tokio::time::timeout(remaining, channel.wait()).await {
            Ok(Some(ChannelMsg::Data { data })) => {
                buf.extend_from_slice(&data);
            }
            Ok(Some(ChannelMsg::ExitStatus { .. }))
            | Ok(Some(ChannelMsg::Eof))
            | Ok(None) => break,
            Ok(_) => {}
            Err(_) => break, // timeout
        }
    }

    // Emitir todo lo acumulado de una vez, al final del banner (con colores ANSI).
    drain_pty_buffer_ansi(&mut buf, &mut { emit });

    // El fragmento final del buffer (sin `\n`) suele ser el prompt del shell.
    // Si parece un prompt, lo retornamos sin emitirlo para que el frontend lo
    // use como prefijo de los comandos posteriores (ls, exit, etc.).
    let mut detected_prompt: Option<String> = None;

    if !buf.is_empty() {
        let visible = strip_ansi(&buf);
        if looks_like_prompt(&visible) {
            detected_prompt = Some(visible.trim_end().to_owned());
        } else if !visible.is_empty() {
            let text = text_with_ansi(&buf);
            emit(TerminalLine::Ansi { text });
        }
    }

    let _ = session
        .disconnect(Disconnect::ByApplication, "banner collected", "en")
        .await;

    Ok(detected_prompt)
}

/// Ejecuta `command` en una sesión SSH nueva usando `exec` (sin PTY, sin shell
/// interactivo). Emite cada línea de stdout como [`TerminalLine::Out`] y cada
/// línea de stderr como [`TerminalLine::Error`].
///
/// Con `exec`:
/// · El servidor nunca hace eco del comando.
/// · No se emite ningún prompt del shell.
/// · El canal se cierra solo cuando el proceso termina.
/// → Cero duplicados posibles por diseño.
async fn run_exec_command(
    pem_path: &str,
    username: &str,
    host: &str,
    command: &str,
    emit: &impl Fn(TerminalLine),
) -> Result<(), AppError> {
    let session = open_ssh_session(pem_path, username, host).await?;

    let mut channel: Channel<russh::client::Msg> = session
        .channel_open_session()
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    channel
        .exec(true, command)
        .await
        .map_err(|e| AppError::SshSessionError(e.to_string()))?;

    let deadline = tokio::time::Instant::now()
        + std::time::Duration::from_millis(EXEC_TIMEOUT_MS);

    let mut stdout_buf: Vec<u8> = Vec::new();
    let mut stderr_buf: Vec<u8> = Vec::new();

    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        match tokio::time::timeout(remaining, channel.wait()).await {
            Ok(Some(ChannelMsg::Data { data })) => {
                stdout_buf.extend_from_slice(&data);
                drain_line_buffer(&mut stdout_buf, false, emit);
            }
            Ok(Some(ChannelMsg::ExtendedData { data, .. })) => {
                // ExtendedData con ext_code = 1 es stderr en el protocolo SSH.
                stderr_buf.extend_from_slice(&data);
                drain_line_buffer(&mut stderr_buf, true, emit);
            }
            Ok(Some(ChannelMsg::ExitStatus { .. }))
            | Ok(Some(ChannelMsg::Eof))
            | Ok(None) => {
                break;
            }
            Ok(_) => {}
            Err(_) => break, // timeout
        }
    }

    // Emitir fragmentos finales sin `\n` (última línea del comando).
    flush_buffer(&mut stdout_buf, false, emit);
    flush_buffer(&mut stderr_buf, true, emit);

    let _ = session
        .disconnect(Disconnect::ByApplication, "exec completed", "en")
        .await;

    Ok(())
}

/// Extrae líneas completas (terminadas en `\n`) del buffer y las emite.
/// Deja en el buffer el fragmento incompleto final.
/// No usa `drain_pty_buffer` porque ese función está diseñada para PTY
/// (normaliza CR/LF y filtra ANSI), mientras que `exec` ya entrega texto
/// limpio con `\n` simples.
fn drain_line_buffer(buf: &mut Vec<u8>, is_stderr: bool, emit: &impl Fn(TerminalLine)) {
    let mut start = 0;

    while let Some(pos) = buf[start..].iter().position(|&b| b == b'\n') {
        let abs_pos = start + pos;
        let line_bytes = &buf[start..abs_pos];
        // Los exec sin PTY pueden tener CR al final en algunos servidores.
        let line_bytes = line_bytes.strip_suffix(b"\r").unwrap_or(line_bytes);
        let text = strip_ansi(line_bytes);

        if text.is_empty() {
            emit(TerminalLine::Blank);
        } else if is_stderr {
            emit(TerminalLine::Error { text });
        } else {
            emit(TerminalLine::Out { text });
        }

        start = abs_pos + 1;
    }

    // Mover el fragmento restante al inicio del buffer.
    buf.drain(..start);
}

/// Emite el contenido restante del buffer como una última línea (sin `\n`
/// final). Se llama al terminar el canal para no perder la última línea.
fn flush_buffer(buf: &mut Vec<u8>, is_stderr: bool, emit: &impl Fn(TerminalLine)) {
    if buf.is_empty() {
        return;
    }
    let text = strip_ansi(buf);
    buf.clear();
    if !text.is_empty() {
        if is_stderr {
            emit(TerminalLine::Error { text });
        } else {
            emit(TerminalLine::Out { text });
        }
    }
}