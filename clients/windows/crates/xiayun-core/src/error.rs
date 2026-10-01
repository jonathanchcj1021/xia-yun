use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClientError {
    pub message: String,
    pub code: Option<String>,
}

impl ClientError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: None,
        }
    }

    pub fn with_code(message: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: Some(code.into()),
        }
    }
}

impl fmt::Display for ClientError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for ClientError {}

pub fn err(message: impl Into<String>) -> ClientError {
    ClientError::new(message)
}
