import { createSignal, createEffect, Show } from "solid-js";
import { useScale } from "../context/ScaleContext";
import { apiFetch } from "../hooks/useAuth";
import toast from "solid-toast";
import {
  Scale,
  X,
  RotateCcw,
  Plus,
  Minus,
  Check,
  RefreshCw,
  Bluetooth,
  Sliders,
  AlertCircle,
} from "lucide-solid";

export interface PartWeightCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  part: any;
  onSuccess?: (newWeight: number) => void;
}

export default function PartWeightCalibrationModal(props: PartWeightCalibrationModalProps) {
  const scale = useScale();
  const [calibrationCount, setCalibrationCount] = createSignal<number>(10);
  const [isSubmitting, setIsSubmitting] = createSignal<boolean>(false);

  // Auto connect if disconnected when modal opens
  createEffect(() => {
    if (props.isOpen && scale.status() === "disconnected") {
      scale.connect();
    }
  });

  const adjustCount = (delta: number) => {
    setCalibrationCount((prev) => Math.max(1, prev + delta));
  };

  const calculateUnitWeight = () => {
    const net = scale.netWeight();
    const count = calibrationCount();
    if (count <= 0 || net <= 0) return 0;
    return Math.round((net / count) * 10000) / 10000;
  };

  const handleConfirmCalibration = async () => {
    const net = scale.netWeight();
    const count = calibrationCount();

    if (count <= 0) {
      toast.error("Please enter a sample count greater than zero.");
      return;
    }
    if (net <= 0) {
      toast.error("Scale weight is zero. Please place sample parts on the scale first.");
      return;
    }
    if (!scale.isStable()) {
      toast.error("Scale reading is not stable yet. Please wait for the scale to settle.");
      return;
    }

    const calculatedUnitWeight = calculateUnitWeight();
    setIsSubmitting(true);
    try {
      await apiFetch(`/parts/${props.part.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: calculatedUnitWeight }),
      });

      toast.success(`Unit weight calibrated: ${calculatedUnitWeight} ${scale.unit()}/piece`);
      if (props.part) props.part.weight = calculatedUnitWeight;
      if (props.onSuccess) props.onSuccess(calculatedUnitWeight);
      props.onClose();
    } catch (err: any) {
      console.error("Failed to update part unit weight:", err);
      toast.error(err.message || "Failed to update part unit weight.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
        <div class="relative w-full max-w-md bg-[#141419] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Scale size={20} />
              </div>
              <div>
                <h3 class="text-base font-bold text-white leading-tight">
                  Calibrate Part Weight
                </h3>
                <p class="text-xs text-gray-400">
                  {props.part?.number} — {props.part?.value}
                </p>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div class="p-6 space-y-5">
            {/* Connection Check / Warning */}
            <Show when={scale.status() !== "connected"}>
              <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3">
                <div class="flex items-center justify-center gap-2 text-amber-300 font-semibold text-xs">
                  <Bluetooth size={16} /> Scale Not Connected
                </div>
                <p class="text-xs text-gray-400">
                  Connect your scale or use Dev Simulator mode to calibrate.
                </p>
                <button
                  onClick={() => scale.connect()}
                  class="px-4 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors inline-flex items-center gap-2"
                >
                  <RefreshCw size={14} /> Connect Scale
                </button>
              </div>
            </Show>

            {/* Scale Reading Display */}
            <div class="p-5 rounded-xl bg-black/40 border border-white/10 space-y-3 text-center">
              <div class="flex items-center justify-between text-xs text-gray-400">
                <span class="flex items-center gap-1.5">
                  Live Net Weight
                  <Show when={scale.isStable()} fallback={
                    <span class="text-[10px] text-amber-400 animate-pulse font-semibold">Unstable</span>
                  }>
                    <span class="text-[10px] text-emerald-400 font-semibold">Stable</span>
                  </Show>
                </span>
                <button
                  onClick={() => scale.tare()}
                  class="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-200 text-xs transition-colors flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Tare Scale
                </button>
              </div>

              <div class="text-4xl font-black text-amber-400 tracking-tight">
                {scale.netWeight()} <span class="text-xl font-normal text-gray-400">{scale.unit()}</span>
              </div>

              <Show when={scale.tareOffset() > 0}>
                <div class="text-xs text-amber-400/70">
                  Tare Offset: -{scale.tareOffset()} {scale.unit()}
                </div>
              </Show>
            </div>

            {/* Sample Count Controls (-10, -1, +1, +10) */}
            <div class="space-y-2">
              <label class="text-xs font-semibold text-gray-300 block">
                Sample part quantity placed on scale:
              </label>
              <div class="flex items-center gap-2">
                <button
                  onClick={() => adjustCount(-10)}
                  class="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 text-xs font-bold active:scale-95 transition-all"
                >
                  -10
                </button>
                <button
                  onClick={() => adjustCount(-1)}
                  class="p-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 active:scale-95 transition-all"
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  inputmode="numeric"
                  min="1"
                  value={calibrationCount()}
                  onInput={(e) =>
                    setCalibrationCount(Math.max(1, parseInt(e.currentTarget.value) || 1))
                  }
                  class="w-full text-center py-2 px-3 bg-black/50 border border-white/10 rounded-lg text-white font-bold text-lg focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => adjustCount(1)}
                  class="p-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 active:scale-95 transition-all"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => adjustCount(10)}
                  class="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 text-xs font-bold active:scale-95 transition-all"
                >
                  +10
                </button>
              </div>
            </div>

            {/* Unit Weight Preview */}
            <Show when={scale.netWeight() > 0}>
              <div class="p-3 rounded-lg bg-white/5 text-xs text-gray-300 flex justify-between items-center">
                <span>Calculated Unit Weight:</span>
                <span class="font-mono font-bold text-amber-400">
                  {calculateUnitWeight()} {scale.unit()}/piece
                </span>
              </div>
            </Show>

            {/* Unstable Warning */}
            <Show when={scale.netWeight() > 0 && !scale.isStable()}>
              <div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} class="shrink-0" />
                <span>Waiting for scale weight to stabilize...</span>
              </div>
            </Show>

            {/* Action */}
            <div class="pt-2 flex justify-end">
              <button
                onClick={handleConfirmCalibration}
                disabled={isSubmitting() || scale.netWeight() <= 0 || !scale.isStable()}
                class="w-full py-3 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Check size={16} /> Save Unit Weight
              </button>
            </div>
          </div>

          {/* Dev / Simulator Bar */}
          <div class="px-6 py-3 border-t border-white/10 bg-black/60 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-gray-400">
              <Sliders size={14} class="text-amber-400" />
              <span>Dev Simulator</span>
            </div>

            <div class="flex items-center gap-3">
              <Show when={scale.mockMode()}>
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="5"
                    value={scale.simulatedWeight()}
                    onInput={(e) => scale.setSimulatedWeight(parseFloat(e.currentTarget.value))}
                    class="w-24 accent-amber-400 cursor-pointer"
                  />
                  <span class="font-mono text-amber-400 text-xs w-12">
                    {scale.simulatedWeight()}g
                  </span>
                </div>
              </Show>

              <button
                onClick={() => scale.setMockMode(!scale.mockMode())}
                class={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  scale.mockMode()
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                {scale.mockMode() ? "Mock Active" : "Enable Mock"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
