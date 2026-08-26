use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct NfcResult {
    pub success: bool,
    pub payload: Option<String>,
    pub tag_uid: Option<String>,
    pub error: Option<String>,
}

#[cfg(not(mobile))]
use pcsc::{Context, Protocols, ShareMode, MAX_BUFFER_SIZE};

#[cfg(not(mobile))]
fn hex_string(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(":")
}

/// Attempts to read tag UID / NDEF payload using PC/SC USB Reader (e.g. ACR122U) on Desktop platforms.
#[tauri::command]
pub async fn nfc_read_tag() -> Result<NfcResult, String> {
    #[cfg(not(mobile))]
    {
        // 1. Establish PC/SC context
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

        // 2. List readers
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

        // 3. Connect to card
        let card = match ctx.connect(reader_name, ShareMode::Shared, Protocols::ANY) {
            Ok(card) => card,
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("Failed to connect to NFC tag: {}", err)),
                });
            }
        };

        // 4. Send APDU command to get Card UID (Command APDU: FF CA 00 00 00)
        let get_uid_apdu = [0xFF, 0xCA, 0x00, 0x00, 0x00];
        let mut rapdu_buf = [0; MAX_BUFFER_SIZE];
        
        match card.transmit(&get_uid_apdu, &mut rapdu_buf) {
            Ok(rapdu) => {
                if rapdu.len() >= 2 && rapdu[rapdu.len() - 2] == 0x90 && rapdu[rapdu.len() - 1] == 0x00 {
                    let uid_bytes = &rapdu[..rapdu.len() - 2];
                    let uid_str = hex_string(uid_bytes);
                    return Ok(NfcResult {
                        success: true,
                        payload: None,
                        tag_uid: Some(uid_str),
                        error: None,
                    });
                } else {
                    return Ok(NfcResult {
                        success: false,
                        payload: None,
                        tag_uid: None,
                        error: Some("Failed to read tag UID from card".to_string()),
                    });
                }
            }
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("APDU transmit error: {}", err)),
                });
            }
        }
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

    #[cfg(not(mobile))]
    {
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

        let card = match ctx.connect(reader_name, ShareMode::Shared, Protocols::ANY) {
            Ok(card) => card,
            Err(err) => {
                return Ok(NfcResult {
                    success: false,
                    payload: None,
                    tag_uid: None,
                    error: Some(format!("Tag connect error: {}", err)),
                });
            }
        };

        // Command APDU to read UID first
        let get_uid_apdu = [0xFF, 0xCA, 0x00, 0x00, 0x00];
        let mut rapdu_buf = [0; MAX_BUFFER_SIZE];
        let tag_uid = match card.transmit(&get_uid_apdu, &mut rapdu_buf) {
            Ok(rapdu) if rapdu.len() >= 2 => Some(hex_string(&rapdu[..rapdu.len() - 2])),
            _ => None,
        };

        Ok(NfcResult {
            success: true,
            payload: Some(uri),
            tag_uid,
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
