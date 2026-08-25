import { createSignal, onMount, Show } from "solid-js";
import { MapPin, Plus } from "lucide-solid";
import { apiFetch } from "../hooks/useAuth";
import toast from "solid-toast";
import LabelPreviewModal from "../components/LabelPreviewModal";
import StorageColumns from "../components/storage/StorageColumns";
import LocationEditModal from "../components/storage/LocationEditModal";
import LocationMoveModal from "../components/storage/LocationMoveModal";
import MovePartModal from "../components/storage/MovePartModal";
import PartsBrowser from "../components/storage/PartsBrowser";
import PartDetails from "./PartDetails";
import ScaleModal from "../components/ScaleModal";
import { useConfirm } from "../contexts/ConfirmContext";

export default function Storage() {
  const { confirm } = useConfirm();
  const [locations, setLocations] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  
  // Storage Location Form State
  const [locName, setLocName] = createSignal("");
  const [locDesc, setLocDesc] = createSignal("");
  const [locParentId, setLocParentId] = createSignal<string | null>(null);
  const [locIndex, setLocIndex] = createSignal(0);
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  
  // Edit Location Modal State
  const [editLocation, setEditLocation] = createSignal<any | null>(null);
  
  // Move Location Modal State
  const [moveLocation, setMoveLocation] = createSignal<any | null>(null);

  // Move Part Modal State (Re-home parts at location)
  const [movePartLocation, setMovePartLocation] = createSignal<any | null>(null);

  // Navigation State
  const [activePath, setActivePath] = createSignal<string[]>([]);
  
  // Parts Browser & Inline Part Details
  const [inlinePartId, setInlinePartId] = createSignal<string | null>(null);
  const [isAutoSelected, setIsAutoSelected] = createSignal(false);
  
  // Printing Reference Tags
  const [activePrintLocation, setActivePrintLocation] = createSignal<any | null>(null);

  // Scale Modal State
  const [showScaleModal, setShowScaleModal] = createSignal(false);
  const [scaleTargetLocation, setScaleTargetLocation] = createSignal<any | null>(null);
  const [scalePart, setScalePart] = createSignal<any | null>(null);

  const handleScaleLocation = async (loc: any) => {
    if (!loc || !loc.part_id) return;
    try {
      const fullPart = await apiFetch(`/parts/${loc.part_id}`);
      setScalePart(fullPart);
    } catch (_) {
      setScalePart(loc.part || { id: loc.part_id });
    }
    setScaleTargetLocation(loc);
    setShowScaleModal(true);
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const locRes = await apiFetch("/locations?flat=true");
      setLocations(locRes);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const updateUrlHistory = (path: string[], replace = false) => {
    const url = new URL(window.location.href);
    if (path.length > 0) {
      url.searchParams.set("locPath", path.join(","));
    } else {
      url.searchParams.delete("locPath");
    }
    if (replace) {
      window.history.replaceState({ activePath: path }, "", url.toString());
    } else {
      window.history.pushState({ activePath: path }, "", url.toString());
    }
  };

  onMount(() => {
    loadData();

    // Initialize activePath from URL if present
    const params = new URLSearchParams(window.location.search);
    const locParam = params.get("locPath");
    if (locParam) {
      const initialPath = locParam.split(",").filter(Boolean);
      setActivePath(initialPath);
      window.history.replaceState({ activePath: initialPath }, "", window.location.href);
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state && Array.isArray(e.state.activePath)) {
        setActivePath(e.state.activePath);
      } else {
        const p = new URLSearchParams(window.location.search).get("locPath");
        setActivePath(p ? p.split(",").filter(Boolean) : []);
      }
    };

    window.addEventListener("popstate", handlePopState);
  });

  let nameInputRef: HTMLInputElement | undefined;

  const getAncestorChain = (locId: string, allLocs: any[]): string[] => {
    const chain: string[] = [];
    let curr = allLocs.find(l => l.id === locId);
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      chain.unshift(curr.id);
      if (curr.parent_id) {
        curr = allLocs.find(l => l.id === curr.parent_id);
      } else {
        curr = null;
      }
    }
    return chain;
  };

  const handleSelectNode = (id: string) => {
    const newPath = getAncestorChain(id, locations());
    if (newPath.length > 0) {
      setActivePath(newPath);
      updateUrlHistory(newPath);
    }
    setShowCreateForm(false);
    setInlinePartId(null); // reset inline part view when navigating
  };

  const handleSelectSearchPath = (pathIds: string[]) => {
    setActivePath(pathIds);
    updateUrlHistory(pathIds);
    setShowCreateForm(false);
    setInlinePartId(null);
  };

  const handleCreateLocation = async (e: Event) => {
    e.preventDefault();
    if (!locName()) return;
    try {
      const newLoc = await apiFetch("/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: locName(),
          description: locDesc(),
          parent_id: locParentId(),
          index: locIndex()
        })
      });
      
      setLocName("");
      setLocDesc("");
      setLocParentId(null);
      setLocIndex(0);
      setShowCreateForm(false);
      
      await loadData(true);

      if (newLoc && newLoc.id) {
        handleSelectNode(newLoc.id);
      }

      toast.success("Storage location created successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create storage location.");
    }
  };

  const handleReorderLocation = async (items: { id: string; index: number }[]) => {
    try {
      // Optimistically update UI state to avoid flicker
      const updatedLocations = [...locations()];
      for (const item of items) {
        const idx = updatedLocations.findIndex(l => l.id === item.id);
        if (idx !== -1) {
          updatedLocations[idx] = { ...updatedLocations[idx], index: item.index };
        }
      }
      setLocations(updatedLocations);

      await apiFetch("/locations/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      loadData(true); // Ensure synchronization silently
    } catch (err: any) {
      toast.error(err.message || "Failed to reorder locations.");
      loadData(true); // Revert on failure
    }
  };

  const handleDeleteLocation = async (locId: string) => {
    try {
      await apiFetch(`/locations/${locId}`, { method: "DELETE" });
      
      const pathIdx = activePath().indexOf(locId);
      if (pathIdx !== -1) {
        setActivePath(activePath().slice(0, pathIdx));
      }
      
      setEditLocation(null);
      await loadData(true);
      toast.success("Location deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete location.");
    }
  };

  const handleCollapseToParent = async (childLoc: any, parentLoc: any) => {
    if (!childLoc || !childLoc.id || !parentLoc || !parentLoc.id) {
      toast.error("Invalid storage location selected for promotion.");
      return;
    }

    const childId = String(childLoc.id);
    const parentId = String(parentLoc.id);
    const partName = childLoc.part?.value || "part";

    const isConfirmed = await confirm({
      title: "Promote Part to Parent Container",
      message: `Promote '${partName}' directly to '${parentLoc.name}' and remove intermediate location '${childLoc.name}'?`,
      confirmText: "Promote & Clean Up",
      type: "warning"
    });
    if (!isConfirmed) return;

    try {
      await apiFetch(`/locations/${childId}/collapse`, {
        method: "POST"
      });

      toast.success(`Promoted '${partName}' to '${parentLoc.name}' and removed '${childLoc.name}'!`);

      const freshLocs = await apiFetch("/locations?flat=true");
      setLocations(freshLocs);

      const parentChain = getAncestorChain(parentId, freshLocs);
      setActivePath(parentChain);
      updateUrlHistory(parentChain);
    } catch (err: any) {
      toast.error(err.message || "Failed to promote part.");
      try {
        const freshLocs = await apiFetch("/locations?flat=true");
        setLocations(freshLocs);
        const parentChain = getAncestorChain(parentId, freshLocs);
        setActivePath(parentChain);
      } catch (_) {}
    }
  };

  const activeNode = () => {
    const path = activePath();
    if (path.length === 0) return null;
    return locations().find(l => l.id === path[path.length - 1]);
  };

  return (
    <div class="space-y-6 flex flex-col">
      {/* Page Header */}
      <div>
        <h2 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <MapPin class="text-accentCyan" />
          Storage Structure Designer
        </h2>
        <p class="text-gray-400 text-sm">Navigate and define storage containers using Miller Columns.</p>
      </div>

      <Show when={loading()}>
        <div class="glass-panel p-8 rounded-2xl animate-pulse h-64"></div>
      </Show>

      <Show when={!loading()}>
        {/* Top: Miller Columns */}
        <div class="relative w-full">
          <StorageColumns 
            locations={locations()} 
            activePath={activePath()}
            onSelect={handleSelectNode}
            onSelectSearchPath={handleSelectSearchPath}
            onCreateChild={(parentId, index = 0) => {
              setLocParentId(parentId);
              setLocIndex(index);
              setShowCreateForm(true);
              setTimeout(() => {
                nameInputRef?.focus();
              }, 50);
            }}
            onEditLocation={(loc) => setEditLocation(loc)}
            creatingParentId={locParentId()}
            creatingIndex={locIndex()}
            isCreating={showCreateForm()}
            onReorder={handleReorderLocation}
            onMoveParts={(loc) => setMovePartLocation(loc)}
            onCollapseToParent={handleCollapseToParent}
            onStorageChanged={() => loadData(true)}
            onPrint={(loc) => setActivePrintLocation(loc)}
            onScale={handleScaleLocation}
            onDeleteLocation={(loc) => handleDeleteLocation(String(loc.id))}
          />
        </div>
        
        {/* Creation Form Overlay (if needed) */}
        <Show when={showCreateForm()}>
          <div class="glass-panel p-5 rounded-xl border border-white/10 shrink-0">
            <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Plus size={16} class="text-accentCyan" />
              Add Storage Slot {locParentId() ? `to ${locations().find(l => l.id === locParentId())?.name}` : "to Root"}
            </h3>
            
            <form onSubmit={handleCreateLocation} class="flex items-end gap-4 text-xs">
              <div class="flex-1">
                <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Name</label>
                <input
                  ref={(el) => {
                    nameInputRef = el;
                    setTimeout(() => el?.focus(), 50);
                  }}
                  type="text"
                  required
                  value={locName()}
                  onInput={(e) => setLocName(e.target.value)}
                  placeholder="E.g. Drawer 1"
                  class="glass-input w-full text-xs"
                />
              </div>
              <div class="flex-1">
                <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Description</label>
                <input
                  type="text"
                  value={locDesc()}
                  onInput={(e) => setLocDesc(e.target.value)}
                  placeholder="Optional details"
                  class="glass-input w-full text-xs"
                />
              </div>
              <div class="flex gap-2 w-48 shrink-0">
                <button type="button" onClick={() => setShowCreateForm(false)} class="btn-secondary flex-1 py-2 text-xs">Cancel</button>
                <button type="submit" class="btn-primary flex-1 py-2 text-xs">Save</button>
              </div>
            </form>
          </div>
        </Show>

        {/* Bottom: Aggregated Parts Browser or Inline Details */}
        <div class="w-full">
          <Show when={activeNode() && !inlinePartId()}>
            <PartsBrowser 
              locationId={activeNode().id}
              onSelectPart={(part) => {
                setIsAutoSelected(false);
                setInlinePartId(part.id);
              }}
              onAutoSelect={(part) => {
                setIsAutoSelected(true);
                setInlinePartId(part.id);
              }}
            />
          </Show>
          
          <Show when={inlinePartId()}>
            <div class="glass-panel p-6 rounded-2xl border border-white/5 bg-dark/50">
              <PartDetails 
                id={inlinePartId()!} 
                onCloseInline={() => setInlinePartId(null)}
                hideBackButton={isAutoSelected()}
              />
            </div>
          </Show>
          
          <Show when={!activeNode()}>
            <div class="bg-black/20 p-8 rounded-xl border border-white/5 text-center text-gray-500 text-sm">
              Select a location above to browse its parts.
            </div>
          </Show>
        </div>
      </Show>

      {/* Edit Location Modal */}
      <Show when={editLocation()}>
        <LocationEditModal
          location={editLocation()}
          locations={locations()}
          onClose={() => setEditLocation(null)}
          onUpdate={() => loadData(true)}
          onPrint={(loc) => {
            setEditLocation(null);
            setActivePrintLocation(loc);
          }}
          onDelete={handleDeleteLocation}
          onMove={(loc) => {
            setEditLocation(null);
            setMoveLocation(loc);
          }}
        />
      </Show>

      {/* Move Location Modal */}
      <Show when={moveLocation()}>
        <LocationMoveModal
          location={moveLocation()}
          allLocations={locations()}
          onClose={() => setMoveLocation(null)}
          onMoved={() => {
            const movedLoc = moveLocation();
            if (movedLoc) {
              const idx = activePath().indexOf(movedLoc.id);
              if (idx !== -1) {
                setActivePath(activePath().slice(0, idx));
              }
            }
            setMoveLocation(null);
            loadData(true);
          }}
        />
      </Show>

      {/* Re-Home / Move Part Modal */}
      <Show when={movePartLocation()}>
        <MovePartModal
          location={movePartLocation()}
          allLocations={locations()}
          onClose={() => setMovePartLocation(null)}
          onMoved={() => {
            setMovePartLocation(null);
            loadData(true);
          }}
        />
      </Show>

      {/* Label Print Modal */}
      <LabelPreviewModal
        location={activePrintLocation()}
        onClose={() => setActivePrintLocation(null)}
      />

      {/* Scale Counting Modal */}
      <Show when={showScaleModal()}>
        <ScaleModal
          isOpen={showScaleModal()}
          onClose={() => setShowScaleModal(false)}
          part={scalePart()}
          storageLocation={scaleTargetLocation()}
          onSuccess={() => {
            setShowScaleModal(false);
            loadData(true);
          }}
        />
      </Show>
    </div>
  );
}
