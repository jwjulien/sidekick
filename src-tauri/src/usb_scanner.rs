use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
#[cfg(not(mobile))]
use std::time::Duration;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsbDeviceInfo {
    pub vid: String,
    pub pid: String,
    pub vid_num: u16,
    pub pid_num: u16,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsbScannerStatusResult {
    pub enabled: bool,
    pub connected: bool,
    pub device_name: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsbScanEventPayload {
    pub success: bool,
    pub payload: String,
    pub error: Option<String>,
}

struct ScannerState {
    enabled: bool,
    vid: u16,
    pid: u16,
}

static SCANNER_STATE: Mutex<ScannerState> = Mutex::new(ScannerState {
    enabled: false,
    vid: 0x0581,
    pid: 0x011C,
});

static SCANNER_CONNECTED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn usb_enumerate_devices() -> Result<Vec<UsbDeviceInfo>, String> {
    #[cfg(not(mobile))]
    {
        use rusb::UsbContext;
        let context = rusb::Context::new().map_err(|e| e.to_string())?;
        let devices = context.devices().map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for device in devices.iter() {
            let desc = match device.device_descriptor() {
                Ok(d) => d,
                Err(_) => continue,
            };

            let handle = device.open().ok();
            let mut manufacturer = None;
            let mut product = None;

            if let Some(ref h) = handle {
                let timeout = Duration::from_millis(300);
                let languages = h.read_languages(timeout).unwrap_or_default();
                if !languages.is_empty() {
                    let lang = languages[0];
                    if desc.manufacturer_string_index().is_some() {
                        manufacturer = h.read_manufacturer_string(lang, &desc, timeout).ok();
                    }
                    if desc.product_string_index().is_some() {
                        product = h.read_product_string(lang, &desc, timeout).ok();
                    }
                }
            }

            list.push(UsbDeviceInfo {
                vid: format!("0x{:04X}", desc.vendor_id()),
                pid: format!("0x{:04X}", desc.product_id()),
                vid_num: desc.vendor_id(),
                pid_num: desc.product_id(),
                manufacturer,
                product,
            });
        }
        Ok(list)
    }
    #[cfg(mobile)]
    {
        Ok(vec![])
    }
}

#[tauri::command]
pub fn usb_scanner_update_config(enabled: bool, vid: String, pid: String) -> Result<UsbScannerStatusResult, String> {
    let vid_clean = vid.trim().trim_start_matches("0x").trim_start_matches("0X");
    let pid_clean = pid.trim().trim_start_matches("0x").trim_start_matches("0X");

    let vid_num = u16::from_str_radix(vid_clean, 16)
        .map_err(|_| format!("Invalid Vendor ID (VID) hex string: '{}'", vid))?;
    let pid_num = u16::from_str_radix(pid_clean, 16)
        .map_err(|_| format!("Invalid Product ID (PID) hex string: '{}'", pid))?;

    if let Ok(mut state) = SCANNER_STATE.lock() {
        state.enabled = enabled;
        state.vid = vid_num;
        state.pid = pid_num;
    }

    usb_scanner_get_status()
}

#[tauri::command]
pub fn usb_scanner_get_status() -> Result<UsbScannerStatusResult, String> {
    if let Ok(state) = SCANNER_STATE.lock() {
        let connected = SCANNER_CONNECTED.load(Ordering::Relaxed);
        Ok(UsbScannerStatusResult {
            enabled: state.enabled,
            connected,
            device_name: if connected { Some(format!("VID 0x{:04X} / PID 0x{:04X}", state.vid, state.pid)) } else { None },
            error: None,
        })
    } else {
        Err("Failed to acquire scanner lock".to_string())
    }
}

fn decode_hid_report_chunk(data: &[u8], offset: usize) -> Option<char> {
    if offset + 2 >= data.len() {
        return None;
    }
    let shift = (data[offset] & 0x22) != 0;
    let key = data[offset + 2];
    if key == 0 {
        return None;
    }

    let (lower, upper) = match key {
        0x04 => ('a', 'A'), 0x05 => ('b', 'B'), 0x06 => ('c', 'C'), 0x07 => ('d', 'D'),
        0x08 => ('e', 'E'), 0x09 => ('f', 'F'), 0x0A => ('g', 'G'), 0x0B => ('h', 'H'),
        0x0C => ('i', 'I'), 0x0D => ('j', 'J'), 0x0E => ('k', 'K'), 0x0F => ('l', 'L'),
        0x10 => ('m', 'M'), 0x11 => ('n', 'N'), 0x12 => ('o', 'O'), 0x13 => ('p', 'P'),
        0x14 => ('q', 'Q'), 0x15 => ('r', 'R'), 0x16 => ('s', 'S'), 0x17 => ('t', 'T'),
        0x18 => ('u', 'U'), 0x19 => ('v', 'V'), 0x1A => ('w', 'W'), 0x1B => ('x', 'X'),
        0x1C => ('y', 'Y'), 0x1D => ('z', 'Z'),
        0x1E => ('1', '!'), 0x1F => ('2', '@'), 0x20 => ('3', '#'), 0x21 => ('4', '$'),
        0x22 => ('5', '%'), 0x23 => ('6', '^'), 0x24 => ('7', '&'), 0x25 => ('8', '*'),
        0x26 => ('9', '('), 0x27 => ('0', ')'),
        0x28 | 0x58 => ('\n', '\n'),
        0x2B => ('\t', '\t'), 0x2C => (' ', ' '),
        0x2D => ('-', '_'), 0x2E => ('=', '+'), 0x2F => ('[', '{'), 0x30 => (']', '}'),
        0x31 => ('\\', '|'), 0x32 => ('#', '~'), 0x33 => (';', ':'), 0x34 => ('\'', '"'),
        0x35 => ('`', '~'), 0x36 => (',', '<'), 0x37 => ('.', '>'), 0x38 => ('/', '?'),
        _ => return None,
    };

    Some(if shift { upper } else { lower })
}

pub fn start_desktop_usb_scanner_polling(app: tauri::AppHandle) {
    #[cfg(not(mobile))]
    {
        std::thread::spawn(move || {
            let mut buffer_str = String::new();

            loop {
                std::thread::sleep(Duration::from_millis(200));

                let (enabled, vid, pid) = match SCANNER_STATE.lock() {
                    Ok(st) => (st.enabled, st.vid, st.pid),
                    Err(_) => (false, 0, 0),
                };

                if !enabled {
                    SCANNER_CONNECTED.store(false, Ordering::Relaxed);
                    continue;
                }

                let handle = match rusb::open_device_with_vid_pid(vid, pid) {
                    Some(h) => h,
                    None => {
                        SCANNER_CONNECTED.store(false, Ordering::Relaxed);
                        continue;
                    }
                };

                // Auto-detach kernel driver if applicable
                let _ = handle.set_auto_detach_kernel_driver(true);

                // Set active configuration (1 by default)
                let _ = handle.set_active_configuration(1);

                // Find interface 0 and dynamic IN endpoint
                let device = handle.device();
                let config_desc = match device.active_config_descriptor() {
                    Ok(c) => c,
                    Err(_) => match device.config_descriptor(0) {
                        Ok(c) => c,
                        Err(_) => {
                            SCANNER_CONNECTED.store(false, Ordering::Relaxed);
                            continue;
                        }
                    },
                };

                let mut in_endpoint_address = 0x81;
                let mut is_interrupt = true;
                let mut max_packet_size = 64;
                let mut target_interface = 0;

                'find_ep: for interface in config_desc.interfaces() {
                    for interface_desc in interface.descriptors() {
                        for endpoint_desc in interface_desc.endpoint_descriptors() {
                            if endpoint_desc.direction() == rusb::Direction::In {
                                in_endpoint_address = endpoint_desc.address();
                                max_packet_size = endpoint_desc.max_packet_size() as usize;
                                target_interface = interface_desc.interface_number();
                                is_interrupt = endpoint_desc.transfer_type() == rusb::TransferType::Interrupt;
                                break 'find_ep;
                            }
                        }
                    }
                }

                if handle.claim_interface(target_interface).is_err() {
                    SCANNER_CONNECTED.store(false, Ordering::Relaxed);
                    continue;
                }

                SCANNER_CONNECTED.store(true, Ordering::Relaxed);

                let mut buf = vec![0u8; max_packet_size.max(64)];
                let mut last_char_time = std::time::Instant::now();

                while SCANNER_STATE.lock().map(|st| st.enabled && st.vid == vid && st.pid == pid).unwrap_or(false) {
                    let timeout = Duration::from_millis(150);
                    let read_result = if is_interrupt {
                        handle.read_interrupt(in_endpoint_address, &mut buf, timeout)
                    } else {
                        handle.read_bulk(in_endpoint_address, &mut buf, timeout)
                    };

                    match read_result {
                        Ok(len) => {
                            if len >= 3 {
                                for offset in (0..len).step_by(8) {
                                    if let Some(ch) = decode_hid_report_chunk(&buf[..len], offset) {
                                        if ch == '\n' {
                                            if !buffer_str.is_empty() {
                                                let scan_event = UsbScanEventPayload {
                                                    success: true,
                                                    payload: buffer_str.clone(),
                                                    error: None,
                                                };
                                                let _ = app.emit("usb-scanner://scan-received", &scan_event);
                                                buffer_str.clear();
                                            }
                                        } else {
                                            buffer_str.push(ch);
                                            last_char_time = std::time::Instant::now();
                                        }
                                    }
                                }
                            }
                        }
                        Err(rusb::Error::Timeout) => {
                            if !buffer_str.is_empty() && last_char_time.elapsed() > Duration::from_millis(250) {
                                let scan_event = UsbScanEventPayload {
                                    success: true,
                                    payload: buffer_str.clone(),
                                    error: None,
                                };
                                let _ = app.emit("usb-scanner://scan-received", &scan_event);
                                buffer_str.clear();
                            }
                            continue;
                        }
                        Err(_err) => {
                            SCANNER_CONNECTED.store(false, Ordering::Relaxed);
                            break;
                        }
                    }
                }

                let _ = handle.release_interface(target_interface);
            }
        });
    }
}
