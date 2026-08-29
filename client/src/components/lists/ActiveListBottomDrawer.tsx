import { createSignal, Show } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { ShoppingBag, ChevronUp, ChevronDown, X, ExternalLink, Plus } from "lucide-solid";
import { useActiveList } from "../../context/ActiveListContext";
import PartListItemsTable from "./PartListItemsTable";
import { apiFetch } from "../../hooks/useAuth";
import { showToast, toast } from "../../utils/toast";

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
      showToast.success("Added currently viewed component to active list!");
      await activeListCtx.refreshActiveList();
    } catch (err: any) {
      if (err.message?.includes("already in list")) {
        showToast.warning("Item already in active list", {
          actions: [
            {
              title: "Locate in Drawer",
              variant: "primary",
              onClick: () => activeListCtx.highlightPartInDrawer(partId)
            }
          ]
        });
      } else {
        showToast.error(err.message || "Failed to add component.");
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
                <PartListItemsTable
                  items={activeList()?.items || []}
                  listId={activeList().id}
                  isDrawer={true}
                  highlightedPartId={activeListCtx.highlightedPartId()}
                  onItemUpdated={() => activeListCtx.refreshActiveList()}
                />
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
