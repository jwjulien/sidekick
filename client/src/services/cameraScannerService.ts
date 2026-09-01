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
    console.info("[Camera Scanner] Checking runtime camera permissions...");
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    if (isTauri) {
      try {
        const { checkPermissions } = await import("@tauri-apps/plugin-barcode-scanner");
        const res: any = await checkPermissions();
        const status = typeof res === "string" ? res : (res?.camera || "prompt");
        console.info(`[Camera Scanner] Tauri camera permission status: "${status}"`);
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
        console.info(`[Camera Scanner] Browser navigator.permissions status: "${res.state}"`);
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
    console.info("[Camera Scanner] Requesting camera permission from OS...");
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    if (isTauri) {
      try {
        const { requestPermissions } = await import("@tauri-apps/plugin-barcode-scanner");
        const res: any = await requestPermissions();
        const status = typeof res === "string" ? res : (res?.camera || "denied");
        console.info(`[Camera Scanner] Tauri camera permission request result: "${status}"`);
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
      console.info("[Camera Scanner] Browser getUserMedia permission granted.");
      return { granted: true, canAskAgain: true };
    } catch (err: any) {
      console.warn("[Camera Scanner] Browser getUserMedia permission denied or failed:", err?.message || err);
      return { granted: false, canAskAgain: false };
    }
  },

  /**
   * Helper to determine device screen orientation ('portrait' | 'landscape').
   */
  getDeviceOrientation(): "portrait" | "landscape" {
    if (typeof window !== "undefined" && window.screen && window.screen.orientation) {
      return window.screen.orientation.type.startsWith("portrait") ? "portrait" : "landscape";
    }
    if (typeof window !== "undefined") {
      return window.innerHeight >= window.innerWidth ? "portrait" : "landscape";
    }
    return "portrait";
  },

  /**
   * Launches native Tauri Android barcode scanner plugin.
   */
  async startNativeScan(onResult: ScanResultCallback): Promise<boolean> {
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        console.info("[Camera Scanner] Starting native Tauri barcode scanner session (DataMatrix, QRCode)...");
        const { scan, Format } = await import("@tauri-apps/plugin-barcode-scanner");
        isScanning = true;

        const res = await scan({
          formats: [Format.DataMatrix, Format.QRCode],
          windowed: true,
        });

        isScanning = false;
        if (res && res.content) {
          console.info(`[Camera Scanner] Native scan result received: "${res.content}" (format: ${res.format || "unknown"})`);
          playSuccessBeep();
          onResult(res.content);
          return true;
        } else {
          console.info("[Camera Scanner] Native scan completed with empty result or user cancelled.");
        }
      } catch (err: any) {
        isScanning = false;
        console.warn("[Camera Scanner] Native barcode scan error/cancellation:", err?.message || err);
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
    console.info("[Camera Scanner] Initializing HTML5 ZXing camera scanner with TRY_HARDER and orientation awareness...");
    try {
      await this.stopScan(videoElement);
      isScanning = true;

      const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } = await import("@zxing/library");

      const formats = [
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
      ];

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
      hints.set(DecodeHintType.TRY_HARDER, true);

      // Supply configured hints map to constructor for rotation pass & format filtering
      const reader = new BrowserMultiFormatReader(hints);
      activeBrowserReader = reader;

      const videoConstraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      // Attempt rear environment camera first with 1080p target resolution
      try {
        console.info("[Camera Scanner] Attempting rear camera with high-resolution constraints & orientation hints...", videoConstraints);
        await reader.decodeFromConstraints(
          videoConstraints,
          videoElement,
          (result, err) => {
            if (result && isScanning) {
              const text = result.getText();
              if (text) {
                console.info(`[Camera Scanner] HTML5 camera scan decoded barcode: "${text}" (format: ${result.getBarcodeFormat()})`);
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
        console.info("[Camera Scanner] HTML5 ZXing camera stream active.");
        return true;
      } catch (constraintErr: any) {
        console.warn("[Camera Scanner] Rear camera constraint failed, falling back to default video device:", constraintErr?.message || constraintErr);
        // Fallback to default device camera if environment constraint fails
        await reader.decodeFromVideoDevice(
          null,
          videoElement,
          (result, err) => {
            if (result && isScanning) {
              const text = result.getText();
              if (text) {
                console.info(`[Camera Scanner] HTML5 fallback camera scan decoded barcode: "${text}"`);
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
        console.info("[Camera Scanner] HTML5 ZXing fallback camera stream active.");
        return true;
      }
    } catch (err: any) {
      isScanning = false;
      console.error("[Camera Scanner] HTML5 camera initialization error:", err?.message || err);
      return false;
    }
  },

  /**
   * Toggles flashlight / torch if supported by active hardware stream.
   */
  async toggleTorch(videoElement?: HTMLVideoElement | null): Promise<boolean> {
    console.info("[Camera Scanner] Toggling hardware torch/flashlight...");
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
          console.info(`[Camera Scanner] HTML5 video track torch set to: ${target}`);
          return target;
        } catch (e: any) {
          console.warn("[Camera Scanner] HTML5 torch constraint error:", e?.message || e);
        }
      }
    }

    // 2. Fallback to native Tauri plugin toggleTorch if active
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { toggleTorch } = await import("@tauri-apps/plugin-barcode-scanner");
        await toggleTorch();
        console.info("[Camera Scanner] Tauri native toggleTorch invoked.");
        return true;
      } catch (err: any) {
        console.warn("[Camera Scanner] Tauri native toggleTorch warning:", err?.message || err);
      }
    }

    return false;
  },

  /**
   * Cancels active camera scan session and releases hardware camera lock.
   */
  async stopScan(videoElement?: HTMLVideoElement | null) {
    if (!isScanning && !activeBrowserReader && !activeStream) return;
    console.info("[Camera Scanner] Stopping camera scan session and releasing media stream tracks...");
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
    console.info("[Camera Scanner] Camera hardware lock released.");
  },

  /**
   * Decodes scanned string payload and navigates / dispatches via Sidekick's deep link engine.
   */
  async handleScanPayload(payload: string, navigate: (route: string) => void) {
    if (!payload) return;
    console.info(`[Camera Scanner] Processing barcode payload: "${payload}"...`);

    // 1. Dispatch custom event for in-page views (e.g. Storage.tsx)
    const parsed = parseDeepLink(payload);
    if (parsed) {
      console.info(`[Camera Scanner] Scanned payload parsed as deep link:`, parsed);
      const evt = new CustomEvent("sidekick:nfc-scanned", { detail: parsed, cancelable: true });
      const handled = !window.dispatchEvent(evt);
      if (handled) {
        console.info("[Camera Scanner] Deep link payload handled by active page event listener.");
        return;
      }
    }

    // 2. Fallback: Query FastAPI entity resolver
    try {
      console.info(`[Camera Scanner] Resolving barcode payload via backend API (/resolve/${encodeURIComponent(payload)})...`);
      const entity = await apiFetch(`/resolve/${encodeURIComponent(payload)}`);
      if (entity && entity.target_route) {
        console.info(`[Camera Scanner] Backend resolved entity to route: "${entity.target_route}"`, entity);
        navigate(entity.target_route);
      } else {
        console.warn("[Camera Scanner] Backend entity resolution returned no target route:", entity);
      }
    } catch (err: any) {
      console.error(`[Camera Scanner] Failed to resolve barcode payload "${payload}":`, err?.message || err);
    }
  },
};
