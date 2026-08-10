import { createSignal, createEffect, Show, For } from "solid-js";
import { apiFetch } from "../../hooks/useAuth";
import { Package, Hash, AlertTriangle } from "lucide-solid";

export default function PartsBrowser(props: {
  locationId: string;
  onSelectPart: (part: any) => void;
  onAutoSelect: (part: any) => void;
}) {
  const [parts, setParts] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    if (props.locationId) {
      loadParts(props.locationId);
    } else {
      setParts([]);
    }
  });

  const loadParts = async (id: string) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/parts?location_id=${id}`);
      setParts(data);
      
      // Auto-navigate logic: if exactly 1 part is found (and we can assume we're a leaf, but the requirement was simply 0 or 1 parts for auto-nav)
      // Actually the requirement was "when a location is a leaf I would expect to see 0 or 1 parts... automatically switch"
      // Since we don't strictly know if it's a leaf here, we can just say if parts.length === 1, auto-select it. 
      // But maybe let's wait a moment and only auto-select if requested by parent. We'll emit onAutoSelect.
      if (data.length === 1) {
        props.onAutoSelect(data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch parts for location:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
      <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
        <Package size={16} class="text-accentCyan" />
        Aggregated Parts Browser
      </h3>
      
      <Show when={loading()}>
        <div class="h-32 flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accentCyan"></div>
        </div>
      </Show>

      <Show when={!loading() && parts().length === 0}>
        <div class="bg-black/20 p-8 rounded-xl border border-white/5 text-center text-gray-500 text-sm">
          No parts assigned to this location or its children.
        </div>
      </Show>

      <Show when={!loading() && parts().length > 0}>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-gray-300">
            <thead class="text-xs uppercase bg-white/5 text-gray-400">
              <tr>
                <th class="px-4 py-3 rounded-tl-lg">Part Value</th>
                <th class="px-4 py-3">Category</th>
                <th class="px-4 py-3">Package</th>
                <th class="px-4 py-3 rounded-tr-lg">Total Qty</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <For each={parts()}>
                {(part) => (
                  <tr 
                    class="hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => props.onSelectPart(part)}
                  >
                    <td class="px-4 py-3 font-semibold text-white">
                      <div class="flex flex-col">
                        <span>{part.value}</span>
                        <Show when={part.number}>
                          <span class="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                            <Hash size={10} /> {part.number}
                          </span>
                        </Show>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-xs">{part.category?.name || "Unknown"}</td>
                    <td class="px-4 py-3 text-xs">{part.package}</td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <span class={`font-bold ${part.total_quantity < part.threshold ? 'text-red-400' : 'text-green-400'}`}>
                          {part.total_quantity}
                        </span>
                        <Show when={part.total_quantity < part.threshold}>
                          <AlertTriangle size={14} class="text-red-400" title="Low Stock" />
                        </Show>
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}
