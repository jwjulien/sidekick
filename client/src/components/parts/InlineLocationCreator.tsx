import { createSignal, For, Show } from "solid-js";
import { Plus, X, FolderPlus } from "lucide-solid";
import { apiFetch } from "../../hooks/useAuth";
import toast from "solid-toast";

interface InlineLocationCreatorProps {
  locations: any[];
  onCreated: (location: any) => void;
  onCancel?: () => void;
}

export default function InlineLocationCreator(props: InlineLocationCreatorProps) {
  const [name, setName] = createSignal("");
  const [parentId, setParentId] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name().trim()) {
      toast.error("Location name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name().trim(),
        parent_id: parentId() || null,
        description: description().trim() || null
      };

      const newLoc = await apiFetch("/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      toast.success(`Location '${newLoc.name}' created.`);
      props.onCreated(newLoc);
    } catch (err: any) {
      toast.error(err.message || "Failed to create storage location.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="bg-black/40 p-4 rounded-xl border border-accentCyan/30 space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-accentCyan font-bold text-xs uppercase tracking-wider">
          <FolderPlus size={16} />
          <span>Create New Storage Bin</span>
        </div>
        <Show when={props.onCancel}>
          <button
            type="button"
            onClick={props.onCancel}
            class="text-gray-400 hover:text-white p-1"
          >
            <X size={14} />
          </button>
        </Show>
      </div>

      <form onSubmit={handleSubmit} class="space-y-3">
        <div>
          <label class="block text-[10px] font-semibold text-gray-400 mb-1 uppercase">
            Location Bin Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Bin B4, Tray 1, Shelf A"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            class="glass-input w-full text-xs"
          />
        </div>

        <div>
          <label class="block text-[10px] font-semibold text-gray-400 mb-1 uppercase">
            Parent Location (Container)
          </label>
          <select
            value={parentId()}
            onChange={(e) => setParentId(e.currentTarget.value)}
            class="glass-input w-full text-xs"
          >
            <option value="">(None - Top Level Root Location)</option>
            <For each={props.locations}>
              {(loc) => (
                <option value={loc.id}>
                  {loc.name} {loc.description ? `(${loc.description})` : ""}
                </option>
              )}
            </For>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-semibold text-gray-400 mb-1 uppercase">
            Description / Notes
          </label>
          <input
            type="text"
            placeholder="e.g. Sort tray for incoming passives"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            class="glass-input w-full text-xs"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Show when={props.onCancel}>
            <button
              type="button"
              onClick={props.onCancel}
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white bg-white/5"
            >
              Cancel
            </button>
          </Show>
          <button
            type="submit"
            disabled={submitting()}
            class="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
          >
            {submitting() ? (
              <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Plus size={14} />
                Create & Select Bin
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
