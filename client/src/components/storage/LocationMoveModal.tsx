import { createSignal, createMemo, Show, For } from "solid-js";
import { X, MapPin } from "lucide-solid";
import toast from "solid-toast";
import { apiFetch } from "../../hooks/useAuth";
import StorageColumns from "./StorageColumns";

export default function LocationMoveModal(props: {
  location: any;
  allLocations: any[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [submitting, setSubmitting] = createSignal(false);

  // Filter out invalid destinations:
  // 1. Cannot be the location itself.
  // 2. Cannot have an affiliated part (part_id != null).
  // 3. Cannot be a descendant of the location.
  const validLocations = createMemo(() => {
    const isDescendant = (locId: string, parentId: string) => {
      let current = props.allLocations.find((l: any) => l.id === locId);
      while (current) {
        if (current.parent_id === parentId) return true;
        current = props.allLocations.find((l: any) => l.id === current.parent_id);
      }
      return false;
    };

    return props.allLocations.filter(loc => {
      if (loc.id === props.location.id) return false;
      if (isDescendant(loc.id, props.location.id)) return false;
      return true;
    });
  });

  const getParentPath = (locId: string | null) => {
    let path = [];
    let current = props.allLocations.find(l => l.id === locId);
    while (current) {
      path.unshift(current.id);
      current = props.allLocations.find(l => l.id === current.parent_id);
    }
    return path;
  };

  const [movePath, setMovePath] = createSignal<string[]>(getParentPath(props.location.parent_id));
  
  const handleSelectNode = (id: string) => {
    setMovePath(prev => {
      const loc = props.allLocations.find((l: any) => l.id === id);
      if (!loc) return prev;
      if (!loc.parent_id) return [id];
      const parentIdx = prev.indexOf(loc.parent_id);
      if (parentIdx !== -1) {
        return [...prev.slice(0, parentIdx + 1), id];
      }
      return [...prev, id];
    });
  };

  const handlePickerSelect = async (parentId: string | null, index?: number) => {
    setSubmitting(true);
    try {
      await apiFetch(`/locations/${props.location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          set_parent: true,
          parent_id: parentId,
          index: index
        })
      });
      toast.success("Location moved successfully.");
      props.onMoved();
    } catch (err: any) {
      toast.error(err.message || "Failed to move location.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div class="bg-dark/90 border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[600px]">
        {/* Header */}
        <div class="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <MapPin size={20} class="text-accentCyan" /> Move Location
          </h2>
          <button onClick={props.onClose} class="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div class="p-6 flex flex-col flex-1 overflow-hidden space-y-4">
          <p class="text-sm text-gray-300 shrink-0">
            Navigate to the new parent location for <span class="font-bold text-white">{props.location.name}</span>. Click an empty slot to complete the move!
          </p>
          
          <div class="flex-1 overflow-auto relative">
            <StorageColumns 
              locations={validLocations()} 
              activePath={movePath()} 
              onSelect={handleSelectNode}
              onCreateChild={() => {}}
              onEditLocation={() => {}}
              pickerMode={true}
              onPickerSelect={handlePickerSelect}
            />
          </div>
        </div>

        {/* Footer */}
        <div class="p-4 border-t border-white/10 flex justify-between gap-3 bg-white/5 shrink-0">
          <div class="text-xs text-gray-500 max-w-[70%]">
            The columns above only show valid drop destinations. You cannot move a node into itself, its descendants, or into a node with an affiliated part.
          </div>
          <button type="button" onClick={props.onClose} class="btn-secondary px-6 py-2 text-sm" disabled={submitting()}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
