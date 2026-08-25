import { createSignal, createMemo, createEffect, onMount, For, Show } from "solid-js";
import { 
  Search, 
  MapPin, 
  ChevronRight, 
  Plus, 
  CheckCircle,
  Folder
} from "lucide-solid";
import { apiFetch } from "../../hooks/useAuth";
import InlineLocationCreator from "../parts/InlineLocationCreator";

export interface UniversalLocationSelectorProps {
  locations?: any[];
  selectedLocationId?: string;
  part?: any; // Optional part context for smart default location naming
  onSelectLocation: (location: any) => void;
  initialMode?: "miller" | "search";
  showInlineCreate?: boolean;
}

export default function UniversalLocationSelector(props: UniversalLocationSelectorProps) {
  const [remoteLocations, setRemoteLocations] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(false);
  
  // Selection & Search state
  const [selectedId, setSelectedId] = createSignal<string>(props.selectedLocationId || "");
  const [searchTerm, setSearchTerm] = createSignal("");

  // Miller Columns path array of node IDs: [level0SelectedId, level1SelectedId, ...]
  const [millerPath, setMillerPath] = createSignal<string[]>([]);
  
  // Inline creation state for Miller Column level or search
  const [addingUnderParentId, setAddingUnderParentId] = createSignal<string | null>(null);

  // Dynamic view mode: true when search input has text, false when empty (Miller Columns)
  const isSearching = createMemo(() => searchTerm().trim() !== "");

  // Sync prop changes for selectedLocationId
  createEffect(() => {
    if (props.selectedLocationId) {
      setSelectedId(props.selectedLocationId);
    }
  });

  // Fetch locations if not provided as props
  onMount(async () => {
    if (props.locations === undefined) {
      setLoading(true);
      try {
        const data = await apiFetch("/locations?flat=true");
        setRemoteLocations(data || []);
      } catch (err) {
        console.error("Failed to fetch locations:", err);
      } finally {
        setLoading(false);
      }
    }
  });

  const allLocations = createMemo(() => {
    return props.locations !== undefined ? props.locations : remoteLocations();
  });

  // Map of parentId -> children array
  const locationsByParent = createMemo(() => {
    const map = new Map<string | null, any[]>();
    for (const loc of allLocations()) {
      const pid = loc.parent_id || null;
      if (!map.has(pid)) {
        map.set(pid, []);
      }
      map.get(pid)!.push(loc);
    }
    return map;
  });

  // Active selected location object
  const selectedLocation = createMemo(() => {
    return allLocations().find((l) => l.id === selectedId()) || null;
  });

  // Calculate Miller Columns array: [[rootNodes], [childNodes1], [childNodes2], ...]
  const millerColumns = createMemo(() => {
    const cols: Array<{ parentId: string | null; items: any[] }> = [];
    
    // Column 0: Root items (parent_id == null)
    const roots = locationsByParent().get(null) || [];
    cols.push({ parentId: null, items: roots });

    // Subsequent columns driven by millerPath()
    const path = millerPath();
    for (let i = 0; i < path.length; i++) {
      const currentParentId = path[i];
      const children = locationsByParent().get(currentParentId) || [];
      if (children.length > 0) {
        cols.push({ parentId: currentParentId, items: children });
      }
    }

    return cols;
  });

  // Calculate breadcrumb trail for selected location
  const breadcrumbs = createMemo(() => {
    if (!selectedId()) return [];
    const trail: any[] = [];
    let curr = allLocations().find((l) => l.id === selectedId());
    while (curr) {
      trail.unshift(curr);
      curr = curr.parent_id ? allLocations().find((l) => l.id === curr.parent_id) : null;
    }
    return trail;
  });

  // Filtered list for Search Mode
  const filteredSearchLocations = createMemo(() => {
    const term = searchTerm().trim().toLowerCase();
    if (!term) return allLocations();
    return allLocations().filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        (l.description && l.description.toLowerCase().includes(term))
    );
  });

  const handleSelectNode = (node: any, columnIndex: number) => {
    setSelectedId(node.id);
    props.onSelectLocation(node);

    // Update Miller path up to columnIndex
    const newPath = millerPath().slice(0, columnIndex);
    
    // Check if node has children to expand
    const hasChildren = (locationsByParent().get(node.id) || []).length > 0;
    if (hasChildren) {
      newPath.push(node.id);
    }
    setMillerPath(newPath);
  };

  const handleLocationCreatedInline = (newLoc: any) => {
    if (props.locations === undefined) {
      setRemoteLocations([...remoteLocations(), newLoc]);
    }
    setSelectedId(newLoc.id);
    props.onSelectLocation(newLoc);
    setAddingUnderParentId(null);
  };

  // Smart default bin name suggestion based on component value
  const suggestedBinName = createMemo(() => {
    if (props.part && props.part.value) {
      return `${props.part.value} Bin`;
    }
    return "";
  });

  const getFullPathName = (loc: any) => {
    const path: string[] = [loc.name];
    let curr = loc.parent_id ? allLocations().find((l) => l.id === loc.parent_id) : null;
    while (curr) {
      path.unshift(curr.name);
      curr = curr.parent_id ? allLocations().find((l) => l.id === curr.parent_id) : null;
    }
    return path.join(" > ");
  };

  return (
    <div class="glass-panel p-4 rounded-2xl border border-white/5 space-y-4">
      {/* Header Info Bar & Top Right Search Box */}
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div class="flex items-center gap-2">
          <MapPin size={18} class="text-accentCyan" />
          <span class="text-xs font-bold text-white uppercase tracking-wider">
            Select Storage Bin
          </span>
          <Show when={selectedLocation()}>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
              {selectedLocation()?.name}
            </span>
          </Show>
        </div>

        {/* Upper Right Corner Search Box */}
        <div class="relative w-full sm:w-64">
          <Search size={14} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search all locations in database..."
            value={searchTerm()}
            onInput={(e) => setSearchTerm(e.currentTarget.value)}
            class="glass-input w-full !pl-9 pr-7 py-1.5 text-xs"
          />
          <Show when={searchTerm()}>
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-white bg-white/10 px-1.5 py-0.5 rounded"
            >
              ✕
            </button>
          </Show>
        </div>
      </div>

      {/* Breadcrumb Path Preview */}
      <Show when={breadcrumbs().length > 0}>
        <div class="flex items-center flex-wrap gap-1.5 text-xs text-gray-400 bg-black/30 p-2.5 rounded-xl border border-white/5">
          <span class="text-[10px] uppercase font-bold text-gray-500 mr-1">Path:</span>
          <For each={breadcrumbs()}>
            {(crumb, idx) => (
              <>
                <Show when={idx() > 0}>
                  <ChevronRight size={12} class="text-gray-600 shrink-0" />
                </Show>
                <span
                  class={`font-semibold cursor-pointer hover:text-white transition-colors ${
                    crumb.id === selectedId() ? "text-accentCyan font-bold" : "text-gray-300"
                  }`}
                  onClick={() => {
                    setSelectedId(crumb.id);
                    props.onSelectLocation(crumb);
                  }}
                >
                  {crumb.name}
                </span>
              </>
            )}
          </For>
        </div>
      </Show>

      {/* Loading Spinner */}
      <Show when={loading()}>
        <div class="h-36 flex items-center justify-center">
          <div class="animate-spin rounded-full h-7 w-7 border-b-2 border-accentCyan"></div>
        </div>
      </Show>

      {/* VIEW 1: MILLER COLUMNS MODE (Active when search input is empty) */}
      <Show when={!loading() && !isSearching()}>
        <div class="overflow-x-auto pb-2">
          <div class="flex items-start gap-3 min-w-max">
            <For each={millerColumns()}>
              {(col, colIdx) => (
                <div class="w-64 bg-black/30 p-2.5 rounded-xl border border-white/5 flex flex-col max-h-64 space-y-2 shrink-0">
                  <div class="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1 pb-1 border-b border-white/5">
                    <span class="truncate">
                      {col.parentId
                        ? allLocations().find((l) => l.id === col.parentId)?.name || "Sub-Location"
                        : "Root Storage Units"}
                    </span>
                    <span class="text-[10px] text-gray-500 font-mono">({col.items.length})</span>
                  </div>

                  <div class="overflow-y-auto space-y-1 pr-1 flex-1">
                    <For each={col.items}>
                      {(item) => {
                        const isSelected = selectedId() === item.id;
                        const isPathSelected = millerPath().includes(item.id);
                        const hasChildren = (locationsByParent().get(item.id) || []).length > 0;

                        return (
                          <div
                            onClick={() => handleSelectNode(item, colIdx())}
                            class={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                              isSelected
                                ? "bg-accentCyan/20 text-accentCyan border border-accentCyan/40 font-bold"
                                : isPathSelected
                                ? "bg-white/10 text-white border border-white/10 font-semibold"
                                : "hover:bg-white/5 text-gray-300 border border-transparent"
                            }`}
                          >
                            <div class="flex items-center gap-2 truncate">
                              {hasChildren ? (
                                <Folder size={14} class="text-accentCyan shrink-0" />
                              ) : (
                                <MapPin size={14} class="text-gray-400 shrink-0" />
                              )}
                              <span class="truncate">{item.name}</span>
                            </div>
                            <div class="flex items-center gap-1">
                              <Show when={isSelected}>
                                <CheckCircle size={14} class="text-accentCyan" />
                              </Show>
                              <Show when={hasChildren}>
                                <ChevronRight size={14} class="text-gray-500" />
                              </Show>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>

                  {/* Add Bin Inline under this column */}
                  <Show when={props.showInlineCreate !== false}>
                    <Show
                      when={addingUnderParentId() === (col.parentId || "root")}
                      fallback={
                        <button
                          type="button"
                          onClick={() => setAddingUnderParentId(col.parentId || "root")}
                          class="w-full py-1.5 px-2 text-[11px] text-accentCyan hover:text-white bg-accentCyan/10 hover:bg-accentCyan/20 rounded-lg font-medium border border-accentCyan/20 transition-colors flex items-center justify-center gap-1 mt-1"
                        >
                          <Plus size={12} />
                          Add Bin Here
                        </button>
                      }
                    >
                      <div class="mt-2">
                        <InlineLocationCreator
                          locations={allLocations()}
                          initialName={suggestedBinName()}
                          defaultParentId={col.parentId || ""}
                          onCreated={handleLocationCreatedInline}
                          onCancel={() => setAddingUnderParentId(null)}
                        />
                      </div>
                    </Show>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* VIEW 2: SEARCH LIST MODE (Active when search input has text) */}
      <Show when={!loading() && isSearching()}>
        <div class="space-y-2">
          <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-1">
            Search Results for "{searchTerm()}" ({filteredSearchLocations().length}):
          </div>
          <div class="max-h-56 overflow-y-auto space-y-1 bg-black/20 p-2 rounded-xl border border-white/5 pr-1">
            <Show
              when={filteredSearchLocations().length > 0}
              fallback={
                <div class="p-6 text-center text-xs text-gray-500">
                  No matching storage locations found for "{searchTerm()}".
                </div>
              }
            >
              <For each={filteredSearchLocations()}>
                {(loc) => {
                  const isSelected = selectedId() === loc.id;

                  return (
                    <div
                      onClick={() => {
                        setSelectedId(loc.id);
                        props.onSelectLocation(loc);
                      }}
                      class={`p-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected
                          ? "bg-accentCyan/20 text-accentCyan border border-accentCyan/40 font-bold"
                          : "hover:bg-white/5 text-gray-300 border border-transparent"
                      }`}
                    >
                      <div class="flex items-center gap-2.5">
                        <MapPin size={14} class="text-accentCyan shrink-0" />
                        <div class="flex flex-col">
                          <span class="font-semibold text-white">{loc.name}</span>
                          <span class="text-[10px] text-gray-400 font-mono">
                            {getFullPathName(loc)}
                          </span>
                          <Show when={loc.description}>
                            <span class="text-[10px] text-gray-500 font-normal">
                              {loc.description}
                            </span>
                          </Show>
                        </div>
                      </div>
                      <Show when={isSelected}>
                        <CheckCircle size={16} class="text-accentCyan" />
                      </Show>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
