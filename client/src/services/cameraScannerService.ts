import { parseDeepLink } from "../utils/deepLink";
import { apiFetch } from "../hooks/useAuth";

export interface CameraPermissionState {
  granted: boolean;
  canAskAgain: boolean;
}

export type ScanResultCallback = (payload: string) => void;

let activeBrowserReader: any = null;
let activeStream: MediaStream | null = null;
let isScanning = false;

function playSuccessBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // C6 tone
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (_) { }
}

export const cameraScannerService = {
  isScanning(): boolean {
    return isScanning;
  },

  /**
   * Checks runtime camera permissions for mobile / browser environment.
   */
  async checkPermissions(): Promise<CameraPermissionState> {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { checkPermissions } = await import("@tauri-apps/plugin-barcode-scanner");
        const res: any = await checkPermissions();
        const status = typeof res === "string" ? res : (res?.camera || "prompt");
        return {
          granted: status === "granted",
          canAskAgain: status !== "denied",
        };
      } catch (err) {
        console.warn("[Camera Scanner] Tauri permission check warning:", err);
      }
    }

    // Web browser fallback check
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({ name: "camera" as any });
        return {
          granted: res.state === "granted",
          canAskAgain: res.state !== "denied",
        };
      }
    } catch (_) { }

    return { granted: true, canAskAgain: true };
  },

  /**
   * Requests runtime camera permission from the operating system.
   */
  async requestPermissions(): Promise<CameraPermissionState> {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { requestPermissions } = await import("@tauri-apps/plugin-barcode-scanner");
        const res: any = await requestPermissions();
        const status = typeof res === "string" ? res : (res?.camera || "denied");
        return {
          granted: status === "granted",
          canAskAgain: status !== "denied",
        };
      } catch (err) {
        console.warn("[Camera Scanner] Tauri permission request warning:", err);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true, canAskAgain: true };
    } catch (_) {
      return { granted: false, canAskAgain: false };
    }
  },

  /**
   * Launches native Tauri Android barcode scanner plugin.
   */
  async startNativeScan(onResult: ScanResultCallback): Promise<boolean> {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { scan, Format } = await import("@tauri-apps/plugin-barcode-scanner");
        isScanning = true;

        const res = await scan({
          formats: [Format.DataMatrix, Format.Code128, Format.QrCode],
          windowed: true,
        });

        isScanning = false;
        if (res && res.content) {
          playSuccessBeep();
          onResult(res.content);
          return true;
        }
      } catch (err: any) {
        isScanning = false;
        console.warn("[Camera Scanner] Native scan failed or cancelled:", err);
      }
    }
    return false;
  },

  /**
   * Launches camera scanner using @zxing/library against HTML5 video element.
   */
  async startBrowserScan(
    videoElement: HTMLVideoElement,
    onResult: ScanResultCallback
  ): Promise<boolean> {
    try {
      await this.stopScan(videoElement);
      isScanning = true;

      const { BrowserMultiFormatReader, BarcodeFormat } = await import("@zxing/library");
      const reader = new BrowserMultiFormatReader();
      activeBrowserReader = reader;

      const formats = [
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.CODE_128,
        BarcodeFormat.QR_CODE,
      ];

      const hints = new Map();
      hints.set(2, formats);

      // Attempt rear environment camera first
      try {
        await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoElement,
          (result, err) => {
            if (result && isScanning) {
              const text = result.getText();
              if (text) {
                playSuccessBeep();
                isScanning = false;
                this.stopScan(videoElement);
                onResult(text);
              }
            }
          }
        );
        if (videoElement.srcObject) {
          activeStream = videoElement.srcObject as MediaStream;
        }
        return true;
      } catch (constraintErr) {
        // Fallback to default device camera if environment constraint fails
        await reader.decodeFromVideoDevice(
          undefined,
          videoElement,
          (result, err) => {
            if (result && isScanning) {
              const text = result.getText();
              if (text) {
                playSuccessBeep();
                isScanning = false;
                this.stopScan(videoElement);
                onResult(text);
              }
            }
          }
        );
        if (videoElement.srcObject) {
          activeStream = videoElement.srcObject as MediaStream;
        }
        return true;
      }
    } catch (err: any) {
      isScanning = false;
      console.error("[Camera Scanner] Camera initialization error:", err);
      return false;
    }
  },

  /**
   * Toggles flashlight / torch if supported by active hardware stream.
   */
  async toggleTorch(videoElement?: HTMLVideoElement | null): Promise<boolean> {
    // 1. Try active HTML5 video track first
    const stream = activeStream || (videoElement?.srcObject as MediaStream | null);
    if (stream && stream.getVideoTracks) {
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const settings = track.getSettings ? (track.getSettings() as any) : {};
          const current = !!settings.torch;
          const target = !current;
          await track.applyConstraints({
            advanced: [{ torch: target } as any],
          });
          return target;
        } catch (e) {
          console.warn("[Camera Scanner] HTML5 torch constraint warning:", e);
        }
      }
    }

    // 2. Fallback to native Tauri plugin toggleTorch if active
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { toggleTorch } = await import("@tauri-apps/plugin-barcode-scanner");
        await toggleTorch();
        return true;
      } catch (_) { }
    }

    return false;
  },

  /**
   * Cancels active camera scan session and releases hardware camera lock.
   */
  async stopScan(videoElement?: HTMLVideoElement | null) {
    isScanning = false;

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { cancel } = await import("@tauri-apps/plugin-barcode-scanner");
        await cancel();
      } catch (_) { }
    }

    if (activeBrowserReader) {
      try {
        activeBrowserReader.stopAsyncDecode();
      } catch (_) { }
      try {
        activeBrowserReader.reset();
      } catch (_) { }
      activeBrowserReader = null;
    }

    if (videoElement && videoElement.srcObject) {
      try {
        const stream = videoElement.srcObject as MediaStream;
        if (stream && stream.getTracks) {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch (_) { }
          });
        }
      } catch (_) { }
      videoElement.srcObject = null;
    }

    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) { }
      });
      activeStream = null;
    }
  },

  /**
   * Decodes scanned string payload and navigates / dispatches via Sidekick's deep link engine.
   */
  async handleScanPayload(payload: string, navigate: (route: string) => void) {
    if (!payload) return;

    // 1. Dispatch custom event for in-page views (e.g. Storage.tsx)
    const parsed = parseDeepLink(payload);
    if (parsed) {
      const evt = new CustomEvent("sidekick:nfc-scanned", { detail: parsed, cancelable: true });
      const handled = !window.dispatchEvent(evt);
      if (handled) return;
    }

    // 2. Fallback: Query FastAPI entity resolver
    try {
      const entity = await apiFetch(`/resolve/${encodeURIComponent(payload)}`);
      if (entity && entity.target_route) {
        navigate(entity.target_route);
      }
    } catch (err) {
      console.error("[Camera Scanner] Failed to resolve payload:", payload, err);
    }
  },
};
