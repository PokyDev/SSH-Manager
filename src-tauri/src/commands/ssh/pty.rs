#[derive(serde::Serialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum TerminalLine {
    Out { text: String },
    #[allow(dead_code)]
    Error { text: String },
    Ansi { text: String },
    Blank,
}

#[allow(dead_code)]
pub fn drain_pty_buffer(buf: &mut Vec<u8>, emit: &mut impl FnMut(TerminalLine)) {
    let normalized: Vec<u8> = {
        let mut out = Vec::with_capacity(buf.len());
        let mut i = 0;
        while i < buf.len() {
            if buf[i] == b'\r' {
                if i + 1 < buf.len() && buf[i + 1] == b'\n' {
                    out.push(b'\n');
                    i += 2;
                } else {
                    out.push(b'\n');
                    i += 1;
                }
            } else {
                out.push(buf[i]);
                i += 1;
            }
        }
        out
    };

    let mut start = 0;
    for (pos, &byte) in normalized.iter().enumerate() {
        if byte == b'\n' {
            let raw = &normalized[start..pos];
            let text = strip_ansi(raw);
            if text.is_empty() {
                emit(TerminalLine::Blank);
            } else {
                emit(TerminalLine::Out { text });
            }
            start = pos + 1;
        }
    }

    *buf = normalized[start..].to_vec();
}

pub fn strip_ansi(raw: &[u8]) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut i = 0;
    while i < raw.len() {
        if raw[i] == 0x1b {
            i += 1;
            if i < raw.len() && raw[i] == b'[' {
                i += 1;
                while i < raw.len() && !raw[i].is_ascii_alphabetic() {
                    i += 1;
                }
                i += 1;
            } else if i < raw.len() && raw[i] == b']' {
                i += 1;
                while i < raw.len() {
                    if raw[i] == 0x07 {
                        i += 1;
                        break;
                    }
                    if raw[i] == 0x1b && i + 1 < raw.len() && raw[i + 1] == b'\\' {
                        i += 2;
                        break;
                    }
                    i += 1;
                }
            } else {
                if i < raw.len() {
                    i += 1;
                }
            }
        } else if raw[i] >= 0x20 || raw[i] == b'\t' {
            out.push(raw[i] as char);
            i += 1;
        } else {
            i += 1;
        }
    }
    out.trim_end().to_owned()
}

pub fn text_with_ansi(raw: &[u8]) -> String {
    let mut out = Vec::with_capacity(raw.len());
    let mut i = 0;
    while i < raw.len() {
        if raw[i] == 0x1b {
            let seq_start = i;
            i += 1;
            if i < raw.len() && raw[i] == b'[' {
                i += 1;
                while i < raw.len() && !(raw[i] >= 0x40 && raw[i] <= 0x7e) {
                    i += 1;
                }
                if i < raw.len() {
                    if raw[i] == b'm' {
                        out.extend_from_slice(&raw[seq_start..=i]);
                    }
                    i += 1;
                }
            } else if i < raw.len() && raw[i] == b']' {
                i += 1;
                while i < raw.len() {
                    if raw[i] == 0x07 {
                        i += 1;
                        break;
                    }
                    if raw[i] == 0x1b && i + 1 < raw.len() && raw[i + 1] == b'\\' {
                        i += 2;
                        break;
                    }
                    i += 1;
                }
            } else {
                if i < raw.len() {
                    i += 1;
                }
            }
        } else if raw[i] >= 0x20 || raw[i] == b'\t' {
            out.push(raw[i]);
            i += 1;
        } else {
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).trim_end().to_owned()
}

pub fn looks_like_prompt(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return false;
    }
    trimmed.contains('@') && (trimmed.ends_with('$') || trimmed.ends_with('#'))
}

pub fn drain_pty_buffer_ansi(buf: &mut Vec<u8>, emit: &mut impl FnMut(TerminalLine)) {
    let normalized: Vec<u8> = {
        let mut out = Vec::with_capacity(buf.len());
        let mut i = 0;
        while i < buf.len() {
            if buf[i] == b'\r' {
                if i + 1 < buf.len() && buf[i + 1] == b'\n' {
                    out.push(b'\n');
                    i += 2;
                } else {
                    out.push(b'\n');
                    i += 1;
                }
            } else {
                out.push(buf[i]);
                i += 1;
            }
        }
        out
    };

    let mut start = 0;
    for (pos, &byte) in normalized.iter().enumerate() {
        if byte == b'\n' {
            let raw = &normalized[start..pos];
            let visible = strip_ansi(raw);
            if visible.is_empty() {
                emit(TerminalLine::Blank);
            } else {
                let text = text_with_ansi(raw);
                emit(TerminalLine::Ansi { text });
            }
            start = pos + 1;
        }
    }

    *buf = normalized[start..].to_vec();
}
