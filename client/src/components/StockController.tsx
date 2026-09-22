import { createSignal, createEffect, Show } from "solid-js";
import { apiFetch, user } from "../hooks/useAuth";
import toast from "solid-toast";
import ConfirmCountWidget from "./ConfirmCountWidget";
import QuantityController from "./QuantityController";
import LifecyclePopover from "./LifecyclePopover";

interface StockControllerProps {
  storageId: string;
  storageName?: string;
  currentQty: number;
  firstAdded?: string | null;
  first_added?: string | null;
  lastCounted?: string | null;
  last_counted?: string | null;
  lastStocked?: string | null;
  last_stocked?: string | null;
  lastUsed?: string | null;
  last_used?: string | null;
  compact?: boolean;
  onChanged?: (newQty: number, newLastCounted?: string, details?: any) => void;
}

export default function StockController(props: StockControllerProps) {
  const [saving, setSaving] = createSignal(false);
  const [showLifecycle, setShowLifecycle] = createSignal(false);

  const [firstAdded, setFirstAdded] = createSignal<string | null | undefined>(props.firstAdded ?? props.first_added);
  const [lastCounted, setLastCounted] = createSignal<string | null | undefined>(props.lastCounted ?? props.last_counted);
  const [lastStocked, setLastStocked] = createSignal<string | null | undefined>(props.lastStocked ?? props.last_stocked);
  const [lastUsed, setLastUsed] = createSignal<string | null | undefined>(props.lastUsed ?? props.last_used);

  createEffect(() => {
    setFirstAdded(props.firstAdded ?? props.first_added);
    setLastCounted(props.lastCounted ?? props.last_counted);
    setLastStocked(props.lastStocked ?? props.last_stocked);
    setLastUsed(props.lastUsed ?? props.last_used);
  });

  const saveCount = async (qty: number) => {
    if (saving()) return;
    setSaving(true);
    try {
      const result = await apiFetch(`/locations/${props.storageId}/count`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty })
      });
      if (result) {
        setFirstAdded(result.first_added);
        setLastCounted(result.last_counted);
        setLastStocked(result.last_stocked);
        setLastUsed(result.last_used);
        props.onChanged?.(result.quantity, result.last_counted, result);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update quantity.");
    } finally {
      setSaving(false);
    }
  };

  const handleCountConfirmed = (newTs: string) => {
    setLastCounted(newTs);
    props.onChanged?.(props.currentQty, newTs);
  };

  const canAdjust = () => {
    const role = user()?.role;
    return role === "admin" || role === "stocker";
  };

  return (
    <div class={`relative ${props.compact ? "py-1" : "py-2 space-y-4"}`}>
      <QuantityController
        value={props.currentQty}
        compact={props.compact}
        disabled={!canAdjust() || saving()}
        label="units"
        onChange={saveCount}
      />

      <Show when={props.storageId}>
        <div class="pt-1 relative">
          <ConfirmCountWidget
            storageId={props.storageId}
            lastCounted={lastCounted()}
            onConfirmed={handleCountConfirmed}
            onToggleLifecycle={() => setShowLifecycle((prev) => !prev)}
          />

          <LifecyclePopover
            isOpen={showLifecycle()}
            onClose={() => setShowLifecycle(false)}
            storageName={props.storageName}
            timestamps={{
              firstAdded: firstAdded(),
              lastCounted: lastCounted(),
              lastStocked: lastStocked(),
              lastUsed: lastUsed(),
            }}
          />
        </div>
      </Show>
    </div>
  );
}
