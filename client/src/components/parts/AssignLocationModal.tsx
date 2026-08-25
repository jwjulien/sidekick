import { createSignal, onMount, For, Show } from "solid-js";
import { X, MapPin, Search, Plus, CheckCircle, Package } from "lucide-solid";
import { apiFetch } from "../../hooks/useAuth";
import toast from "solid-toast";
import InlineLocationCreator from "./InlineLocationCreator";

interface AssignLocationModalProps {
  parts: any[];
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignLocationModal(props: AssignLocationModalProps) {
  const [locations, setLocations] = createSignal<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = createSignal("");
  const [searchLocation, setSearchLocation] = createSignal("");
  const [quantity, setQuantity] = createSignal(1);
  const [notes, setNotes] = createSignal("");
  const [showInlineCreate, setShowInlineCreate] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [loadingLocs, setLoadingLocs] = createSignal(true);

  const isBulk = () => props.parts.length > 1;
  const singlePart = () => (props.parts.length === 1 ? props.parts[0] : null);

  const fetchLocations = async () => {
    setLoadingLocs(true);
    try {
      const data = await apiFetch("/locations?flat=true");
      setLocations(data || []);
      
      // Default quantity for single part
      const p = singlePart();
      if (p) {
        setQuantity(p.threshold && p.threshold > 0 ? p.threshold : 1);
      }
    } catch (err) {
      console.error("Failed to fetch locations:", err);
      toast.error("Failed to load storage locations.");
    } finally {
      setLoadingLocs(false);
    }
  };

  onMount(() => {
    fetchLocations();
  });

  const filteredLocations = () => {
    const term = searchLocation().trim().toLowerCase();
    if (!term) return locations();
    return locations().filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        (l.description && l.description.toLowerCase().includes(term))
    );
  };

  const handleLocationCreatedInline = (newLoc: any) => {
    setLocations([...locations(), newLoc]);
    setSelectedLocationId(newLoc.id);
    setShowInlineCreate(false);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!selectedLocationId()) {
      toast.error("Please select a target storage location.");
      return;
    }

