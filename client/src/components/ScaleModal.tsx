import { createSignal, createEffect, Show, untrack } from "solid-js";
import { useScale } from "../context/ScaleContext";
import { apiFetch } from "../hooks/useAuth";
import toast from "solid-toast";
import {
  Scale,
  X,
  RotateCcw,
  Check,
  RefreshCw,
  Bluetooth,
  Sliders,
  AlertCircle,
} from "lucide-solid";
import ContainerTareSelector from "./ContainerTareSelector";
import PartWeightCalibrationModal from "./PartWeightCalibrationModal";

export interface ScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  part: any;
  storageLocation: any;
  onSuccess?: () => void;
}

export default function ScaleModal(props: ScaleModalProps) {
  const scale = useScale();

  const [step, setStep] = createSignal<"connect" | "measure">("connect");
  const [showCalibrationModal, setShowCalibrationModal] = createSignal<boolean>(false);
  const [isSubmitting, setIsSubmitting] = createSignal<boolean>(false);
  const [tareWeights, setTareWeights] = createSignal<any[]>([]);
  const [selectedTareId, setSelectedTareId] = createSignal<string | null>(null);

  let autoConnectAttempted = false;

  // Synchronize modal state on open & load container tare profiles
  createEffect(() => {
    if (props.isOpen) {
      // Fetch container tare weights
      apiFetch("/tare-weights")
        .then((data) => {
          setTareWeights(data || []);
          // Auto-select initial tare if location has last_tare
          const initTareId = props.storageLocation?.last_tare_id || props.storageLocation?.last_tare?.id || null;
          if (initTareId) {
            const match = (data || []).find((t: any) => t.id === initTareId);
            if (match) {
              setSelectedTareId(match.id);
              scale.setTareOffset(match.weight);
            } else {
              setSelectedTareId(null);
            }
          } else {
            setSelectedTareId(null);
          }
        })
        .catch((err) => console.error("Failed to load tare weights:", err));

      const currentStatus = untrack(() => scale.status());
      // Auto attempt connection if disconnected
      if (!autoConnectAttempted && currentStatus === "disconnected") {
        autoConnectAttempted = true;
        scale.connect();
      }

      // Check if scale connected & whether unit weight exists
      if (currentStatus === "connected") {
        if (!props.part || !props.part.weight || props.part.weight <= 0) {
          setShowCalibrationModal(true);
        } else {
          setStep("measure");
        }
      } else {
        setStep("connect");
      }
    } else {
      autoConnectAttempted = false;
    }
  });

  // Watch scale status changes
  createEffect(() => {
    if (props.isOpen && scale.status() === "connected" && step() === "connect") {
      if (!props.part || !props.part.weight || props.part.weight <= 0) {
        setShowCalibrationModal(true);
      } else {
        setStep("measure");
      }
    }
  });

  const handleSelectTare = (tareId: string | null) => {
    if (!tareId) {
      setSelectedTareId(null);
      scale.tare();
    } else {
      const match = tareWeights().find((t) => t.id === tareId);
      if (match) {
        setSelectedTareId(match.id);
        scale.setTareOffset(match.weight);
      }
    }
  };

  const getActiveUnitWeight = () => {
    return props.part?.weight || 0;
  };

  const calculateEstimatedCount = () => {
    const unitWt = getActiveUnitWeight();
    if (unitWt <= 0) return 0;
    const net = scale.netWeight();
    if (net <= 0) return 0;
    return Math.round(net / unitWt);
  };

  const handleUpdateStockCount = async () => {
    const count = calculateEstimatedCount();
    if (!props.storageLocation) {
      toast.error("No storage location specified.");
      return;
    }
    if (!scale.isStable()) {
      toast.error("Scale reading is not stable. Please wait for the scale to settle.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`/locations/${props.storageLocation.id}/count`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: count,
          last_tare_id: selectedTareId(),
          set_last_tare: true
        }),
      });

      toast.success(`Updated stock at '${props.storageLocation.name}' to ${count} pcs.`);
      if (props.onSuccess) props.onSuccess();
      props.onClose();
    } catch (err: any) {
      console.error("Failed to update stock quantity:", err);
      toast.error(err.message || "Failed to update stock quantity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Standalone Calibration Modal (Embedded Intercept) */}
      <PartWeightCalibrationModal
        isOpen={showCalibrationModal()}
        onClose={() => setShowCalibrationModal(false)}
        part={props.part}
        onSuccess={() => setStep("measure")}
      />

      <Show when={props.isOpen && !showCalibrationModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div class="relative w-full max-w-lg bg-[#141419] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-xl bg-accentCyan/10 text-accentCyan">
                  <Scale size={20} />
                </div>
                <div>
                  <h3 class="text-base font-bold text-white leading-tight">
                    Scale Inventory Reconciliation
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
              {/* STEP 1: CONNECTING */}
              <Show when={step() === "connect"}>
                <div class="py-8 text-center space-y-4">
                  <div class="relative inline-flex items-center justify-center">
                    <div class="w-16 h-16 rounded-full border-4 border-accentCyan/20 border-t-accentCyan animate-spin"></div>
                    <Bluetooth size={24} class="absolute text-accentCyan" />
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-white">
                      Searching for scale devices...
                    </h4>
                    <p class="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                      Ensure your Bluetooth scale is powered on and within range.
                    </p>
                  </div>

                  <Show when={scale.errorMessage()}>
                    <div class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                      {scale.errorMessage()}
                    </div>
                  </Show>

                  <div class="pt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={() => scale.connect()}
                      class="px-4 py-2 text-xs font-semibold rounded-lg bg-accentCyan text-black hover:bg-cyan-300 transition-colors flex items-center gap-2"
                    >
                      <RefreshCw size={14} /> Connect Scale
                    </button>
                  </div>
                </div>
              </Show>

              {/* STEP 2: MEASUREMENT / COUNTING */}
              <Show when={step() === "measure"}>
                <div class="space-y-5">
                  {/* Live Weight & Calculated Count Displays */}
                  <div class="grid grid-cols-2 gap-4">
                    {/* Scale Net Weight */}
                    <div class="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 text-center">
                      <div class="flex items-center justify-between text-xs text-gray-400">
                        <span class="flex items-center gap-1">
                          Net Weight
                          <Show when={scale.isStable()} fallback={
                            <span class="text-[9px] text-amber-400 animate-pulse font-semibold">Unstable</span>
                          }>
                            <span class="text-[9px] text-emerald-400 font-semibold">Stable</span>
                          </Show>
                        </span>
                        <button
                          onClick={() => handleSelectTare(null)}
                          class="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-gray-300 transition-colors"
                        >
                          Tare Zero
                        </button>
                      </div>
                      <div class="text-2xl font-bold text-white">
                        {scale.netWeight()} <span class="text-xs font-normal text-gray-400">{scale.unit()}</span>
                      </div>
                    </div>

                    {/* Calculated Count */}
                    <div class="p-4 rounded-xl bg-accentCyan/10 border border-accentCyan/30 space-y-2 text-center">
                      <div class="text-xs text-accentCyan font-semibold">
                        Calculated Count
                      </div>
                      <div class="text-3xl font-black text-accentCyan">
                        {calculateEstimatedCount()} <span class="text-xs font-normal text-cyan-200">pcs</span>
                      </div>
                    </div>
                  </div>

                  {/* Container Tare Selector (Feature 018) */}
                  <ContainerTareSelector
                    tareWeights={tareWeights()}
                    selectedTareId={selectedTareId()}
                    onSelectTare={handleSelectTare}
                    tareOffset={scale.tareOffset()}
                    unit={scale.unit()}
                  />

                  {/* Unit Weight Info Bar & Recalibrate Trigger */}
                  <div class="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                    <div class="text-gray-300">
                      <span class="text-gray-500">Unit Weight:</span>{" "}
                      <strong class="font-mono text-white">{getActiveUnitWeight()} {scale.unit()}</strong>
                    </div>
                    <button
                      onClick={() => setShowCalibrationModal(true)}
                      class="text-accentCyan hover:underline font-semibold text-[11px] flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> Re-calibrate Weight
                    </button>
                  </div>

                  {/* Target Location Summary */}
                  <div class="p-3 rounded-lg bg-black/30 border border-white/5 text-xs text-gray-400">
                    Target Location: <strong class="text-white">{props.storageLocation?.name}</strong>
                    <div class="text-[11px] text-gray-500 mt-0.5">
                      Current count: {props.storageLocation?.quantity ?? 0} pcs &rarr; New count: {calculateEstimatedCount()} pcs
                    </div>
                  </div>

                  {/* Unstable Warning */}
                  <Show when={!scale.isStable() && scale.netWeight() > 0}>
                    <div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle size={14} class="shrink-0" />
                      <span>Waiting for scale reading to stabilize before update...</span>
                    </div>
                  </Show>

                  {/* Actions */}
                  <div class="pt-2 flex items-center justify-between">
                    <button
                      onClick={() => handleSelectTare(null)}
                      class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <RotateCcw size={14} /> Zero Scale
                    </button>
                    <button
                      onClick={handleUpdateStockCount}
                      disabled={isSubmitting() || !scale.isStable()}
                      class="px-5 py-2.5 rounded-xl bg-accentCyan text-black font-bold text-xs hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <Check size={16} /> Commit Stock Count
                    </button>
                  </div>
                </div>
              </Show>
            </div>

            {/* Dev / Simulator Bar */}
            <div class="px-6 py-3 border-t border-white/10 bg-black/60 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2 text-gray-400">
                <Sliders size={14} class="text-accentCyan" />
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
                      class="w-24 accent-accentCyan cursor-pointer"
                    />
                    <span class="font-mono text-accentCyan text-xs w-12">
                      {scale.simulatedWeight()}g
                    </span>
                  </div>
                </Show>

                <button
                  onClick={() => scale.setMockMode(!scale.mockMode())}
                  class={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                    scale.mockMode()
                      ? "bg-accentCyan/20 text-accentCyan border border-accentCyan/40"
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
    </>
  );
}
