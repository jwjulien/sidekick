import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { 
  PackageCheck, 
  MapPin, 
  Barcode, 
  RefreshCw, 
  AlertCircle,
  HelpCircle
} from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";
import toast from "solid-toast";
import UniversalPartsBrowser from "../components/parts/UniversalPartsBrowser";
import AssignLocationModal from "../components/parts/AssignLocationModal";

export default function HomelessParts() {
  const navigate = useNavigate();
  const [homelessParts, setHomelessParts] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [reasonFilter, setReasonFilter] = createSignal<string>("");

  // Selection & Modal state
  const [selectedParts, setSelectedParts] = createSignal<any[]>([]);
  const [assignModalOpen, setAssignModalOpen] = createSignal(false);
  const [activePartsForModal, setActivePartsForModal] = createSignal<any[]>([]);

  const fetchHomelessParts = async () => {
    setLoading(true);
    try {
      let url = "/parts/homeless";
      if (reasonFilter()) {
        url += `?reason=${reasonFilter()}`;
      }
      const data = await apiFetch(url);
      setHomelessParts(data || []);
      // Clear selection if parts list changes
      setSelectedParts([]);
    } catch (err: any) {
      console.error("Failed to fetch homeless parts:", err);
      toast.error("Failed to load homeless parts list.");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchHomelessParts();

    // Attach listener for hardware barcode scanners
    window.addEventListener("keydown", handleGlobalKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown);
  });

  // Simple buffer listener for physical USB / Bluetooth barcode scanners
  let barcodeBuffer = "";
  let lastKeyTime = 0;

  const handleGlobalKeyDown = async (e: KeyboardEvent) => {
    // Ignore input if focused inside a text field / input element
    const activeElem = document.activeElement;
    if (activeElem && (activeElem.tagName === "INPUT" || activeElem.tagName === "TEXTAREA")) {
      return;
    }

    const currentTime = Date.now();
    if (currentTime - lastKeyTime > 100) {
      barcodeBuffer = "";
    }
    lastKeyTime = currentTime;

    if (e.key === "Enter") {
      if (barcodeBuffer.length >= 3) {
        const code = barcodeBuffer.trim();
        barcodeBuffer = "";
        handleBarcodeScanned(code);
      }
    } else if (e.key.length === 1) {
      barcodeBuffer += e.key;
    }
  };

  const handleBarcodeScanned = async (barcode: string) => {
    toast(`Scanned location barcode: ${barcode}`);
    
    // Check if barcode matches a location
    try {
      const locs = await apiFetch("/locations?flat=true");
      const match = locs.find((l: any) => l.id === barcode || l.name.toLowerCase() === barcode.toLowerCase());
      
      if (!match) {
        toast.error(`No storage location found matching barcode '${barcode}'.`);
        return;
      }

      // If we have selected parts or a single part, assign immediately!
      const targets = selectedParts().length > 0 ? selectedParts() : (homelessParts().length > 0 ? [homelessParts()[0]] : []);
      if (targets.length === 0) {
        toast.error("No homeless parts available to assign.");
        return;
      }

      if (targets.length === 1) {
        await apiFetch("/locations/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            part_id: targets[0].id,
            location_id: match.id,
            quantity: targets[0].threshold || 1,
            notes: `Assigned via barcode scan '${barcode}'`
          })
        });
        toast.success(`Scan-assigned part '${targets[0].value}' to ${match.name}!`);
      } else {
        await apiFetch("/locations/bulk-assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            part_ids: targets.map(t => t.id),
            location_id: match.id,
            quantity: 0,
            notes: `Batch assigned via barcode scan '${barcode}'`
          })
        });
        toast.success(`Scan-assigned ${targets.length} parts to ${match.name}!`);
      }

      fetchHomelessParts();
    } catch (err: any) {
      toast.error(err.message || "Failed to process barcode scan.");
    }
  };

  const openModalForSelected = () => {
    if (selectedParts().length === 0) {
      toast.error("Please select at least one homeless part using checkboxes.");
      return;
    }
    setActivePartsForModal(selectedParts());
    setAssignModalOpen(true);
  };

  const openModalForPart = (part: any) => {
    setActivePartsForModal([part]);
    setAssignModalOpen(true);
  };

  return (
    <div class="space-y-6">
      {/* View Header */}
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <PackageCheck class="text-accentCyan" size={26} />
            Homeless Parts Browser & Organizer
          </h2>
          <p class="text-gray-400 text-sm mt-1">
            Triage, inspect, and assign unassigned inventory records into physical storage bins.
          </p>
        </div>

        {/* Action Controls */}
        <div class="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchHomelessParts}
            class="btn-secondary p-2.5 flex items-center justify-center text-gray-400 hover:text-white"
            title="Refresh List"
          >
            <RefreshCw size={16} class={loading() ? "animate-spin text-accentCyan" : ""} />
          </button>

          <button
            onClick={openModalForSelected}
            disabled={selectedParts().length === 0 || user()?.role === "viewer"}
            class={`btn-primary flex items-center gap-2 text-sm font-semibold transition-all ${
              selectedParts().length === 0 ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <MapPin size={16} />
            {selectedParts().length > 1
              ? `Bulk Assign Location (${selectedParts().length})`
              : "Assign Location"}
          </button>
        </div>
      </div>

      {/* Overview Banner & Reason Filter Tabs */}
      <div class="glass-card p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-white text-sm">Unassigned Inventory Ledger</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {homelessParts().length} Homeless Part{homelessParts().length === 1 ? "" : "s"}
              </span>
            </div>
            <p class="text-xs text-gray-400 mt-0.5">
              Parts ingested without initial storage or orphaned during bin reorganizations.
            </p>
          </div>
        </div>

        {/* Reason Filter Dropdown */}
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <label class="text-xs text-gray-400 font-semibold uppercase">Filter Reason:</label>
          <select
            value={reasonFilter()}
            onChange={(e) => {
              setReasonFilter(e.currentTarget.value);
              fetchHomelessParts();
            }}
            class="glass-input text-xs py-1.5 px-3 bg-black/40 border border-white/10"
          >
            <option value="">All Homeless Parts</option>
            <option value="new_entry">New Ingestion (No Storage Yet)</option>
            <option value="location_deleted">Location Deleted / Cleared</option>
          </select>
        </div>
      </div>

      {/* Universal Parts Browser Component in Selection Mode */}
      <UniversalPartsBrowser
        parts={homelessParts()}
        loading={loading()}
        title="Unassigned Homeless Components"
        mode="table"
        selectionMode="multiple"
        unassignedOnly={true}
        onBulkSelect={(parts) => setSelectedParts(parts)}
        onSelectPart={(part) => navigate(`/parts/${part.id}`)}
        customActions={(part) => (
          <button
            onClick={() => openModalForPart(part)}
            disabled={user()?.role === "viewer"}
            class="px-3 py-1 text-xs bg-accentCyan/20 text-accentCyan hover:bg-accentCyan/30 border border-accentCyan/30 rounded-lg font-medium transition-colors flex items-center gap-1.5 ml-auto"
          >
            <MapPin size={12} />
            Assign
          </button>
        )}
      />

      {/* Footer Mobile Scanning Tip */}
      <div class="glass-panel p-4 rounded-xl border border-white/5 flex items-center justify-between text-xs text-gray-400">
        <div class="flex items-center gap-2">
          <Barcode size={18} class="text-accentCyan" />
          <span>
            <strong>Barcode Direct Assign:</strong> Point handheld scanner at any bin barcode to instantly assign selected homeless part(s).
          </span>
        </div>
        <div class="flex items-center gap-1 text-[10px] text-gray-500">
          <HelpCircle size={12} /> Keyboard listener active
        </div>
      </div>

      {/* Assign Location Dialog Modal */}
      <Show when={assignModalOpen()}>
        <AssignLocationModal
          parts={activePartsForModal()}
          onClose={() => setAssignModalOpen(false)}
          onAssigned={() => {
            fetchHomelessParts();
            toast.success("Homeless parts inventory refreshed.");
          }}
        />
      </Show>
    </div>
  );
}
