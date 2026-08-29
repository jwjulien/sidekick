import { createSignal, Show } from "solid-js";
import type { JSX } from "solid-js";
import { X, Check, Package, Plus, Minus } from "lucide-solid";
import UniversalPartsBrowser from "./UniversalPartsBrowser";

export interface UniversalPartFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  onConfirm: (part: any, quantity: number, extraData?: any) => void;
  children?: (selectedPart: any, setExtraData: (val: any) => void) => JSX.Element;
}

export default function UniversalPartFinderModal(props: UniversalPartFinderModalProps) {
  const [selectedPart, setSelectedPart] = createSignal<any | null>(null);
  const [quantity, setQuantity] = createSignal<number>(1);
  const [extraData, setExtraData] = createSignal<any>("");

  const handleClose = () => {
    setSelectedPart(null);
    setQuantity(1);
    setExtraData("");
    props.onClose();
  };

  const handleSelectPart = (part: any) => {
    setSelectedPart(part);
  };

  const handleConfirm = () => {
    const p = selectedPart();
    if (!p) return;
    props.onConfirm(p, quantity(), extraData());
    handleClose();
  };

  return (
    <Show when={props.isOpen}>
      {/* Modal backdrop */}
      <div
        class="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        {/* Modal card */}
        <div
          class="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-white/20 shadow-2xl bg-gray-900/95 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div class="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-xl bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
                <Package size={20} />
              </div>
              <h2 class="text-lg font-bold text-white">
                {props.title || "Select Component"}
              </h2>
            </div>
            <button
              onClick={handleClose}
              class="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body: Universal Parts Browser in Picker Mode */}
          <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <UniversalPartsBrowser
              mode="picker"
              selectionMode="single"
              onSelectPart={handleSelectPart}
              showToolbar={true}
            />

            {/* Selected Part Preview & Custom Inputs */}
            <Show when={selectedPart()}>
              <div class="mt-4 p-4 rounded-2xl bg-accentCyan/5 border border-accentCyan/20 space-y-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-accentCyan">
                      {selectedPart()?.package || "Part"}
                    </div>
                    <div>
                      <div class="text-sm font-bold text-white">
                        {selectedPart()?.value}
                      </div>
                      <div class="text-xs text-gray-400 font-mono">
                        {selectedPart()?.number}
                      </div>
                    </div>
                  </div>
                  <span class="text-xs text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    Selected
                  </span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/10">
                  {/* Universal Quantity Selector */}
                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-gray-300">
                      Target Quantity
                    </label>
                    <div class="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity() - 1))}
                        class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={quantity()}
                        onInput={(e) => {
                          const val = parseFloat((e.target as HTMLInputElement).value);
                          if (!isNaN(val) && val > 0) setQuantity(val);
                        }}
                        class="glass-input w-24 text-center text-sm font-bold text-white py-1.5"
                      />
                      <button
                        onClick={() => setQuantity(quantity() + 1)}
                        class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Custom Slot / Children Inputs (Notes, Designator, etc.) */}
                  <Show when={props.children}>
                    <div class="space-y-1">
                      {props.children?.(selectedPart(), (val: any) => setExtraData(val))}
                    </div>
                  </Show>
                </div>
              </div>
            </Show>
          </div>

          {/* Modal Footer */}
          <div class="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              class="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 text-gray-300 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedPart()}
              class="flex items-center gap-2 px-5 py-2 rounded-xl bg-accentCyan text-gray-950 font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check size={16} />
              <span>Confirm & Add</span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
