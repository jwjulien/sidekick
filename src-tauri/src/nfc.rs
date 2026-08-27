use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};

pub static IS_WRITING_NFC: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NfcResult {
    pub success: bool,
    pub payload: Option<String>,
    pub tag_uid: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NfcStatusResult {
    pub connected: bool,
    pub reader_name: Option<String>,
    pub card_present: bool,
    pub error: Option<String>,
}

#[cfg(not(mobile))]
use pcsc::{Context, Protocols, ShareMode, MAX_BUFFER_SIZE};

#[cfg(not(mobile))]
fn hex_string(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(":")
}

/// Helper function to parse NDEF URI record from raw tag memory bytes (pages 4+).
#[cfg(not(mobile))]
fn parse_ndef_uri_from_bytes(data: &[u8]) -> Option<String> {
    let mut i = 0;
    while i < data.len() {
        let tag = data[i];
        if tag == 0x00 {
            // Null TLV
            i += 1;
            continue;
        }
        if tag == 0xFE {
            // Terminator TLV
            break;
        }
        if tag == 0x03 {
            // NDEF Message TLV
            if i + 1 >= data.len() {
                break;
            }
            let len_byte = data[i + 1] as usize;
            let (length, value_start) = if len_byte == 0xFF {
                if i + 3 >= data.len() {
                    break;
                }
                let len = ((data[i + 2] as usize) << 8) | (data[i + 3] as usize);
                (len, i + 4)
            } else {
                (len_byte, i + 2)
            };

            if value_start + length > data.len() {
                break;
            }

            let ndef_bytes = &data[value_start..value_start + length];
            if ndef_bytes.is_empty() {
                break;
            }

            let header = ndef_bytes[0];
            let tnf = header & 0x07;
            let sr = (header & 0x10) != 0; // Short Record flag
            let il = (header & 0x20) != 0; // ID Length flag

            let mut idx = 1;
            if idx >= ndef_bytes.len() {
                break;
            }
            let type_len = ndef_bytes[idx] as usize;
            idx += 1;

            let payload_len = if sr {
                if idx >= ndef_bytes.len() {
                    break;
                }
                let plen = ndef_bytes[idx] as usize;
                idx += 1;
                plen
            } else {
                if idx + 3 >= ndef_bytes.len() {
                    break;
                }
                let plen = ((ndef_bytes[idx] as usize) << 24)
                    | ((ndef_bytes[idx + 1] as usize) << 16)
                    | ((ndef_bytes[idx + 2] as usize) << 8)
                    | (ndef_bytes[idx + 3] as usize);
                idx += 4;
                plen
            };

            if il {
                if idx >= ndef_bytes.len() {
                    break;
                }
                let id_len = ndef_bytes[idx] as usize;
                idx += 1 + id_len;
            }

            if idx + type_len + payload_len > ndef_bytes.len() {
                break;
            }

            let type_bytes = &ndef_bytes[idx..idx + type_len];
            let payload_bytes = &ndef_bytes[idx + type_len..idx + type_len + payload_len];

            // TNF 1 (NFC Forum Well-Known Type) and Type 'U' (0x55)
            if tnf == 1 && type_bytes == [0x55] && !payload_bytes.is_empty() {
                let prefix_code = payload_bytes[0];
                let uri_body = match String::from_utf8(payload_bytes[1..].to_vec()) {
                    Ok(s) => s,
                    Err(_) => return None,
                };

                let prefix = match prefix_code {
                    0x00 => "",
                    0x01 => "http://www.",
                    0x02 => "https://www.",
                    0x03 => "http://",
                    0x04 => "https://",
                    _ => "",
                };

                return Some(format!("{}{}", prefix, uri_body));
            }
            break;
        } else {
            // Skip other TLV types
            if i + 1 >= data.len() {
                break;
            }
            let l = data[i + 1] as usize;
            i += 2 + l;
        }
    }
    None
}

/// Helper function to construct NDEF Message TLV bytes for a URI (e.g. fuse://location/{id})
#[cfg(not(mobile))]
fn encode_ndef_uri_tlv(uri: &str) -> Vec<u8> {
    let uri_bytes = uri.as_bytes();
    let payload_len = 1 + uri_bytes.len(); // 1 byte for URI prefix code 0x00 + URI bytes
    
    let mut record = Vec::new();
    record.push(0xD1); // MB=1, ME=1, CF=0, SR=1, IL=0, TNF=1
    record.push(0x01); // Type length = 1
    record.push(payload_len as u8); // Payload length
    record.push(0x55); // Type 'U' (URI)
    record.push(0x00); // URI Prefix 0x00 (raw URI for custom schemes like fuse://)
    record.extend_from_slice(uri_bytes);

    let mut tlv = Vec::new();
    tlv.push(0x03); // NDEF Message TLV
    if record.len() < 255 {
        tlv.push(record.len() as u8);
    } else {
        tlv.push(0xFF);
        tlv.push(((record.len() >> 8) & 0xFF) as u8);
        tlv.push((record.len() & 0xFF) as u8);
    }
    tlv.extend_from_slice(&record);
    tlv.push(0xFE); // Terminator TLV

    // Pad buffer to multiple of 4 bytes (page size for Type 2 tags)
    while tlv.len() % 4 != 0 {
        tlv.push(0x00);
    }

    tlv
}

/// Helper to authenticate MIFARE Classic block using ACR122U APDU
#[cfg(not(mobile))]
fn authenticate_mifare_classic_block(card: &pcsc::Card, block_num: u8) -> bool {
    let mut rapdu_buf = [0u8; MAX_BUFFER_SIZE];
    
    // Load Key APDU (Default Key FF FF FF FF FF FF into Key Structure 0x00)
    let load_key_apdu = [0xFF, 0x82, 0x00, 0x00, 0x06, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
    let _ = card.transmit(&load_key_apdu, &mut rapdu_buf);

    // Authenticate Block APDU (Key Type 0x60 = Key A, Key Structure 0x00)
    let auth_apdu = [0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, block_num, 0x60, 0x00];
    match card.transmit(&auth_apdu, &mut rapdu_buf) {
        Ok(res) if res.len() >= 2 && res[res.len() - 2] == 0x90 && res[res.len() - 1] == 0x00 => true,
        _ => {
            // Try Key B (0x61) fallback
            let auth_key_b = [0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, block_num, 0x61, 0x00];
            match card.transmit(&auth_key_b, &mut rapdu_buf) {
                Ok(res) if res.len() >= 2 && res[res.len() - 2] == 0x90 && res[res.len() - 1] == 0x00 => true,
                _ => false,
            }
        }
    }
}

/// Helper to write 4 bytes of data to a specific page/block on NTAG or MIFARE Classic using ACR122U.
#[cfg(not(mobile))]
fn write_page_bytes(card: &pcsc::Card, page_num: u8, data: &[u8; 4]) -> Result<(), String> {
    let mut rapdu_buf = [0u8; MAX_BUFFER_SIZE];

    // Method 1: ACR122U / PN532 Direct Transmit APDU for NTAG (InCommunicateThru 0xD4 0x42 + NTAG WRITE 0xA2)
    let direct_write_apdu = [
        0xFF, 0x00, 0x00, 0x00, 0x08,
        0xD4, 0x42, 0xA2, page_num,
        data[0], data[1], data[2], data[3],
    ];

    match card.transmit(&direct_write_apdu, &mut rapdu_buf) {
        Ok(res) if res.len() >= 5 && res[0] == 0xD5 && res[1] == 0x43 && res[2] == 0x00 && res[res.len() - 2] == 0x90 && res[res.len() - 1] == 0x00 => {
            return Ok(());
        }
        Ok(res) if res.len() >= 2 && res[res.len() - 2] == 0x90 && res[res.len() - 1] == 0x00 => {
            return Ok(());
        }
        _ => {}
    }

    // Method 2: Standard PC/SC Update Binary APDU (FF D6 00 <page> 04 b0 b1 b2 b3)
    let pcsc_write_apdu = [
        0xFF, 0xD6, 0x00, page_num, 0x04,
        data[0], data[1], data[2], data[3],
    ];
    let mut rapdu_buf2 = [0u8; MAX_BUFFER_SIZE];
    match card.transmit(&pcsc_write_apdu, &mut rapdu_buf2) {
        Ok(r) if r.len() >= 2 && r[r.len() - 2] == 0x90 && r[r.len() - 1] == 0x00 => return Ok(()),
        _ => {}
    }

    // Method 3: MIFARE Classic 16-byte Block Write Fallback with Authentication
    let _ = authenticate_mifare_classic_block(card, page_num);
    let mut block_data = [0u8; 16];
    block_data[..4].copy_from_slice(data);
    let mifare_write_apdu = [
        0xFF, 0xD6, 0x00, page_num, 0x10,
        block_data[0], block_data[1], block_data[2], block_data[3],
        block_data[4], block_data[5], block_data[6], block_data[7],
        block_data[8], block_data[9], block_data[10], block_data[11],
        block_data[12], block_data[13], block_data[14], block_data[15],
    ];
    let mut rapdu_buf3 = [0u8; MAX_BUFFER_SIZE];
    match card.transmit(&mifare_write_apdu, &mut rapdu_buf3) {
        Ok(r) if r.len() >= 2 && r[r.len() - 2] == 0x90 && r[r.len() - 1] == 0x00 => Ok(()),
        Ok(r) => Err(format!("Write rejected at page {} (SW: {:02X}{:02X})", page_num, r[r.len() - 2], r[r.len() - 1])),
        Err(e) => Err(format!("APDU write fallback error on page {}: {}", page_num, e)),
    }
}

/// Helper to read 4 bytes from a specific page/block on NTAG or MIFARE Classic.
#[cfg(not(mobile))]
fn read_page_4bytes(card: &pcsc::Card, page_num: u8) -> Result<[u8; 4], String> {
    let mut rapdu_buf = [0u8; MAX_BUFFER_SIZE];

    // Method 1: Standard PC/SC Read Binary APDU (FF B0 00 <page> 04)
    let pcsc_read_apdu = [0xFF, 0xB0, 0x00, page_num, 0x04];
    if let Ok(res) = card.transmit(&pcsc_read_apdu, &mut rapdu_buf) {
        if res.len() >= 6 && res[res.len() - 2] == 0x90 && res[res.len() - 1] == 0x00 {
            return Ok([res[0], res[1], res[2], res[3]]);
        }
        if res.len() == 4 {
            return Ok([res[0], res[1], res[2], res[3]]);
        }
    }

    // Method 2: PN532 Direct Transmit READ APDU (0x30)
    let direct_read_apdu = [0xFF, 0x00, 0x00, 0x00, 0x04, 0xD4, 0x42, 0x30, page_num];
    if let Ok(res) = card.transmit(&direct_read_apdu, &mut rapdu_buf) {
        if res.len() >= 7 && res[0] == 0xD5 && res[1] == 0x43 && res[2] == 0x00 {
            return Ok([res[3], res[4], res[5], res[6]]);
        }
        if res.len() >= 6 && res[res.len() - 2] == 0x90 && res[res.len() - 1] == 0x00 {
            return Ok([res[0], res[1], res[2], res[3]]);
        }
    }

    // Method 3: MIFARE Classic Read 16-byte Block Fallback
    let _ = authenticate_mifare_classic_block(card, page_num);
    let mifare_read_apdu = [0xFF, 0xB0, 0x00, page_num, 0x10];
    let mut rapdu_buf2 = [0u8; MAX_BUFFER_SIZE];
    match card.transmit(&mifare_read_apdu, &mut rapdu_buf2) {
        Ok(res) if res.len() >= 6 && res[res.len() - 2] == 0x90 && res[res.len() - 1] == 0x00 => {
            Ok([res[0], res[1], res[2], res[3]])
        }
        Ok(res) => Err(format!("SW {:02X}{:02X} (len {})", res[res.len().saturating_sub(2)], res[res.len().saturating_sub(1)], res.len())),
        Err(e) => Err(e.to_string()),
    }
}

/// Helper to read tag memory pages using ACR122U PC/SC & Direct Transmit fallbacks.
#[cfg(not(mobile))]
fn read_tag_memory(card: &pcsc::Card) -> (Vec<u8>, Option<String>) {
    let mut raw_data = Vec::new();
    let mut first_error = None;

    let get_uid_apdu = [0xFF, 0xCA, 0x00, 0x00, 0x00];
    let mut rapdu_buf = [0u8; MAX_BUFFER_SIZE];
    let _ = card.transmit(&get_uid_apdu, &mut rapdu_buf);

    for page in 4..=40 {
        match read_page_4bytes(card, page as u8) {
            Ok(bytes) => {
                raw_data.extend_from_slice(&bytes);
            }
            Err(err) => {
                if first_error.is_none() {
                    first_error = Some(format!("p{} error: {}", page, err));
                }
                break;
            }
        }
    }
    (raw_data, first_error)
}

/// Returns connection & card status for PC/SC NFC readers (ACR122U).
#[tauri::command]
pub async fn nfc_get_status() -> Result<NfcStatusResult, String> {
    #[cfg(not(mobile))]
    {
        let ctx = match Context::establish(pcsc::Scope::User) {
            Ok(ctx) => ctx,
            Err(err) => {
                return Ok(NfcStatusResult {
                    connected: false,
                    reader_name: None,
                    card_present: false,
                    error: Some(format!("PC/SC context error: {}", err)),
                });
            }
        };

        let mut readers_buf = [0; 2048];
        let mut readers = match ctx.list_readers(&mut readers_buf) {
            Ok(readers) => readers,
            Err(err) => {
                return Ok(NfcStatusResult {
                    connected: false,
                    reader_name: None,
                    card_present: false,
                    error: Some(format!("No NFC reader found: {}", err)),
                });
            }
        };

        let reader_c_str = match readers.next() {
            Some(name) => name,
            None => {
                return Ok(NfcStatusResult {
                    connected: false,
                    reader_name: None,
                    card_present: false,
                    error: Some("No NFC reader connected".to_string()),
                });
            }
        };

        let reader_name = reader_c_str.to_str().unwrap_or("ACR122U NFC Reader").to_string();

        let card_present = match ctx.connect(reader_c_str, ShareMode::Shared, Protocols::ANY) {
            Ok(_) => true,
            Err(_) => false,
        };

        Ok(NfcStatusResult {
            connected: true,
            reader_name: Some(reader_name),
            card_present,
            error: None,
        })
    }

    #[cfg(mobile)]
    {
        Ok(NfcStatusResult {
            connected: true,
            reader_name: Some("Android NFC Adapter".to_string()),
            card_present: false,
            error: None,
        })
    }
}

/// Reads tag UID & NDEF payload using PC/SC USB Reader (e.g. ACR122U) on Desktop platforms.
#[tauri::command]
pub async fn nfc_read_tag() -> Result<NfcResult, String> {
    #[cfg(not(mobile))]
    {
        let ctx = match Context::establish(pcsc::Scope::User) {
            Ok(ctx) => ctx,
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("Failed to establish PC/SC context: {}", err)),
                });
            }
        };

        let mut readers_buf = [0; 2048];
        let mut readers = match ctx.list_readers(&mut readers_buf) {
            Ok(readers) => readers,
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("No PC/SC NFC readers found: {}", err)),
                });
            }
        };

        let reader_name = match readers.next() {
            Some(name) => name,
            None => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some("No NFC reader connected".to_string()),
                });
            }
        };

        let card = match ctx.connect(reader_name, ShareMode::Shared, Protocols::ANY) {
            Ok(card) => card,
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("No NFC tag detected on reader: {}", err)),
                });
            }
        };

        let get_uid_apdu = [0xFF, 0xCA, 0x00, 0x00, 0x00];
        let mut rapdu_buf = [0; MAX_BUFFER_SIZE];
        
        let tag_uid = match card.transmit(&get_uid_apdu, &mut rapdu_buf) {
            Ok(rapdu) if rapdu.len() >= 2 && rapdu[rapdu.len() - 2] == 0x90 && rapdu[rapdu.len() - 1] == 0x00 => {
                let uid_bytes = &rapdu[..rapdu.len() - 2];
                hex_string(uid_bytes)
            }
            Ok(_) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some("Failed to read tag UID from card".to_string()),
                });
            }
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("APDU transmit error: {}", err)),
                });
            }
        };

        let (raw_pages, _) = read_tag_memory(&card);
        let payload = parse_ndef_uri_from_bytes(&raw_pages);

        Ok(NfcResult {
            success: true,
            payload,
            tag_uid: Some(tag_uid),
            error: None,
        })
    }

    #[cfg(mobile)]
    {
        Ok(NfcResult {
            success: false,
            payload: None,
            tag_uid: None,
            error: Some("Mobile NFC handled via native plugin".to_string()),
        })
    }
}

