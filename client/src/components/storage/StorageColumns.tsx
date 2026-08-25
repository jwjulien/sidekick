import { createSignal, createEffect, on, For, Show } from "solid-js";
import { ChevronRight, MapPin, Plus, Pencil, GripVertical, Package, Hash, AlertTriangle, Search, X, Move } from "lucide-solid";
import {
  DragDropProvider,
  DragDropSensors,
  SortableProvider,
  createSortable,
  closestCenter,
} from "@thisbeyond/solid-dnd";

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      sortable: boolean;
    }
  }
}

const getLocationPathString = (loc: any, allLocations: any[]): string => {
  const chain: string[] = [];
  let curr: any = loc;
  const visited = new Set<string>();
  while (curr && !visited.has(String(curr.id))) {
    visited.add(String(curr.id));
    chain.unshift(curr.name);
    if (curr.parent_id) {
      curr = allLocations.find((l: any) => String(l.id) === String(curr.parent_id));
    } else {
      curr = null;
    }
  }
  return chain.length > 0 ? chain.join(", ") : (loc.name || "");
};

const getLocationAncestorIds = (loc: any, allLocations: any[]): string[] => {
  const chain: string[] = [];
  let curr: any = loc;
  const visited = new Set<string>();
  while (curr && !visited.has(String(curr.id))) {
    visited.add(String(curr.id));
    chain.unshift(String(curr.id));
    if (curr.parent_id) {
      curr = allLocations.find((l: any) => String(l.id) === String(curr.parent_id));
    } else {
      curr = null;
    }
  }
  return chain;
};

