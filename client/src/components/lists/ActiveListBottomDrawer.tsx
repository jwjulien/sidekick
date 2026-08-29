import { createSignal, Show, For } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { ShoppingBag, ChevronUp, ChevronDown, X, ExternalLink, Trash2, Plus, RotateCcw } from "lucide-solid";
import { useActiveList } from "../../context/ActiveListContext";
import MultiLocationStockController from "../parts/MultiLocationStockController";
import QuantityController from "../QuantityController";
import { apiFetch } from "../../hooks/useAuth";
import toast from "solid-toast";

export default function ActiveListBottomDrawer() {
  const activeListCtx = useActiveList();
  const navigate = useNavigate();
  const location = useLocation();

  const [showConfirmClose, setShowConfirmClose] = createSignal(false);

  const activeList = () => activeListCtx.activeList();
  const expanded = () => activeListCtx.drawerExpanded();
  const setExpanded = (val: boolean) => activeListCtx.setDrawerExpanded(val);

  const currentPartId = () => {
    const path = location.pathname;
    if (path.startsWith("/parts/")) {
      const id = path.substring(7);
      if (id && id !== "homeless") return id;
    }
    return null;
  };

  const handleAddViewedPart = async () => {
    const partId = currentPartId();
    const listId = activeList()?.id;
    if (!partId || !listId) return;

    try {
      await apiFetch(`/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_id: partId, quantity: 1 })
      });
      toast.success("Added currently viewed component to active list!");
      await activeListCtx.refreshActiveList();
    } catch (err: any) {
      if (err.message?.includes("already in list")) {
        toast((t) => (
          <div class="flex items-center justify-between gap-4 py-1 px-1">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <span class="text-xs font-bold text-white tracking-wide">Item already in list</span>
            </div>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                activeListCtx.highlightPartInDrawer(partId);
              }}
              class="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-gray-950 font-extrabold text-[11px] uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
            >
              Locate in Drawer
            </button>
          </div>
        ), {
          duration: 6000,
          style: {
            background: "#0f172a",
            color: "#ffffff",
            border: "1px solid rgba(245, 158, 11, 0.5)",
            "border-radius": "0.85rem",
            "box-shadow": "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            padding: "0.5rem 0.75rem"
          }
        });
      } else {
        toast.error(err.message || "Failed to add component.");
      }
    }
  };

  const handleOpenList = () => {
    if (activeList()?.id) {
      navigate(`/lists/${activeList().id}`);
    }
  };

  const handleConfirmClose = async () => {
    setShowConfirmClose(false);
    await activeListCtx.clearActiveList();
  };

  const handleRemoveItem = async (item: any) => {
    const listId = activeList()?.id;
    if (!listId || !item) return;

    const snapshot = {
      listId,
      partId: item.part_id,
      quantity: item.quantity,
      notes: item.notes || "",
      partValue: item.part?.value || item.part?.number || "Component"
    };

    try {
      await apiFetch(`/lists/${listId}/items/${item.id}`, { method: "DELETE" });
      await activeListCtx.refreshActiveList();

      toast((t) => (
        <div class="flex items-center justify-between gap-4 py-0.5">
          <span class="text-xs font-semibold text-white truncate max-w-[200px]">
            Removed "{snapshot.partValue}"
          </span>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
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
                toast.success(`Restored "${snapshot.partValue}" to list!`);
                await activeListCtx.refreshActiveList();
              } catch (e: any) {
                toast.error(e.message || "Failed to restore item.");
              }
            }}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accentCyan text-gray-950 font-extrabold text-[11px] uppercase tracking-wider transition-all hover:brightness-110 shadow-md active:scale-95 shrink-0"
          >
            <RotateCcw size={12} />
            <span>Undo</span>
          </button>
        </div>
      ), {
        duration: 6000,
        style: {
          background: "#0f172a",
          color: "#ffffff",
          border: "1px solid rgba(6, 182, 212, 0.4)",
          "border-radius": "0.85rem",
          "box-shadow": "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          padding: "0.5rem 0.75rem"
        }
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to remove item.");
    }
  };

  return (
    <Show when={activeList()}>
      {/* Sticky Docked Bottom Container */}
      <div class="fixed bottom-0 left-0 right-0 z-40 px-4 transition-all duration-300">
        <div class="max-w-7xl mx-auto glass-card rounded-t-2xl border border-white/20 shadow-2xl bg-gray-900/95 backdrop-blur-xl overflow-hidden">
          {/* Header Bar */}
          <div class="px-5 py-3 flex items-center justify-between bg-gradient-to-r from-accentCyan/10 via-purple-500/5 to-transparent border-b border-white/10">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-xl bg-accentCyan/20 text-accentCyan border border-accentCyan/30">
                <ShoppingBag size={18} />
              </div>

              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-accentCyan uppercase tracking-wider">
                    Active List
                  </span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10 font-mono">
                    {activeList()?.type || "General"}
                  </span>
                </div>
                <h3 class="text-sm font-bold text-white truncate max-w-xs md:max-w-md">
                  {activeList()?.name}
                </h3>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Show when={currentPartId()}>
                <button
                  onClick={handleAddViewedPart}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all font-bold text-xs shadow-sm"
                  title="Add the component currently being viewed to this active list"
                >
                  <Plus size={14} />
                  <span>+ Add Current Part</span>
                </button>
              </Show>

              <button
                onClick={() => setExpanded(!expanded())}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white transition-all text-xs font-semibold"
              >
                <span>{activeList()?.items?.length || 0} items</span>
                <Show when={expanded()} fallback={<ChevronUp size={14} />}>
                  <ChevronDown size={14} />
                </Show>
              </button>

              <button
                onClick={handleOpenList}
                class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-accentCyan text-gray-950 hover:brightness-110 font-bold text-xs transition-all"
              >
                <span>View List</span>
                <ExternalLink size={12} />
              </button>

              <button
                onClick={() => setShowConfirmClose(true)}
                class="p-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Deactivate and close list drawer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Expandable Body Table */}
          <Show when={expanded()}>
            <div class="p-4 max-h-60 overflow-y-auto space-y-2 border-t border-white/5 bg-gray-950/60">
              <Show
                when={activeList()?.items?.length > 0}
                fallback={
                  <div class="text-center py-6 text-xs text-gray-500">
                    No items in this active list yet. Use search or parts catalog to add items!
                  </div>
                }
              >
                <div class="grid grid-cols-1 divide-y divide-white/5">
                  <For each={activeList()?.items}>
                    {(item) => (
                      <div
                        id={`drawer-part-${item.part_id}`}
                        class={`py-2.5 px-3 rounded-xl flex items-center justify-between gap-4 text-xs transition-all duration-500 ${
                          activeListCtx.highlightedPartId() === item.part_id
                            ? "bg-amber-500/30 border border-amber-400/60 shadow-lg shadow-amber-500/20 animate-pulse"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-accentCyan text-[10px]">
                            {item.part?.package || "Part"}
                          </div>
                          <div class="min-w-0">
                            <div class="font-bold text-white truncate">
                              {item.part?.value}
                            </div>
                            <div class="text-[10px] text-gray-400 font-mono truncate">
                              {item.part?.number}
                            </div>
                          </div>
                        </div>

                        <div class="flex items-center gap-4 shrink-0">
                          <div class="text-center">
                            <span class="text-[10px] text-gray-400 block mb-0.5">Req Qty</span>
                            <QuantityController
                              value={item.quantity}
                              compact={true}
                              min={1}
                              onDelete={() => handleRemoveItem(item)}
                              onChange={async (newQty) => {
                                const listId = activeList()?.id;
                                if (!listId) return;
                                try {
                                  await apiFetch(`/lists/${listId}/items/${item.id}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ quantity: newQty })
                                  });
                                  await activeListCtx.refreshActiveList();
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to update item quantity.");
                                }
                              }}
                            />
                          </div>

                          <div class="text-center">
                            <span class="text-[10px] text-gray-400 block">Notes</span>
                            <span class="text-gray-300 truncate max-w-[120px] block text-[11px]">
                              {item.notes || "-"}
                            </span>
                          </div>

                          <MultiLocationStockController
                            partId={item.part_id}
                            totalQty={item.part?.total_quantity}
                            locations={item.part?.locations || []}
                            compact={true}
                            dropUp={true}
                            onChanged={() => activeListCtx.refreshActiveList()}
                          />

                          <button
                            onClick={() => handleRemoveItem(item)}
                            class="p-1 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        {/* Confirmation Modal to Deactivate List */}
        <Show when={showConfirmClose()}>
          <div
            class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowConfirmClose(false)}
          >
            <div
              class="glass-card max-w-md w-full p-6 rounded-2xl border border-white/20 shadow-2xl bg-gray-900/95 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 class="text-base font-bold text-white">Deactivate Active List?</h4>
              <p class="text-xs text-gray-300">
                Are you sure you want to deactivate <span class="font-bold text-accentCyan">"{activeList()?.name}"</span>?
                This will unmount the sticky bottom drawer. The list and its items will remain safely stored.
              </p>
              <div class="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmClose(false)}
                  class="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmClose}
                  class="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition-colors"
                >
                  Deactivate & Close
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
