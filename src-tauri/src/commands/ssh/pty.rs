#[derive(serde::Serialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum TerminalLine {
    Out { text: String },
    #[allow(dead_code)]
    Error { text: String },
    Blank,
}

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
            } else {
                i += 1;
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
