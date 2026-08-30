import { getDeviceSetting, setDeviceSetting } from "./deviceSettings";
import { apiFetch } from "../hooks/useAuth";
import { parseDeepLink } from "../utils/deepLink";
import toast from "solid-toast";

export interface UsbDeviceInfo {
  vid: string;
  pid: string;
  vid_num: number;
  pid_num: number;
  manufacturer: string | null;
  product: string | null;
}

export interface UsbScannerStatusResult {
  enabled: boolean;
  connected: boolean;
  device_name: string | null;
  error?: string;
}

export interface UsbScanEventPayload {
  success: boolean;
  payload: string;
  error?: string;
}

export interface ResolvedEntity {
  entity_type: "location" | "part";
  entity_id: string;
  display_name: string;
  breadcrumb: string;
  target_route: string;
}

type ScanCallback = (payload: string) => boolean;

let activeScanListener: ScanCallback | null = null;
let unlistenTauriEvent: (() => void) | null = null;

function playSuccessBeep() {
  try {
    if (!getDeviceSetting("soundEffectsEnabled")) return;
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.warn("[USB Scanner] Audio play failed:", e);
  }
}

export const usbScannerService = {
  /**
   * Register a custom scan listener for active modals (e.g. MovePartModal).
   * Returns an unregister function.
   */
  registerModalListener(listener: ScanCallback): () => void {
    activeScanListener = listener;
    return () => {
      if (activeScanListener === listener) {
        activeScanListener = null;
      }
    };
  },

  /**
   * Enumerate attached USB devices via Tauri Rust backend.
   */
  async enumerateDevices(): Promise<UsbDeviceInfo[]> {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res: UsbDeviceInfo[] = await invoke("usb_enumerate_devices");
        return res || [];
      } catch (err) {
        console.warn("[USB Scanner] Hardware enumeration failed:", err);
      }
    }
    return [];
  },

  async enumerateUsbDevices(): Promise<UsbDeviceInfo[]> {
    return this.enumerateDevices();
  },

  /**
   * Queries real-time connection status from Tauri backend.
   */
  async getStatus(): Promise<UsbScannerStatusResult> {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res: UsbScannerStatusResult = await invoke("usb_scanner_get_status");
        return res;
      } catch (err) {
        console.warn("[USB Scanner] Status query failed:", err);
      }
    }
    return {
      enabled: getDeviceSetting("usbScannerEnabled"),
      connected: false,
      device_name: null,
    };
  },

  /**
   * Updates target scanner config (VID/PID/Enabled) in Rust backend.
   */
  async updateConfig(enabled: boolean, vidStr: string, pidStr: string): Promise<UsbScannerStatusResult> {
    setDeviceSetting("usbScannerEnabled", enabled);
    setDeviceSetting("usbScannerVid", vidStr);
    setDeviceSetting("usbScannerPid", pidStr);

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const status: UsbScannerStatusResult = await invoke("usb_scanner_update_config", {
          enabled,
          vid: String(vidStr),
          pid: String(pidStr),
        });
        return status;
      } catch (err) {
        console.error("[USB Scanner] Config update failed:", err);
      }
    }
    return {
      enabled,
      connected: false,
      device_name: null,
    };
  },

  /**
   * Initializes real-time Tauri event listener for USB barcode scans.
   */
  async initGlobalListener(navigate: (route: string) => void) {
    if (unlistenTauriEvent) {
      unlistenTauriEvent();
      unlistenTauriEvent = null;
    }

    const enabled = getDeviceSetting("usbScannerEnabled");
    const vid = getDeviceSetting("usbScannerVid");
    const pid = getDeviceSetting("usbScannerPid");
    await this.updateConfig(enabled, vid, pid);

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        unlistenTauriEvent = await listen<UsbScanEventPayload>("usb-scanner://scan-received", async (event) => {
          console.log("[USB Scanner] Decoded scan payload:", event.payload?.payload);
          const rawPayload = event.payload?.payload;
          if (!rawPayload) return;

          console.log("[USB Scanner] Decoded scan payload:", rawPayload);
          playSuccessBeep();

          // 1. Check if an active modal listener handles the scan
          if (activeScanListener) {
            const handled = activeScanListener(rawPayload);
            if (handled) return;
          }

          // 2. Dispatch custom event for in-page views (e.g. Storage.tsx)
          const parsed = parseDeepLink(rawPayload);
          if (parsed) {
            const evt = new CustomEvent("sidekick:nfc-scanned", { detail: parsed, cancelable: true });
            const handled = !window.dispatchEvent(evt);
            if (handled) {
              toast(`USB Scanner: Navigating to ${parsed.action}`, { id: "usb-scan-toast", icon: "🏷️" });
              return;
            }
          }

          // 3. Fallback: Resolve entity via FastAPI backend if unhandled or raw payload
          try {
            const entity: ResolvedEntity = await apiFetch(`/resolve/${encodeURIComponent(rawPayload)}`);
            if (entity && entity.target_route) {
              console.log("[USB Scanner] Navigating to target route:", entity.target_route);
              navigate(entity.target_route);
            }
          } catch (err) {
            console.error("[USB Scanner] Entity resolution request failed:", err);
          }
        });
      } catch (err) {
        console.error("[USB Scanner] Failed to attach Tauri event listener:", err);
      }
    }
  },
};
