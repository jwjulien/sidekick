import { createSignal, onMount, For, Show } from "solid-js";
import { 
  FolderTree, 
  Tag, 
  MapPin, 
  Plus, 
  Trash2, 
  LayoutGrid, 
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
  const [catName, setCatName] = createSignal("");
  const [catDesc, setCatDesc] = createSignal("");
  
  // Custom Field Form State
  const [expandedCatId, setExpandedCatId] = createSignal<number | null>(null);
  const [fieldName, setFieldName] = createSignal("");
  const [fieldType, setFieldType] = createSignal("text");

  // Location Form State
  const [locName, setLocName] = createSignal("");
  const [locDesc, setLocDesc] = createSignal("");
  const [locParentId, setLocParentId] = createSignal("");

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
    if (!catName()) return;
    try {
      await apiFetch("/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName(), description: catDesc() })
      });
      setCatName("");
      setCatDesc("");
      loadData();
      alert("Category created successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to create category.");
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    if (!confirm("Are you sure you want to delete this category? All dynamic custom field definitions will be deleted.")) return;
    try {
      await apiFetch(`/categories/${catId}`, { method: "DELETE" });
      if (expandedCatId() === catId) setExpandedCatId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete category.");
    }
  };

  const handleToggleExpandCategory = async (catId: number) => {
    if (expandedCatId() === catId) {
      setExpandedCatId(null);
      return;
    }
    
    // Fetch detailed category with custom fields
    try {
      const details = await apiFetch(`/categories/${catId}`);
      // Update that category in list
      setCategories(categories().map(c => c.id === catId ? details : c));
      setExpandedCatId(catId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCustomField = async (e: Event, catId: number) => {
    e.preventDefault();
    if (!fieldName()) return;
    try {
      await apiFetch(`/categories/${catId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fieldName(), field_type: fieldType() })
      });
      setFieldName("");
      
      // Reload this expanded category
      const details = await apiFetch(`/categories/${catId}`);
      setCategories(categories().map(c => c.id === catId ? details : c));
      alert("Custom field added successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to add custom field.");
    }
  };

  const handleDeleteCustomField = async (fieldId: number, catId: number) => {
    if (!confirm("Are you sure you want to delete this custom field? Existing values for all items in this category will be removed.")) return;
    try {
      await apiFetch(`/categories/fields/${fieldId}`, { method: "DELETE" });
      // Reload expanded category
      const details = await apiFetch(`/categories/${catId}`);
      setCategories(categories().map(c => c.id === catId ? details : c));
    } catch (err: any) {
      alert(err.message || "Failed to delete field.");
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
          parent_id: locParentId() ? parseInt(locParentId()) : null
        })
      });
      setLocName("");
      setLocDesc("");
      setLocParentId("");
      loadData();
      alert("Location created successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to create location.");
    }
  };

  const handleDeleteLocation = async (locId: number) => {
    if (!confirm("Are you sure you want to delete this location? All child locations in the hierarchy will also be deleted!")) return;
    try {
      await apiFetch(`/locations/${locId}`, { method: "DELETE" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete location.");
    }
  };

  // Helper to build location hierarchy labels for option dropdown
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
          Inventory Structure Designer
        </h2>
        <p class="text-gray-400 text-sm">Define dynamic categories, attributes, and hierarchical location paths.</p>
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
            Categories & Custom Attributes
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
            Storage Locations Hierarchy
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
                    value={catName()}
                    onInput={(e) => setCatName(e.target.value)}
                    placeholder="E.g. Electronics, Tools, Materials"
                    class="glass-input w-full text-xs"
                  />
                </div>
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Description</label>
                  <textarea
                    value={catDesc()}
                    onInput={(e) => setCatDesc(e.target.value)}
                    placeholder="Brief description of category items..."
                    class="glass-input w-full h-20 resize-none"
                  />
                </div>
                <button type="submit" class="btn-primary w-full py-2.5">
                  Save Category
                </button>
              </form>
            </div>

            {/* Right 2 Cols: Category Listing & Fields */}
            <div class="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Tag size={16} class="text-accentCyan" />
                Categories Configured
              </h3>
              
              <Show when={categories().length === 0}>
                <div class="text-center py-10 text-xs text-gray-500">
                  No categories designed yet. Define one on the left.
                </div>
              </Show>

              <Show when={categories().length > 0}>
                <div class="space-y-4">
                  <For each={categories()}>
                    {(cat) => {
                      const isExpanded = expandedCatId() === cat.id;
                      return (
                        <div class="glass-card rounded-xl border border-white/5 overflow-hidden">
                          {/* Accordion header */}
                          <div 
                            onClick={() => handleToggleExpandCategory(cat.id)}
                            class="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.01] transition-all"
                          >
                            <div>
                              <h4 class="font-bold text-white text-sm tracking-wide">{cat.name}</h4>
                              <p class="text-gray-400 text-xs mt-0.5">{cat.description || "No description."}</p>
                            </div>
                            
                            <div class="flex items-center gap-4">
                              <span class="bg-white/5 border border-white/5 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider text-gray-400">
                                {cat.custom_fields?.length || 0} fields
                              </span>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCategory(cat.id);
                                }}
                                class="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/5 rounded transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                              
                              <div class="text-gray-400 shrink-0">
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </div>
                            </div>
                          </div>

                          {/* Expanded content */}
                          <Show when={isExpanded}>
                            <div class="p-4 bg-white/[0.01] border-t border-white/5 text-xs space-y-4">
                              
                              {/* Custom Fields List */}
                              <div class="space-y-2">
                                <h5 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Defined Attributes</h5>
                                
                                <Show when={!cat.custom_fields || cat.custom_fields.length === 0}>
                                  <p class="text-gray-500 text-[11px] italic">No custom fields defined. Add one below.</p>
                                </Show>

                                <Show when={cat.custom_fields && cat.custom_fields.length > 0}>
                                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <For each={cat.custom_fields}>
                                      {(cf) => (
                                        <div class="glass-card p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs">
                                          <div>
                                            <span class="font-bold text-white">{cf.name}</span>
                                            <span class="text-[9px] bg-white/5 text-gray-400 px-1 py-0.5 rounded font-mono ml-2 uppercase">
                                              {cf.field_type}
                                            </span>
                                          </div>
                                          <button
                                            onClick={() => handleDeleteCustomField(cf.id, cat.id)}
                                            class="text-gray-600 hover:text-red-400 cursor-pointer"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      )}
                                    </For>
                                  </div>
                                </Show>
                              </div>

                              {/* Form to add custom field */}
                              <form onSubmit={(e) => handleAddCustomField(e, cat.id)} class="flex flex-col sm:flex-row gap-3 pt-3 border-t border-white/5 items-end">
                                <div class="flex-1 w-full">
                                  <label class="block text-[9px] font-semibold text-gray-500 mb-1 uppercase">Field Name</label>
                                  <input
                                    type="text"
                                    required
                                    value={fieldName()}
                                    onInput={(e) => setFieldName(e.target.value)}
                                    placeholder="E.g. Manufacturer, Voltage"
                                    class="glass-input w-full py-1.5 text-xs"
                                  />
                                </div>
                                <div class="w-full sm:w-40">
                                  <label class="block text-[9px] font-semibold text-gray-500 mb-1 uppercase">Field Type</label>
                                  <select
                                    value={fieldType()}
                                    onChange={(e) => setFieldType(e.currentTarget.value)}
                                    class="glass-input w-full py-1.5 text-xs"
                                  >
                                    <option value="text">Text / String</option>
                                    <option value="number">Number</option>
                                    <option value="date">Date</option>
                                    <option value="boolean">Checkbox / Boolean</option>
                                  </select>
                                </div>
                                <button type="submit" class="btn-secondary py-1.5 px-4 font-bold flex items-center gap-1">
                                  <Plus size={12} />
                                  Add Field
                                </button>
                              </form>

                            </div>
                          </Show>
                        </div>
                      )
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          {/* ----------------- LOCATIONS PANEL ----------------- */}
          <Show when={activeTab() === "locations"}>
            {/* Left 1 Col: Location creation */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 h-fit">
              <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Plus size={16} class="text-accentCyan" />
                Add Location
              </h3>
              
              <form onSubmit={handleCreateLocation} class="space-y-4 text-xs">
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Location Name</label>
                  <input
                    type="text"
                    required
                    value={locName()}
                    onInput={(e) => setLocName(e.target.value)}
                    placeholder="E.g. Workbench 1, Bin B"
                    class="glass-input w-full text-xs"
                  />
                </div>
                
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Description</label>
                  <input
                    type="text"
                    value={locDesc()}
                    onInput={(e) => setLocDesc(e.target.value)}
                    placeholder="E.g. Cabinet drawer, shelf code..."
                    class="glass-input w-full text-xs"
                  />
                </div>

                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Parent Location (Optional)</label>
                  <select
                    value={locParentId()}
                    onChange={(e) => setLocParentId(e.currentTarget.value)}
                    class="glass-input w-full text-xs"
                  >
                    <option value="">No Parent (Top Level)</option>
                    <For each={locations()}>
                      {(loc) => (
                        <option value={loc.id}>
                          {loc.name} {loc.parent_id ? `(under ${getParentLocationName(loc.parent_id)})` : ""}
                        </option>
                      )}
                    </For>
                  </select>
                  <p class="text-[9px] text-gray-500 mt-1">Allows building multi-layered location hierarchies.</p>
                </div>

                <button type="submit" class="btn-primary w-full py-2.5">
                  Save Location
                </button>
              </form>
            </div>

            {/* Right 2 Cols: Location Listing Indented Tree */}
            <div class="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={16} class="text-accentCyan" />
                Storage Locations Tree
              </h3>
              
              <Show when={locations().length === 0}>
                <div class="text-center py-10 text-xs text-gray-500">
                  No storage locations designed yet. Define one on the left.
                </div>
              </Show>

              <Show when={locations().length > 0}>
                <div class="space-y-2 text-xs">
                  {/* Indented listing helper */}
                  <For each={locations()}>
                    {(loc) => {
                      // Count depth
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
                              <span class="text-gray-400 block text-[10px] mt-0.5">{loc.description || "No description."}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteLocation(loc.id)}
                            class="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/5 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
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
