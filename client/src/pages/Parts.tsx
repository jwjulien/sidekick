import { createSignal, onMount, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Plus, X, Trash2, ArrowLeft } from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";
import { useFocusRevalidation } from "../hooks/useFocusRevalidation";
import toast from "solid-toast";
import UniversalPartsBrowser from "../components/parts/UniversalPartsBrowser";
import { useViewState } from "../context/ViewStateContext";

export default function Parts() {
  const navigate = useNavigate();
  const viewState = useViewState();
  const [parts, setParts] = createSignal<any[]>([]);
  const [categories, setCategories] = createSignal<any[]>([]);
  const [locations, setLocations] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Add Part Modal state
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [newPartValue, setNewPartValue] = createSignal("");
  const [newPartNumber, setNewPartNumber] = createSignal("");
  const [newPartPackage, setNewPartPackage] = createSignal("");
  const [newPartPrice, setNewPartPrice] = createSignal(0);
  const [newPartWeight, setNewPartWeight] = createSignal(0);
  const [newPartMinQty, setNewPartMinQty] = createSignal(5);
  const [newPartCat, setNewPartCat] = createSignal("");
  const [newPartNotes, setNewPartNotes] = createSignal("");

  // Dynamic Attributes State
  const [attributes, setAttributes] = createSignal<Array<{ key: string, value: string }>>([]);
  const [submitting, setSubmitting] = createSignal(false);

  const fetchParts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/parts");
      setParts(data);
    } catch (err) {
      console.error("Failed to fetch parts:", err);
    } finally {
      setLoading(false);
    }
  };

  useFocusRevalidation(fetchParts);

  onMount(() => {
    fetchParts();
  });

  const addAttribute = () => {
    setAttributes([...attributes(), { key: "", value: "" }]);
  };

  const updateAttribute = (index: number, field: "key" | "value", val: string) => {
    const attrs = [...attributes()];
    attrs[index][field] = val;
    setAttributes(attrs);
  };

  const removeAttribute = (index: number) => {
    const attrs = [...attributes()];
    attrs.splice(index, 1);
    setAttributes(attrs);
  };

  const handleCreatePart = async (e: Event) => {
    e.preventDefault();
    if (!newPartValue() || !newPartNumber() || !newPartCat()) {
      toast.error("Value, Part Number, and Category are required.");
      return;
    }

    setSubmitting(true);
    try {
      const attributesObj: Record<string, string> = {};
      attributes().forEach(attr => {
        if (attr.key.trim() !== "") {
          attributesObj[attr.key.trim()] = attr.value.trim();
        }
      });

      const payload = {
        category_id: newPartCat(),
        value: newPartValue(),
        number: newPartNumber(),
        package: newPartPackage() || null,
        price: newPartPrice() || 0.0,
        weight: newPartWeight() || 0.0,
        threshold: newPartMinQty(),
        notes: newPartNotes(),
        attributes: attributesObj
      };

      await apiFetch("/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Clear form
      setNewPartValue("");
      setNewPartNumber("");
      setNewPartPackage("");
      setNewPartPrice(0);
      setNewPartWeight(0);
      setNewPartMinQty(5);
      setNewPartCat("");
      setNewPartNotes("");
      setAttributes([]);

      setShowAddModal(false);
      fetchParts();
      toast.success("Part created successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create part.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="space-y-6">
      {/* View Header */}
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-white tracking-tight">Parts Catalog</h2>
          <p class="text-gray-400 text-sm">Browse, search, filter, and track components in stock.</p>
        </div>

        <div class="flex items-center gap-3">
          <Show when={viewState.partsState().lastViewedPartId}>
            <button
              onClick={() => navigate(`/parts/${viewState.partsState().lastViewedPartId}`)}
              class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-accentCyan/15 text-accentCyan border border-accentCyan/30 hover:bg-accentCyan/25 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Return to the last viewed part"
            >
              <ArrowLeft size={14} />
              Return to Last Viewed Part ({viewState.partsState().lastViewedPartName || "Part"})
            </button>
          </Show>

          {/* Create Button */}
          <Show when={user()?.role === "admin" || user()?.role === "stocker" || user()?.role === "designer"}>
            <button
              onClick={() => setShowAddModal(true)}
              class="btn-primary flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Add New Part
            </button>
          </Show>
        </div>
      </div>

      {/* Shared Universal Parts Browser Component */}
      <UniversalPartsBrowser
        parts={parts()}
        loading={loading()}
        title="Inventory Parts Catalog"
        onSelectPart={(part) => navigate(`/parts/${part.id}`)}
      />

      {/* ----------------- CREATE PART DIALOG MODAL ----------------- */}
      <Show when={showAddModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div class="glass-panel max-w-2xl w-full rounded-2xl p-6 border border-white/10 relative my-8">
            <button
              onClick={() => setShowAddModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <h3 class="text-xl font-bold text-white mb-2">Create New Part</h3>
            <p class="text-xs text-gray-400 mb-6">Define a core component and its attributes.</p>

            <form onSubmit={handleCreatePart} class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Value / Name *</label>
                  <input
                    type="text"
                    required
                    value={newPartValue()}
                    onInput={(e) => setNewPartValue(e.target.value)}
                    placeholder="e.g. 10k Ohm"
                    class="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Manufacturer Part No *</label>
                  <input
                    type="text"
                    required
                    value={newPartNumber()}
                    onInput={(e) => setNewPartNumber(e.target.value)}
                    placeholder="e.g. ERJ-6GEYJ103V"
                    class="glass-input w-full text-sm font-mono"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Category *</label>
                  <select
                    required
                    value={newPartCat()}
                    onChange={(e) => setNewPartCat(e.currentTarget.value)}
                    class="glass-input w-full text-sm"
                  >
                    <option value="" disabled>Select a category...</option>
                    <For each={categories()}>
                      {(cat) => <option value={cat.id}>{cat.title}</option>}
                    </For>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Package / Footprint</label>
                  <input
                    type="text"
                    value={newPartPackage()}
                    onInput={(e) => setNewPartPackage(e.target.value)}
                    placeholder="e.g. 0805"
                    class="glass-input w-full text-sm"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Price (USD)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newPartPrice()}
                    onInput={(e) => setNewPartPrice(parseFloat(e.target.value))}
                    class="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newPartWeight()}
                    onInput={(e) => setNewPartWeight(parseFloat(e.target.value))}
                    class="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Min Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={newPartMinQty()}
                    onInput={(e) => setNewPartMinQty(parseInt(e.target.value) || 0)}
                    class="glass-input w-full text-sm"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-semibold text-gray-400 mb-1.5 uppercase">Notes / Description</label>
                <textarea
                  value={newPartNotes()}
                  onInput={(e) => setNewPartNotes(e.target.value)}
                  placeholder="Additional component details..."
                  class="glass-input w-full text-sm min-h-[80px]"
                ></textarea>
              </div>

              {/* Dynamic Attributes Builder */}
              <div class="pt-4 border-t border-white/5 space-y-3">
                <div class="flex justify-between items-center">
                  <h4 class="text-xs font-bold text-white uppercase">Custom Attributes</h4>
                  <button
                    type="button"
                    onClick={addAttribute}
                    class="text-xs text-accentCyan hover:text-white flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Attribute
                  </button>
                </div>
                <p class="text-[10px] text-gray-500">Define dynamic Key/Value pairs like Tolerance, Voltage, or Thread Pitch.</p>

                <For each={attributes()}>
                  {(attr, index) => (
                    <div class="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Key (e.g. Tolerance)"
                        value={attr.key}
                        onInput={(e) => updateAttribute(index(), "key", e.currentTarget.value)}
                        class="glass-input text-xs w-1/3"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. 1%)"
                        value={attr.value}
                        onInput={(e) => updateAttribute(index(), "value", e.currentTarget.value)}
                        class="glass-input text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttribute(index())}
                        class="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </For>
              </div>

              <div class="flex justify-end pt-4 border-t border-white/10 gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  class="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting()}
                  class="btn-primary flex items-center justify-center gap-2 min-w-[120px]"
                >
                  {submitting() ? (
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "Save Part"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