/// Programs an NDEF URI payload (e.g. fuse://location/{id}) to an NFC tag via PC/SC reader on Desktop.
#[tauri::command]
pub async fn nfc_write_tag(uri: String) -> Result<NfcResult, String> {
    if uri.trim().is_empty() {
        return Ok(NfcResult {
            success: false,
            payload: None,
            tag_uid: None,
            error: Some("URI payload cannot be empty".to_string()),
        });
    }

    IS_WRITING_NFC.store(true, Ordering::SeqCst);

    #[cfg(not(mobile))]
    let result = (|| {
        let ctx = match Context::establish(pcsc::Scope::User) {
            Ok(ctx) => ctx,
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("PC/SC context error: {}", err)),
                });
            }
        };

        let mut readers_buf = [0; 2048];
        let mut readers = match ctx.list_readers(&mut readers_buf) {
            Ok(readers) => readers,
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("No NFC reader found: {}", err)),
                });
            }
        };

        let reader_name = match readers.next() {
            Some(name) => name,
            None => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some("No NFC reader connected".to_string()),
                });
            }
        };

        let mut card = match ctx.connect(reader_name, ShareMode::Shared, Protocols::ANY) {
            Ok(card) => card,
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("Please place NFC tag firmly on ACR122U reader: {}", err)),
                });
            }
        };

        let tx = match card.transaction() {
            Ok(tx) => tx,
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("Failed to lock NFC reader transaction: {}", err)),
                });
            }
        };

        let target_card: &pcsc::Card = &*tx;

        // Get UID
        let get_uid_apdu = [0xFF, 0xCA, 0x00, 0x00, 0x00];
        let mut rapdu_buf = [0; MAX_BUFFER_SIZE];
        let tag_uid = match target_card.transmit(&get_uid_apdu, &mut rapdu_buf) {
            Ok(rapdu) if rapdu.len() >= 2 && rapdu[rapdu.len() - 2] == 0x90 && rapdu[rapdu.len() - 1] == 0x00 => {
                hex_string(&rapdu[..rapdu.len() - 2])
            }
            _ => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some("Failed to get NFC tag UID".to_string()),
                });
            }
        };

        // Write Capability Container (CC) to Page 3: [0xE1, 0x10, 0x12, 0x00]
        let cc_bytes = [0xE1, 0x10, 0x12, 0x00];
        let _ = write_page_bytes(target_card, 3, &cc_bytes);

        // Encode NDEF TLV payload
        let tlv_bytes = encode_ndef_uri_tlv(&uri);

        // Write NDEF pages/blocks starting at Page 4
        let mut page_num = 4;
        for chunk in tlv_bytes.chunks(4) {
            if chunk.len() == 4 {
                let page_data: [u8; 4] = [chunk[0], chunk[1], chunk[2], chunk[3]];
                if let Err(err) = write_page_bytes(target_card, page_num, &page_data) {
                    return Ok(NfcResult {
                        success: false,
                        payload: None,
                        tag_uid: Some(tag_uid),
                        error: Some(err),
                    });
                }
                page_num += 1;
            }
        }

        // EEPROM Write Commit Pause (100ms) before verification readback
        std::thread::sleep(std::time::Duration::from_millis(100));

        // Verification Readback
        let (raw_written_pages, read_err) = read_tag_memory(target_card);
        let verified_payload = parse_ndef_uri_from_bytes(&raw_written_pages);

        if verified_payload.as_deref() == Some(uri.as_str()) {
            Ok(NfcResult {
                success: true,
                payload: Some(uri),
                tag_uid: Some(tag_uid),
                error: None,
            })
        } else {
            let read_back_str = match verified_payload {
                Some(p) => format!("'{}'", p),
                None => {
                    let hex_preview = if raw_written_pages.is_empty() {
                        format!("0 bytes read ({})", read_err.unwrap_or_else(|| "no detail".to_string()))
                    } else {
                        hex_string(&raw_written_pages[..raw_written_pages.len().min(16)])
                    };
                    format!("No NDEF header read ({})", hex_preview)
                }
            };
            Ok(NfcResult {
                success: false,
                payload: None,
                tag_uid: Some(tag_uid),
                error: Some(format!("Write verification mismatch (expected '{}', read back {})", uri, read_back_str)),
            })
        }
    })();

    #[cfg(mobile)]
    let result = Ok(NfcResult {
        success: false,
        payload: None,
        tag_uid: None,
        error: Some("Mobile NFC handled via native plugin".to_string()),
    });

    IS_WRITING_NFC.store(false, Ordering::SeqCst);
    result
}

