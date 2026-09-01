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
  } catch (e: any) {
    console.warn("[USB Scanner] Audio play failed:", e?.message || e);
  }
}

export const usbScannerService = {
  /**
   * Register a custom scan listener for active modals (e.g. MovePartModal).
   * Returns an unregister function.
   */
  registerModalListener(listener: ScanCallback): () => void {
    console.info("[USB Scanner] Modal listener registered.");
    activeScanListener = listener;
    return () => {
      if (activeScanListener === listener) {
        activeScanListener = null;
        console.info("[USB Scanner] Modal listener unregistered.");
      }
    };
  },

  /**
   * Enumerate attached USB devices via Tauri Rust backend.
   */
  async enumerateDevices(): Promise<UsbDeviceInfo[]> {
    console.info("[USB Scanner] Enumerating hardware USB HID / Serial devices...");
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res: UsbDeviceInfo[] = await invoke("usb_enumerate_devices");
        console.info(`[USB Scanner] Hardware enumeration complete. Found ${res?.length || 0} device(s):`, res);
        return res || [];
      } catch (err: any) {
        console.warn("[USB Scanner] Hardware enumeration failed:", err?.message || err);
      }
    } else {
      console.info("[USB Scanner] Running in Web environment. USB hardware enumeration unavailable.");
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
    console.info("[USB Scanner] Querying real-time connection status...");
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res: UsbScannerStatusResult = await invoke("usb_scanner_get_status");
        console.info(`[USB Scanner] Connection status: enabled=${res.enabled}, connected=${res.connected}, device="${res.device_name}"`);
        return res;
      } catch (err: any) {
        console.warn("[USB Scanner] Status query failed:", err?.message || err);
      }
    }
    const fallback: UsbScannerStatusResult = {
      enabled: getDeviceSetting("usbScannerEnabled"),
      connected: false,
      device_name: null,
    };
    console.info("[USB Scanner] Web fallback status returned:", fallback);
    return fallback;
  },

  /**
   * Updates target scanner config (VID/PID/Enabled) in Rust backend.
   */
  async updateConfig(enabled: boolean, vidStr: string, pidStr: string): Promise<UsbScannerStatusResult> {
    console.info(`[USB Scanner] Updating scanner configuration: enabled=${enabled}, vid="${vidStr}", pid="${pidStr}"...`);
    setDeviceSetting("usbScannerEnabled", enabled);
    setDeviceSetting("usbScannerVid", vidStr);
    setDeviceSetting("usbScannerPid", pidStr);

    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const status: UsbScannerStatusResult = await invoke("usb_scanner_update_config", {
          enabled,
          vid: String(vidStr),
          pid: String(pidStr),
        });
        console.info(`[USB Scanner] Tauri backend config updated successfully:`, status);
        return status;
      } catch (err: any) {
        console.error("[USB Scanner] Backend config update failed:", err?.message || err);
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
    console.info(`[USB Scanner] Initializing global USB scanner listener (enabled=${enabled}, vid="${vid}", pid="${pid}")...`);
    await this.updateConfig(enabled, vid, pid);

    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        unlistenTauriEvent = await listen<UsbScanEventPayload>("usb-scanner://scan-received", async (event) => {
          const rawPayload = event.payload?.payload;
          if (!rawPayload) return;

          console.info(`[USB Scanner] Barcode scan event received: "${rawPayload}"`);
          playSuccessBeep();

          // 1. Check if an active modal listener handles the scan
          if (activeScanListener) {
            console.info("[USB Scanner] Passing scan payload to registered modal listener...");
            const handled = activeScanListener(rawPayload);
            if (handled) {
              console.info("[USB Scanner] Scan payload consumed by active modal.");
              return;
            }
          }

          // 2. Dispatch custom event for in-page views (e.g. Storage.tsx)
          const parsed = parseDeepLink(rawPayload);
          if (parsed) {
            console.info("[USB Scanner] Scan payload parsed as deep link:", parsed);
            const evt = new CustomEvent("sidekick:nfc-scanned", { detail: parsed, cancelable: true });
            const handled = !window.dispatchEvent(evt);
            if (handled) {
              toast(`USB Scanner: Navigating to ${parsed.action}`, { id: "usb-scan-toast", icon: "🏷️" });
              console.info("[USB Scanner] Scan payload handled by page event listener.");
              return;
            }
          }

          // 3. Fallback: Resolve entity via FastAPI backend if unhandled or raw payload
          try {
            console.info(`[USB Scanner] Resolving scan payload via backend API (/resolve/${encodeURIComponent(rawPayload)})...`);
            const entity: ResolvedEntity = await apiFetch(`/resolve/${encodeURIComponent(rawPayload)}`);
            if (entity && entity.target_route) {
              console.info(`[USB Scanner] Navigating to backend target route: "${entity.target_route}"`, entity);
              navigate(entity.target_route);
            } else {
              console.warn("[USB Scanner] Backend entity resolution returned no route:", entity);
            }
          } catch (err: any) {
            console.error("[USB Scanner] Entity resolution request failed:", err?.message || err);
          }
        });
        console.info("[USB Scanner] Event listener attached for \"usb-scanner://scan-received\".");
      } catch (err: any) {
        console.error("[USB Scanner] Failed to attach Tauri event listener:", err?.message || err);
      }
    } else {
      console.info("[DeepLink Engine] Running in Web environment. USB scanner hardware event listener skipped.");
    }
  },
};
