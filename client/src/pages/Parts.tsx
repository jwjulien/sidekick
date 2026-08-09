import { createSignal, onMount, For, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { 
  Search, 
  Filter, 
  Plus, 
  Tag, 
  MapPin, 
  AlertTriangle,
  FolderOpen,
  X,
  Trash2
} from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";
import toast from "solid-toast";
import { useConfirm } from "../contexts/ConfirmContext";

export default function Parts() {
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [parts, setParts] = createSignal<any[]>([]);
  const [categories, setCategories] = createSignal<any[]>([]);
  const [locations, setLocations] = createSignal<any[]>([]);
  
  const [search, setSearch] = createSignal("");
  const [selectedCat, setSelectedCat] = createSignal("");
  const [selectedLoc, setSelectedLoc] = createSignal("");
  const [filterLowStock, setFilterLowStock] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  
  // Advanced Dynamic Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = createSignal(false);
  const [dynamicFilters, setDynamicFilters] = createSignal<Array<{key: string, value: string}>>([]);

  // Add Part Modal state
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [newPartValue, setNewPartValue] = createSignal("");
  const [newPartNumber, setNewPartNumber] = createSignal("");
  const [newPartPackage, setNewPartPackage] = createSignal("");
  const [newPartPrice, setNewPartPrice] = createSignal(0);
  const [newPartWeight, setNewPartWeight] = createSignal(0);
  const [newPartMinQty, setNewPartMinQty] = createSignal(5);
  const [newPartCat, setNewPartCat] = createSignal("");
  const [newPartNotes, setNewPartNotes] = createSignal("");
  
  // Dynamic Attributes State
  const [attributes, setAttributes] = createSignal<Array<{key: string, value: string}>>([]);
  
  const [submitting, setSubmitting] = createSignal(false);

  const fetchFilters = async () => {
    try {
      const [cats, locs] = await Promise.all([
        apiFetch("/categories"),
        apiFetch("/locations?flat=true")
      ]);
      setCategories(cats);
      setLocations(locs);
    } catch (err) {
      console.error("Failed to load filters:", err);
    }
  };

  const fetchParts = async () => {
    setLoading(true);
    try {
      let queryParams: string[] = [];
      if (search()) queryParams.push(`q=${encodeURIComponent(search())}`);
      if (selectedCat()) queryParams.push(`category_id=${selectedCat()}`);
      if (selectedLoc()) queryParams.push(`location_id=${selectedLoc()}`);
      if (filterLowStock()) queryParams.push(`low_stock=true`);
      
      // Add dynamic JSON attribute filters
      dynamicFilters().forEach(filter => {
        if (filter.key && filter.value) {
          queryParams.push(`attr_${encodeURIComponent(filter.key)}=${encodeURIComponent(filter.value)}`);
        }
      });
      
      const queryStr = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
      const data = await apiFetch(`/parts${queryStr}`);
      setParts(data);
    } catch (err) {
      console.error("Failed to fetch parts:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchFilters();
    fetchParts();
  });

  const handleSearchTrigger = (e: Event) => {
    e.preventDefault();
    fetchParts();
  };

  const addDynamicFilter = () => {
    setDynamicFilters([...dynamicFilters(), { key: "", value: "" }]);
  };

  const updateDynamicFilter = (index: number, field: "key" | "value", val: string) => {
    const filters = [...dynamicFilters()];
    filters[index][field] = val;
    setDynamicFilters(filters);
  };

  const removeDynamicFilter = (index: number) => {
    const filters = [...dynamicFilters()];
    filters.splice(index, 1);
    setDynamicFilters(filters);
  };

  const addAttribute = () => {
    setAttributes([...attributes(), { key: "", value: "" }]);
  };

  const updateAttribute = (index: number, field: "key" | "value", val: string) => {
    const attrs = [...attributes()];
    attrs[index][field] = val;
    setAttributes(attrs);
  };

  const removeAttribute = (index: number) => {
    const attrs = [...attributes()];
    attrs.splice(index, 1);
    setAttributes(attrs);
  };

  const handleCreatePart = async (e: Event) => {
    e.preventDefault();
    if (!newPartValue() || !newPartNumber() || !newPartCat()) {
      toast.error("Value, Part Number, and Category are required.");
      return;
    }
    
    setSubmitting(true);
    try {
      // Serialize attributes into an object map
      const attributesObj: Record<string, string> = {};
      attributes().forEach(attr => {
        if (attr.key.trim() !== "") {
          attributesObj[attr.key.trim()] = attr.value.trim();
        }
      });

      const payload = {
        category_id: newPartCat(),
        value: newPartValue(),
        number: newPartNumber(),
        package: newPartPackage() || null,
        price: newPartPrice() || 0.0,
        weight: newPartWeight() || 0.0,
        threshold: newPartMinQty(),
        notes: newPartNotes(),
        attributes: attributesObj
      };
      
      await apiFetch("/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Clear form
      setNewPartValue("");
      setNewPartNumber("");
      setNewPartPackage("");
      setNewPartPrice(0);
      setNewPartWeight(0);
      setNewPartMinQty(5);
      setNewPartCat("");
      setNewPartNotes("");
      setAttributes([]);
      
      setShowAddModal(false);
      fetchParts();
      toast.success("Part created successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create part.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="space-y-6">
      {/* View Header */}
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-white tracking-tight">Parts Catalog</h2>
          <p class="text-gray-400 text-sm">Browse, search, filter, and track components in stock.</p>
        </div>
        
        {/* Create Button */}
        <Show when={user()?.role === "admin" || user()?.role === "stocker" || user()?.role === "designer"}>
          <button
            onClick={() => setShowAddModal(true)}
            class="btn-primary flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Add New Part
          </button>
        </Show>
      </div>

      {/* ----------------- SEARCH & FILTERS BAR ----------------- */}
      <form onSubmit={handleSearchTrigger} class="glass-panel rounded-2xl p-5 border border-white/5 space-y-4">
        <div class="flex flex-col md:flex-row gap-3">
          <div class="flex-1 relative">
            <input
              type="text"
              value={search()}
              onInput={(e) => setSearch(e.target.value)}
              placeholder="Search by value, part number, package, description..."
              class="glass-input w-full pl-10"
            />
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          </div>
          
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters())}
            class={`btn-secondary px-4 font-semibold flex items-center justify-center gap-2 ${showAdvancedFilters() ? 'bg-white/10' : ''}`}
          >
            <Filter size={16} />
            Advanced
          </button>
          
          <button
            type="submit"
            class="btn-primary px-6 font-semibold flex items-center justify-center gap-2"
          >
            Apply Filters
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Category</label>
            <select
              value={selectedCat()}
              onChange={(e) => setSelectedCat(e.currentTarget.value)}
              class="glass-input w-full text-xs"
            >
              <option value="">All Categories</option>
              <For each={categories()}>
                {(cat) => <option value={cat.id}>{cat.title}</option>}
              </For>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Location</label>
            <select
              value={selectedLoc()}
              onChange={(e) => setSelectedLoc(e.currentTarget.value)}
              class="glass-input w-full text-xs"
            >
              <option value="">All Locations</option>
              <For each={locations()}>
                {(loc) => <option value={loc.id}>{loc.name}</option>}
              </For>
            </select>
          </div>

          <div class="flex items-end pb-1.5">
            <label class="flex items-center gap-2 text-xs text-gray-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={filterLowStock()}
                onChange={(e) => setFilterLowStock(e.currentTarget.checked)}
                class="w-4 h-4 accent-accentCyan rounded"
              />
              Show Low Stock Warnings Only
            </label>
          </div>
        </div>
        
        {/* Advanced Filters Drawer */}
        <Show when={showAdvancedFilters()}>
          <div class="pt-4 border-t border-white/5 space-y-3">
            <div class="flex justify-between items-center">
              <h4 class="text-xs font-semibold text-gray-400 uppercase">Dynamic Attributes</h4>
              <button
                type="button"
                onClick={addDynamicFilter}
                class="text-xs text-accentCyan hover:text-white flex items-center gap-1"
              >
                <Plus size={12} /> Add Filter Rule
              </button>
            </div>
            
            <For each={dynamicFilters()}>
              {(filter, index) => (
                <div class="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Attribute Key (e.g., Tolerance)"
                    value={filter.key}
                    onInput={(e) => updateDynamicFilter(index(), "key", e.currentTarget.value)}
                    class="glass-input text-xs w-1/3"
                  />
                  <span class="text-xs text-gray-500">=</span>
                  <input
                    type="text"
                    placeholder="Value (e.g., 1%)"
                    value={filter.value}
                    onInput={(e) => updateDynamicFilter(index(), "value", e.currentTarget.value)}
                    class="glass-input text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeDynamicFilter(index())}
                    class="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </For>
            <Show when={dynamicFilters().length === 0}>
              <p class="text-xs text-gray-500 italic">No dynamic filters applied.</p>
            </Show>
          </div>
        </Show>
      </form>

      {/* ----------------- PARTS LIST ----------------- */}
      <Show when={loading()}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="h-44 bg-white/5 rounded-2xl animate-pulse"></div>
          <div class="h-44 bg-white/5 rounded-2xl animate-pulse"></div>
          <div class="h-44 bg-white/5 rounded-2xl animate-pulse"></div>
        </div>
      </Show>

      <Show when={!loading() && parts().length === 0}>
        <div class="text-center py-20 text-gray-500 bg-white/[0.01] rounded-2xl border border-dashed border-white/5">
          <FolderOpen size={48} class="mx-auto mb-4 text-gray-600" />
          <h3 class="font-bold text-white mb-1">No parts found</h3>
          <p class="text-sm">Try adjusting your filters or search keywords.</p>
        </div>
      </Show>

      <Show when={!loading() && parts().length > 0}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={parts()}>
            {(part) => {
              const isAlert = part.total_quantity < part.threshold;
              return (
                <div 
                  onClick={() => navigate(`/parts/${part.id}`)}
                  class={`glass-card glass-card-hover p-6 rounded-2xl flex flex-col justify-between h-48 cursor-pointer relative ${
                    isAlert ? "border-amber-500/20 bg-amber-500/[0.01]" : ""
                  }`}
                >
                  <div>
                    <div class="flex justify-between items-start gap-2">
                      <h3 class="font-bold text-white text-base truncate group-hover:text-accentCyan transition-colors">
                        {part.value}
                      </h3>
                      <Show when={isAlert}>
                        <span class="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                          <AlertTriangle size={10} />
                          Low
                        </span>
                      </Show>
                    </div>
                    <div class="text-[11px] font-mono text-gray-400 mt-1 truncate">{part.number}</div>
                    <p class="text-gray-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                      {part.notes || "No description provided."}
                    </p>
                  </div>

                  <div class="border-t border-white/5 pt-4 flex justify-between items-center text-xs">
                    <div class="space-y-1">
                      <div class="flex items-center gap-1 text-[11px] text-gray-500">
                        <Tag size={12} />
                        <span class="truncate max-w-[100px]">{part.category?.title || "Uncategorized"}</span>
                      </div>
                      <div class="flex items-center gap-1 text-[11px] text-gray-500">
                        <MapPin size={12} />
                        <span class="truncate max-w-[100px]">{part.package || "No package"}</span>
                      </div>
                    </div>

                    <div class="text-right">
                      <span class="text-[10px] text-gray-500 uppercase font-semibold">In Stock</span>
                      <div class={`text-lg font-bold ${isAlert ? "text-amber-400" : "text-accentCyan"}`}>
                        {part.total_quantity}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      </Show>

      {/* ----------------- CREATE PART DIALOG MODAL ----------------- */}
      <Show when={showAddModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div class="glass-panel max-w-2xl w-full rounded-2xl p-6 border border-white/10 relative my-8">
            <button 
              onClick={() => setShowAddModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 class="text-xl font-bold text-white mb-2">Create New Part</h3>
            <p class="text-xs text-gray-400 mb-6">Define a core component and its attributes.</p>

            <form onSubmit={handleCreatePart} class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Value / Name *</label>
                  <input
                    type="text"
                    required
                    value={newPartValue()}
                    onInput={(e) => setNewPartValue(e.target.value)}
                    placeholder="e.g. 10k Ohm"
                    class="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Manufacturer Part No *</label>
                  <input
                    type="text"
                    required
                    value={newPartNumber()}
                    onInput={(e) => setNewPartNumber(e.target.value)}
                    placeholder="e.g. ERJ-6GEYJ103V"
                    class="glass-input w-full text-sm font-mono"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Category *</label>
                  <select
                    required
                    value={newPartCat()}
                    onChange={(e) => setNewPartCat(e.currentTarget.value)}
                    class="glass-input w-full text-sm"
                  >
                    <option value="" disabled>Select a category...</option>
                    <For each={categories()}>
                      {(cat) => <option value={cat.id}>{cat.title}</option>}
                    </For>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Package / Footprint</label>
                  <input
                    type="text"
                    value={newPartPackage()}
                    onInput={(e) => setNewPartPackage(e.target.value)}
                    placeholder="e.g. 0805"
                    class="glass-input w-full text-sm"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Price (USD)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newPartPrice()}
                    onInput={(e) => setNewPartPrice(parseFloat(e.target.value))}
                    class="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newPartWeight()}
                    onInput={(e) => setNewPartWeight(parseFloat(e.target.value))}
                    class="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Min Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={newPartMinQty()}
                    onInput={(e) => setNewPartMinQty(parseInt(e.target.value) || 0)}
                    class="glass-input w-full text-sm"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Notes / Description</label>
                <textarea
                  value={newPartNotes()}
                  onInput={(e) => setNewPartNotes(e.target.value)}
                  placeholder="Additional component details..."
                  class="glass-input w-full text-sm min-h-[80px]"
                ></textarea>
              </div>
              
              {/* Dynamic Attributes Builder */}
              <div class="pt-4 border-t border-white/5 space-y-3">
                <div class="flex justify-between items-center">
                  <h4 class="text-xs font-bold text-white uppercase">Custom Attributes</h4>
                  <button
                    type="button"
                    onClick={addAttribute}
                    class="text-xs text-accentCyan hover:text-white flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Attribute
                  </button>
                </div>
                <p class="text-[10px] text-gray-500">Define dynamic Key/Value pairs like Tolerance, Voltage, or Thread Pitch.</p>
                
                <For each={attributes()}>
                  {(attr, index) => (
                    <div class="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Key (e.g. Tolerance)"
                        value={attr.key}
                        onInput={(e) => updateAttribute(index(), "key", e.currentTarget.value)}
                        class="glass-input text-xs w-1/3"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. 1%)"
                        value={attr.value}
                        onInput={(e) => updateAttribute(index(), "value", e.currentTarget.value)}
                        class="glass-input text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttribute(index())}
                        class="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </For>
              </div>

              <div class="flex justify-end pt-4 border-t border-white/10 gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  class="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting()}
                  class="btn-primary flex items-center justify-center gap-2 min-w-[120px]"
                >
                  {submitting() ? (
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "Save Part"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
