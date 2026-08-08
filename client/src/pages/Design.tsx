import { createSignal, onMount, For, Show } from "solid-js";
import { 
  FolderTree, 
  Tag, 
  MapPin, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  Layers
} from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";

export default function Design() {
  const [activeTab, setActiveTab] = createSignal<"categories" | "locations">("categories");
  const [categories, setCategories] = createSignal<any[]>([]);
  const [locations, setLocations] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Category Form State
  const [catTitle, setCatTitle] = createSignal("");
  const [catDesignator, setCatDesignator] = createSignal("");
  const [catParentId, setCatParentId] = createSignal("");
  
  // Storage Location Form State
  const [locName, setLocName] = createSignal("");
  const [locDesc, setLocDesc] = createSignal("");
  const [locParentId, setLocParentId] = createSignal("");
  const [locIndex, setLocIndex] = createSignal(0);
  const [locLabelScheme, setLocLabelScheme] = createSignal("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, locs] = await Promise.all([
        apiFetch("/categories"),
        apiFetch("/locations?flat=true")
      ]);
      setCategories(cats);
      setLocations(locs);
    } catch (err) {
      console.error("Failed to load design structures:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  const handleCreateCategory = async (e: Event) => {
    e.preventDefault();
    if (!catTitle()) return;
    try {
      await apiFetch("/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: catTitle(), 
          designator: catDesignator() || null,
          parent_id: catParentId() ? parseInt(catParentId()) : null
        })
      });
      setCatTitle("");
      setCatDesignator("");
      setCatParentId("");
      loadData();
      alert("Category created successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to create category.");
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    if (!confirm("Are you sure you want to delete this category? Any subcategories or parts attached will have catalog references deleted.")) return;
    try {
      await apiFetch(`/categories/${catId}`, { method: "DELETE" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete category.");
    }
  };

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
      alert("Storage location created successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to create storage location.");
    }
  };

  const handleDeleteLocation = async (locId: number) => {
    if (!confirm("Are you sure you want to delete this storage location? All sub-bins and drawers in this hierarchy will also be deleted!")) return;
    try {
      await apiFetch(`/locations/${locId}`, { method: "DELETE" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete location.");
    }
  };

  // Helper to resolve parents
  const getParentCategoryName = (parentId: number | null) => {
    if (!parentId) return "";
    const parent = categories().find(c => c.id === parentId);
    return parent ? parent.title : "";
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
          <FolderTree class="text-accentCyan" />
          Component Structure Designer
        </h2>
        <p class="text-gray-400 text-sm">Define dynamic component categories, silkscreen designators, and storage drawers.</p>
      </div>

      {/* Selector Tabs */}
      <div class="flex border-b border-white/5 space-x-6 text-sm font-semibold mb-6">
        <button
          onClick={() => setActiveTab("categories")}
          class={`pb-3 border-b-2 px-1 transition-colors cursor-pointer ${
            activeTab() === "categories" ? "border-accentCyan text-white" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <span class="flex items-center gap-2">
            <Tag size={16} />
            Categories & Reference Designators
          </span>
        </button>
        <button
          onClick={() => setActiveTab("locations")}
          class={`pb-3 border-b-2 px-1 transition-colors cursor-pointer ${
            activeTab() === "locations" ? "border-accentCyan text-white" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
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
          
          {/* ----------------- CATEGORIES PANEL ----------------- */}
          <Show when={activeTab() === "categories"}>
            {/* Left 1 Col: Category creation */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 h-fit">
              <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Plus size={16} class="text-accentCyan" />
                Add Category
              </h3>
              
              <form onSubmit={handleCreateCategory} class="space-y-4 text-xs">
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Category Name</label>
                  <input
                    type="text"
                    required
                    value={catTitle()}
                    onInput={(e) => setCatTitle(e.target.value)}
                    placeholder="E.g. Resistors, Capacitors, Passives"
                    class="glass-input w-full text-xs"
                  />
                </div>
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Silkscreen Designator Prefix (Optional)</label>
                  <input
                    type="text"
                    value={catDesignator()}
                    onInput={(e) => setCatDesignator(e.target.value)}
                    placeholder="E.g. R, C, U, Q"
                    class="glass-input w-full text-xs font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Parent Category (Optional)</label>
                  <select
                    value={catParentId()}
                    onChange={(e) => setCatParentId(e.currentTarget.value)}
                    class="glass-input w-full text-xs"
                  >
                    <option value="">No Parent (Top Level)</option>
                    <For each={categories()}>
                      {(c) => <option value={c.id}>{c.title}</option>}
                    </For>
                  </select>
                </div>
                <button type="submit" class="btn-primary w-full py-2.5">
                  Save Category
                </button>
              </form>
            </div>

            {/* Right 2 Cols: Category Listing Indented Tree */}
            <div class="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Tag size={16} class="text-accentCyan" />
                Category Classifications
              </h3>
              
              <Show when={categories().length === 0}>
                <div class="text-center py-10 text-xs text-gray-500">
                  No categories designed yet. Define one on the left.
                </div>
              </Show>

              <Show when={categories().length > 0}>
                <div class="space-y-2 text-xs">
                  <For each={categories()}>
                    {(cat) => {
                      // Calculate depth
                      let depth = 0;
                      let currentParentId = cat.parent_id;
                      while (currentParentId) {
                        depth++;
                        const parent = categories().find(c => c.id === currentParentId);
                        currentParentId = parent ? parent.parent_id : null;
                      }

                      return (
                        <div 
                          style={{ "margin-left": `${depth * 20}px` }}
                          class="glass-card p-3.5 rounded-xl border border-white/5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div class="flex items-center gap-2">
                            <span class="text-accentCyan shrink-0">
                              <Tag size={14} class={depth > 0 ? "opacity-60" : ""} />
                            </span>
                            <div>
                              <span class="font-bold text-white text-sm">{cat.title}</span>
                              <Show when={cat.designator}>
                                <span class="bg-accentCyan/10 border border-accentCyan/20 text-accentCyan text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono ml-2 uppercase">
                                  Prefix: {cat.designator}
                                </span>
                              </Show>
                              <Show when={cat.parent_id}>
                                <span class="text-gray-500 text-[10px] block mt-0.5">
                                  under {getParentCategoryName(cat.parent_id)}
                                </span>
                              </Show>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            class="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/5 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          {/* ----------------- LOCATIONS (STORAGE) PANEL ----------------- */}
          <Show when={activeTab() === "locations"}>
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

                          <button
                            onClick={() => handleDeleteLocation(loc.id)}
                            class="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/5 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

        </div>
      </Show>
    </div>
  );
}
