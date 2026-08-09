import { createSignal, onMount, For, Show } from "solid-js";
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Layers,
  Printer
} from "lucide-solid";
import { apiFetch } from "../hooks/useAuth";
import toast from "solid-toast";
import { useConfirm } from "../contexts/ConfirmContext";
import LabelPreviewModal from "../components/LabelPreviewModal";

export default function Storage() {
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = createSignal<"locations">("locations");
  const [locations, setLocations] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  
  // Storage Location Form State
  const [locName, setLocName] = createSignal("");
  const [locDesc, setLocDesc] = createSignal("");
  const [locParentId, setLocParentId] = createSignal("");
  const [locIndex, setLocIndex] = createSignal(0);
  const [locLabelScheme, setLocLabelScheme] = createSignal("");
  
  // Printing Reference Tags
  const [activePrintLocation, setActivePrintLocation] = createSignal<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const locs = await apiFetch("/locations?flat=true");
      setLocations(locs);
    } catch (err) {
      console.error("Failed to load storage structure:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  const handleCreateLocation = async (e: Event) => {
    e.preventDefault();
    if (!locName()) return;
    try {
      await apiFetch("/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: locName(),
          description: locDesc(),
          parent_id: locParentId() ? parseInt(locParentId()) : null,
          index: locIndex(),
          label_scheme: locLabelScheme() || null
        })
      });
      setLocName("");
      setLocDesc("");
      setLocParentId("");
      setLocIndex(0);
      setLocLabelScheme("");
      loadData();
      toast.success("Storage location created successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create storage location.");
    }
  };

  const handleDeleteLocation = async (locId: number) => {
    const isConfirmed = await confirm({
      title: "Confirm Action",
      message: "Are you sure you want to delete this storage location? All sub-bins and drawers in this hierarchy will also be deleted!",
      confirmText: "Proceed",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/locations/${locId}`, { method: "DELETE" });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete location.");
    }
  };

  const getParentLocationName = (parentId: number | null) => {
    if (!parentId) return "";
    const parent = locations().find(l => l.id === parentId);
    return parent ? parent.name : "";
  };

  return (
    <div class="space-y-6">
      {/* Page Header */}
      <div>
        <h2 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <MapPin class="text-accentCyan" />
          Storage Structure Designer
        </h2>
        <p class="text-gray-400 text-sm">Define storage drawers, cabinets, and bin hierarchy.</p>
      </div>

      {/* Selector Tabs */}
      <div class="flex border-b border-white/5 space-x-6 text-sm font-semibold mb-6">
        <button
          onClick={() => setActiveTab("locations")}
          class={`pb-3 border-b-2 px-1 transition-colors cursor-pointer border-accentCyan text-white`}
        >
          <span class="flex items-center gap-2">
            <MapPin size={16} />
            Storage Drawers & Bins Hierarchy
          </span>
        </button>
      </div>

      <Show when={loading()}>
        <div class="glass-panel p-8 rounded-2xl animate-pulse h-64"></div>
      </Show>

      <Show when={!loading()}>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 1 Col: Storage creation */}
          <div class="glass-panel rounded-2xl p-6 border border-white/5 h-fit">
            <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Plus size={16} class="text-accentCyan" />
              Add Storage Slot
            </h3>
            
            <form onSubmit={handleCreateLocation} class="space-y-4 text-xs">
              <div>
                <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Bin / Drawer Name</label>
                <input
                  type="text"
                  required
                  value={locName()}
                  onInput={(e) => setLocName(e.target.value)}
                  placeholder="E.g. Drawer 1, Drawer 2 - ICs, Slot A1"
                  class="glass-input w-full text-xs"
                />
              </div>
              
              <div>
                <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Description</label>
                <input
                  type="text"
                  value={locDesc()}
                  onInput={(e) => setLocDesc(e.target.value)}
                  placeholder="E.g. top shelf, bin organizer code..."
                  class="glass-input w-full text-xs"
                />
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Grid Index</label>
                  <input
                    type="number"
                    value={locIndex()}
                    onInput={(e) => setLocIndex(parseInt(e.target.value) || 0)}
                    class="glass-input w-full text-xs"
                    min="0"
                  />
                </div>
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Label Scheme</label>
                  <input
                    type="text"
                    value={locLabelScheme()}
                    onInput={(e) => setLocLabelScheme(e.target.value)}
                    placeholder="E.g. row-col"
                    class="glass-input w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Parent Unit (Cabinet / Box)</label>
                <select
                  value={locParentId()}
                  onChange={(e) => setLocParentId(e.currentTarget.value)}
                  class="glass-input w-full text-xs"
                >
                  <option value="">No Parent (Cabinet Root)</option>
                  <For each={locations()}>
                    {(loc) => (
                      <option value={loc.id}>
                        {loc.name} {loc.parent_id ? `(under ${getParentLocationName(loc.parent_id)})` : ""}
                      </option>
                    )}
                  </For>
                </select>
                <p class="text-[9px] text-gray-500 mt-1">Allows building multi-layered bin layouts.</p>
              </div>

              <button type="submit" class="btn-primary w-full py-2.5">
                Save Storage Slot
              </button>
            </form>
          </div>

          {/* Right 2 Cols: Storage Tree */}
          <div class="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
            <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={16} class="text-accentCyan" />
              Storage Drawers Tree
            </h3>
            
            <Show when={locations().length === 0}>
              <div class="text-center py-10 text-xs text-gray-500">
                No storage slots designed yet. Define one on the left.
              </div>
            </Show>

            <Show when={locations().length > 0}>
              <div class="space-y-2 text-xs">
                <For each={locations()}>
                  {(loc) => {
                    let depth = 0;
                    let currentParentId = loc.parent_id;
                    while (currentParentId) {
                      depth++;
                      const parent = locations().find(l => l.id === currentParentId);
                      currentParentId = parent ? parent.parent_id : null;
                    }
                    
                    return (
                      <div 
                        style={{ "margin-left": `${depth * 20}px` }}
                        class="glass-card p-3.5 rounded-xl border border-white/5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div class="flex items-center gap-2">
                          <span class="text-accentCyan shrink-0">
                            {depth > 0 ? <Layers size={14} class="opacity-60" /> : <MapPin size={14} />}
                          </span>
                          <div>
                            <span class="font-bold text-white">{loc.name}</span>
                            <Show when={loc.label_scheme}>
                              <span class="bg-white/5 text-[9px] border border-white/5 px-1.5 py-0.5 rounded font-mono ml-2 uppercase text-gray-400">
                                Format: {loc.label_scheme}
                              </span>
                            </Show>
                            <span class="text-gray-500 block text-[10px] mt-0.5">{loc.description || "No description."}</span>
                          </div>
                        </div>

                        <div class="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setActivePrintLocation({ id: loc.id, name: loc.name, description: loc.description })}
                            class="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Print Reference Tag"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteLocation(loc.id)}
                            class="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/5 rounded transition-colors"
                            title="Delete Location"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Label Print Modal */}
      <LabelPreviewModal
        location={activePrintLocation()}
        onClose={() => setActivePrintLocation(null)}
      />
    </div>
  );
}
