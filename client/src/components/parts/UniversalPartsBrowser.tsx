import { createSignal, createMemo, createEffect, Show, For, onMount } from "solid-js";
import {
  Package,
  Hash,
  AlertTriangle,
  Search,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  Tag
} from "lucide-solid";
import { apiFetch } from "../../hooks/useAuth";

export interface UniversalPartsBrowserProps {
  parts?: any[]; // Input array of parts (if passed, operates in client-side mode)
  locationId?: string;
  categoryId?: string;
  unassignedOnly?: boolean;
  lowStockOnly?: boolean;
  mode?: "table" | "grid" | "picker";
  selectionMode?: "none" | "single" | "multiple";
  selectedPartIds?: string[];
  title?: string;
  showToolbar?: boolean;
  loading?: boolean;
  onSelectPart?: (part: any) => void;
  onBulkSelect?: (parts: any[]) => void;
  onAutoSelect?: (part: any) => void;
  customActions?: (part: any) => any;
}

export default function UniversalPartsBrowser(props: UniversalPartsBrowserProps) {
  const [remoteParts, setRemoteParts] = createSignal<any[]>([]);
  const [remoteLoading, setRemoteLoading] = createSignal(false);
  const [categories, setCategories] = createSignal<any[]>([]);

  // State for search, filter, sort
  const [search, setSearch] = createSignal("");
  const [selectedCat, setSelectedCat] = createSignal(props.categoryId || "");
  const [filterLowStock, setFilterLowStock] = createSignal(props.lowStockOnly || false);
  const [filterUnassigned] = createSignal(props.unassignedOnly || false);
  const [viewMode, setViewMode] = createSignal<"table" | "grid" | "picker">(props.mode || "table");
  
  // Sorting state
  const [sortField, setSortField] = createSignal<string>("value");
  const [sortOrder, setSortOrder] = createSignal<"asc" | "desc">("asc");

  // Selection state
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(
    new Set(props.selectedPartIds || [])
  );

  // Sync prop changes for selectedPartIds if updated externally
  createEffect(() => {
    if (props.selectedPartIds) {
      setSelectedIds(new Set(props.selectedPartIds));
    }
  });

  // Fetch categories for the filter dropdown
  onMount(async () => {
    try {
      const cats = await apiFetch("/categories");
      setCategories(cats || []);
    } catch (err) {
      console.error("Failed to fetch categories for filter:", err);
    }
  });

  // Auto-fetch remote parts if props.parts is NOT provided
  createEffect(() => {
    if (props.parts === undefined) {
      fetchRemoteParts();
    }
  });

  const fetchRemoteParts = async () => {
    setRemoteLoading(true);
    try {
      let url = "/parts";
      const params = new URLSearchParams();
      if (props.locationId) params.append("location_id", props.locationId);
      if (props.categoryId) params.append("category_id", props.categoryId);
      if (props.lowStockOnly) params.append("low_stock", "true");
      
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const data = await apiFetch(url);
      setRemoteParts(data || []);

      if (data && data.length === 1 && props.onAutoSelect) {
        props.onAutoSelect(data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch parts:", err);
    } finally {
      setRemoteLoading(false);
    }
  };

  // Determine base parts array (props.parts if supplied, else remoteParts)
  const baseParts = createMemo(() => {
    return props.parts !== undefined ? props.parts : remoteParts();
  });

  const isLoading = createMemo(() => {
    return props.loading !== undefined ? props.loading : remoteLoading();
  });

  // Filtered & Sorted Parts Memo
  const processedParts = createMemo(() => {
    let result = [...baseParts()];

    // Search filter
    const searchTerm = search().trim().toLowerCase();
    if (searchTerm) {
      result = result.filter((p) => {
        const valueMatch = p.value?.toLowerCase().includes(searchTerm);
        const numberMatch = p.number?.toLowerCase().includes(searchTerm);
        const packageMatch = p.package?.toLowerCase().includes(searchTerm);
        const notesMatch = p.notes?.toLowerCase().includes(searchTerm);
        const catMatch = (p.category?.title || p.category?.name || "").toLowerCase().includes(searchTerm);
        
        // Match custom JSON attributes
        let attrMatch = false;
        if (p.attributes && typeof p.attributes === "object") {
          attrMatch = Object.values(p.attributes).some(v => 
            String(v).toLowerCase().includes(searchTerm)
          );
        }

        return valueMatch || numberMatch || packageMatch || notesMatch || catMatch || attrMatch;
      });
    }

    // Category filter
    if (selectedCat()) {
      result = result.filter((p) => {
        const catId = p.category_id || p.category?.id;
        return String(catId) === String(selectedCat());
      });
    }

    // Low stock filter
    if (filterLowStock()) {
      result = result.filter((p) => {
        const qty = p.total_quantity !== undefined ? p.total_quantity : (p.quantity || 0);
        return qty < (p.threshold || 0);
      });
    }

    // Unassigned (Homeless) filter
    if (filterUnassigned()) {
      result = result.filter((p) => {
        const hasLocations = p.storage_records && p.storage_records.length > 0;
        const totalQty = p.total_quantity !== undefined ? p.total_quantity : (p.quantity || 0);
        return !hasLocations || totalQty === 0;
      });
    }

    // Sorting
    const field = sortField();
    const order = sortOrder() === "asc" ? 1 : -1;

    result.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (field === "value") {
        valA = a.value || "";
        valB = b.value || "";
      } else if (field === "number") {
        valA = a.number || "";
        valB = b.number || "";
      } else if (field === "category") {
        valA = a.category?.title || a.category?.name || "";
        valB = b.category?.title || b.category?.name || "";
      } else if (field === "package") {
        valA = a.package || "";
        valB = b.package || "";
      } else if (field === "quantity") {
        valA = a.total_quantity !== undefined ? a.total_quantity : (a.quantity || 0);
        valB = b.total_quantity !== undefined ? b.total_quantity : (b.quantity || 0);
      }

      if (typeof valA === "string") {
        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" }) * order;
      }
      return (valA > valB ? 1 : valA < valB ? -1 : 0) * order;
    });

    return result;
  });

  const handleSort = (field: string) => {
    if (sortField() === field) {
      setSortOrder(sortOrder() === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const toggleSelect = (part: any, e?: Event) => {
    if (e) e.stopPropagation();
    const newSet = new Set(selectedIds());
    if (newSet.has(part.id)) {
      newSet.delete(part.id);
    } else {
      newSet.add(part.id);
    }
    setSelectedIds(newSet);

    if (props.onBulkSelect) {
      const selectedParts = processedParts().filter(p => newSet.has(p.id));
      props.onBulkSelect(selectedParts);
    }
  };

  const toggleSelectAll = () => {
    const allIds = processedParts().map(p => p.id);
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedIds().has(id));

    const newSet = new Set(selectedIds());
    if (isAllSelected) {
      allIds.forEach(id => newSet.delete(id));
    } else {
      allIds.forEach(id => newSet.add(id));
    }
    setSelectedIds(newSet);

    if (props.onBulkSelect) {
      const selectedParts = processedParts().filter(p => newSet.has(p.id));
      props.onBulkSelect(selectedParts);
    }
  };

  const isAllSelected = createMemo(() => {
    const list = processedParts();
    return list.length > 0 && list.every(p => selectedIds().has(p.id));
  });

  return (
    <div class="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
      {/* Header & Controls Toolbar */}
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <Package size={20} class="text-accentCyan" />
          <h3 class="text-base font-bold text-white uppercase tracking-wider">
            {props.title || "Parts Browser"}
          </h3>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
            {processedParts().length}
          </span>
        </div>

        {/* Toolbar controls */}
        <Show when={props.showToolbar !== false}>
          <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div class="flex items-center bg-black/40 p-1 rounded-lg border border-white/10">
              <button
                class={`p-1.5 rounded-md transition-colors ${viewMode() === "table" ? "bg-accentCyan/20 text-accentCyan" : "text-gray-400 hover:text-white"}`}
                onClick={() => setViewMode("table")}
                title="Table View"
              >
                <List size={16} />
              </button>
              <button
                class={`p-1.5 rounded-md transition-colors ${viewMode() === "grid" ? "bg-accentCyan/20 text-accentCyan" : "text-gray-400 hover:text-white"}`}
                onClick={() => setViewMode("grid")}
                title="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            {/* Low stock toggle */}
            <button
              class={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                filterLowStock()
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : "bg-black/30 text-gray-400 border-white/10 hover:text-white"
              }`}
              onClick={() => setFilterLowStock(!filterLowStock())}
            >
              <AlertTriangle size={14} />
              Low Stock
            </button>

            {/* Category Dropdown */}
            <select
              class="bg-black/40 text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-white/10 focus:outline-none focus:border-accentCyan"
              value={selectedCat()}
              onChange={(e) => setSelectedCat(e.currentTarget.value)}
            >
              <option value="">All Categories</option>
              <For each={categories()}>
                {(cat) => <option value={cat.id}>{cat.title || cat.name}</option>}
              </For>
            </select>
          </div>
        </Show>
      </div>

      {/* Search Input Bar */}
      <Show when={props.showToolbar !== false}>
        <div class="relative">
          <Search size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search parts by value, number, package, notes, attributes..."
            class="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accentCyan transition-colors"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
      </Show>

      {/* Loading State */}
      <Show when={isLoading()}>
        <div class="h-40 flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accentCyan"></div>
        </div>
      </Show>

      {/* Empty State */}
      <Show when={!isLoading() && processedParts().length === 0}>
        <div class="bg-black/20 p-8 rounded-xl border border-white/5 text-center text-gray-500 text-sm">
          No parts match your search or filter criteria.
        </div>
      </Show>

      {/* Content Views */}
      <Show when={!isLoading() && processedParts().length > 0}>
        {/* TABLE VIEW */}
        <Show when={viewMode() === "table"}>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-gray-300">
              <thead class="text-xs uppercase bg-white/5 text-gray-400">
                <tr>
                  <Show when={props.selectionMode === "multiple"}>
                    <th class="px-4 py-3 w-10 text-center">
                      <button onClick={toggleSelectAll} class="text-gray-400 hover:text-white">
                        {isAllSelected() ? (
                          <CheckSquare size={16} class="text-accentCyan" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                  </Show>
                  <th
                    class="px-4 py-3 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort("value")}
                  >
                    <div class="flex items-center gap-1">
                      <span>Part Value</span>
                      <Show when={sortField() === "value"}>
                        {sortOrder() === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      </Show>
                    </div>
                  </th>
                  <th
                    class="px-4 py-3 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort("category")}
                  >
                    <div class="flex items-center gap-1">
                      <span>Category</span>
                      <Show when={sortField() === "category"}>
                        {sortOrder() === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      </Show>
                    </div>
                  </th>
                  <th
                    class="px-4 py-3 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort("package")}
                  >
                    <div class="flex items-center gap-1">
                      <span>Package</span>
                      <Show when={sortField() === "package"}>
                        {sortOrder() === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      </Show>
                    </div>
                  </th>
                  <th
                    class="px-4 py-3 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort("quantity")}
                  >
                    <div class="flex items-center gap-1">
                      <span>Quantity</span>
                      <Show when={sortField() === "quantity"}>
                        {sortOrder() === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      </Show>
                    </div>
                  </th>
                  <Show when={props.customActions}>
                    <th class="px-4 py-3 text-right">Actions</th>
                  </Show>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                <For each={processedParts()}>
                  {(part) => {
                    const qty = part.total_quantity !== undefined ? part.total_quantity : (part.quantity || 0);
                    const isLowStock = qty < (part.threshold || 0);
                    const isSelected = selectedIds().has(part.id);

                    return (
                      <tr
                        class={`hover:bg-white/5 cursor-pointer transition-colors ${
                          isSelected ? "bg-accentCyan/10 border-l-2 border-accentCyan" : ""
                        }`}
                        onClick={() => props.onSelectPart && props.onSelectPart(part)}
                      >
                        <Show when={props.selectionMode === "multiple"}>
                          <td class="px-4 py-3 text-center" onClick={(e) => toggleSelect(part, e)}>
                            <button class="text-gray-400 hover:text-white">
                              {isSelected ? (
                                <CheckSquare size={16} class="text-accentCyan" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </td>
                        </Show>
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
                        <td class="px-4 py-3 text-xs">
                          {part.category?.title || part.category?.name || "Uncategorized"}
                        </td>
                        <td class="px-4 py-3 text-xs text-gray-400">{part.package || "N/A"}</td>
                        <td class="px-4 py-3">
                          <div class="flex items-center gap-2">
                            <span class={`font-bold ${isLowStock ? "text-red-400" : "text-green-400"}`}>
                              {qty}
                            </span>
                            <Show when={isLowStock}>
                              <AlertTriangle size={14} class="text-red-400" />
                            </Show>
                          </div>
                        </td>
                        <Show when={props.customActions}>
                          <td class="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {props.customActions!(part)}
                          </td>
                        </Show>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Show>

        {/* GRID / CARD VIEW */}
        <Show when={viewMode() === "grid"}>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <For each={processedParts()}>
              {(part) => {
                const qty = part.total_quantity !== undefined ? part.total_quantity : (part.quantity || 0);
                const isLowStock = qty < (part.threshold || 0);
                const isSelected = selectedIds().has(part.id);

                return (
                  <div
                    class={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-accentCyan/10 border-accentCyan"
                        : "bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/5"
                    }`}
                    onClick={() => props.onSelectPart && props.onSelectPart(part)}
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex flex-col">
                        <span class="font-bold text-white text-sm">{part.value}</span>
                        <Show when={part.number}>
                          <span class="text-xs text-gray-400 font-mono">{part.number}</span>
                        </Show>
                      </div>
                      <Show when={props.selectionMode === "multiple"}>
                        <button onClick={(e) => toggleSelect(part, e)} class="text-gray-400 hover:text-white">
                          {isSelected ? <CheckSquare size={18} class="text-accentCyan" /> : <Square size={18} />}
                        </button>
                      </Show>
                    </div>

                    <div class="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-white/5 pt-2">
                      <span class="flex items-center gap-1">
                        <Tag size={12} /> {part.category?.title || part.category?.name || "Uncategorized"}
                      </span>
                      <span class={`font-bold flex items-center gap-1 ${isLowStock ? "text-red-400" : "text-green-400"}`}>
                        {qty} {isLowStock && <AlertTriangle size={12} />}
                      </span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* PICKER VIEW */}
        <Show when={viewMode() === "picker"}>
          <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
            <For each={processedParts()}>
              {(part) => {
                const qty = part.total_quantity !== undefined ? part.total_quantity : (part.quantity || 0);
                return (
                  <div
                    class="p-3 rounded-lg bg-black/30 border border-white/5 hover:border-accentCyan/50 flex items-center justify-between cursor-pointer transition-colors"
                    onClick={() => props.onSelectPart && props.onSelectPart(part)}
                  >
                    <div class="flex flex-col">
                      <span class="font-semibold text-white text-xs">{part.value}</span>
                      <span class="text-[10px] text-gray-400">{part.number || part.package || "No MPN"}</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="text-xs font-mono font-bold text-green-400">Qty: {qty}</span>
                      <button class="px-2.5 py-1 text-xs bg-accentCyan/20 text-accentCyan hover:bg-accentCyan/30 rounded-md font-medium transition-colors">
                        Select
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
