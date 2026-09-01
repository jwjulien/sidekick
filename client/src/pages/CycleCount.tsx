import { createSignal, createEffect, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import { apiFetch } from "../hooks/useAuth";
import toast from "solid-toast";
import AuditWizard, { type AuditLocationItem, type AuditCompleteSummary } from "../components/audit/AuditWizard";
import {
  ClipboardCheck,
  RefreshCw,
  Play,
  Layers,
  Package,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  MapPin,
  Sliders,
} from "lucide-solid";

export default function CycleCount() {
  const [daysStale, setDaysStale] = createSignal<number>(180);
  const [items, setItems] = createSignal<AuditLocationItem[]>([]);
  const [isLoading, setIsLoading] = createSignal<boolean>(false);
  const [wizardOpen, setWizardOpen] = createSignal<boolean>(false);
  const [completionSummary, setCompletionSummary] = createSignal<AuditCompleteSummary | null>(null);

  const fetchAuditRoute = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch(`/locations/audit?days_stale=${daysStale()}`);
      setItems(data || []);
    } catch (err: any) {
      console.error("Failed to fetch audit route:", err);
      toast.error(err.message || "Failed to fetch cycle count audit route.");
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    fetchAuditRoute();
  });

  const handleWizardComplete = (summary: AuditCompleteSummary) => {
    setWizardOpen(false);
    setCompletionSummary(summary);
    fetchAuditRoute();
  };

  return (
    <div class="space-y-6">
      
      {/* Top Header */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/5">
        <div class="space-y-1">
          <div class="flex items-center gap-3">
            <div class="p-2.5 rounded-xl bg-gradient-to-br from-accentCyan/20 to-accentBlue/10 border border-accentCyan/30 text-accentCyan">
              <ClipboardCheck size={24} />
            </div>
            <div>
              <h1 class="text-xl font-extrabold text-white tracking-wide">
                Cycle Counting & Inventory Audit
              </h1>
              <p class="text-xs text-gray-400">
                Physically optimized traversal routes for verifying stale workshop inventory
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            onClick={fetchAuditRoute}
            disabled={isLoading()}
            class="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} class={isLoading() ? "animate-spin" : ""} /> Refresh Route
          </button>

          <button
            onClick={() => setWizardOpen(true)}
            disabled={isLoading() || items().length === 0}
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-accentCyan to-accentBlue text-white font-extrabold text-xs hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-accentCyan/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={16} /> Start Audit Route ({items().length})
          </button>
        </div>
      </div>

      {/* Completion Summary Card (if audit recently completed) */}
      <Show when={completionSummary()}>
        <div class="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-4 animate-fadeIn">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 class="text-base font-extrabold text-white">
                  Audit Route Completed!
                </h3>
                <p class="text-xs text-gray-300">
                  Great job maintaining inventory accuracy on the shop floor.
                </p>
              </div>
            </div>

            <button
              onClick={() => setCompletionSummary(null)}
              class="text-xs text-gray-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div class="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
              <span class="text-xs text-gray-400 block font-semibold">Total Audited</span>
              <span class="text-xl font-black text-emerald-400">{completionSummary()?.totalAudited}</span>
            </div>

            <div class="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
              <span class="text-xs text-gray-400 block font-semibold">Adjustments Logged</span>
              <span class="text-xl font-black text-amber-400">{completionSummary()?.adjustedCount}</span>
            </div>

            <div class="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
              <span class="text-xs text-gray-400 block font-semibold">Skipped</span>
              <span class="text-xl font-black text-gray-400">{completionSummary()?.skippedCount}</span>
            </div>
          </div>
        </div>
      </Show>

      {/* Threshold Selector & Summary Banner */}
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Days Stale Selector Card */}
        <div class="glass-card p-5 rounded-2xl border border-white/5 space-y-3 md:col-span-1">
          <div class="flex items-center gap-2 text-xs font-extrabold text-accentCyan uppercase tracking-wider">
            <Sliders size={14} /> Audit Threshold
          </div>

          <div class="space-y-2">
            <label class="text-xs text-gray-400 block">Stale time window:</label>
            <div class="space-y-1.5">
              {[
                { label: "30 Days (Strict)", value: 30 },
                { label: "90 Days (Quarterly)", value: 90 },
                { label: "180 Days (Semi-Annual)", value: 180 },
                { label: "365 Days (Annual)", value: 365 },
                { label: "All Uncounted", value: 0 },
              ].map((opt) => (
                <button
                  onClick={() => setDaysStale(opt.value)}
                  class={`w-full px-3 py-2 rounded-xl text-xs font-bold text-left transition-all cursor-pointer flex items-center justify-between ${
                    daysStale() === opt.value
                      ? "bg-accentCyan/20 border border-accentCyan/40 text-accentCyan"
                      : "bg-white/5 hover:bg-white/10 text-gray-400"
                  }`}
                >
                  <span>{opt.label}</span>
                  <Show when={daysStale() === opt.value}>
                    <CheckCircle2 size={14} />
                  </Show>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Route Details Card */}
        <div class="glass-card p-5 rounded-2xl border border-white/5 space-y-4 md:col-span-3 flex flex-col justify-between">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
                Generated Route Metrics
              </span>
              <span class="text-xs text-accentCyan font-bold bg-accentCyan/10 px-2.5 py-1 rounded-full border border-accentCyan/20">
                Sorted by Physical Lineage Path (CTE)
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div class="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span class="text-[10px] text-gray-400 uppercase font-bold">Pending Stale Bins</span>
                <div class="text-2xl font-black text-white">{items().length}</div>
              </div>

              <div class="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span class="text-[10px] text-gray-400 uppercase font-bold">Estimated Route Time</span>
                <div class="text-2xl font-black text-accentCyan">
                  ~{Math.ceil(items().length * 1.5)} min
                </div>
              </div>

              <div class="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span class="text-[10px] text-gray-400 uppercase font-bold">Optimized Travel Order</span>
                <div class="text-xs font-bold text-emerald-400 flex items-center gap-1 pt-1">
                  <MapPin size={14} /> Sibling Bins Grouped
                </div>
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-white/5 flex items-center justify-between">
            <p class="text-xs text-gray-400">
              Ready to start? Launch the step-by-step full-screen wizard.
            </p>
            
            <button
              onClick={() => setWizardOpen(true)}
              disabled={isLoading() || items().length === 0}
              class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-accentCyan to-accentBlue text-white font-extrabold text-xs hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-accentCyan/20 cursor-pointer disabled:opacity-50"
            >
              <Play size={16} /> Launch Audit Wizard
            </button>
          </div>
        </div>
      </div>

      {/* Stale Locations Table Preview */}
      <div class="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Layers size={18} class="text-accentCyan" />
            <h3 class="text-base font-extrabold text-white">
              Audit Route Bin Sequence
            </h3>
          </div>
          <span class="text-xs text-gray-400">
            {items().length} locations in route
          </span>
        </div>

        <Show when={!isLoading()} fallback={
          <div class="p-8 text-center text-gray-400 animate-pulse">Loading cycle count route...</div>
        }>
          <Show when={items().length > 0} fallback={
            <div class="p-12 text-center space-y-3 glass-card rounded-xl border border-white/5">
              <CheckCircle2 size={36} class="text-emerald-400 mx-auto" />
              <h4 class="text-base font-bold text-white">All Bins Are Up to Date!</h4>
              <p class="text-xs text-gray-400 max-w-sm mx-auto">
                No storage locations exceed the selected threshold ({daysStale()} days). Your inventory counts are current!
              </p>
            </div>
          }>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-gray-300">
                <thead class="bg-white/5 text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th class="px-4 py-3 rounded-l-xl">Seq</th>
                    <th class="px-4 py-3">Physical Location Lineage Path</th>
                    <th class="px-4 py-3">Assigned Part</th>
                    <th class="px-4 py-3 text-right">Recorded Qty</th>
                    <th class="px-4 py-3 text-right rounded-r-xl">Last Counted</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <For each={items()}>
                    {(item, idx) => (
                      <tr class="hover:bg-white/[0.02] transition-colors">
                        <td class="px-4 py-3 font-mono font-bold text-accentCyan">
                          #{idx() + 1}
                        </td>
                        <td class="px-4 py-3 font-semibold text-white">
                          {item.path}
                        </td>
                        <td class="px-4 py-3">
                          <Show when={item.part_name} fallback={
                            <span class="text-gray-500 italic">Empty Location</span>
                          }>
                            <span class="font-bold text-gray-200">{item.part_name}</span>
                            <Show when={item.part_number}>
                              <span class="text-gray-400 font-mono text-[11px] block">
                                {item.part_number}
                              </span>
                            </Show>
                          </Show>
                        </td>
                        <td class="px-4 py-3 text-right font-bold text-white">
                          {item.quantity}
                        </td>
                        <td class="px-4 py-3 text-right text-gray-400">
                          {item.last_counted ? new Date(item.last_counted).toLocaleDateString() : "Never"}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>
      </div>

      {/* Audit Wizard Overlay */}
      <AuditWizard
        isOpen={wizardOpen()}
        onClose={() => setWizardOpen(false)}
        items={items()}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}
