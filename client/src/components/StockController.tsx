import { createSignal, Show } from "solid-js";
import { apiFetch, user } from "../hooks/useAuth";
import toast from "solid-toast";
import ConfirmCountWidget from "./ConfirmCountWidget";
import QuantityController from "./QuantityController";

interface StockControllerProps {
  storageId: string;
  currentQty: number;
  lastCounted?: string | null;
  compact?: boolean;
  onChanged?: (newQty: number, newLastCounted: string) => void;
}

export default function StockController(props: StockControllerProps) {
  const [saving, setSaving] = createSignal(false);

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
    } finally {
      setSaving(false);
    }
  };

  const canAdjust = () => {
    const role = user()?.role;
    return role === "admin" || role === "stocker";
  };

  return (
    <div class={props.compact ? "py-1" : "py-2 space-y-4"}>
      <QuantityController
        value={props.currentQty}
        compact={props.compact}
        disabled={!canAdjust() || saving()}
        label="units"
        onChange={saveCount}
      />

      <Show when={props.storageId}>
        <div class="pt-1">
          <ConfirmCountWidget
            storageId={props.storageId}
            lastCounted={props.lastCounted}
            onConfirmed={(newTs) => props.onChanged?.(props.currentQty, newTs)}
          />
        </div>
      </Show>
    </div>
  );
}
