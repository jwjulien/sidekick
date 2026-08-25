import { createSignal, createEffect, Show } from "solid-js";
import { X, Move, MapPin, Package, Minus, Plus, Trash2 } from "lucide-solid";
import toast from "solid-toast";
import { apiFetch } from "../../hooks/useAuth";
import UniversalLocationSelector from "./UniversalLocationSelector";

export interface MovePartModalProps {
  location: any;
  allLocations?: any[];
  onClose: () => void;
  onMoved: () => void;
}

export default function MovePartModal(props: MovePartModalProps) {
  const [moveQuantity, setMoveQuantity] = createSignal(1);
  const [selectedTargetLocation, setSelectedTargetLocation] = createSignal<any | null>(null);
  const [deleteSourceAfterMove, setDeleteSourceAfterMove] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);

  createEffect(() => {
    if (props.location) {
      setMoveQuantity(props.location.quantity || 1);
      setDeleteSourceAfterMove(false);
      setSelectedTargetLocation(null);
    }
  });

  const part = () => props.location?.part || null;
  const maxQty = () => props.location?.quantity || 1;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const source = props.location;
    if (!source) return;

    const target = selectedTargetLocation();
    if (!target) {
      toast.error("Please select a target storage location.");
      return;
    }

    if (String(target.id) === String(source.id)) {
      toast.error("Target location cannot be the same as the source location.");
      return;
    }

    const qty = moveQuantity();
    if (qty <= 0 || qty > maxQty()) {
      toast.error("Invalid quantity to move.");
      return;
    }

    setSubmitting(true);
    try {
      const partId = source.part_id || part()?.id;
      if (!partId) {
        toast.error("No part associated with source location.");
        return;
      }

      const destId = target.id;

      if (!target.part_id || String(target.part_id) === String(partId)) {
        if (!target.part_id) {
          await apiFetch(`/locations/${destId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ part_id: partId })
          });
        }
        const destDetails = await apiFetch(`/locations/${destId}`);
        const destCurrentQty = destDetails.quantity || 0;

        await apiFetch(`/locations/${destId}/count`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: destCurrentQty + qty,
            notes: `Re-homed ${qty} units from '${source.name}'`
          })
        });
      } else {
        await apiFetch("/locations/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            part_id: partId,
            location_id: destId,
            quantity: qty,
            notes: `Re-homed ${qty} units from '${source.name}'`
          })
        });
      }

      const remainingQty = source.quantity - qty;
      await apiFetch(`/locations/${source.id}/count`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: remainingQty,
          notes: `Re-homed ${qty} units to '${target.name}'`
        })
      });

      if (remainingQty === 0 && deleteSourceAfterMove()) {
        try {
          await apiFetch(`/locations/${source.id}`, { method: "DELETE" });
        } catch (err: any) {
          toast.error(`Parts moved, but could not delete source location: ${err.message}`);
        }
      }

      toast.success(`Successfully re-homed ${qty} unit${qty > 1 ? "s" : ""} to '${target.name}'!`);
      props.onMoved();
      props.onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to move parts.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div class="glass-panel max-w-2xl w-full rounded-2xl p-4 sm:p-6 border border-white/10 relative my-auto flex flex-col space-y-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div class="flex items-start justify-between shrink-0">
          <div>
            <h3 class="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Move class="text-accentCyan" size={22} />
              Re-Home Parts
            </h3>
            <p class="text-xs text-gray-400 mt-0.5">
              Transfer component stock from <span class="font-bold text-white">{props.location?.name}</span> to another storage location.
            </p>
          </div>
          <button
            onClick={props.onClose}
            class="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} class="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Source Component Summary */}
          <div class="bg-black/30 p-3 rounded-xl border border-white/5 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-accentCyan/10 border border-accentCyan/20 flex items-center justify-center shrink-0">
                <Package size={20} class="text-accentCyan" />
              </div>
              <div>
                <div class="text-sm font-bold text-white">{part()?.value || "Component"}</div>
                <div class="text-xs text-gray-400 font-mono">
                  {part()?.name || part()?.number || "No MPN"}
                </div>
              </div>
            </div>
            <div class="text-right">
              <span class="text-[10px] uppercase font-bold text-gray-400 block">Current Location Stock</span>
              <span class="text-base font-bold text-white font-mono">{maxQty()} units</span>
            </div>
          </div>

          {/* Quantity selector spinbox */}
          <div class="space-y-1.5">
            <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Quantity to Move (Default: All)
            </label>
            <div class="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMoveQuantity(prev => Math.max(1, prev - 1))}
                disabled={moveQuantity() <= 1}
                class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all disabled:opacity-40"
              >
                <Minus size={16} />
              </button>

              <input
                type="number"
                min="1"
                max={maxQty()}
                value={moveQuantity()}
                onInput={(e) => {
                  const val = parseInt(e.currentTarget.value);
                  if (!isNaN(val)) {
                    setMoveQuantity(Math.max(1, Math.min(maxQty(), val)));
                  }
                }}
                class="glass-input flex-1 text-center text-lg font-bold py-1.5 font-mono"
              />

              <button
                type="button"
                onClick={() => setMoveQuantity(prev => Math.min(maxQty(), prev + 1))}
                disabled={moveQuantity() >= maxQty()}
                class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all disabled:opacity-40"
              >
                <Plus size={16} />
              </button>

              <button
                type="button"
                onClick={() => setMoveQuantity(maxQty())}
                class="px-3 py-2 rounded-xl text-xs font-semibold bg-accentCyan/10 border border-accentCyan/20 text-accentCyan hover:bg-accentCyan/20 transition-colors shrink-0"
              >
                All ({maxQty()})
              </button>
            </div>
          </div>

          {/* Target Location Selector */}
          <div class="space-y-2">
            <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Select Target Location
            </label>

            <UniversalLocationSelector
              locations={props.allLocations}
              selectedLocationId={selectedTargetLocation()?.id || ""}
              part={part()}
              onSelectLocation={(loc) => setSelectedTargetLocation(loc)}
              initialMode="miller"
              showInlineCreate={true}
            />

            <Show when={selectedTargetLocation()}>
              <div class="p-3 rounded-xl bg-accentCyan/10 border border-accentCyan/20 text-xs flex items-center justify-between text-white">
                <div class="flex items-center gap-2">
                  <MapPin size={14} class="text-accentCyan" />
                  <span class="font-bold">Destination: {selectedTargetLocation()?.name}</span>
                </div>
                <span class="text-gray-300 font-mono">
                  Current stock: {selectedTargetLocation()?.quantity || 0}
                </span>
              </div>
            </Show>
          </div>

          {/* Delete Source Location Checkbox */}
          <Show when={moveQuantity() === maxQty()}>
            <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5">
              <input
                type="checkbox"
                id="delete-source-checkbox-modal"
                checked={deleteSourceAfterMove()}
                onChange={(e) => setDeleteSourceAfterMove(e.currentTarget.checked)}
                class="rounded border-white/10 bg-white/5 text-accentCyan focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              <label for="delete-source-checkbox-modal" class="text-xs text-amber-200 select-none cursor-pointer flex items-center gap-1.5">
                <Trash2 size={13} class="text-amber-400 shrink-0" />
                Delete source location <span class="font-semibold text-white">'{props.location?.name}'</span> from database (no parts remaining)
              </label>
            </div>
          </Show>

          {/* Actions Footer */}
          <div class="flex justify-end pt-3 border-t border-white/10 gap-3 shrink-0">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting() || !selectedTargetLocation() || String(selectedTargetLocation()?.id) === String(props.location?.id)}
              class="btn-primary flex items-center justify-center gap-2 text-xs min-w-[140px]"
            >
              {submitting() ? (
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Move size={14} /> Confirm Re-home
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
