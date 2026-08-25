import { createSignal, createResource, Show, For, onMount } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { 
  Package, 
  FolderTree, 
  MapPin, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  Plus, 
  Minus,
  Search,
  RefreshCw,
  PackageCheck
} from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";
import toast from "solid-toast";
import { useConfirm } from "../contexts/ConfirmContext";

export default function Dashboard() {
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [stats, setStats] = createSignal({
    totalItems: 0,
    categories: 0,
    locations: 0,
    lowStock: 0,
    homelessCount: 0
  });
  
  const [lowStockItems, setLowStockItems] = createSignal<any[]>([]);
  const [recentTx, setRecentTx] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [quickStockId, setQuickStockId] = createSignal<number | null>(null);
  const [quickQty, setQuickQty] = createSignal(1);
  const [quickNotes, setQuickNotes] = createSignal("");
  const [quickAction, setQuickAction] = createSignal<"check_in" | "check_out" | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [items, categories, locations, alerts, txs, homelessRes] = await Promise.all([
        apiFetch("/parts"),
        apiFetch("/categories"),
        apiFetch("/locations?flat=true"),
        apiFetch("/parts?low_stock=true"),
        apiFetch("/parts/transactions?limit=8"),
        apiFetch("/parts/homeless/count")
      ]);
      
      setStats({
        totalItems: items.length,
        categories: categories.length,
        locations: locations.length,
        lowStock: alerts.length,
        homelessCount: homelessRes?.count || 0
      });
      setLowStockItems(alerts);
      setRecentTx(txs);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchDashboardData();
  });

  const handleQuickStock = async (itemId: string) => {
    if (!quickAction()) return;
    try {
      await apiFetch(`/items/${itemId}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity_change: quickQty(),
          action_type: quickAction(),
          notes: quickNotes() || "Quick dashboard update."
        })
      });
      // Reset & refresh
      setQuickStockId(null);
      setQuickQty(1);
      setQuickNotes("");
      setQuickAction(null);
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update stock level.");
    }
  };

  const formatTxMessage = (tx: any) => {
    const qtyText = tx.quantity_change > 0 ? `+${tx.quantity_change}` : `${tx.quantity_change}`;
    switch(tx.action_type) {
      case "create":
        return `Item created with ${tx.quantity_change} units`;
      case "check_in":
        return `Checked in ${qtyText} units`;
      case "check_out":
        return `Checked out ${Math.abs(tx.quantity_change)} units`;
      case "edit":
        return tx.notes || "Details edited";
      default:
        return tx.notes || "Stock adjusted";
    }
  };

  const getTxColor = (action: string) => {
    switch(action) {
      case "create": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "check_in": return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      case "check_out": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "edit": return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      default: return "text-gray-400 bg-white/5 border-white/5";
    }
  };

  return (
    <div class="space-y-8">
      {/* Welcome Area */}
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-white tracking-tight">Dashboard</h2>
          <p class="text-gray-400 text-sm">Welcome back, {user()?.username}. You have <span class="text-accentCyan font-semibold">{user()?.role}</span> permissions.</p>
        </div>
        <div class="flex items-center gap-2">
          <button 
            onClick={fetchDashboardData}
            class="btn-secondary p-2.5 flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw size={16} class={loading() ? "animate-spin text-accentCyan" : ""} />
            Reload Data
          </button>
          <button 
            onClick={() => navigate("/inventory")}
            class="btn-primary flex items-center justify-center gap-2 text-sm"
          >
            <Search size={16} />
            Search Inventory
          </button>
        </div>
      </div>

      {/* Homeless Parts Alert Banner */}
      <Show when={stats().homelessCount > 0}>
        <div class="glass-card p-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.03] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <PackageCheck size={20} />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-white text-sm">Unassigned Homeless Parts</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {stats().homelessCount} Requiring Triage
                </span>
              </div>
              <p class="text-xs text-gray-400 mt-0.5">
                You have {stats().homelessCount} part record{stats().homelessCount === 1 ? "" : "s"} with no physical storage assignment.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/inventory/homeless-parts")}
            class="btn-primary py-2 px-4 text-xs flex items-center gap-2 shrink-0 font-bold"
          >
            Triage Homeless Parts ➔
          </button>
        </div>
      </Show>

      {/* Grid of Stats Cards */}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total items */}
        <div class="glass-card p-6 flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-accentCyan/10 border border-accentCyan/20 text-accentCyan flex items-center justify-center">
            <Package size={22} />
          </div>
          <div>
            <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Total Items</span>
            <span class="text-2xl font-bold text-white mt-1 block">{stats().totalItems}</span>
          </div>
        </div>

        {/* Categories */}
        <div class="glass-card p-6 flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-accentPurple/10 border border-accentPurple/20 text-accentPurple flex items-center justify-center">
            <FolderTree size={22} />
          </div>
          <div>
            <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Categories</span>
            <span class="text-2xl font-bold text-white mt-1 block">{stats().categories}</span>
          </div>
        </div>

        {/* Locations */}
        <div class="glass-card p-6 flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-accentBlue/10 border border-accentBlue/20 text-accentBlue flex items-center justify-center">
            <MapPin size={22} />
          </div>
          <div>
            <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Locations</span>
            <span class="text-2xl font-bold text-white mt-1 block">{stats().locations}</span>
          </div>
        </div>

        {/* Low stock alerts */}
        <div class={`glass-card p-6 flex items-center gap-4 border transition-all ${
          stats().lowStock > 0 
            ? "border-amber-500/30 bg-amber-500/[0.02]" 
            : "border-white/5"
        }`}>
          <div class={`w-12 h-12 rounded-xl flex items-center justify-center ${
            stats().lowStock > 0 
              ? "bg-amber-500/10 text-amber-500 animate-pulse" 
              : "bg-gray-500/10 text-gray-400"
          }`}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Stock Alerts</span>
            <span class={`text-2xl font-bold mt-1 block ${stats().lowStock > 0 ? "text-amber-400" : "text-white"}`}>
              {stats().lowStock}
            </span>
          </div>
        </div>
      </div>

      {/* Main split sections */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ----------------- LEFT 2 COLS: LOW STOCK ALERT LEDGER ----------------- */}
        <div class="lg:col-span-2 space-y-6">
          <div class="glass-panel rounded-2xl p-6 border border-white/5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle size={18} class="text-amber-500" />
                Low Stock Threshold Alerts
              </h3>
              <span class="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px] uppercase px-2.5 py-1 rounded-full">
                Needs Attention
              </span>
            </div>

            <Show when={loading()}>
              <div class="space-y-3 py-6">
                <div class="h-10 bg-white/5 rounded-xl animate-pulse"></div>
                <div class="h-10 bg-white/5 rounded-xl animate-pulse"></div>
                <div class="h-10 bg-white/5 rounded-xl animate-pulse"></div>
              </div>
            </Show>

            <Show when={!loading() && lowStockItems().length === 0}>
              <div class="text-center py-10 text-gray-500 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                🎉 All items are fully stocked above warning levels.
              </div>
            </Show>

            <Show when={!loading() && lowStockItems().length > 0}>
              <div class="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                <For each={lowStockItems()}>
                  {(item) => (
                    <div class="glass-card p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-l-amber-500">
                      <div>
                        <A href={`/inventory/item/${item.id}`} class="font-bold text-white hover:text-accentCyan transition-colors text-sm">
                          {item.name}
                        </A>
                        <div class="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-gray-400">
                          <span>SKU: {item.sku || "N/A"}</span>
                          <span>•</span>
                          <span>Location: {item.location?.name || "N/A"}</span>
                        </div>
                      </div>
                      
                      <div class="flex items-center gap-6 self-end sm:self-auto">
                        <div class="text-right">
                          <span class="text-[10px] text-gray-500 uppercase block font-semibold">Stock Level</span>
                          <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="text-sm font-bold text-amber-400">{item.quantity}</span>
                            <span class="text-xs text-gray-500">/ min {item.min_quantity_alert}</span>
                          </div>
                        </div>

                        {/* Quick stock replenishment interface */}
                        <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                          <button
                            onClick={() => {
                              setQuickStockId(item.id);
                              setQuickAction("check_in");
                            }}
                            class="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 hover:bg-accentCyan/10 hover:text-accentCyan"
                          >
                            <Plus size={12} />
                            Restock
                          </button>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* ----------------- RIGHT 1 COL: AUDIT HISTORY TRANSACTION LOG ----------------- */}
        <div class="space-y-6">
          <div class="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col h-full">
            <h3 class="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Activity size={18} class="text-accentCyan" />
              Audit Transaction Log
            </h3>

            <Show when={loading()}>
              <div class="space-y-4 py-4">
                <div class="h-12 bg-white/5 rounded-xl animate-pulse"></div>
                <div class="h-12 bg-white/5 rounded-xl animate-pulse"></div>
                <div class="h-12 bg-white/5 rounded-xl animate-pulse"></div>
              </div>
            </Show>

            <Show when={!loading() && recentTx().length === 0}>
              <div class="text-center py-10 text-gray-500 flex-1 flex flex-col items-center justify-center">
                <span>No inventory movements recorded yet.</span>
              </div>
            </Show>

            <Show when={!loading() && recentTx().length > 0}>
              <div class="space-y-4 overflow-y-auto max-h-[460px] pr-1 flex-1">
                <For each={recentTx()}>
                  {(tx) => (
                    <div class="flex gap-3 text-xs">
                      {/* Left timeline line decoration */}
                      <div class="flex flex-col items-center">
                        <div class={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${
                          tx.quantity_change > 0 ? "text-cyan-400 border-cyan-500/30" : "text-rose-400 border-rose-500/30"
                        }`}>
                          {tx.quantity_change > 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                        </div>
                        <div class="w-[1px] flex-1 bg-white/5 my-1"></div>
                      </div>
                      
                      {/* Content */}
                      <div class="flex-1 min-w-0 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <div class="flex justify-between items-start gap-2">
                          <span class="font-bold text-white truncate hover:text-accentCyan cursor-pointer" onClick={() => navigate(`/inventory/item/${tx.item_id}`)}>
                            Item #{tx.item_id}
                          </span>
                          <span class="text-[10px] text-gray-500 shrink-0">
                            {new Date(tx.created_at + "Z").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p class="text-gray-400 mt-1 leading-normal text-[11px]">{formatTxMessage(tx)}</p>
                        
                        <div class="flex justify-between items-center mt-2 pt-2 border-t border-white/5 text-[10px]">
                          <span class="text-gray-500">By: {tx.user?.username || "System"}</span>
                          <span class={`px-1.5 py-0.5 rounded font-extrabold uppercase ${getTxColor(tx.action_type)}`}>
                            {tx.action_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* ----------------- QUICK DIALOG FOR RESTOCKING ----------------- */}
      <Show when={quickStockId() !== null}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="glass-panel max-w-md w-full rounded-2xl p-6 border border-white/10 relative">
            <h3 class="text-lg font-bold text-white mb-4 uppercase tracking-wide">
              Quick Restock Level
            </h3>
            
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Quantity to add</label>
                <div class="flex items-center gap-2">
                  <button 
                    onClick={() => setQuickQty(Math.max(1, quickQty() - 1))}
                    class="btn-secondary px-3 py-2"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quickQty()}
                    onInput={(e) => setQuickQty(parseInt(e.target.value) || 1)}
                    class="glass-input flex-1 text-center font-bold text-base"
                    min="1"
                  />
                  <button 
                    onClick={() => setQuickQty(quickQty() + 1)}
                    class="btn-secondary px-3 py-2"
                  >
                    +
                  </button>
                </div>
              </div>
              
              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Notes / Reference</label>
                <textarea
                  value={quickNotes()}
                  onInput={(e) => setQuickNotes(e.target.value)}
                  placeholder="Restock order #, invoice ref, etc."
                  class="glass-input w-full h-20 text-sm resize-none"
                />
              </div>
              
              <div class="flex gap-3 pt-2">
                <button
                  onClick={() => setQuickStockId(null)}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleQuickStock(quickStockId()!)}
                  class="btn-primary flex-1"
                >
                  Confirm Restock
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
