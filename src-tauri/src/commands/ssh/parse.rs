use crate::errors::AppError;

pub struct ParsedConnection {
    pub username: String,
    pub host: String,
    pub pem_path: Option<String>,
}

pub fn parse_connection_string(connection_string: &str) -> Result<ParsedConnection, AppError> {
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

pub fn split_user_host(s: &str) -> Result<(&str, &str), AppError> {
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

pub fn shell_words_split(input: &str) -> Result<Vec<String>, AppError> {
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