const SortableItem = (props: {
  item: any;
  activePath: string[];
  locations: any[];
  onSelect: (id: string) => void;
}) => {
  const sortable = createSortable(props.item.id);
  const isActive = () => props.activePath.includes(props.item.id);
  const hasChildren = () => props.locations.some(l => l.parent_id === props.item.id);
  const isEmptyLeaf = () => !hasChildren() && !props.item.part_id;

  return (
    <div
      use:sortable
      class="flex w-full group relative"
      classList={{
        "opacity-50": sortable.isActiveDraggable,
        "transition-transform": !!sortable.transform,
      }}
      style={{
        transform: sortable.transform ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0)` : undefined,
        "z-index": sortable.isActiveDraggable ? 10 : 1
      }}
    >
      <div
        {...sortable.dragActivators}
        class="absolute left-1 top-1/2 -translate-y-1/2 p-1 cursor-grab text-gray-500 opacity-0 group-hover:opacity-100 hover:text-white transition-opacity z-20"
      >
        <GripVertical size={12} />
      </div>
      <button
        onClick={() => props.onSelect(props.item.id)}
        class={`w-full text-left pl-6 pr-2 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${isActive()
          ? 'bg-accentCyan/20 border border-accentCyan/30 text-white'
          : isEmptyLeaf()
            ? 'bg-amber-500/10 border border-dashed border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
            : 'hover:bg-white/5 text-gray-300'
          }`}
      >
        <div class="flex items-center gap-2 truncate">
          <MapPin size={12} class={isActive() ? "text-accentCyan" : (isEmptyLeaf() ? "text-amber-400" : "text-gray-500")} />
          <span class="truncate">{props.item.name}</span>
          <Show when={hasChildren() && props.item.part_id}>
            <div title="Warning: Node has both child locations and an assigned part.">
              <AlertTriangle size={12} class="text-amber-400 shrink-0" />
            </div>
          </Show>
          <Show when={isEmptyLeaf()}>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 font-mono" title="Dangling Location: Location has no sub-locations and no assigned part.">
              empty
            </span>
          </Show>
        </div>
        <Show when={hasChildren()}>
          <ChevronRight size={14} class="text-gray-500" />
        </Show>
      </button>
    </div>
  );
};

export default function StorageColumns(props: {
  locations: any[];
  activePath: string[];
  onSelect: (id: string) => void;
  onSelectSearchPath?: (pathIds: string[]) => void;
  onCreateChild: (parentId: string | null, index?: number) => void;
  onEditLocation: (location: any) => void;
  onReorder?: (items: { id: string; index: number }[]) => void;
  creatingParentId?: string | null;
  creatingIndex?: number;
  isCreating?: boolean;
  pickerMode?: boolean;
  onPickerSelect?: (parentId: string | null, index?: number) => void;
  onMoveParts?: (location: any) => void;
}) {
  const [filterText, setFilterText] = createSignal("");

  const globalSearchResults = () => {
    const query = filterText().trim().toLowerCase();
    if (!query) return [];
    return props.locations.filter(l => l.name.toLowerCase().includes(query));
  };

  const pathSteps = () => {
    return [null, ...props.activePath];
  };

  let scrollRef: HTMLDivElement | undefined;

  createEffect(on(() => props.activePath.length, () => {
    if (scrollRef) {
      setTimeout(() => {
        scrollRef!.scrollTo({ left: scrollRef!.scrollWidth, behavior: 'smooth' });
      }, 50);
    }
  }));

  return (
    <div class="flex flex-col gap-3">
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideInRight 0.3s ease-out forwards;
        }
      `}</style>

      {/* Global Location Search Input */}
      <div class="relative max-w-sm">
        <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={filterText()}
          onInput={(e) => setFilterText(e.target.value)}
          placeholder="Search all storage locations..."
          class="glass-input !pl-9 !pr-8 py-1.5 text-xs w-full"
        />
        <Show when={filterText()}>
          <button
            onClick={() => setFilterText("")}
            class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded transition-colors"
            title="Clear search"
          >
            <X size={12} />
          </button>
        </Show>
      </div>

      {/* View Switcher: Global Search List vs. Miller Columns */}
      <Show when={filterText().trim() !== ""} fallback={
        <div ref={scrollRef} class="flex overflow-x-auto gap-4 pb-4 snap-x items-start">
          <For each={pathSteps()}>
            {(parentId) => {
              const parentLoc = () => parentId ? props.locations.find(l => l.id === parentId) : null;
              const title = () => parentLoc() ? parentLoc()!.name : "Root Locations";
              const items = () => props.locations
                .filter(l => l.parent_id === parentId)
                .sort((a, b) => a.index - b.index);

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

              const capacity = () => layoutType() === "linear" ? dims()[0] : (layoutType() === "grid" ? dims()[0] * dims()[1] : 0);
              const colWidth = () => layoutType() === "grid" ? Math.max(250, dims()[0] * 45) : 250;

              return (
                <div
                  class="flex-shrink-0 glass-panel border border-white/10 rounded-xl overflow-hidden snap-start flex flex-col min-h-[260px] h-fit animate-slide-in"
                  style={{ width: `${colWidth()}px`, "min-width": `${colWidth()}px` }}
                >
                  <div class="p-3 bg-white/5 border-b border-white/10 flex justify-between items-start text-white">
                    <div class="overflow-hidden pr-2">
                      <div class="font-bold text-xs truncate">{title()}</div>
                      <Show when={parentLoc() && parentLoc()!.description}>
                        <div class="text-[10px] text-gray-400 truncate mt-0.5">{parentLoc()!.description}</div>
                      </Show>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <Show when={parentLoc() && !props.pickerMode}>
                        <button
                          onClick={() => props.onEditLocation(parentLoc()!)}
                          class="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                          title="Edit Location"
                        >
                          <Pencil size={14} />
                        </button>
                      </Show>
                      <Show when={layoutType() === "default" && !parentLoc()?.part_id && !props.pickerMode}>
                        <button
                          onClick={() => props.onCreateChild(parentId)}
                          class="p-1 hover:bg-white/10 rounded text-accentCyan transition-colors"
                          title="Add Child Location"
                        >
                          <Plus size={14} />
                        </button>
                      </Show>
                    </div>
                  </div>

                  <Show when={parentLoc()?.part_id && parentLoc()?.part}>
                    <div class="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-4 bg-accentCyan/5">
                      <div class="w-20 h-20 rounded-full bg-accentCyan/20 flex items-center justify-center border border-accentCyan/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                        <Package size={40} class="text-accentCyan" />
                      </div>
                      <div>
                        <div class="text-base font-bold text-white">{parentLoc()!.part.value}</div>
                        <div class="text-xs text-gray-300 mt-1">
                          <span class="font-bold text-white">{parentLoc()!.part.name}</span>
                          <Show when={parentLoc()!.part.number}>
                            <div class="text-[10px] font-mono text-gray-500 mt-2 flex items-center justify-center gap-1">
                              <Hash size={12} /> {parentLoc()!.part.number}
                            </div>
                          </Show>
                        </div>
                      </div>
                      <div class="px-4 py-2 bg-white/10 rounded-xl text-sm font-mono border border-white/20 text-gray-300">
                        Stock Qty: <span class="text-white font-bold text-base">{parentLoc()!.quantity}</span>
                      </div>
                      <Show when={!props.pickerMode}>
                        <button
                          onClick={() => props.onMoveParts?.(parentLoc()!)}
                          class="mt-2 btn-secondary text-xs flex items-center gap-1.5 px-3.5 py-2 bg-accentCyan/10 border-accentCyan/30 text-accentCyan hover:bg-accentCyan/20 transition-all rounded-xl font-semibold shadow-lg hover:shadow-accentCyan/10"
                          title="Re-home or move parts stored at this location"
                        >
                          <Move size={14} /> Re-home Parts
                        </button>
                      </Show>
                      <Show when={props.pickerMode}>
                        <div class="mt-4 text-xs text-red-400 font-bold px-3 py-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
                          Cannot move into a location with parts
                        </div>
                      </Show>
                    </div>
                  </Show>

                  <Show when={layoutType() === "default" && !parentLoc()?.part_id}>
                    <DragDropProvider
                      onDragEnd={(event) => {
                        const droppable = event.droppable;
                        const draggable = event.draggable;
                        if (droppable && draggable && droppable.id !== draggable.id) {
                          const currentItems = items();
                          const oldIndex = currentItems.findIndex(i => i.id === draggable.id);
                          const newIndex = currentItems.findIndex(i => i.id === droppable.id);
                          if (oldIndex !== -1 && newIndex !== -1) {
                            const newItems = [...currentItems];
                            const [moved] = newItems.splice(oldIndex, 1);
                            newItems.splice(newIndex, 0, moved);
                            // Recalculate sequential indices
                            const reordered = newItems.map((item, idx) => ({ id: item.id, index: idx }));
                            if (props.onReorder) {
                              props.onReorder(reordered);
                            }
                          }
                        }
                      }}
                      collisionDetector={closestCenter}
                    >
                      <DragDropSensors />
                      <div class="p-2 space-y-1">
                        <SortableProvider ids={items().map(i => i.id)}>
                          <For each={items()}>
                            {(item) => (
                              <SortableItem
                                item={item}
                                activePath={props.activePath}
                                locations={props.locations}
                                onSelect={props.onSelect}
                              />
                            )}
                          </For>
                        </SortableProvider>
                        <Show when={items().length === 0}>
                          <div class="text-[10px] text-gray-500 text-center p-4">Empty</div>
                        </Show>
                        <Show when={props.pickerMode}>
                          <button
                            onClick={() => props.onPickerSelect?.(parentId, items().length)}
                            class="w-full mt-2 min-h-[32px] rounded-lg border border-dashed border-accentCyan/30 hover:border-accentCyan hover:bg-accentCyan/10 text-accentCyan flex items-center justify-center gap-2 transition-colors text-xs"
                          >
                            <MapPin size={12} /> Move Here
                          </button>
                        </Show>
                      </div>
                    </DragDropProvider>
                  </Show>

                  <Show when={layoutType() === "linear" && !parentLoc()?.part_id}>
                    <div class="p-2 flex flex-col gap-1">
                      <For each={Array.from({ length: capacity() })}>
                        {(_, i) => {
                          const idx = i();
                          const item = () => items().find(it => it.index === idx);
                          const isCreatingHere = () => props.isCreating && props.creatingParentId === parentId && props.creatingIndex === idx;

                          return (
                            <Show
                              when={item()}
                              fallback={
                                <Show
                                  when={props.pickerMode}
                                  fallback={
                                    <button
                                      onClick={() => props.onCreateChild(parentId, idx)}
                                      class={`w-full min-h-[32px] rounded-lg border transition-colors flex items-center px-2 gap-2 group ${isCreatingHere() ? 'border-accentCyan bg-accentCyan/20 text-accentCyan' : 'border-dashed border-white/10 hover:border-accentCyan/50 hover:bg-accentCyan/10 text-gray-600 hover:text-accentCyan'}`}
                                      title={`Create Location at Slot ${idx + 1}`}
                                    >
                                      <div class={`text-[9px] font-mono w-4 text-right shrink-0 ${isCreatingHere() ? 'text-accentCyan' : 'group-hover:text-accentCyan/50'}`}>{idx + 1}</div>
                                      <Plus size={10} />
                                    </button>
                                  }
                                >
                                  <button
                                    onClick={() => props.onPickerSelect?.(parentId, idx)}
                                    class="w-full min-h-[32px] rounded-lg border border-dashed border-accentCyan/30 hover:border-accentCyan hover:bg-accentCyan/10 text-accentCyan flex items-center justify-center transition-colors"
                                    title={`Move Location to Slot ${idx + 1}`}
                                  >
                                    <MapPin size={12} />
                                  </button>
                                </Show>
                              }
                            >
                              {(loc) => {
                                const isActive = () => props.activePath.includes(loc().id);
                                const hasChildren = () => props.locations.some(l => l.parent_id === loc().id);
                                const isEmptyLeaf = () => !hasChildren() && !loc().part_id;
                                return (
                                  <button
                                    onClick={() => props.onSelect(loc().id)}
                                    class={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors border ${isActive()
                                      ? 'bg-accentCyan/20 border-accentCyan/30 text-white'
                                      : isEmptyLeaf()
                                        ? 'bg-amber-500/10 border-dashed border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                                        : 'border-transparent hover:bg-white/5 text-gray-300'
                                      }`}
                                  >
                                    <div class="flex items-center gap-2 truncate">
                                      <div class="text-[9px] font-mono text-gray-500 w-4 text-right shrink-0">{idx + 1}</div>
                                      <span class="truncate">{loc().name}</span>
                                      <Show when={isEmptyLeaf()}>
                                        <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 font-mono ml-auto mr-1" title="Dangling Location: Location has no sub-locations and no assigned part.">
                                          empty
                                        </span>
                                      </Show>
                                    </div>
                                    <Show when={hasChildren()}>
                                      <ChevronRight size={14} class="text-gray-500" />
                                    </Show>
                                  </button>
                                );
                              }}
                            </Show>
                          );
                        }}
                      </For>
                    </div>
                  </Show>

                  <Show when={layoutType() === "grid" && !parentLoc()?.part_id}>
                    <div
                      class="p-2 grid gap-1"
                      style={{ "grid-template-columns": `repeat(${dims()[0]}, minmax(0, 1fr))` }}
                    >
                      <For each={Array.from({ length: capacity() })}>
                        {(_, i) => {
                          const idx = i();
                          const item = () => items().find(it => it.index === idx);
                          const isCreatingHere = () => props.isCreating && props.creatingParentId === parentId && props.creatingIndex === idx;

                          return (
                            <Show
                              when={item()}
                              fallback={
                                <Show
                                  when={props.pickerMode}
                                  fallback={
                                    <button
                                      onClick={() => props.onCreateChild(parentId, idx)}
                                      class={`aspect-square w-full rounded border transition-colors flex items-center justify-center ${isCreatingHere() ? 'border-accentCyan bg-accentCyan/20 text-accentCyan shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'border-dashed border-white/10 hover:border-accentCyan/50 hover:bg-accentCyan/10 text-gray-600 hover:text-accentCyan'}`}
                                      title={`Create Location at Grid Index ${idx}`}
                                    >
                                      <Plus size={10} />
                                    </button>
                                  }
                                >
                                  <button
                                    onClick={() => props.onPickerSelect?.(parentId, idx)}
                                    class="aspect-square w-full rounded border border-dashed border-accentCyan/30 hover:border-accentCyan hover:bg-accentCyan/10 text-accentCyan flex items-center justify-center transition-colors"
                                    title={`Move Location to Grid Index ${idx}`}
                                  >
                                    <MapPin size={12} />
                                  </button>
                                </Show>
                              }
                            >
                              {(loc) => {
                                const isActive = () => props.activePath.includes(loc().id);
                                const hasChildren = () => props.locations.some(l => l.parent_id === loc().id);
                                const isEmptyLeaf = () => !hasChildren() && !loc().part_id;
                                return (
                                  <button
                                    onClick={() => props.onSelect(loc().id)}
                                    title={isEmptyLeaf() ? `${loc().name} (Dangling Location: No sub-locations or assigned part)` : loc().name}
                                    class={`aspect-square w-full rounded flex flex-col items-center justify-center transition-colors border p-1 relative ${isActive()
                                      ? 'bg-accentCyan/20 border-accentCyan/30 text-white shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                                      : isEmptyLeaf()
                                        ? 'bg-amber-500/10 border-dashed border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                                        : 'border-white/5 hover:border-white/20 bg-white/[0.02] hover:bg-white/5 text-gray-300'
                                      }`}
                                  >
                                    <span class="break-words whitespace-normal line-clamp-3 text-[9px] w-full text-center leading-tight font-medium">{loc().name}</span>
                                    <Show when={isEmptyLeaf() && !isActive()}>
                                      <div class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.6)]" title="Dangling Location: Location has no sub-locations and no assigned part" />
                                    </Show>
                                  </button>
                                );
                              }}
                            </Show>
                          );
                        }}
                      </For>
                    </div>
                  </Show>

                </div>
              );
            }}
          </For>
        </div>
      }>
        {/* Global Search Results Panel */}
        <div class="glass-panel border border-white/10 rounded-xl p-4 space-y-2">
          <div class="text-xs text-gray-400 font-semibold mb-3 flex items-center justify-between">
            <span>Matching Locations for "{filterText()}"</span>
            <span class="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">
              {globalSearchResults().length} result(s)
            </span>
          </div>

          <Show when={globalSearchResults().length === 0}>
            <div class="text-center py-12 text-gray-500 text-xs">
              No locations found matching "{filterText()}"
            </div>
          </Show>

          <For each={globalSearchResults()}>
            {(item) => {
              const fullPathString = getLocationPathString(item, props.locations);
              return (
                <div
                  onClick={() => {
                    const fullPathIds = getLocationAncestorIds(item, props.locations);
                    if (props.onSelectSearchPath) {
                      props.onSelectSearchPath(fullPathIds);
                    } else {
                      props.onSelect(item.id);
                    }
                    setFilterText("");
                  }}
                  class="glass-card hover:bg-white/10 p-3 rounded-lg border border-white/5 cursor-pointer flex items-center justify-between gap-3 group transition-colors"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="p-2 rounded-lg bg-accentCyan/10 text-accentCyan border border-accentCyan/20 shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="font-bold text-white text-xs truncate group-hover:text-accentCyan transition-colors">
                        {item.name}
                      </span>
                      <span class="text-[11px] text-gray-400 truncate mt-0.5">
                        {fullPathString}
                      </span>
                    </div>
                  </div>

                  <Show when={item.part_id && item.part}>
                    <div class="px-2 py-1 bg-white/5 rounded text-[10px] text-gray-300 font-mono shrink-0 flex items-center gap-1 border border-white/10">
                      <Package size={12} class="text-accentCyan" />
                      {item.part.value || item.part.number}
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
