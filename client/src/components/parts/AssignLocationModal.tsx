import { createSignal, onMount, For, Show } from "solid-js";
import { X, MapPin, Package } from "lucide-solid";
import { apiFetch } from "../../hooks/useAuth";
import toast from "solid-toast";
import UniversalLocationSelector from "../storage/UniversalLocationSelector";

interface AssignLocationModalProps {
  parts: any[];
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignLocationModal(props: AssignLocationModalProps) {
  const [selectedLocationId, setSelectedLocationId] = createSignal("");
  const [quantity, setQuantity] = createSignal(1);
  const [notes, setNotes] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  const isBulk = () => props.parts.length > 1;
  const singlePart = () => (props.parts.length === 1 ? props.parts[0] : null);

  onMount(() => {
    const p = singlePart();
    if (p) {
      setQuantity(p.threshold && p.threshold > 0 ? p.threshold : 1);
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!selectedLocationId()) {
      toast.error("Please select a target storage location.");
      return;
    }

    setSubmitting(true);
    try {
      if (isBulk()) {
        const payload = {
          part_ids: props.parts.map((p) => p.id),
          location_id: selectedLocationId(),
          quantity: quantity(),
          notes: notes().trim() || "Batch location assignment from Homeless Parts view"
        };
        await apiFetch("/locations/bulk-assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        toast.success(`Successfully batch assigned ${props.parts.length} parts to location!`);
      } else {
        const part = singlePart();
        const payload = {
          part_id: part.id,
          location_id: selectedLocationId(),
          quantity: quantity(),
          notes: notes().trim() || `Assigned location for ${part.value}`
        };
        await apiFetch("/locations/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        toast.success(`Assigned location for part '${part.value}'!`);
      }

      props.onAssigned();
      props.onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign location.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div class="glass-panel max-w-2xl w-full rounded-2xl p-6 border border-white/10 relative my-8 space-y-6">
        {/* Header */}
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-xl font-bold text-white flex items-center gap-2">
              <MapPin class="text-accentCyan" size={22} />
              {isBulk() ? `Bulk Assign ${props.parts.length} Parts` : "Assign Storage Location"}
            </h3>
            <p class="text-xs text-gray-400 mt-1">
              Select or create a physical bin/container to triage unassigned components.
            </p>
          </div>
          <button
            onClick={props.onClose}
            class="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Selected Part(s) Summary */}
        <div class="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-2">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            Target Component{isBulk() ? "s" : ""}
          </span>
          <Show
            when={!isBulk()}
            fallback={
              <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                <For each={props.parts}>
                  {(p) => (
                    <span class="px-2.5 py-1 rounded-lg text-xs bg-accentCyan/10 text-accentCyan border border-accentCyan/20 flex items-center gap-1 font-semibold">
                      <Package size={12} /> {p.value} ({p.number || p.package || "Part"})
                    </span>
                  )}
                </For>
              </div>
            }
          >
            <div class="flex justify-between items-center text-sm">
              <div class="flex flex-col">
                <span class="font-bold text-white">{singlePart()?.value}</span>
                <span class="text-xs text-gray-400 font-mono">
                  {singlePart()?.number || singlePart()?.package || "No MPN"}
                </span>
              </div>
              <span class="text-xs px-2.5 py-1 rounded-full bg-accentCyan/10 text-accentCyan border border-accentCyan/20 font-semibold">
                Category: {singlePart()?.category?.title || singlePart()?.category?.name || "Uncategorized"}
              </span>
            </div>
          </Show>
        </div>

        {/* Universal Location Selector (Miller Columns + Search + Smart Naming) */}
        <form onSubmit={handleSubmit} class="space-y-4">
          <UniversalLocationSelector
            selectedLocationId={selectedLocationId()}
            part={singlePart()}
            onSelectLocation={(loc) => setSelectedLocationId(loc.id)}
            initialMode="miller"
            showInlineCreate={true}
          />

          {/* Initial Stock Quantity Input */}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">
                Initial Stock Quantity
              </label>
              <input
                type="number"
                min="0"
                value={quantity()}
                onInput={(e) => setQuantity(parseInt(e.currentTarget.value) || 0)}
                class="glass-input w-full text-sm font-bold text-center"
              />
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">
                Audit Transaction Notes
              </label>
              <input
                type="text"
                placeholder="Optional triage details..."
                value={notes()}
                onInput={(e) => setNotes(e.currentTarget.value)}
                class="glass-input w-full text-xs"
              />
            </div>
          </div>

          {/* Actions */}
          <div class="flex justify-end pt-4 border-t border-white/10 gap-3">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting() || !selectedLocationId()}
              class="btn-primary flex items-center justify-center gap-2 text-xs min-w-[130px]"
            >
              {submitting() ? (
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "Confirm Assignment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
