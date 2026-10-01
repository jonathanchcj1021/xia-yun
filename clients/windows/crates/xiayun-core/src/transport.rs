use std::time::Duration;

use crate::error::{err, ClientError};
use crate::USER_AGENT;

#[derive(Debug, Clone)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct RawResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

pub trait Transport {
    fn send(
        &self,
        request: HttpRequest,
    ) -> impl std::future::Future<Output = Result<RawResponse, ClientError>> + Send;
}

#[derive(Clone)]
pub struct ReqwestTransport {
    http: reqwest::Client,
}

impl ReqwestTransport {
    pub fn new() -> Result<Self, ClientError> {
        let http = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(120))
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .map_err(|error| err(format!("無法建立連線：{error}")))?;
        Ok(Self { http })
    }

    pub fn from_client(http: reqwest::Client) -> Self {
        Self { http }
    }
}

impl Transport for ReqwestTransport {
    async fn send(&self, request: HttpRequest) -> Result<RawResponse, ClientError> {
        let method = reqwest::Method::from_bytes(request.method.as_bytes())
            .map_err(|_| err("不支援的 HTTP 方法"))?;
        let mut builder = self.http.request(method, &request.url);
        for (name, value) in &request.headers {
            builder = builder.header(name.as_str(), value.as_str());
        }
        if !request.body.is_empty() {
            builder = builder.body(request.body);
        }
        let response = builder
            .send()
            .await
            .map_err(|error| err(format!("無法連上伺服器：{error}")))?;
        let status = response.status().as_u16();
        let headers = response
            .headers()
            .iter()
            .map(|(name, value)| {
                (
                    name.as_str().to_string(),
                    String::from_utf8_lossy(value.as_bytes()).into_owned(),
                )
            })
            .collect();
        let body = response
            .bytes()
            .await
            .map_err(|error| err(format!("無法讀取伺服器回應：{error}")))?
            .to_vec();
        Ok(RawResponse {
            status,
            headers,
            body,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[tokio::test]
    async fn reqwest_sends_bearer_and_content_length() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let handle = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut buf = vec![0u8; 4096];
            let n = tokio::time::timeout(Duration::from_secs(5), socket.read(&mut buf))
                .await
                .unwrap()
                .unwrap();
            let text = String::from_utf8_lossy(&buf[..n]).to_string();
            let response = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}";
            socket.write_all(response.as_bytes()).await.unwrap();
            text
        });
        let transport = ReqwestTransport::new().unwrap();
        let response = transport
            .send(HttpRequest {
                method: "POST".into(),
                url: format!("http://{addr}/api/auth/login"),
                headers: vec![
                    ("Authorization".into(), "Bearer abc".into()),
                    ("Content-Type".into(), "application/json".into()),
                    ("Content-Length".into(), "2".into()),
                ],
                body: b"{}".to_vec(),
            })
            .await
            .unwrap();
        assert_eq!(response.status, 200);
        let seen = handle.await.unwrap().to_ascii_lowercase();
        assert!(seen.contains("authorization: bearer abc"), "{seen}");
        assert!(seen.contains("content-length: 2"), "{seen}");
    }
}
