import { createSignal, Show, For } from "solid-js";
import { Tag, AlertTriangle, FileText, Check, X } from "lucide-solid";

export interface ReasonCodeOption {
  code: string;
  label: string;
  description: string;
}

export const REASON_CODES: ReasonCodeOption[] = [
  { code: "initial_stocking", label: "Initial Stocking", description: "First-time intake or registration into inventory catalog." },
  { code: "supplier_receiving", label: "Supplier Receiving", description: "Stock received from a supplier purchase order." },
  { code: "assembly_build", label: "Assembly Build", description: "Components pulled/consumed for project manufacturing." },
  { code: "cycle_count_adjustment", label: "Cycle Count Adjustment", description: "Variance corrected during physical audit or stock check." },
  { code: "tare_drift", label: "Tare Drift", description: "Container tare recalibration or weight offset correction." },
  { code: "scrap_damage", label: "Scrap / Damage", description: "Broken, spilled, or defective components written off." },
  { code: "triage", label: "Lost & Found Triage", description: "Homeless component identified or lost part recovered." },
  { code: "other", label: "Other", description: "Custom reason (specify details in notes)." }
];

interface ReasonCodeModalProps {
  isOpen: boolean;
  title?: string;
  currentQuantity?: number;
  newQuantity?: number;
  onClose: () => void;
  onConfirm: (reasonCode: string, notes: string) => void;
}

export default function ReasonCodeModal(props: ReasonCodeModalProps) {
  const [selectedReason, setSelectedReason] = createSignal("cycle_count_adjustment");
  const [notes, setNotes] = createSignal("");

  const handleConfirm = (e: Event) => {
    e.preventDefault();
    props.onConfirm(selectedReason(), notes());
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
        <div class="relative w-full max-w-md bg-[#121319] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-gray-200">
          
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
            <div class="flex items-center gap-2.5">
              <div class="p-2 rounded-xl bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
                <Tag size={18} />
              </div>
              <h3 class="font-bold text-white tracking-wide">
                {props.title || "Audit Log Reason Code"}
              </h3>
            </div>
            <button 
              onClick={props.onClose}
              class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleConfirm} class="p-6 space-y-5">
            
            <Show when={props.currentQuantity !== undefined && props.newQuantity !== undefined}>
              <div class="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                <span class="text-gray-400">Stock Quantity Change:</span>
                <div class="flex items-center gap-2 font-mono font-bold">
                  <span class="text-gray-400">{props.currentQuantity}</span>
                  <span class="text-gray-600">→</span>
                  <span class={props.newQuantity! >= props.currentQuantity! ? "text-emerald-400" : "text-amber-400"}>
                    {props.newQuantity}
                  </span>
                  <span class="text-gray-500">
                    ({props.newQuantity! >= props.currentQuantity! ? "+" : ""}{props.newQuantity! - props.currentQuantity!})
                  </span>
                </div>
              </div>
            </Show>

            {/* Reason Code Selection */}
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Select Reason Code
              </label>
              <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                <For each={REASON_CODES}>
                  {(item) => (
                    <label 
                      onClick={() => setSelectedReason(item.code)}
                      class={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all text-xs ${
                        selectedReason() === item.code 
                          ? "bg-accentCyan/15 border-accentCyan text-white shadow-lg shadow-accentCyan/5" 
                          : "bg-white/5 border-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="reasonCode" 
                        value={item.code}
                        checked={selectedReason() === item.code}
                        class="hidden"
                      />
                      <div class={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                        selectedReason() === item.code ? "border-accentCyan bg-accentCyan text-black" : "border-gray-500"
                      }`}>
                        <Show when={selectedReason() === item.code}>
                          <Check size={10} strokeWidth={3} />
                        </Show>
                      </div>
                      <div class="flex-1">
                        <div class="font-semibold text-white">{item.label}</div>
                        <div class="text-[11px] text-gray-400 mt-0.5">{item.description}</div>
                      </div>
                    </label>
                  )}
                </For>
              </div>
            </div>

            {/* Optional Audit Notes */}
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Audit Notes (Optional)
              </label>
              <div class="relative">
                <textarea 
                  value={notes()}
                  onInput={(e) => setNotes(e.currentTarget.value)}
                  placeholder="Provide additional details or context for the audit log..."
                  rows={2}
                  class="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accentCyan transition-colors"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div class="flex items-center justify-end gap-3 pt-2">
              <button 
                type="button"
                onClick={props.onClose}
                class="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                class="px-5 py-2 rounded-xl bg-accentCyan hover:bg-cyan-400 text-black font-bold text-xs shadow-lg shadow-accentCyan/20 transition-all flex items-center gap-1.5"
              >
                <Check size={14} />
                Save to Audit Trail
              </button>
            </div>

          </form>

        </div>
      </div>
    </Show>
  );
}
