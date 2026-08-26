import { createSignal, Show } from "solid-js";
import { X, Printer, Trash2, MapPin, Nfc } from "lucide-solid";
import { apiFetch } from "../../hooks/useAuth";
import toast from "solid-toast";

export default function LocationEditModal(props: {
  location: any;
  locations?: any[];
  hasChildren?: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onPrint: (loc: any) => void;
  onWriteNfc?: (loc: any) => void;
  onDelete: (id: string) => void;
  onMove: (loc: any) => void;
}) {
  const [name, setName] = createSignal(props.location.name);
  const [desc, setDesc] = createSignal(props.location.description || "");
  const [labelScheme, setLabelScheme] = createSignal(props.location.label_scheme || "");
  
  const hasChildren = () => {
    if (props.hasChildren !== undefined) return props.hasChildren;
    if (props.locations) return props.locations.some(l => String(l.parent_id) === String(props.location.id));
    return false;
  };

  const cannotDeleteReason = () => {
    if (hasChildren()) return "Cannot delete a location that contains child locations";
    if (props.location?.part_id && (props.location?.quantity || 0) > 0) return "Cannot delete a location with active part stock (quantity > 0)";
    return null;
  };

  const [layoutType, setLayoutType] = createSignal(
    !props.location.dimensions ? "default" : (props.location.dimensions.length === 1 ? "linear" : "grid")
  );
  const [len, setLen] = createSignal(props.location.dimensions?.length === 1 ? props.location.dimensions[0] : 10);
  const [cols, setCols] = createSignal(props.location.dimensions?.length === 2 ? props.location.dimensions[0] : 5);
  const [rows, setRows] = createSignal(props.location.dimensions?.length === 2 ? props.location.dimensions[1] : 5);

  const handleSave = async (e: Event) => {
    e.preventDefault();
    let dims = null;
    if (layoutType() === "linear") dims = [len()];
    else if (layoutType() === "grid") dims = [cols(), rows()];

    try {
      // First update layout
      await apiFetch(`/locations/${props.location.id}/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimensions: dims })
      });
      
      // Then update metadata
      await apiFetch(`/locations/${props.location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name(),
          description: desc(),
          label_scheme: labelScheme()
        })
      });
      
      toast.success("Location updated.");
      props.onUpdate();
      props.onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update location");
    }
  };

  return (
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-dark/90 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div class="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <h2 class="text-lg font-bold text-white">Edit Location</h2>
          <button onClick={props.onClose} class="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div class="p-6 overflow-y-auto space-y-6">
          <form id="edit-loc-form" onSubmit={handleSave} class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Name</label>
              <input type="text" class="glass-input w-full" value={name()} onInput={e => setName(e.target.value)} required />
            </div>
            
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Description</label>
              <textarea class="glass-input w-full" rows="2" value={desc()} onInput={e => setDesc(e.target.value)} />
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Label Scheme</label>
              <input type="text" class="glass-input w-full font-mono text-sm" value={labelScheme()} onInput={e => setLabelScheme(e.target.value)} />
            </div>

            <div class="pt-4 border-t border-white/10">
              <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Layout Configuration</label>
              <select 
                class="glass-input w-full text-sm mb-3" 
                value={layoutType()}
                onChange={(e) => setLayoutType(e.currentTarget.value)}
              >
                <option value="default">Default (List)</option>
                <option value="linear">Linear (1D)</option>
                <option value="grid">Grid (2D)</option>
              </select>
              
              <Show when={layoutType() === "linear"}>
                <div>
                  <label class="text-xs text-gray-400">Total Slots / Length</label>
                  <input type="number" min="1" class="glass-input w-full" value={len()} onInput={e => setLen(parseInt(e.target.value) || 1)} />
                </div>
              </Show>

              <Show when={layoutType() === "grid"}>
                <div class="flex gap-3">
                  <div class="flex-1">
                    <label class="text-xs text-gray-400">Columns</label>
                    <input type="number" min="1" class="glass-input w-full" value={cols()} onInput={e => setCols(parseInt(e.target.value) || 1)} />
                  </div>
                  <div class="flex-1">
                    <label class="text-xs text-gray-400">Rows</label>
                    <input type="number" min="1" class="glass-input w-full" value={rows()} onInput={e => setRows(parseInt(e.target.value) || 1)} />
                  </div>
                </div>
              </Show>
            </div>
          </form>

          <div class="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button type="button" onClick={() => props.onPrint(props.location)} class="btn-secondary py-2 flex justify-center items-center gap-1.5 text-xs">
              <Printer size={15} /> Print
            </button>
            <Show when={props.onWriteNfc}>
              <button type="button" onClick={() => props.onWriteNfc!(props.location)} class="bg-accentCyan/10 text-accentCyan hover:bg-accentCyan/20 py-2 rounded-lg flex justify-center items-center gap-1.5 text-xs transition-colors">
                <Nfc size={15} /> NFC Tag
              </button>
            </Show>
            <button type="button" onClick={() => props.onMove(props.location)} class="bg-accentPurple/10 text-accentPurple hover:bg-accentPurple/20 py-2 rounded-lg flex justify-center items-center gap-1.5 text-xs transition-colors">
              <MapPin size={15} /> Move
            </button>
            <div title={cannotDeleteReason() || "Delete location"} class="w-full">
              <button 
                type="button" 
                disabled={cannotDeleteReason() !== null}
                onClick={() => props.onDelete(props.location.id)} 
                class="w-full h-full bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-500/20 py-2 rounded-lg flex justify-center items-center gap-1.5 text-xs transition-colors"
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
          <button type="button" onClick={props.onClose} class="btn-secondary px-6 py-2">Cancel</button>
          <button type="submit" form="edit-loc-form" class="btn-primary px-6 py-2">Save Changes</button>
        </div>
      </div>
    </div>
  );
}
