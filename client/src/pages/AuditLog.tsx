import { createSignal, createEffect, Show, For } from "solid-js";
import { 
  History, 
  Search, 
  Download, 
  ShieldCheck, 
  AlertTriangle, 
  Scale, 
  User, 
  RefreshCw,
  FileCode,
  Layers
} from "lucide-solid";
import { apiFetch } from "../hooks/useAuth";
import AuditDiffDrawer, { type AuditLogItem } from "../components/audit/AuditDiffDrawer";

interface AuditStats {
  total_events_30d: number;
  discrepancy_count_30d: number;
  scale_reconciliations_30d: number;
  reason_breakdown: Record<string, number>;
  action_breakdown: Record<string, number>;
}

export default function AuditLog() {
  const [logs, setLogs] = createSignal<AuditLogItem[]>([]);
  const [stats, setStats] = createSignal<AuditStats | null>(null);
  const [loading, setLoading] = createSignal(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal("all");
  const [selectedMethod, setSelectedMethod] = createSignal("all");
  const [selectedReason] = createSignal("all");
  const [page, setPage] = createSignal(1);
  const [selectedLog, setSelectedLog] = createSignal<AuditLogItem | null>(null);
  const [drawerOpen, setDrawerOpen] = createSignal(false);


  const fetchStats = async () => {
    try {
      const data = await apiFetch("/audit/stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to load audit stats:", err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = `/audit/logs?page=${page()}&limit=30`;
      if (searchQuery()) url += `&search=${encodeURIComponent(searchQuery())}`;
      
      if (selectedCategory() !== "all") {
        if (selectedCategory() === "stock") url += "&action_type=count_update";
        else if (selectedCategory() === "relocation") url += "&action_type=relocation";
        else if (selectedCategory() === "scale") url += "&method=scale";
        else if (selectedCategory() === "discrepancies") url += "&reason_code=cycle_count_adjustment";
      }

      if (selectedMethod() !== "all") url += `&method=${selectedMethod()}`;
      if (selectedReason() !== "all") url += `&reason_code=${selectedReason()}`;

      const res = await apiFetch(url);
      setLogs(res || []);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    fetchStats();
  });

  createEffect(() => {
    fetchLogs();
  });

  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/audit/export", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("sidekick_token")}`
        }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sidekick_audit_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("CSV Export failed:", err);
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case "check_in":
      case "create":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "check_out":
      case "scrap":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      case "count_update":
      case "count":
        return "bg-accentCyan/15 text-accentCyan border-accentCyan/30";
      case "relocation":
      case "homeless_assigned":
        return "bg-purple-500/15 text-purple-400 border-purple-500/30";
      case "discrepancy_flagged":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      default:
        return "bg-gray-500/15 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div class="space-y-6 pb-12">
      
      {/* ----------------- PAGE HEADER ----------------- */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="p-2.5 rounded-xl bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
              <History size={24} />
            </div>
            <div>
              <h1 class="text-2xl font-black text-white tracking-wide">Audit Log & Activity Ledger</h1>
              <p class="text-xs text-gray-400">Immutable, system-wide event trail & discrepancy tracking</p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button 
            onClick={fetchLogs}
            class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs border border-white/10 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={14} class={loading() ? "animate-spin" : ""} />
            Refresh
          </button>
          <button 
            onClick={handleExportCSV}
            class="px-4 py-2 rounded-xl bg-accentCyan hover:bg-cyan-400 text-black font-bold text-xs shadow-lg shadow-accentCyan/20 transition-all flex items-center gap-1.5"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ----------------- TOP METRICS BANNER ----------------- */}
      <Show when={stats()}>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="glass-panel p-4.5 rounded-2xl border border-white/10 flex items-center gap-4">
            <div class="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers size={22} />
            </div>
            <div>
              <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">30d Total Events</span>
              <span class="text-2xl font-black text-white">{stats()!.total_events_30d}</span>
            </div>
          </div>

          <div class="glass-panel p-4.5 rounded-2xl border border-white/10 flex items-center gap-4">
            <div class="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle size={22} />
            </div>
            <div>
              <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Discrepancy Events</span>
              <span class="text-2xl font-black text-amber-400">{stats()!.discrepancy_count_30d}</span>
            </div>
          </div>

          <div class="glass-panel p-4.5 rounded-2xl border border-white/10 flex items-center gap-4">
            <div class="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Scale size={22} />
            </div>
            <div>
              <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Scale Reconciliations</span>
              <span class="text-2xl font-black text-purple-300">{stats()!.scale_reconciliations_30d}</span>
            </div>
          </div>

          <div class="glass-panel p-4.5 rounded-2xl border border-white/10 flex items-center gap-4">
            <div class="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">SQLite Status</span>
              <span class="text-sm font-bold text-emerald-400">Append-Only Immutable</span>
            </div>
          </div>
        </div>
      </Show>

      {/* ----------------- SEARCH & FILTER BAR ----------------- */}
      <div class="glass-panel p-4 rounded-2xl border border-white/10 space-y-4">
        
        <div class="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div class="relative flex-1">
            <Search size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Search by part number, location, user, or notes..."
              class="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accentCyan transition-colors"
            />
          </div>

          {/* Acquisition Method Filter */}
          <select
            value={selectedMethod()}
            onChange={(e) => setSelectedMethod(e.currentTarget.value)}
            class="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-accentCyan"
          >
            <option value="all">All Methods</option>
            <option value="manual">Manual Entry</option>
            <option value="scale">Bluetooth Scale</option>
            <option value="scanner">Barcode Scanner</option>
            <option value="cycle_count">Cycle Count Wizard</option>
          </select>
        </div>

        {/* Category Pills */}
        <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <For each={[
            { id: "all", label: "All Events" },
            { id: "stock", label: "Stock Updates" },
            { id: "relocation", label: "Relocations" },
            { id: "scale", label: "Scale Weigh-Ins" },
            { id: "discrepancies", label: "Discrepancies" }
          ]}>
            {(cat) => (
              <button
                onClick={() => setSelectedCategory(cat.id)}
                class={`px-3.5 py-1.5 rounded-xl font-semibold border transition-all whitespace-nowrap ${
                  selectedCategory() === cat.id
                    ? "bg-accentCyan/20 border-accentCyan text-accentCyan shadow-sm"
                    : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            )}
          </For>
        </div>

      </div>

      {/* ----------------- AUDIT LOG FEED TABLE ----------------- */}
      <div class="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-gray-300">
            <thead class="bg-white/5 text-gray-400 uppercase text-[10px] tracking-wider font-semibold border-b border-white/10">
              <tr>
                <th class="px-5 py-3.5">Action & Entity</th>
                <th class="px-4 py-3.5">Quantity Change</th>
                <th class="px-4 py-3.5">Reason Code</th>
                <th class="px-4 py-3.5">Method</th>
                <th class="px-4 py-3.5">Triggered By</th>
                <th class="px-4 py-3.5">Timestamp</th>
                <th class="px-4 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              
              <Show 
                when={!loading() && logs().length > 0}
                fallback={
                  <tr>
                    <td colspan="7" class="px-5 py-12 text-center text-gray-500">
                      <Show when={loading()} fallback="No matching audit logs found.">
                        <div class="flex items-center justify-center gap-2">
                          <RefreshCw size={16} class="animate-spin text-accentCyan" />
                          <span>Loading audit ledger...</span>
                        </div>
                      </Show>
                    </td>
                  </tr>
                }
              >
                <For each={logs()}>
                  {(log) => (
                    <tr class="hover:bg-white/5 transition-colors group">
                      
                      {/* Action & Entity */}
                      <td class="px-5 py-3.5">
                        <div class="flex items-center gap-3">
                          <span class={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getActionBadgeClass(log.action_type)}`}>
                            {log.action_type}
                          </span>
                          <div>
                            <div class="font-bold text-white group-hover:text-accentCyan transition-colors">
                              {log.part_name || log.location_name || log.project_name || log.entity_id}
                            </div>
                            <Show when={log.part_number}>
                              <div class="text-[10px] font-mono text-gray-400">{log.part_number}</div>
                            </Show>
                          </div>
                        </div>
                      </td>

                      {/* Quantity Change */}
                      <td class="px-4 py-3.5 font-mono font-bold">
                        <Show when={log.quantity_change !== 0} fallback={<span class="text-gray-500">—</span>}>
                          <span class={log.quantity_change > 0 ? "text-emerald-400" : "text-rose-400"}>
                            {log.quantity_change > 0 ? "+" : ""}{log.quantity_change}
                          </span>
                        </Show>
                      </td>

                      {/* Reason Code */}
                      <td class="px-4 py-3.5 font-mono text-gray-300">
                        {log.reason_code ? (
                          <span class="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-300">
                            {log.reason_code}
                          </span>
                        ) : (
                          <span class="text-gray-500">—</span>
                        )}
                      </td>

                      {/* Method */}
                      <td class="px-4 py-3.5 uppercase font-mono text-[10px] font-semibold text-emerald-400">
                        {log.method}
                      </td>

                      {/* Triggered By */}
                      <td class="px-4 py-3.5 text-gray-300">
                        <div class="flex items-center gap-1.5">
                          <User size={12} class="text-gray-500" />
                          <span>{log.user_name || "System"}</span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td class="px-4 py-3.5 font-mono text-[11px] text-gray-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      {/* Details Trigger */}
                      <td class="px-4 py-3.5 text-right">
                        <button 
                          onClick={() => {
                            setSelectedLog(log);
                            setDrawerOpen(true);
                          }}
                          class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors inline-flex items-center gap-1 text-[11px]"
                        >
                          <FileCode size={14} />
                          <span>Inspect</span>
                        </button>
                      </td>

                    </tr>
                  )}
                </For>
              </Show>

            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div class="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs text-gray-400">
          <span>Page {page()}</span>
          <div class="flex items-center gap-2">
            <button 
              disabled={page() === 1}
              onClick={() => setPage(page() - 1)}
              class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Previous
            </button>
            <button 
              disabled={logs().length < 30}
              onClick={() => setPage(page() + 1)}
              class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Next
            </button>
          </div>
        </div>

      </div>

      {/* State Snapshot Inspector Drawer */}
      <AuditDiffDrawer 
        log={selectedLog()}
        isOpen={drawerOpen()}
        onClose={() => setDrawerOpen(false)}
      />

    </div>
  );
}
