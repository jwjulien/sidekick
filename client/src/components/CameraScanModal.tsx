import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { X, Zap, Camera, AlertTriangle, RefreshCw } from "lucide-solid";
import { cameraScannerService } from "../services/cameraScannerService";
import toast from "solid-toast";

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

  const isNative = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  return (
    <Show when={props.isOpen}>
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md text-white android-safe-top">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 z-20">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-sm">Scan Barcode / DataMatrix</span>
          </div>

          <div className="flex items-center gap-2">
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

          {/* Reticle Mask Frame */}
          <div className="absolute inset-0 border-[60px] sm:border-[100px] border-slate-950/70 pointer-events-none z-10">
            {/* Target Reticle Frame */}
            <div className="relative w-full h-full border-2 border-indigo-400/80 rounded-2xl shadow-[0_0_25px_rgba(99,102,241,0.5)] overflow-hidden bg-transparent">
              {/* Animated Scan Line */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse shadow-[0_0_12px_#818cf8]" />
              
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
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
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 text-center text-xs text-slate-400 z-20">
          Position DataMatrix or Code-128 barcode within the reticle
        </div>
      </div>
    </Show>
  );
}