    setSubmitting(true);
    try {
      if (isBulk()) {
        const payload = {
          part_ids: props.parts.map((p) => p.id),
          location_id: selectedLocationId(),
          quantity: quantity(),
          notes: notes().trim() || "Batch location assignment from Homeless Parts view"
        };
        await apiFetch("/locations/bulk-assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        toast.success(`Successfully batch assigned ${props.parts.length} parts to location!`);
      } else {
        const part = singlePart();
        const payload = {
          part_id: part.id,
          location_id: selectedLocationId(),
          quantity: quantity(),
          notes: notes().trim() || `Assigned location for ${part.value}`
        };
        await apiFetch("/locations/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        toast.success(`Assigned location for part '${part.value}'!`);
      }

      props.onAssigned();
      props.onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign location.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div class="glass-panel max-w-xl w-full rounded-2xl p-6 border border-white/10 relative my-8 space-y-6">
        {/* Header */}
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-xl font-bold text-white flex items-center gap-2">
              <MapPin class="text-accentCyan" size={22} />
              {isBulk() ? `Bulk Assign ${props.parts.length} Parts` : "Assign Storage Location"}
            </h3>
            <p class="text-xs text-gray-400 mt-1">
              Select or create a physical bin/container to triage unassigned components.
            </p>
          </div>
          <button
            onClick={props.onClose}
            class="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Selected Part(s) Summary */}
        <div class="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-2">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            Target Component{isBulk() ? "s" : ""}
          </span>
          <Show
            when={!isBulk()}
            fallback={
              <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                <For each={props.parts}>
                  {(p) => (
                    <span class="px-2.5 py-1 rounded-lg text-xs bg-accentCyan/10 text-accentCyan border border-accentCyan/20 flex items-center gap-1 font-semibold">
                      <Package size={12} /> {p.value} ({p.number || p.package || "Part"})
                    </span>
                  )}
                </For>
              </div>
            }
          >
            <div class="flex justify-between items-center text-sm">
              <div class="flex flex-col">
                <span class="font-bold text-white">{singlePart()?.value}</span>
                <span class="text-xs text-gray-400 font-mono">
                  {singlePart()?.number || singlePart()?.package || "No MPN"}
                </span>
              </div>
              <span class="text-xs px-2.5 py-1 rounded-full bg-accentCyan/10 text-accentCyan border border-accentCyan/20 font-semibold">
                Category: {singlePart()?.category?.title || singlePart()?.category?.name || "Uncategorized"}
              </span>
            </div>
          </Show>
        </div>

        {/* Location Selection & Form */}
        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <div class="flex justify-between items-center mb-1.5">
              <label class="block text-[10px] font-semibold text-gray-400 uppercase">
                Destination Storage Location *
              </label>
              <button
                type="button"
                onClick={() => setShowInlineCreate(!showInlineCreate())}
                class="text-xs text-accentCyan hover:text-white flex items-center gap-1 font-medium"
              >
                <Plus size={14} />
                {showInlineCreate() ? "Hide New Bin Form" : "Create Bin Inline"}
              </button>
            </div>

            {/* Inline Location Creator Form */}
            <Show when={showInlineCreate()}>
              <div class="mb-4">
                <InlineLocationCreator
                  locations={locations()}
                  onCreated={handleLocationCreatedInline}
                  onCancel={() => setShowInlineCreate(false)}
                />
              </div>
            </Show>

            {/* Search Location Input & Dropdown */}
            <Show when={!showInlineCreate()}>
              <div class="space-y-2">
                <div class="relative">
                  <Search size={16} class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search locations by name..."
                    value={searchLocation()}
                    onInput={(e) => setSearchLocation(e.currentTarget.value)}
                    class="glass-input w-full !pl-11 text-xs"
                  />
                </div>

                <Show when={loadingLocs()}>
                  <div class="py-6 flex items-center justify-center">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-accentCyan"></div>
                  </div>
                </Show>

                <Show when={!loadingLocs()}>
                  <div class="max-h-48 overflow-y-auto space-y-1 pr-1 bg-black/20 p-2 rounded-xl border border-white/5">
                    <Show
                      when={filteredLocations().length > 0}
                      fallback={
                        <div class="p-4 text-center text-xs text-gray-500">
                          No matching storage locations found.
                        </div>
                      }
                    >
                      <For each={filteredLocations()}>
                        {(loc) => (
                          <div
                            onClick={() => setSelectedLocationId(loc.id)}
                            class={`p-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                              selectedLocationId() === loc.id
                                ? "bg-accentCyan/20 text-accentCyan border border-accentCyan/40 font-bold"
                                : "hover:bg-white/5 text-gray-300 border border-transparent"
                            }`}
                          >
                            <div class="flex items-center gap-2">
                              <MapPin size={14} class="shrink-0 text-accentCyan" />
                              <div class="flex flex-col">
                                <span>{loc.name}</span>
                                <Show when={loc.description}>
                                  <span class="text-[10px] text-gray-500 font-normal">
                                    {loc.description}
                                  </span>
                                </Show>
                              </div>
                            </div>
                            <Show when={selectedLocationId() === loc.id}>
                              <CheckCircle size={16} class="text-accentCyan" />
                            </Show>
                          </div>
                        )}
                      </For>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Initial Stock Quantity Input */}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">
                Initial Stock Quantity
              </label>
              <input
                type="number"
                min="0"
                value={quantity()}
                onInput={(e) => setQuantity(parseInt(e.currentTarget.value) || 0)}
                class="glass-input w-full text-sm font-bold text-center"
              />
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">
                Audit Transaction Notes
              </label>
              <input
                type="text"
                placeholder="Optional triage details..."
                value={notes()}
                onInput={(e) => setNotes(e.currentTarget.value)}
                class="glass-input w-full text-xs"
              />
            </div>
          </div>

          {/* Actions */}
          <div class="flex justify-end pt-4 border-t border-white/10 gap-3">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting() || !selectedLocationId()}
              class="btn-primary flex items-center justify-center gap-2 text-xs min-w-[130px]"
            >
              {submitting() ? (
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "Confirm Assignment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
