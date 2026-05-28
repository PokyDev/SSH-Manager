use serde::Serialize;

/// Errores de dominio de la aplicación.
///
/// Se usa `thiserror` para errores de biblioteca/dominio según las
/// buenas prácticas: mensajes legibles, trazabilidad con `#[from]`
/// donde el mapeo es 1-a-1, y sin `unwrap`/`expect` en producción.
#[derive(thiserror::Error, Debug)]
pub enum AppError {
    // ── SSH ──────────────────────────────────────────────────────────
    #[error("La cadena de conexión tiene un formato inválido. Se esperaba 'usuario@host'")]
    InvalidConnectionString,

    #[error("No se pudo leer la clave privada en '{path}': {reason}")]
    PemReadFailed { path: String, reason: String },

    #[error("La clave privada en '{0}' tiene un formato inválido o no es compatible")]
    PemParseFailed(String),

    #[error("No se pudo establecer la conexión TCP con '{host}:{port}': {reason}")]
    TcpConnectionFailed {
        host: String,
        port: u16,
        reason: String,
    },

    #[error("La autenticación SSH falló para el usuario '{0}'")]
    SshAuthFailed(String),

    #[error("Error interno de la sesión SSH: {0}")]
    SshSessionError(String),

    // ── I/O genérico ─────────────────────────────────────────────────
    #[error("Error de I/O: {0}")]
    Io(#[from] std::io::Error),
}

// ── Serialización para el frontend ───────────────────────────────────
//
// Tauri requiere que los errores devueltos por comandos sean `Serialize`.
// Convertimos `AppError` a un objeto `{ code, message }` que el frontend
// puede consumir de forma uniforme sin parsear strings.

#[derive(Serialize, Debug)]
pub struct SerializedError {
    pub code: &'static str,
    pub message: String,
}

impl From<AppError> for SerializedError {
    fn from(err: AppError) -> Self {
        let code = match &err {
            AppError::InvalidConnectionString => "INVALID_CONNECTION_STRING",
            AppError::PemReadFailed { .. }    => "PEM_READ_FAILED",
            AppError::PemParseFailed(_)       => "PEM_PARSE_FAILED",
            AppError::TcpConnectionFailed { .. } => "TCP_CONNECTION_FAILED",
            AppError::SshAuthFailed(_)        => "SSH_AUTH_FAILED",
            AppError::SshSessionError(_)      => "SSH_SESSION_ERROR",
            AppError::Io(_)                   => "IO_ERROR",
        };
        Self {
            code,
            message: err.to_string(),
        }
    }
}

// Implementar `Serialize` directamente sobre `AppError` delegando a
// `SerializedError`, de modo que Tauri pueda serializar el `Err(AppError)`
// devuelto por los comandos.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let code = match self {
            AppError::InvalidConnectionString => "INVALID_CONNECTION_STRING",
            AppError::PemReadFailed { .. } => "PEM_READ_FAILED",
            AppError::PemParseFailed(_) => "PEM_PARSE_FAILED",
            AppError::TcpConnectionFailed { .. } => "TCP_CONNECTION_FAILED",
            AppError::SshAuthFailed(_) => "SSH_AUTH_FAILED",
            AppError::SshSessionError(_) => "SSH_SESSION_ERROR",
            AppError::Io(_) => "IO_ERROR",
        };
        SerializedError {
            code,
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}