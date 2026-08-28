import { createSignal, createMemo, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import toast from "solid-toast";
import { 
  Search, 
  MapPin, 
  ChevronRight, 
  Plus, 
  CheckCircle,
  Folder,
  ArrowLeft
} from "lucide-solid";
import { apiFetch } from "../../hooks/useAuth";
import InlineLocationCreator from "../parts/InlineLocationCreator";

export interface UniversalLocationSelectorProps {
  locations?: any[];
  selectedLocationId?: string;
  initialLocationId?: string;
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
  let millerContainerRef: HTMLDivElement | undefined;
  
  // Inline creation state for Miller Column level or search
  const [addingUnderParentId, setAddingUnderParentId] = createSignal<string | null>(null);
  const [addingIndex, setAddingIndex] = createSignal<number>(0);

  // Dynamic view mode: true when search input has text, false when empty (Miller Columns)
  const isSearching = createMemo(() => searchTerm().trim() !== "");

  // Auto-scroll Miller Columns container to the right when path expands
  createEffect(() => {
    millerPath();
    if (millerContainerRef && typeof millerContainerRef.scrollTo === "function") {
      setTimeout(() => {
        millerContainerRef.scrollTo({
          left: millerContainerRef.scrollWidth,
          behavior: "smooth"
        });
      }, 50);
    }
  });

  // Helper to build ancestor ID chain
  const getAncestorChain = (locId: string, allLocs: any[]): string[] => {
    const chain: string[] = [];
    let curr = allLocs.find((l) => String(l.id) === String(locId));
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      chain.unshift(curr.id);
      if (curr.parent_id) {
        curr = allLocs.find((l) => String(l.id) === String(curr.parent_id));
      } else {
        curr = null;
      }
    }
    return chain;
  };

  // Track whether initial path has been set from initialLocationId
  const [initialPathSet, setInitialPathSet] = createSignal(false);

  const allLocations = createMemo(() => {
    return props.locations !== undefined ? props.locations : remoteLocations();
  });

  // Sync prop changes for selectedLocationId or initialLocationId
  createEffect(() => {
    const locs = allLocations();
    if (locs.length === 0) return;

    if (props.selectedLocationId) {
      setSelectedId(props.selectedLocationId);
      const chain = getAncestorChain(props.selectedLocationId, locs);
      if (chain.length > 0) {
        setMillerPath(chain);
      }
      if (searchTerm()) {
        setSearchTerm("");
      }
    } else if (props.initialLocationId && !initialPathSet()) {
      const chain = getAncestorChain(props.initialLocationId, locs);
      if (chain.length > 0) {
        setMillerPath(chain);
        setInitialPathSet(true);
      }
    }
  });

  // Fetch locations if not provided as props & Listen for hardware NFC scans
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

    const handleNfcEvent = async (e: Event) => {
      const customEvt = e as CustomEvent;
      const parsed = customEvt.detail;
      if (!parsed) return;

      let targetLocId: string | null = parsed.id || null;
      const rawPayload: string = parsed.rawUrl || parsed.id || "";

      const locs = allLocations();

      // Resolve via backend API if action is 'resolve' or targetLocId isn't found directly in current locations
      if ((parsed.action === "resolve" || !targetLocId || !locs.some((l) => String(l.id) === String(targetLocId))) && rawPayload) {
        try {
          const resolved = await apiFetch(`/resolve/${encodeURIComponent(rawPayload)}`);
          if (resolved && resolved.entity_type === "location" && resolved.entity_id) {
            targetLocId = resolved.entity_id;
          }
        } catch (err) {
          console.warn("[UniversalLocationSelector] Failed to resolve NFC payload:", err);
        }
      }

      if (!targetLocId) return;

      let foundLoc = locs.find((l) => String(l.id) === String(targetLocId));

      // Fallback fetch location details if missing from locs array
      if (!foundLoc) {
        try {
          const fetched = await apiFetch(`/locations/${encodeURIComponent(targetLocId)}`);
          if (fetched && fetched.id) {
            foundLoc = fetched;
            if (props.locations === undefined) {
              setRemoteLocations((prev) => [...prev.filter((l) => String(l.id) !== String(fetched.id)), fetched]);
            }
          }
        } catch (err) {
          console.warn("[UniversalLocationSelector] Location fetch failed:", err);
        }
      }

      if (foundLoc) {
        e.preventDefault(); // Stop default route navigation in useDeepLink

        if (searchTerm()) {
          setSearchTerm("");
        }

        setSelectedId(foundLoc.id);
        const currentLocs = allLocations();
        const chain = getAncestorChain(foundLoc.id, currentLocs);
        if (chain.length > 0) {
          setMillerPath(chain);
        }

        props.onSelectLocation(foundLoc);
        toast.success(`NFC Selected: ${foundLoc.name}`, { id: "nfc-loc-select", icon: "🏷️" });
      }
    };

    window.addEventListener("sidekick:nfc-scanned", handleNfcEvent);

    onCleanup(() => {
      window.removeEventListener("sidekick:nfc-scanned", handleNfcEvent);
    });
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
    return allLocations().find((l) => String(l.id) === String(selectedId())) || null;
  });

  // Calculate Miller Columns array: [[rootNodes], [childNodes1], [childNodes2], ...]
  const millerColumns = createMemo(() => {
    const cols: Array<{ parentId: string | null; items: any[] }> = [];
    
    // Column 0: Root items (parent_id == null)
    const roots = locationsByParent().get(null) || [];
    cols.push({ parentId: null, items: roots });

    // Subsequent columns driven by valid millerPath()
    const validPath = millerPath().filter((id) => allLocations().some((l) => String(l.id) === String(id)));
    for (let i = 0; i < validPath.length; i++) {
      const currentParentId = validPath[i];
      const children = locationsByParent().get(currentParentId) || [];
      cols.push({ parentId: currentParentId, items: children });
    }

    return cols;
  });

  // Calculate breadcrumb trail for selected location
  const breadcrumbs = createMemo(() => {
    if (!selectedId()) return [];
    return getAncestorChain(selectedId(), allLocations()).map(id => allLocations().find(l => String(l.id) === String(id))).filter(Boolean);
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
    
    // Check if node has children or dimensions (1D/2D) to expand
    const hasChildren = (locationsByParent().get(node.id) || []).length > 0;
    const hasDimensions = Array.isArray(node.dimensions) && node.dimensions.length > 0;
    if (hasChildren || hasDimensions) {
      newPath.push(node.id);
    }
    setMillerPath(newPath);
  };

  const handleCloseColumn = (columnIndex: number) => {
    if (columnIndex <= 0) return;
    const newPath = millerPath().slice(0, columnIndex - 1);
    setMillerPath(newPath);
    if (newPath.length > 0) {
      const parentId = newPath[newPath.length - 1];
      setSelectedId(parentId);
      const parentLoc = allLocations().find((l) => String(l.id) === String(parentId));
      if (parentLoc) {
        props.onSelectLocation(parentLoc);
      }
    } else {
      setSelectedId("");
      props.onSelectLocation(null);
    }
  };

  const handleLocationCreatedInline = (newLoc: any) => {
    let updatedLocs: any[] = [];
    if (props.locations === undefined) {
      updatedLocs = [...remoteLocations(), newLoc];
      setRemoteLocations(updatedLocs);
    } else {
      updatedLocs = [...props.locations, newLoc];
    }
    setSelectedId(newLoc.id);
    props.onSelectLocation(newLoc);

    // Build and set ancestor chain for new location
    const chain = getAncestorChain(newLoc.id, updatedLocs);
    if (chain.length > 0) {
      setMillerPath(chain);
    }

    setAddingUnderParentId(null);
    setAddingIndex(0);
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
        <div class="overflow-x-auto pb-2 scroll-smooth" ref={millerContainerRef}>
          <div class="flex items-start gap-3 min-w-max">
            <For each={millerColumns()}>
              {(col, colIdx) => {
                const parentLoc = () => (col.parentId ? allLocations().find((l) => l.id === col.parentId) : null);
                const layoutType = () => {
                  const p = parentLoc();
                  if (p && p.dimensions) {
                    if (p.dimensions.length === 1) return "linear";
                    if (p.dimensions.length === 2) return "grid";
                  }
                  return "default";
                };

                const dims = () => {
                  const p = parentLoc();
                  return p && p.dimensions ? p.dimensions : [];
                };

                const capacity = () =>
                  layoutType() === "linear"
                    ? dims()[0]
                    : layoutType() === "grid"
                    ? dims()[0] * dims()[1]
                    : 0;

                const colWidth = () =>
                  layoutType() === "grid" ? Math.max(224, dims()[0] * 45) : 224;

                return (
                  <div
                    class="bg-black/30 p-2.5 rounded-xl border border-white/5 flex flex-col max-h-52 sm:max-h-60 space-y-2 shrink-0"
                    style={{ width: `${colWidth()}px`, "min-width": `${colWidth()}px` }}
                  >
                    <div class="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1 pb-1 border-b border-white/5">
                      <div class="flex items-center gap-1.5 overflow-hidden pr-2 min-w-0">
                        <Show when={col.parentId}>
                          <button
                            type="button"
                            onClick={() => handleCloseColumn(colIdx())}
                            class="p-0.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors shrink-0"
                            title="Move up one directory"
                          >
                            <ArrowLeft size={13} />
                          </button>
                        </Show>
                        <span class="truncate">
                          {parentLoc() ? parentLoc()!.name : "Root Storage Units"}
                        </span>
                      </div>
                      <span class="text-[10px] text-gray-500 font-mono shrink-0">({col.items.length})</span>
                    </div>

                    <div class="overflow-y-auto pr-1 flex-1">
                      {/* LAYOUT 1: DEFAULT LIST */}
                      <Show when={layoutType() === "default"}>
                        <div class="space-y-1">
                          <For each={col.items.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0))}>
                            {(item) => {
                              const isSelected = selectedId() === item.id;
                              const isPathSelected = millerPath().includes(item.id);
                              const hasChildren = (locationsByParent().get(item.id) || []).length > 0;
                              const hasDimensions = Array.isArray(item.dimensions) && item.dimensions.length > 0;

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
                                    {hasChildren || hasDimensions ? (
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
                                    <Show when={hasChildren || hasDimensions}>
                                      <ChevronRight size={14} class="text-gray-500" />
                                    </Show>
                                  </div>
                                </div>
                              );
                            }}
                          </For>
                          <Show when={col.items.length === 0}>
                            <div class="text-[10px] text-gray-500 text-center p-4">No sub-locations</div>
                          </Show>
                        </div>
                      </Show>

                      {/* LAYOUT 2: LINEAR (1D SLOT LIST) */}
                      <Show when={layoutType() === "linear"}>
                        <div class="flex flex-col gap-1">
                          <For each={Array.from({ length: capacity() })}>
                            {(_, i) => {
                              const idx = i();
                              const item = () => col.items.find((it) => it.index === idx);

                              return (
                                <Show
                                  when={item()}
                                  fallback={
                                    <Show when={props.showInlineCreate !== false}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAddingUnderParentId(col.parentId || "root");
                                          setAddingIndex(idx);
                                        }}
                                        class={`w-full min-h-[30px] rounded-lg border transition-colors flex items-center px-2 gap-2 group ${
                                          addingUnderParentId() === (col.parentId || "root") && addingIndex() === idx
                                            ? "border-accentCyan bg-accentCyan/20 text-accentCyan"
                                            : "border-dashed border-white/10 hover:border-accentCyan/50 hover:bg-accentCyan/10 text-gray-600 hover:text-accentCyan"
                                        }`}
                                        title={`Create Location at Slot ${idx + 1}`}
                                      >
                                        <div class="text-[9px] font-mono w-4 text-right shrink-0 group-hover:text-accentCyan/50">
                                          {idx + 1}
                                        </div>
                                        <Plus size={10} />
                                      </button>
                                    </Show>
                                  }
                                >
                                  {(loc) => {
                                    const isSelected = selectedId() === loc().id;
                                    const isPathSelected = millerPath().includes(loc().id);
                                    const hasChildren = (locationsByParent().get(loc().id) || []).length > 0;
                                    const hasDimensions = Array.isArray(loc().dimensions) && loc().dimensions.length > 0;

                                    return (
                                      <div
                                        onClick={() => handleSelectNode(loc(), colIdx())}
                                        class={`w-full p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors border ${
                                          isSelected
                                            ? "bg-accentCyan/20 text-accentCyan border-accentCyan/40 font-bold"
                                            : isPathSelected
                                            ? "bg-white/10 text-white border-white/10 font-semibold"
                                            : "border-transparent hover:bg-white/5 text-gray-300"
                                        }`}
                                      >
                                        <div class="flex items-center gap-2 truncate">
                                          <div class="text-[9px] font-mono text-gray-500 w-4 text-right shrink-0">
                                            {idx + 1}
                                          </div>
                                          <span class="truncate">{loc().name}</span>
                                        </div>
                                        <div class="flex items-center gap-1">
                                          <Show when={isSelected}>
                                            <CheckCircle size={14} class="text-accentCyan" />
                                          </Show>
                                          <Show when={hasChildren || hasDimensions}>
                                            <ChevronRight size={14} class="text-gray-500" />
                                          </Show>
                                        </div>
                                      </div>
                                    );
                                  }}
                                </Show>
                              );
                            }}
                          </For>
                        </div>
                      </Show>

                      {/* LAYOUT 3: GRID (2D MATRIX) */}
                      <Show when={layoutType() === "grid"}>
                        <div
                          class="grid gap-1"
                          style={{ "grid-template-columns": `repeat(${dims()[0]}, minmax(0, 1fr))` }}
                        >
                          <For each={Array.from({ length: capacity() })}>
                            {(_, i) => {
                              const idx = i();
                              const item = () => col.items.find((it) => it.index === idx);

                              return (
                                <Show
                                  when={item()}
                                  fallback={
                                    <Show when={props.showInlineCreate !== false}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAddingUnderParentId(col.parentId || "root");
                                          setAddingIndex(idx);
                                        }}
                                        class={`aspect-square w-full rounded border transition-colors flex items-center justify-center ${
                                          addingUnderParentId() === (col.parentId || "root") && addingIndex() === idx
                                            ? "border-accentCyan bg-accentCyan/20 text-accentCyan shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                                            : "border-dashed border-white/10 hover:border-accentCyan/50 hover:bg-accentCyan/10 text-gray-600 hover:text-accentCyan"
                                        }`}
                                        title={`Create Location at Grid Index ${idx}`}
                                      >
                                        <Plus size={10} />
                                      </button>
                                    </Show>
                                  }
                                >
                                  {(loc) => {
                                    const isSelected = selectedId() === loc().id;
                                    const isPathSelected = millerPath().includes(loc().id);

                                    return (
                                      <div
                                        onClick={() => handleSelectNode(loc(), colIdx())}
                                        title={loc().name}
                                        class={`aspect-square w-full rounded flex flex-col items-center justify-center transition-colors border p-1 relative cursor-pointer ${
                                          isSelected
                                            ? "bg-accentCyan/20 border-accentCyan/40 text-accentCyan font-bold shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                                            : isPathSelected
                                            ? "bg-white/10 border-white/20 text-white font-semibold"
                                            : "border-white/5 hover:border-white/20 bg-white/[0.02] hover:bg-white/5 text-gray-300"
                                        }`}
                                      >
                                        <span class="break-words whitespace-normal line-clamp-3 text-[9px] w-full text-center leading-tight font-medium">
                                          {loc().name}
                                        </span>
                                      </div>
                                    );
                                  }}
                                </Show>
                              );
                            }}
                          </For>
                        </div>
                      </Show>
                    </div>

                    {/* Add Bin Inline under this column */}
                    <Show when={props.showInlineCreate !== false}>
                      <Show
                        when={addingUnderParentId() === (col.parentId || "root")}
                        fallback={
                          <Show when={layoutType() === "default"}>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingUnderParentId(col.parentId || "root");
                                setAddingIndex(col.items.length);
                              }}
                              class="w-full py-1.5 px-2 text-[11px] text-accentCyan hover:text-white bg-accentCyan/10 hover:bg-accentCyan/20 rounded-lg font-medium border border-accentCyan/20 transition-colors flex items-center justify-center gap-1 mt-1"
                            >
                              <Plus size={12} />
                              Add Bin Here
                            </button>
                          </Show>
                        }
                      >
                        <div class="mt-2">
                          <InlineLocationCreator
                            locations={allLocations()}
                            initialName={suggestedBinName()}
                            defaultParentId={col.parentId || ""}
                            defaultIndex={addingIndex()}
                            onCreated={handleLocationCreatedInline}
                            onCancel={() => {
                              setAddingUnderParentId(null);
                              setAddingIndex(0);
                            }}
                          />
                        </div>
                      </Show>
                    </Show>
                  </div>
                );
              }}
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
