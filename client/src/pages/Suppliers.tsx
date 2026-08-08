import { createSignal, onMount, For, Show } from "solid-js";
import { 
  Building2, 
  Plus, 
  Trash2, 
  ExternalLink,
  Globe,
  X,
  Search
} from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";
import toast from "solid-toast";
import { useConfirm } from "../contexts/ConfirmContext";

export default function Suppliers() {
  const { confirm } = useConfirm();
  const [suppliers, setSuppliers] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [editSupId, setEditSupId] = createSignal<number | null>(null);
  
  // Form state
  const [name, setName] = createSignal("");
  const [website, setWebsite] = createSignal("");
  const [searchUrl, setSearchUrl] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/suppliers");
      setSuppliers(data);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchSuppliers();
  });

  const handleSaveSupplier = async (e: Event) => {
    e.preventDefault();
    if (!name() || !website()) {
      toast.error("Name and website are required.");
      return;
    }
    
    setSubmitting(true);
    try {
      const payload = {
        name: name(),
        website: website(),
        search: searchUrl() || `${website().replace(/\/$/, "")}/?q=`
      };
      
      if (editSupId()) {
        await apiFetch(`/suppliers/${editSupId()}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        toast.success("Supplier updated successfully.");
      } else {
        await apiFetch("/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        toast.success("Supplier created successfully.");
      }

      setEditSupId(null);
      setName("");
      setWebsite("");
      setSearchUrl("");
      setShowAddModal(false);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Failed to save supplier.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSupplierClick = (supplier: any) => {
    setEditSupId(supplier.id);
    setName(supplier.name);
    setWebsite(supplier.website);
    setSearchUrl(supplier.search);
    setShowAddModal(true);
  };

  const handleDeleteSupplier = async (id: number) => {
    const isConfirmed = await confirm({
      title: "Delete Supplier",
      message: "Are you sure you want to delete this supplier? Any associated product catalog number listings will also be deleted.",
      confirmText: "Delete",
      type: "error"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/suppliers/${id}`, { method: "DELETE" });
      fetchSuppliers();
      toast.success("Supplier deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete supplier.");
    }
  };

  return (
    <div class="space-y-6">
      {/* View Header */}
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 class="text-accentCyan" />
            Distributors & Suppliers
          </h2>
          <p class="text-gray-400 text-sm">Manage electronics component supply lines and distributor parameters.</p>
        </div>
        
        {/* Create Button */}
        <Show when={user()?.role === "admin" || user()?.role === "designer"}>
          <button
            onClick={() => {
              setEditSupId(null);
              setName("");
              setWebsite("");
              setSearchUrl("");
              setShowAddModal(true);
            }}
            class="btn-primary flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Add Supplier
          </button>
        </Show>
      </div>

      {/* Suppliers Grid */}
      <Show when={loading()}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="h-44 bg-white/5 rounded-2xl animate-pulse"></div>
          <div class="h-44 bg-white/5 rounded-2xl animate-pulse"></div>
          <div class="h-44 bg-white/5 rounded-2xl animate-pulse"></div>
        </div>
      </Show>

      <Show when={!loading() && suppliers().length === 0}>
        <div class="text-center py-20 text-gray-500 bg-white/[0.01] rounded-2xl border border-dashed border-white/5">
          <Building2 size={48} class="mx-auto mb-4 text-gray-600" />
          <h3 class="font-bold text-white mb-1">No Suppliers Configured</h3>
          <p class="text-sm">Add suppliers to map order details and links for electronics components.</p>
        </div>
      </Show>

      <Show when={!loading() && suppliers().length > 0}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={suppliers()}>
            {(supplier) => (
              <div class="glass-card glass-card-hover p-6 rounded-2xl flex flex-col justify-between h-44 relative border border-white/5 overflow-hidden">
                <div class="absolute top-0 right-0 w-24 h-24 bg-accentCyan/5 rounded-full blur-xl -z-10"></div>
                
                <div>
                  <div class="flex justify-between items-start gap-2">
                    <h3 class="font-bold text-white text-base truncate pr-6">
                      {supplier.name}
                    </h3>
                    
                    <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                      <div class="absolute right-4 top-4 flex gap-1">
                        <button
                          onClick={() => handleEditSupplierClick(supplier)}
                          class="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                          title="Edit Supplier"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(supplier.id)}
                          class="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/5 rounded transition-colors"
                          title="Delete Supplier"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </Show>
                  </div>
                  
                  <div class="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                    <Globe size={14} class="text-accentCyan shrink-0" />
                    <a 
                      href={supplier.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="hover:text-accentCyan transition-colors truncate max-w-[200px]"
                    >
                      {supplier.website.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </div>
                </div>

                <div class="border-t border-white/5 pt-4 flex gap-2">
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-secondary py-2 flex-1 text-center justify-center flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <ExternalLink size={12} />
                    Open Website
                  </a>
                  
                  <a
                    href={supplier.search}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-secondary py-2 flex-1 text-center justify-center flex items-center gap-1.5 text-xs font-semibold border-accentCyan/20 hover:border-accentCyan/50"
                  >
                    <Search size={12} class="text-accentCyan" />
                    Search Catalog
                  </a>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Add Supplier Modal */}
      <Show when={showAddModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="glass-panel max-w-md w-full rounded-2xl p-6 border border-white/10 relative">
            <button 
              onClick={() => setShowAddModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 class="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Building2 class="text-accentCyan" size={20} />
              {editSupId() ? "Edit Supplier" : "Register Supplier"}
            </h3>
            
            <form onSubmit={handleSaveSupplier} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Supplier Name</label>
                <input
                  type="text"
                  required
                  value={name()}
                  onInput={(e) => setName(e.target.value)}
                  placeholder="E.g. DigiKey, Mouser, LCSC"
                  class="glass-input w-full text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Website Homepage URL</label>
                <input
                  type="url"
                  required
                  value={website()}
                  onInput={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.digikey.com"
                  class="glass-input w-full text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Catalog Query URL (Optional)</label>
                <input
                  type="text"
                  value={searchUrl()}
                  onInput={(e) => setSearchUrl(e.target.value)}
                  placeholder="E.g. https://www.digikey.com/en/products?keywords="
                  class="glass-input w-full text-xs font-mono"
                />
                <p class="text-[9px] text-gray-500 mt-1">
                  Prefix search URL used to quickly check stock or component availability on the vendor's website.
                </p>
              </div>

              <div class="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting()}
                  class="btn-primary flex-1"
                >
                  {submitting() ? "Registering..." : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
