import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { X, Zap, Camera, AlertTriangle, RefreshCw, Smartphone, RotateCw, Target } from "lucide-solid";
import { cameraScannerService } from "../services/cameraScannerService";

interface CameraScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan?: (payload: string) => boolean | void; // Custom handler if invoked inside a modal
}

export default function CameraScanModal(props: CameraScanModalProps) {
  let navigate: ReturnType<typeof useNavigate> | null = null;
  try {
    navigate = useNavigate();
  } catch (_) {}

  let videoRef: HTMLVideoElement | undefined;
  const [permissionGranted, setPermissionGranted] = createSignal(true);
  const [loading, setLoading] = createSignal(false);
  const [torchActive, setTorchActive] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [orientation, setOrientation] = createSignal<"portrait" | "landscape">(
    cameraScannerService.getDeviceOrientation()
  );

  const handleResizeOrOrientation = () => {
    setOrientation(cameraScannerService.getDeviceOrientation());
  };

  onMount(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResizeOrOrientation);
      window.addEventListener("orientationchange", handleResizeOrOrientation);
    }
  });

  onCleanup(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", handleResizeOrOrientation);
      window.removeEventListener("orientationchange", handleResizeOrOrientation);
    }
  });

  const startScanning = async () => {
    setErrorMessage(null);
    setLoading(true);

    const handleResult = async (payload: string) => {
      handleClose();

      // Check if custom prop handler handled it
      if (props.onScan) {
        const handled = props.onScan(payload);
        if (handled) return;
      }

      // Default resolution engine
      if (navigate) {
        await cameraScannerService.handleScanPayload(payload, navigate);
      }
    };

    if (videoRef) {
      const started = await cameraScannerService.startBrowserScan(videoRef, handleResult);
      if (!started) {
        setErrorMessage("Could not start camera video stream. Please grant camera access in Android system settings.");
      }
    }
    setLoading(false);
  };

  const handleToggleTorch = async () => {
    const active = await cameraScannerService.toggleTorch(videoRef);
    setTorchActive(active);
  };

  const cleanupTransparency = () => {
    document.body.classList.remove("barcode-scanner-active");
    document.documentElement.classList.remove("barcode-scanner-active");
  };

  createEffect(() => {
    if (props.isOpen) {
      setTorchActive(false);
      setOrientation(cameraScannerService.getDeviceOrientation());
      const timer = setTimeout(() => {
        startScanning();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      cleanupTransparency();
      cameraScannerService.stopScan(videoRef);
    }
  });

  onCleanup(() => {
    cleanupTransparency();
    cameraScannerService.stopScan(videoRef);
  });

  const handleClose = () => {
    cleanupTransparency();
    cameraScannerService.stopScan(videoRef);
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md text-white android-safe-top">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 z-20">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-sm">Scan DataMatrix</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Phone Orientation Badge */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] font-medium text-slate-300"
              title={`Current orientation: ${orientation()}`}
            >
              <Smartphone className={`w-3.5 h-3.5 ${orientation() === "landscape" ? "rotate-90" : ""} text-indigo-400 transition-transform`} />
              <span className="capitalize">{orientation()}</span>
            </div>

            <button
              onClick={handleToggleTorch}
              className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                torchActive() ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Toggle Flashlight"
            >
              <Zap className="w-4 h-4" />
            </button>

            <button
              onClick={handleClose}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Camera Preview Container */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-slate-950">
          {/* Live Camera Video Feed */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover z-0"
            playsinline
            muted
          />

          {/* Dark Overlay around centered reticle */}
          <div className="absolute inset-0 bg-slate-950/65 pointer-events-none z-10 flex flex-col items-center justify-center">
            {/* Compact Reticle Box for Small DataMatrix Barcodes */}
            <div className="relative w-[75vw] max-w-[260px] h-[170px] rounded-2xl border-2 border-indigo-400/90 shadow-[0_0_30px_rgba(99,102,241,0.6)] bg-transparent overflow-hidden">
              {/* Center Aiming Target Dot / Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
                <Target className="w-8 h-8 text-indigo-300/80 animate-pulse" />
              </div>

              {/* Animated Scan Line */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse shadow-[0_0_12px_#38bdf8]" />

              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
            </div>

            {/* Mobile Orientation Hint under reticle */}
            <div className="mt-4 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-indigo-300 flex items-center gap-1.5 backdrop-blur-sm">
              <Smartphone className={`w-3.5 h-3.5 ${orientation() === "landscape" ? "rotate-90" : ""}`} />
              <span>{orientation() === "portrait" ? "Portrait Mode (Auto-Oriented)" : "Landscape Mode"}</span>
            </div>
          </div>

          {/* Error Message Overlay */}
          <Show when={errorMessage()}>
            <div className="absolute inset-x-6 top-1/3 z-30 p-4 rounded-xl bg-slate-900/95 border border-red-500/40 text-center space-y-3 shadow-2xl">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300">{errorMessage()}</p>
              <button
                onClick={startScanning}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Camera Access
              </button>
            </div>
          </Show>
        </div>

        {/* Bottom Helper Bar */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 text-center text-xs text-slate-300 font-medium z-20">
          Position DataMatrix code inside the reticle
        </div>
      </div>
    </Show>
  );
}