/// Background hardware scanner task launcher for Desktop PC/SC card tap listener.
pub fn start_desktop_nfc_polling(app: tauri::AppHandle) {
    #[cfg(not(mobile))]
    {
        use std::thread;
        use std::time::Duration;
        use tauri::Emitter;

        thread::spawn(move || {
            let mut last_scanned_uid: Option<String> = None;
            let mut last_scan_time = std::time::Instant::now();

            loop {
                thread::sleep(Duration::from_millis(800));

                if IS_WRITING_NFC.load(Ordering::SeqCst) {
                    continue; // Skip polling while active write operation is in progress!
                }

                let ctx = match Context::establish(pcsc::Scope::User) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let mut readers_buf = [0; 2048];
                let mut readers = match ctx.list_readers(&mut readers_buf) {
                    Ok(r) => r,
                    Err(_) => continue,
                };

                let reader_name = match readers.next() {
                    Some(name) => name,
                    None => continue,
                };

                let card = match ctx.connect(reader_name, ShareMode::Shared, Protocols::ANY) {
                    Ok(c) => c,
                    Err(_) => {
                        if last_scan_time.elapsed() > Duration::from_secs(2) {
                            last_scanned_uid = None;
                        }
                        continue;
                    }
                };

                let get_uid_apdu = [0xFF, 0xCA, 0x00, 0x00, 0x00];
                let mut rapdu_buf = [0; MAX_BUFFER_SIZE];
                let tag_uid = match card.transmit(&get_uid_apdu, &mut rapdu_buf) {
                    Ok(rapdu) if rapdu.len() >= 2 && rapdu[rapdu.len() - 2] == 0x90 && rapdu[rapdu.len() - 1] == 0x00 => {
                        hex_string(&rapdu[..rapdu.len() - 2])
                    }
                    _ => continue,
                };

                if last_scanned_uid.as_deref() == Some(&tag_uid) && last_scan_time.elapsed() < Duration::from_secs(3) {
                    continue;
                }

                let (raw_pages, _) = read_tag_memory(&card);
                let payload = parse_ndef_uri_from_bytes(&raw_pages);

                last_scanned_uid = Some(tag_uid.clone());
                last_scan_time = std::time::Instant::now();

                let scan_event = NfcResult {
                    success: true,
                    payload,
                    tag_uid: Some(tag_uid),
                    error: None,
                };

                let _ = app.emit("nfc://tag-scanned", &scan_event);
            }
        });
    }
}
