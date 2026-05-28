use crate::errors::AppError;
use super::parse::{parse_connection_string, shell_words_split};
use super::pty::{drain_pty_buffer, strip_ansi, TerminalLine};

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

#[test]
fn strip_ansi_should_remove_color_codes() {
    let input = b"\x1b[32mubuntu\x1b[0m@\x1b[34mip-172-31-19-136\x1b[0m:~$ ";
    let result = strip_ansi(input);
    assert_eq!(result, "ubuntu@ip-172-31-19-136:~$");
}

#[test]
fn strip_ansi_should_pass_through_plain_text() {
    let input = b"Welcome to Ubuntu 24.04 LTS";
    let result = strip_ansi(input);
    assert_eq!(result, "Welcome to Ubuntu 24.04 LTS");
}

#[test]
fn drain_pty_buffer_should_emit_complete_lines_only() {
    let mut buf = b"line one\nline two\npartial".to_vec();
    let mut emitted: Vec<String> = Vec::new();
    drain_pty_buffer(&mut buf, &mut |line| {
        if let TerminalLine::Out { text } = line {
            emitted.push(text);
        }
    });
    assert_eq!(emitted, vec!["line one", "line two"]);
    assert_eq!(buf, b"partial");
}

#[test]
fn drain_pty_buffer_should_normalize_crlf() {
    let mut buf = b"hello\r\nworld\r\n".to_vec();
    let mut emitted: Vec<String> = Vec::new();
    drain_pty_buffer(&mut buf, &mut |line| {
        if let TerminalLine::Out { text } = line {
            emitted.push(text);
        }
    });
    assert_eq!(emitted, vec!["hello", "world"]);
    assert!(buf.is_empty());
}
