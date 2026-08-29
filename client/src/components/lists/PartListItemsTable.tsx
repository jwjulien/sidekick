import { For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ExternalLink, RotateCcw } from "lucide-solid";
import QuantityController from "../QuantityController";
import MultiLocationStockController from "../parts/MultiLocationStockController";
import { apiFetch } from "../../hooks/useAuth";
import { showToast, toast } from "../../utils/toast";

export interface PartListItemsTableProps {
  items: any[];
  listId: string;
  isDrawer?: boolean;
  highlightedPartId?: string | null;
  onItemUpdated?: () => void;
  onItemRemoved?: (item: any) => void;
}

export default function PartListItemsTable(props: PartListItemsTableProps) {
  const navigate = useNavigate();

  const handleUpdateItemQty = async (itemId: string, newQty: number) => {
    try {
      await apiFetch(`/lists/${props.listId}/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty })
      });
      props.onItemUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update quantity.");
    }
  };

  const handleUpdateItemNotes = async (itemId: string, newNotes: string) => {
    try {
      await apiFetch(`/lists/${props.listId}/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: newNotes })
      });
      props.onItemUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update notes.");
    }
  };

  const handleRemoveItem = async (item: any) => {
    if (!item) return;
    const snapshot = {
      listId: props.listId,
      partId: item.part_id,
      quantity: item.quantity,
      notes: item.notes || "",
      partValue: item.part?.value || item.part?.number || "Component"
    };

    try {
      await apiFetch(`/lists/${props.listId}/items/${item.id}`, { method: "DELETE" });
      props.onItemRemoved?.(item);
      props.onItemUpdated?.();

      showToast.undo(
        `Removed "${snapshot.partValue}" from list`,
        async () => {
          try {
            await apiFetch(`/lists/${snapshot.listId}/items`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                part_id: snapshot.partId,
                quantity: snapshot.quantity,
                notes: snapshot.notes
              })
            });
            showToast.success(`Restored "${snapshot.partValue}" to list!`);
            props.onItemUpdated?.();
          } catch (e: any) {
            showToast.error(e.message || "Failed to restore item.");
          }
        }
      );
    } catch (err: any) {
      showToast.error(err.message || "Failed to remove item.");
    }
  };

  return (
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="border-b border-white/10 bg-white/5 text-gray-400 font-semibold uppercase tracking-wider">
            <th class="py-3.5 px-4">Component</th>
            <th class="py-3.5 px-4 text-center">Live Stock</th>
            <th class="py-3.5 px-4 text-center">Req. Qty</th>
            <th class="py-3.5 px-4">Item Notes</th>
            <th class="py-3.5 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          <For each={props.items}>
            {(item) => (
              <tr
                id={`drawer-part-${item.part_id}`}
                class={`transition-all duration-500 group ${
                  props.highlightedPartId === item.part_id
                    ? "bg-amber-500/30 border border-amber-400/60 shadow-lg shadow-amber-500/20 animate-pulse"
                    : "hover:bg-white/5"
                }`}
              >
                {/* Component Column */}
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-accentCyan text-xs shrink-0">
                      {item.part?.package || "Part"}
                    </div>
                    <div class="min-w-0">
                      <div class="font-extrabold text-white text-sm truncate">
                        {item.part?.value}
                      </div>
                      <div class="text-[11px] text-gray-400 font-mono truncate">
                        {item.part?.number}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Live Multi-Location Stock Column */}
                <td class="py-3 px-4 text-center">
                  <MultiLocationStockController
                    partId={item.part_id}
                    totalQty={item.part?.total_quantity}
                    locations={item.part?.locations || []}
                    compact={true}
                    dropUp={props.isDrawer}
                    onChanged={() => props.onItemUpdated?.()}
                  />
                </td>

                {/* Target Quantity Column with onDelete Trash Transition */}
                <td class="py-3 px-4 text-center">
                  <QuantityController
                    value={item.quantity}
                    compact={true}
                    min={1}
                    onDelete={() => handleRemoveItem(item)}
                    onChange={(newQty) => handleUpdateItemQty(item.id, newQty)}
                  />
                </td>

                {/* Editable Notes Column */}
                <td class="py-3 px-4">
                  <input
                    type="text"
                    value={item.notes || ""}
                    placeholder="Add optional notes..."
                    onBlur={(e) =>
                      handleUpdateItemNotes(item.id, (e.target as HTMLInputElement).value)
                    }
                    onKeyDown={(e: KeyboardEvent) =>
                      e.key === "Enter" &&
                      handleUpdateItemNotes(item.id, (e.target as HTMLInputElement).value)
                    }
                    class="glass-input w-full text-xs text-gray-300 py-1 px-2.5"
                  />
                </td>

                {/* Actions Column */}
                <td class="py-3 px-4 text-right">
                  <button
                    onClick={() => navigate(`/parts/${item.part_id}`)}
                    class="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-accentCyan hover:bg-white/10 transition-colors"
                    title="View part details"
                  >
                    <ExternalLink size={14} />
                  </button>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
