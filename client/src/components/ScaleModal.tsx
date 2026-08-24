import { createSignal, createEffect, Show, For } from "solid-js";
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
} from "lucide-solid";

export interface ScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  part: any;
  storageLocation: any;
  onSuccess?: () => void;
}

export default function ScaleModal(props: ScaleModalProps) {
  const scale = useScale();

  const [step, setStep] = createSignal<"connect" | "calibrate" | "measure">("connect");
  const [calibrationCount, setCalibrationCount] = createSignal<number>(10);
  const [isSubmitting, setIsSubmitting] = createSignal<boolean>(false);
  const [tareWeights, setTareWeights] = createSignal<any[]>([]);
  const [selectedTareId, setSelectedTareId] = createSignal<string | null>(null);

  // Synchronize modal state on open & load tare weights
  createEffect(() => {
    if (props.isOpen) {
      // Fetch tare weights
      apiFetch("/tare-weights")
        .then((data) => {
          setTareWeights(data || []);
          // Auto-select and apply initial tare if location has last_tare
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

      // Auto attempt connection if disconnected
      if (scale.status() === "disconnected") {
        scale.connect();
      }

      // Check current scale status & part weight
      if (scale.status() === "connected") {
        if (props.part && props.part.weight && props.part.weight > 0) {
          setStep("measure");
        } else {
          setStep("calibrate");
        }
      } else {
        setStep("connect");
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

  // Watch scale status changes
  createEffect(() => {
    if (props.isOpen && scale.status() === "connected") {
      if (step() === "connect") {
        if (props.part && props.part.weight && props.part.weight > 0) {
          setStep("measure");
        } else {
          setStep("calibrate");
        }
      }
    }
  });

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

  const handleConfirmCalibration = async () => {
    const net = scale.netWeight();
    const count = calibrationCount();

    if (count <= 0) {
      toast.error("Please enter a valid part count greater than zero.");
      return;
    }
    if (net <= 0) {
      toast.error("Scale weight is zero. Please place parts on the scale first.");
      return;
    }

    const calculatedUnitWeight = Math.round((net / count) * 10000) / 10000;

    setIsSubmitting(true);
    try {
      await apiFetch(`/parts/${props.part.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: calculatedUnitWeight }),
      });

      toast.success(`Unit weight calibrated: ${calculatedUnitWeight} ${scale.unit()}/piece`);
      props.part.weight = calculatedUnitWeight;
      if (props.onSuccess) props.onSuccess();
      setStep("measure");
    } catch (err: any) {
      console.error("Failed to update part unit weight:", err);
      toast.error(err.message || "Failed to update part unit weight.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStockCount = async () => {
    const count = calculateEstimatedCount();
    if (!props.storageLocation) {
      toast.error("No storage location specified.");
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

  const adjustCalibrationCount = (delta: number) => {
    setCalibrationCount((prev) => Math.max(1, prev + delta));
  };

  return (
    <Show when={props.isOpen}>
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
                  Bluetooth Scale Integration
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

          {/* Modal Body */}
          <div class="p-6 space-y-6">
            {/* STEP 1: CONNECTING / SEARCHING */}
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

            {/* STEP 2 / 3: CALIBRATION */}
            <Show when={step() === "calibrate"}>
              <div class="space-y-5">
                <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  <strong>Unit Weight Missing:</strong> Please calibrate the per-piece weight by placing a known quantity of parts on the scale.
                </div>

                {/* Scale Live Reading Card */}
                <div class="p-5 rounded-xl bg-black/40 border border-white/10 space-y-3 text-center">
                  <div class="flex items-center justify-between text-xs text-gray-400">
                    <span>Live Scale Weight</span>
                    <button
                      onClick={() => handleSelectTare(null)}
                      class="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-200 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> Tare Scale
                    </button>
                  </div>
                  <div class="text-4xl font-black text-accentCyan tracking-tight">
                    {scale.netWeight()} <span class="text-xl font-normal text-gray-400">{scale.unit()}</span>
                  </div>
                  <Show when={scale.tareOffset() > 0}>
                    <div class="text-xs text-cyan-400/70">
                      Tare Offset: -{scale.tareOffset()} {scale.unit()}
                    </div>
                  </Show>
                </div>

                {/* Integer Parts Count Input */}
                <div class="space-y-2">
                  <label class="text-xs font-semibold text-gray-300 block">
                    Number of parts placed on scale:
                  </label>
                  <div class="flex items-center gap-2">
                    <button
                      onClick={() => adjustCalibrationCount(-10)}
                      class="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 text-xs font-bold"
                    >
                      -10
                    </button>
                    <button
                      onClick={() => adjustCalibrationCount(-1)}
                      class="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={calibrationCount()}
                      onInput={(e) =>
                        setCalibrationCount(Math.max(1, parseInt(e.currentTarget.value) || 1))
                      }
                      class="w-full text-center py-2 px-3 bg-black/50 border border-white/10 rounded-lg text-white font-bold text-lg focus:outline-none focus:border-accentCyan"
                    />
                    <button
                      onClick={() => adjustCalibrationCount(1)}
                      class="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => adjustCalibrationCount(10)}
                      class="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 text-xs font-bold"
                    >
                      +10
                    </button>
                  </div>
                </div>

                {/* Computed Preview */}
                <Show when={scale.netWeight() > 0 && calibrationCount() > 0}>
                  <div class="p-3 rounded-lg bg-white/5 text-xs text-gray-300 flex justify-between items-center">
                    <span>Calculated Per-Piece Weight:</span>
                    <span class="font-mono font-bold text-accentCyan">
                      {Math.round((scale.netWeight() / calibrationCount()) * 10000) / 10000}{" "}
                      {scale.unit()}/piece
                    </span>
                  </div>
                </Show>

                <div class="pt-2 flex justify-end">
                  <button
                    onClick={handleConfirmCalibration}
                    disabled={isSubmitting() || scale.netWeight() <= 0}
                    class="px-5 py-2.5 rounded-xl bg-accentCyan text-black font-bold text-xs hover:bg-cyan-300 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <Check size={16} /> Save & Proceed to Counting
                  </button>
                </div>
              </div>
            </Show>

            {/* STEP 4: MEASUREMENT / COUNTING */}
            <Show when={step() === "measure"}>
              <div class="space-y-5">
                {/* Live Weight & Calculated Count Displays */}
                <div class="grid grid-cols-2 gap-4">
                  {/* Scale Weight */}
                  <div class="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 text-center">
                    <div class="flex items-center justify-between text-xs text-gray-400">
                      <span>Net Weight</span>
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

                  {/* Estimated Count */}
                  <div class="p-4 rounded-xl bg-accentCyan/10 border border-accentCyan/30 space-y-2 text-center">
                    <div class="text-xs text-accentCyan font-semibold">
                      Calculated Count
                    </div>
                    <div class="text-3xl font-black text-accentCyan">
                      {calculateEstimatedCount()} <span class="text-xs font-normal text-cyan-200">pcs</span>
                    </div>
                  </div>
                </div>

                {/* Container Tare Weight Selection Bar */}
                <div class="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
                  <div class="flex items-center justify-between text-gray-400 font-semibold">
                    <span class="flex items-center gap-1.5 text-gray-300">
                      <Scale size={14} class="text-accentCyan" />
                      Container Tare Weight:
                    </span>
                    <Show when={scale.tareOffset() > 0}>
                      <span class="text-[11px] font-mono text-cyan-300 bg-accentCyan/10 px-2 py-0.5 rounded border border-accentCyan/20 font-bold">
                        -{scale.tareOffset()} {scale.unit()}
                      </span>
                    </Show>
                  </div>
                  <div class="flex items-center gap-2">
                    <select
                      value={selectedTareId() || ""}
                      onChange={(e) => {
                        const val = e.currentTarget.value;
                        handleSelectTare(val ? val : null);
                      }}
                      class="w-full bg-black/50 border border-white/10 rounded-lg py-2 px-3 text-white text-xs font-semibold focus:outline-none focus:border-accentCyan cursor-pointer"
                    >
                      <option value="">No Container / Tare to Zero (0 g)</option>
                      <For each={tareWeights()}>
                        {(t) => (
                          <option value={t.id}>
                            {t.name} ({t.weight} {scale.unit()})
                          </option>
                        )}
                      </For>
                    </select>
                    <button
                      onClick={() => handleSelectTare(null)}
                      class={`px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                        !selectedTareId()
                          ? "bg-accentCyan/20 text-accentCyan border border-accentCyan/30"
                          : "bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                      title="Tare scale to live zero"
                    >
                      Tare Zero
                    </button>
                  </div>
                </div>

                {/* Per Piece Weight Info Bar */}
                <div class="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                  <div class="text-gray-300">
                    <span class="text-gray-500">Unit Weight:</span>{" "}
                    <strong class="font-mono text-white">{getActiveUnitWeight()} {scale.unit()}</strong>
                  </div>
                  <button
                    onClick={() => setStep("calibrate")}
                    class="text-accentCyan hover:underline font-semibold text-[11px] flex items-center gap-1"
                  >
                    <RotateCcw size={12} /> Re-calibrate
                  </button>
                </div>

                <div class="p-3 rounded-lg bg-black/30 border border-white/5 text-xs text-gray-400">
                  Target Bin: <strong class="text-white">{props.storageLocation?.name}</strong>
                  <div class="text-[11px] text-gray-500 mt-0.5">
                    Current stock: {props.storageLocation?.quantity ?? 0} pcs &rarr; New stock: {calculateEstimatedCount()} pcs
                  </div>
                </div>

                {/* Actions */}
                <div class="pt-2 flex items-center justify-between">
                  <button
                    onClick={() => handleSelectTare(null)}
                    class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> Zero / Tare Scale
                  </button>
                  <button
                    onClick={handleUpdateStockCount}
                    disabled={isSubmitting()}
                    class="px-5 py-2.5 rounded-xl bg-accentCyan text-black font-bold text-xs hover:bg-cyan-300 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <Check size={16} /> Update Location Count
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
  );
}
