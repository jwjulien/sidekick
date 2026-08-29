use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredPrinter {
    pub address: String,
    pub name: String,
    pub status: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterStatusResponse {
    pub connected: bool,
    pub ready: bool,
    pub paper_empty: bool,
    pub has_error: bool,
    pub raw_status: u8,
    pub status_text: String,
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterResponse {
    pub status_code: u16,
    pub ok: bool,
    pub text: String,
}

fn probe_printer_endpoint(address: &str, timeout_ms: u64) -> Option<PrinterStatusResponse> {
    let clean_addr = address
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_end_matches('/');

    if clean_addr.is_empty() {
        return None;
    }

    let target_host = if clean_addr.contains(':') {
        clean_addr.to_string()
    } else {
        format!("{}:80", clean_addr)
    };

    let socket_addrs = match target_host.to_socket_addrs() {
        Ok(addrs) => addrs.collect::<Vec<_>>(),
        Err(_) => return None,
    };

    if socket_addrs.is_empty() {
        return None;
    }

    let socket_addr = socket_addrs[0];
    let timeout = Duration::from_millis(timeout_ms);

    let stream = match TcpStream::connect_timeout(&socket_addr, timeout) {
        Ok(s) => s,
        Err(_) => return None,
    };

    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));

    let mut stream = stream;
    let request = format!(
        "GET /status HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        clean_addr
    );

    if stream.write_all(request.as_bytes()).is_err() {
        return None;
    }

    let mut response_bytes = Vec::new();
    let _ = stream.read_to_end(&mut response_bytes);
    let response_str = String::from_utf8_lossy(&response_bytes);

    if response_str.contains("HTTP/1.1 200 OK") || response_str.contains("HTTP/1.0 200 OK") || response_str.contains("\"status\"") {
        let mut raw_status = 1u8;
        if let Some(json_start) = response_str.find('{') {
            if let Some(json_end) = response_str.rfind('}') {
                let json_slice = &response_str[json_start..=json_end];
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_slice) {
                    if let Some(st) = val.get("status").and_then(|v| v.as_u64()) {
                        raw_status = st as u8;
                    }
                }
            }
        }

        let ready = (raw_status & 1) != 0 || raw_status == 1;
        let paper_empty = (raw_status & 32) != 0;
        let has_error = (raw_status & 128) != 0;

        let status_text = if paper_empty {
            "Paper Empty".to_string()
        } else if has_error {
            "Printer Hardware Error".to_string()
        } else if ready {
            "Online & Ready".to_string()
        } else {
            "Not Ready".to_string()
        };

        return Some(PrinterStatusResponse {
            connected: true,
            ready: ready && !paper_empty && !has_error,
            paper_empty,
            has_error,
            raw_status,
            status_text,
            address: clean_addr.to_string(),
        });
    }

    None
}

#[tauri::command]
pub fn printer_check_status(address: String) -> PrinterStatusResponse {
    probe_printer_endpoint(&address, 2500).unwrap_or_else(|| PrinterStatusResponse {
        connected: false,
        ready: false,
        paper_empty: false,
        has_error: true,
        raw_status: 0,
        status_text: format!("Offline / Unreachable at {}", address),
        address,
    })
}

#[tauri::command]
pub fn printer_discover() -> Vec<DiscoveredPrinter> {
    let mut candidates = vec![
        "dymo-printer.local".to_string(),
        "dymo.local".to_string(),
    ];

    for sub in &["192.168.1", "192.168.0", "10.0.0"] {
        for i in 1..=254 {
            candidates.push(format!("{}.{}", sub, i));
        }
    }

    let results = Arc::new(Mutex::new(Vec::new()));
    let chunk_size = 40;

    let handles: Vec<_> = candidates
        .chunks(chunk_size)
        .map(|chunk| {
            let chunk = chunk.to_vec();
            let results = Arc::clone(&results);
            thread::spawn(move || {
                for candidate in chunk {
                    if let Some(res) = probe_printer_endpoint(&candidate, 600) {
                        let mut list = results.lock().unwrap();
                        if !list.iter().any(|p: &DiscoveredPrinter| p.address == res.address) {
                            list.push(DiscoveredPrinter {
                                address: res.address.clone(),
                                name: format!("Dymo ESP32 ({})", res.address),
                                status: res.raw_status,
                            });
                        }
                    }
                }
            })
        })
        .collect();

    for handle in handles {
        let _ = handle.join();
    }

    let final_list = results.lock().unwrap().clone();
    final_list
}

#[tauri::command]
pub fn printer_send_request(
    address: String,
    endpoint: String,
    method: String,
    params: Option<HashMap<String, String>>,
    body: Option<Vec<u8>>,
    mime: Option<String>,
) -> Result<PrinterResponse, String> {
    let clean_addr = address
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_end_matches('/');

    if clean_addr.is_empty() {
        return Err("Printer address is empty".to_string());
    }

    let target_host = if clean_addr.contains(':') {
        clean_addr.to_string()
    } else {
        format!("{}:80", clean_addr)
    };

    let socket_addrs = target_host
        .to_socket_addrs()
        .map_err(|e| format!("DNS/Hostname resolution failed for {}: {}", clean_addr, e))?
        .collect::<Vec<_>>();

    if socket_addrs.is_empty() {
        return Err(format!("Could not resolve address for {}", clean_addr));
    }

    let socket_addr = socket_addrs[0];
    let timeout = Duration::from_secs(12);

    let mut stream = TcpStream::connect_timeout(&socket_addr, timeout)
        .map_err(|e| format!("Connection to {} timed out: {}", clean_addr, e))?;

    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));

    let method_upper = method.to_uppercase();
    let mut param_str = String::new();
    if let Some(p) = params {
        if !p.is_empty() {
            param_str.push('?');
            let pairs: Vec<String> = p.iter().map(|(k, v)| format!("{}={}", k, v)).collect();
            param_str.push_str(&pairs.join("&"));
        }
    }

    let content_type = mime.unwrap_or_else(|| "text/plain".to_string());
    let payload = body.unwrap_or_default();
    let content_length = payload.len();

    let request_header = format!(
        "{} /{}{}\r\nHost: {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        method_upper, endpoint, param_str, clean_addr, content_type, content_length
    );

    stream
        .write_all(request_header.as_bytes())
        .map_err(|e| format!("Write header failed: {}", e))?;

    if !payload.is_empty() {
        stream
            .write_all(&payload)
            .map_err(|e| format!("Write payload failed: {}", e))?;
    }

    let mut response_bytes = Vec::new();
    let _ = stream.read_to_end(&mut response_bytes);
    let response_str = String::from_utf8_lossy(&response_bytes);

    let mut status_code = 500u16;
    if let Some(first_line) = response_str.lines().next() {
        let parts: Vec<&str> = first_line.split_whitespace().collect();
        if parts.len() >= 2 {
            if let Ok(code) = parts[1].parse::<u16>() {
                status_code = code;
            }
        }
    }

    let body_text = if let Some(pos) = response_str.find("\r\n\r\n") {
        response_str[pos + 4..].to_string()
    } else {
        response_str.to_string()
    };

    let ok = status_code >= 200 && status_code < 300;
    if !ok {
        return Err(format!("Printer error ({}) | {}", status_code, body_text));
    }

    Ok(PrinterResponse {
        status_code,
        ok,
        text: body_text,
    })
}
