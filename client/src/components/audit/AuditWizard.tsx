import { createSignal, createEffect, Show, createMemo } from "solid-js";
import { useScale } from "../../context/ScaleContext";
import { apiFetch } from "../../hooks/useAuth";
import toast from "solid-toast";
import PartWeightCalibrationModal from "../PartWeightCalibrationModal";
import {
  ClipboardCheck,
  X,
  Plus,
  Minus,
  Check,
  Scale,
  ArrowRight,
  SkipForward,
  RotateCcw,
  Sparkles,
  Layers,
  Package,
  Clock,
  Sliders,
  CheckCircle2,
} from "lucide-solid";

export interface AuditLocationItem {
  id: string;
  name: string;
  parent_id?: string | null;
  path: string;
  part_id?: string | null;
  part_name?: string | null;
  part_number?: string | null;
  unit_weight?: number | null;
  quantity: number;
  last_counted?: string | null;
}

export interface AuditCompleteSummary {
  totalAudited: number;
  adjustedCount: number;
  skippedCount: number;
}

export interface AuditWizardProps {
  isOpen: boolean;
  onClose: () => void;
  items: AuditLocationItem[];
  onComplete: (summary: AuditCompleteSummary) => void;
}

export default function AuditWizard(props: AuditWizardProps) {
  const scale = useScale();
  const [currentIndex, setCurrentIndex] = createSignal<number>(0);
  const [targetQuantity, setTargetQuantity] = createSignal<number>(0);
  const [isSubmitting, setIsSubmitting] = createSignal<boolean>(false);
  const [showCalibrationModal, setShowCalibrationModal] = createSignal<boolean>(false);

  // Statistics tracking
  const [auditedCount, setAuditedCount] = createSignal<number>(0);
  const [adjustedCount, setAdjustedCount] = createSignal<number>(0);
  const [skippedCount, setSkippedCount] = createSignal<number>(0);

  const currentItem = createMemo(() => {
    const list = props.items || [];
    if (currentIndex() < 0 || currentIndex() >= list.length) return null;
    return list[currentIndex()];
  });

  // Sync initial target quantity when current item changes
  createEffect(() => {
    const item = currentItem();
    if (item) {
      setTargetQuantity(item.quantity || 0);
    }
  });

  // Calculate live count from scale if unit_weight exists
  const scaleCalculatedCount = createMemo(() => {
    const item = currentItem();
    const net = scale.netWeight();
    if (!item || !item.unit_weight || item.unit_weight <= 0 || net <= 0) return null;
    return Math.max(0, Math.round(net / item.unit_weight));
  });

  const adjustQuantity = (delta: number) => {
    setTargetQuantity((prev) => Math.max(0, prev + delta));
  };

  const handleNext = () => {
    if (currentIndex() + 1 < props.items.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Audit complete
      props.onComplete({
        totalAudited: auditedCount(),
        adjustedCount: adjustedCount(),
        skippedCount: skippedCount(),
      });
    }
  };

  const handleConfirmCount = async () => {
    const item = currentItem();
    if (!item) return;

    const newQty = targetQuantity();
    const isQtyChanged = newQty !== item.quantity;

    setIsSubmitting(true);
    try {
      if (isQtyChanged) {
        await apiFetch(`/locations/${item.id}/count`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: newQty,
            reason_code: "cycle_count_adjustment",
            notes: `Cycle count audit adjustment from ${item.quantity} to ${newQty}`,
            method: scaleCalculatedCount() !== null ? "scale" : "manual",
          }),
        });
        setAdjustedCount((prev) => prev + 1);
        toast.success(`Updated ${item.name}: count set to ${newQty}`);
      } else {
        await apiFetch(`/locations/${item.id}/touch`, { method: "PUT" });
        toast.success(`Confirmed ${item.name}: count remains ${newQty}`);
      }

      setAuditedCount((prev) => prev + 1);
      handleNext();
    } catch (err: any) {
      console.error("Failed to update count:", err);
      toast.error(err.message || "Failed to confirm count for location.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setSkippedCount((prev) => prev + 1);
    handleNext();
  };

  return (
    <Show when={props.isOpen && props.items.length > 0}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
        <div class="relative w-full max-w-2xl bg-[#0e1017] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Top Progress & Header */}
          <div class="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-xl bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
                <ClipboardCheck size={22} />
              </div>
              <div>
                <h2 class="text-base font-extrabold text-white tracking-wide">
                  Cycle Count Audit Wizard
                </h2>
                <p class="text-xs text-gray-400">
                  Item <span class="font-bold text-accentCyan">{currentIndex() + 1}</span> of {props.items.length}
                </p>
              </div>
            </div>

            <button
              onClick={props.onClose}
              class="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Exit Wizard"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress Bar */}
          <div class="w-full bg-white/5 h-1.5">
            <div
              class="bg-gradient-to-r from-accentCyan to-accentBlue h-full transition-all duration-300"
              style={{ width: `${((currentIndex() + 1) / props.items.length) * 100}%` }}
            />
          </div>

          {/* Wizard Body */}
          <Show when={currentItem()} fallback={
            <div class="p-8 text-center text-gray-400">No items available in audit route.</div>
          }>
            <div class="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Location Path Display Banner */}
              <div class="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 space-y-2">
                <div class="flex items-center gap-2 text-xs font-semibold text-accentCyan uppercase tracking-widest">
                  <Layers size={14} /> Storage Location Path
                </div>
                <h3 class="text-xl md:text-2xl font-black text-white tracking-tight">
                  {currentItem()?.path}
                </h3>
              </div>

              {/* Part Information Card */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span class="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Assigned Part</span>
                  <div class="flex items-center gap-2">
                    <Package size={16} class="text-accentCyan shrink-0" />
                    <span class="text-sm font-bold text-white truncate">
                      {currentItem()?.part_name || "No Part Assigned"}
                    </span>
                  </div>
                  <Show when={currentItem()?.part_number}>
                    <p class="text-xs font-mono text-gray-400 pl-6">
                      PN: {currentItem()?.part_number}
                    </p>
                  </Show>
                </div>

                <div class="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span class="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Current Recorded Quantity</span>
                  <div class="flex items-center gap-2">
                    <Clock size={16} class="text-amber-400 shrink-0" />
                    <span class="text-lg font-black text-white">
                      {currentItem()?.quantity} units
                    </span>
                  </div>
                  <p class="text-xs text-gray-400 pl-6">
                    Last counted: {currentItem()?.last_counted ? new Date(currentItem()?.last_counted!).toLocaleDateString() : "Never"}
                  </p>
                </div>
              </div>

              {/* Scale / Weight Count Box */}
              <div class="p-4 rounded-xl bg-accentCyan/5 border border-accentCyan/20 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-xs font-bold text-accentCyan">
                    <Scale size={16} /> Live Bluetooth Scale Integration
                  </div>
                  <Show when={scale.status() === "connected"}>
                    <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Connected ({scale.netWeight()} {scale.unit()})
                    </span>
                  </Show>
                </div>

                <Show when={currentItem()?.part_id}>
                  <Show when={currentItem()?.unit_weight} fallback={
                    <div class="flex items-center justify-between pt-1">
                      <span class="text-xs text-gray-400">Unit weight not calibrated for this part</span>
                      <button
                        onClick={() => setShowCalibrationModal(true)}
                        class="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles size={14} /> Calibrate Weight
                      </button>
                    </div>
                  }>
                    <div class="flex items-center justify-between pt-1">
                      <div>
                        <span class="text-xs text-gray-400 block">Unit Weight: {currentItem()?.unit_weight} g/piece</span>
                        <Show when={scaleCalculatedCount() !== null}>
                          <span class="text-sm font-bold text-emerald-400">
                            Scale Estimated Count: {scaleCalculatedCount()} pcs
                          </span>
                        </Show>
                      </div>

                      <Show when={scaleCalculatedCount() !== null}>
                        <button
                          onClick={() => setTargetQuantity(scaleCalculatedCount()!)}
                          class="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 size={14} /> Apply Scale Count
                        </button>
                      </Show>
                    </div>
                  </Show>
                </Show>
              </div>

              {/* Quantity Adjustment Section */}
              <div class="space-y-4 pt-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Audit Verified Quantity:
                  </label>
                  <Show when={targetQuantity() !== currentItem()?.quantity}>
                    <span class="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Delta: {targetQuantity() - (currentItem()?.quantity || 0) > 0 ? "+" : ""}{targetQuantity() - (currentItem()?.quantity || 0)}
                    </span>
                  </Show>
                </div>

                {/* Big Target Quantity Input */}
                <div class="flex items-center gap-3 justify-center">
                  <button
                    onClick={() => adjustQuantity(-1)}
                    class="p-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                  >
                    <Minus size={20} />
                  </button>

                  <input
                    type="number"
                    inputmode="numeric"
                    min="0"
                    value={targetQuantity()}
                    onInput={(e) => setTargetQuantity(Math.max(0, parseInt(e.currentTarget.value) || 0))}
                    class="w-36 text-center py-3 px-4 bg-black/60 border-2 border-accentCyan/40 rounded-2xl text-white font-black text-3xl focus:outline-none focus:border-accentCyan shadow-inner"
                  />

                  <button
                    onClick={() => adjustQuantity(1)}
                    class="p-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                {/* Quick Tap Buttons (-100, -25, -10, -1, +1, +10, +25, +100) */}
                <div class="grid grid-cols-4 md:grid-cols-8 gap-2 pt-2">
                  <button
                    onClick={() => adjustQuantity(-100)}
                    class="py-2 px-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-extrabold text-xs hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    -100
                  </button>
                  <button
                    onClick={() => adjustQuantity(-25)}
                    class="py-2 px-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-extrabold text-xs hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    -25
                  </button>
                  <button
                    onClick={() => adjustQuantity(-10)}
                    class="py-2 px-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold text-xs hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    -10
                  </button>
                  <button
                    onClick={() => adjustQuantity(-1)}
                    class="py-2 px-1 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-extrabold text-xs hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => adjustQuantity(1)}
                    class="py-2 px-1 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-extrabold text-xs hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => adjustQuantity(10)}
                    class="py-2 px-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold text-xs hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    +10
                  </button>
                  <button
                    onClick={() => adjustQuantity(25)}
                    class="py-2 px-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold text-xs hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    +25
                  </button>
                  <button
                    onClick={() => adjustQuantity(100)}
                    class="py-2 px-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold text-xs hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    +100
                  </button>
                </div>
              </div>

            </div>
          </Show>

          {/* Footer Actions */}
          <div class="px-6 py-4 border-t border-white/10 bg-black/60 flex items-center justify-between gap-3">
            <button
              onClick={handleSkip}
              disabled={isSubmitting()}
              class="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <SkipForward size={16} /> Skip Location
            </button>

            <button
              onClick={handleConfirmCount}
              disabled={isSubmitting()}
              class="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-accentCyan to-accentBlue text-white font-extrabold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-accentCyan/20 cursor-pointer disabled:opacity-50"
            >
              <Check size={18} /> Confirm & Next <ArrowRight size={16} />
            </button>
          </div>

          {/* Calibration Modal Overlay */}
          <Show when={showCalibrationModal() && currentItem()?.part_id}>
            <PartWeightCalibrationModal
              isOpen={showCalibrationModal()}
              onClose={() => setShowCalibrationModal(false)}
              part={{
                id: currentItem()?.part_id,
                value: currentItem()?.part_name,
                number: currentItem()?.part_number,
              }}
              onSuccess={(newWeight) => {
                if (currentItem()) {
                  currentItem()!.unit_weight = newWeight;
                }
              }}
            />
          </Show>

        </div>
      </div>
    </Show>
  );
}
