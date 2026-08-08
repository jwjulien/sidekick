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
  X
} from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";
import toast from "solid-toast";
import { useConfirm } from "../contexts/ConfirmContext";

export default function Inventory() {
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [items, setItems] = createSignal<any[]>([]);
  const [categories, setCategories] = createSignal<any[]>([]);
  const [locations, setLocations] = createSignal<any[]>([]);
  
  const [search, setSearch] = createSignal("");
  const [selectedCat, setSelectedCat] = createSignal("");
  const [selectedLoc, setSelectedLoc] = createSignal("");
  const [filterLowStock, setFilterLowStock] = createSignal(false);
  const [loading, setLoading] = createSignal(true);

  // Add Item Modal state
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [newItemName, setNewItemName] = createSignal("");
  const [newItemDesc, setNewItemDesc] = createSignal("");
  const [newItemSku, setNewItemSku] = createSignal("");
  const [newItemBarcode, setNewItemBarcode] = createSignal("");
  const [newItemQty, setNewItemQty] = createSignal(0);
  const [newItemMinQty, setNewItemMinQty] = createSignal(5);
  const [newItemCat, setNewItemCat] = createSignal("");
  const [newItemLoc, setNewItemLoc] = createSignal("");
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

  const fetchItems = async () => {
    setLoading(true);
    try {
      let queryParams: string[] = [];
      if (search()) queryParams.push(`q=${encodeURIComponent(search())}`);
      if (selectedCat()) queryParams.push(`category_id=${selectedCat()}`);
      if (selectedLoc()) queryParams.push(`location_id=${selectedLoc()}`);
      if (filterLowStock()) queryParams.push(`low_stock=true`);
      
      const queryStr = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
      const data = await apiFetch(`/items${queryStr}`);
      setItems(data);
    } catch (err) {
      console.error("Failed to fetch items:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchFilters();
    fetchItems();
  });

  const handleSearchTrigger = (e: Event) => {
    e.preventDefault();
    fetchItems();
  };

  const handleCreateItem = async (e: Event) => {
    e.preventDefault();
    if (!newItemName()) {
      toast.error("Name is required.");
      return;
    }
    
    setSubmitting(true);
    try {
      const payload = {
        name: newItemName(),
        description: newItemDesc(),
        sku: newItemSku() || null,
        barcode: newItemBarcode() || null,
        quantity: newItemQty(),
        min_quantity_alert: newItemMinQty(),
        category_id: newItemCat() ? parseInt(newItemCat()) : null,
        location_id: newItemLoc() ? parseInt(newItemLoc()) : null,
        custom_values: []
      };
      
      await apiFetch("/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Clear form
      setNewItemName("");
      setNewItemDesc("");
      setNewItemSku("");
      setNewItemBarcode("");
      setNewItemQty(0);
      setNewItemMinQty(5);
      setNewItemCat("");
      setNewItemLoc("");
      
      setShowAddModal(false);
      fetchItems();
      toast.success("Item created successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="space-y-6">
      {/* View Header */}
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-white tracking-tight">Inventory Catalog</h2>
          <p class="text-gray-400 text-sm">Browse, search, filter, and track items in stock.</p>
        </div>
        
        {/* Create Button */}
        <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
          <button
            onClick={() => setShowAddModal(true)}
            class="btn-primary flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Add New Item
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
              placeholder="Search by name, SKU, description, barcode..."
              class="glass-input w-full pl-10"
            />
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          </div>
          
          <button
            type="submit"
            class="btn-secondary px-6 font-semibold flex items-center justify-center gap-2"
          >
            <Filter size={16} />
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
      </form>

      {/* ----------------- ITEMS LIST ----------------- */}
      <Show when={loading()}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="h-44 bg-white/5 rounded-2xl animate-pulse"></div>
          <div class="h-44 bg-white/5 rounded-2xl animate-pulse"></div>
          <div class="h-44 bg-white/5 rounded-2xl animate-pulse"></div>
        </div>
      </Show>

      <Show when={!loading() && items().length === 0}>
        <div class="text-center py-20 text-gray-500 bg-white/[0.01] rounded-2xl border border-dashed border-white/5">
          <FolderOpen size={48} class="mx-auto mb-4 text-gray-600" />
          <h3 class="font-bold text-white mb-1">No items found</h3>
          <p class="text-sm">Try adjusting your filters or search keywords.</p>
        </div>
      </Show>

      <Show when={!loading() && items().length > 0}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={items()}>
            {(item) => {
              const isAlert = item.total_quantity < item.threshold;
              return (
                <div 
                  onClick={() => navigate(`/inventory/item/${item.id}`)}
                  class={`glass-card glass-card-hover p-6 rounded-2xl flex flex-col justify-between h-48 cursor-pointer relative ${
                    isAlert ? "border-amber-500/20 bg-amber-500/[0.01]" : ""
                  }`}
                >
                  <div>
                    <div class="flex justify-between items-start gap-2">
                      <h3 class="font-bold text-white text-base truncate group-hover:text-accentCyan transition-colors">
                        {item.value}
                      </h3>
                      <Show when={isAlert}>
                        <span class="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                          <AlertTriangle size={10} />
                          Low
                        </span>
                      </Show>
                    </div>
                    <div class="text-[11px] font-mono text-gray-400 mt-1 truncate">{item.number}</div>
                    <p class="text-gray-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                      {item.notes || "No description provided."}
                    </p>
                  </div>

                  <div class="border-t border-white/5 pt-4 flex justify-between items-center text-xs">
                    <div class="space-y-1">
                      <div class="flex items-center gap-1 text-[11px] text-gray-500">
                        <Tag size={12} />
                        <span class="truncate max-w-[100px]">{item.category?.title || "Uncategorized"}</span>
                      </div>
                      <div class="flex items-center gap-1 text-[11px] text-gray-500">
                        <MapPin size={12} />
                        <span class="truncate max-w-[100px]">{item.package || "No package"}</span>
                      </div>
                    </div>

                    <div class="text-right">
                      <span class="text-[10px] text-gray-500 uppercase font-semibold">In Stock</span>
                      <div class={`text-lg font-bold ${isAlert ? "text-amber-400" : "text-accentCyan"}`}>
                        {item.total_quantity}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      </Show>

      {/* ----------------- CREATE ITEM DIALOG MODAL ----------------- */}
      <Show when={showAddModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div class="glass-panel max-w-lg w-full rounded-2xl p-6 border border-white/10 relative my-8">
            <button 
              onClick={() => setShowAddModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 class="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Plus class="text-accentCyan" size={20} />
              Add Component Part
            </h3>
            
            <form onSubmit={handleCreateItem} class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Component Value / Name</label>
                  <input
                    type="text"
                    required
                    value={newItemName()}
                    onInput={(e) => setNewItemName(e.target.value)}
                    placeholder="E.g. 10k Ohm, 100nF, STM32F103C8T6"
                    class="glass-input w-full text-sm"
                  />
                </div>
                
                <div class="sm:col-span-2">
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Description</label>
                  <textarea
                    value={newItemDesc()}
                    onInput={(e) => setNewItemDesc(e.target.value)}
                    placeholder="Details about product characteristics, specs..."
                    class="glass-input w-full text-sm h-20 resize-none"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">SKU / Model Number</label>
                  <input
                    type="text"
                    value={newItemSku()}
                    onInput={(e) => setNewItemSku(e.target.value)}
                    placeholder="E.g. SLS-DGT-XYZ"
                    class="glass-input w-full text-xs"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Barcode Value</label>
                  <input
                    type="text"
                    value={newItemBarcode()}
                    onInput={(e) => setNewItemBarcode(e.target.value)}
                    placeholder="E.g. EAN / UPC Code"
                    class="glass-input w-full text-xs"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Initial Quantity</label>
                  <input
                    type="number"
                    value={newItemQty()}
                    onInput={(e) => setNewItemQty(parseInt(e.target.value) || 0)}
                    class="glass-input w-full text-sm"
                    min="0"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Low Stock Alert Min</label>
                  <input
                    type="number"
                    value={newItemMinQty()}
                    onInput={(e) => setNewItemMinQty(parseInt(e.target.value) || 0)}
                    class="glass-input w-full text-sm"
                    min="0"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Category</label>
                  <select
                    value={newItemCat()}
                    onChange={(e) => setNewItemCat(e.currentTarget.value)}
                    class="glass-input w-full text-xs"
                  >
                    <option value="">Select Category...</option>
                    <For each={categories()}>
                      {(c) => <option value={c.id}>{c.title}</option>}
                    </For>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Location</label>
                  <select
                    value={newItemLoc()}
                    onChange={(e) => setNewItemLoc(e.currentTarget.value)}
                    class="glass-input w-full text-xs"
                  >
                    <option value="">Select Location...</option>
                    <For each={locations()}>
                      {(l) => <option value={l.id}>{l.name}</option>}
                    </For>
                  </select>
                </div>
              </div>
              
              <div class="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting()}
                  class="btn-primary flex-1"
                >
                  {submitting() ? "Creating..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
