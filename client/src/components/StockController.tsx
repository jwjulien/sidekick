import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { Plus, Minus } from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";
import toast from "solid-toast";
import ConfirmCountWidget from "./ConfirmCountWidget";

interface StockControllerProps {
  storageId: string;
  currentQty: number;
  lastCounted?: string | null;
  compact?: boolean;
  onChanged?: (newQty: number, newLastCounted: string) => void;
}

export default function StockController(props: StockControllerProps) {
  const [pendingQty, setPendingQty] = createSignal(props.currentQty);
  const [isEditing, setIsEditing] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    setPendingQty(props.currentQty);
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const saveCount = async (qty: number) => {
    if (saving()) return;
    setSaving(true);
    try {
      const result = await apiFetch(`/locations/${props.storageId}/count`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty })
      });
      props.onChanged?.(result.quantity, result.last_counted);
    } catch (err: any) {
      toast.error(err.message || "Failed to update quantity.");
      setPendingQty(props.currentQty);
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  };

  const scheduleSave = (qty: number) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => saveCount(qty), 500);
  };

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  const increment = () => {
    const next = pendingQty() + 1;
    setPendingQty(next);
    scheduleSave(next);
  };

  const decrement = () => {
    const next = Math.max(0, pendingQty() - 1);
    setPendingQty(next);
    scheduleSave(next);
  };

  const handleQtyInput = (e: Event) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    if (!isNaN(val) && val >= 0) setPendingQty(val);
  };

  const commitInlineEdit = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    saveCount(pendingQty());
  };

  const canAdjust = () => {
    const role = user()?.role;
    return role === "admin" || role === "stocker";
  };

  return (
    <div class="space-y-3">
      {/* +/- controls with central qty */}
      <div class="flex items-center gap-3">
        <Show when={canAdjust()}>
          <button
            onClick={decrement}
            disabled={saving() || pendingQty() <= 0}
            class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-all disabled:opacity-40"
          >
            <Minus size={16} />
          </button>
        </Show>

        <div class="flex-1 text-center">
          <Show
            when={isEditing() && canAdjust()}
            fallback={
              <span
                onClick={() => canAdjust() && setIsEditing(true)}
                class={`text-4xl font-extrabold block transition-colors select-none ${
                  canAdjust() ? "cursor-text hover:text-accentCyan" : "cursor-default"
                } ${saving() ? "opacity-50" : ""} ${
                  pendingQty() !== props.currentQty ? "text-amber-300" : "text-white"
                }`}
              >
                {pendingQty()}
              </span>
            }
          >
            <input
              type="number"
              min="0"
              value={pendingQty()}
              onInput={handleQtyInput}
              onBlur={commitInlineEdit}
              onKeyDown={(e: KeyboardEvent) => e.key === "Enter" && commitInlineEdit()}
              autofocus
              class="glass-input w-full text-center text-3xl font-extrabold text-white py-1"
            />
          </Show>
          <Show when={!props.compact}>
            <span class="text-[10px] text-gray-500 uppercase tracking-widest mt-1 block">units</span>
          </Show>
        </div>

        <Show when={canAdjust()}>
          <button
            onClick={increment}
            disabled={saving()}
            class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-all disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </Show>
      </div>

      <ConfirmCountWidget
        storageId={props.storageId}
        lastCounted={props.lastCounted}
        onConfirmed={(newTs) => props.onChanged?.(props.currentQty, newTs)}
      />
    </div>
  );
}
