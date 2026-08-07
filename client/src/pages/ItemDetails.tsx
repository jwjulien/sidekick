import { createSignal, onMount, For, Show } from "solid-js";
import { useParams, useNavigate, A } from "@solidjs/router";
import { 
  Package, 
  Tag, 
  MapPin, 
  AlertTriangle, 
  Plus, 
  Minus, 
  FileText, 
  Image as ImageIcon, 
  Download, 
  Trash2, 
  History, 
  Edit3, 
  Upload,
  ArrowLeft
} from "lucide-solid";
import { apiFetch, user, backendUrl } from "../hooks/useAuth";

export default function ItemDetails() {
  const params = useParams();
  const navigate = useNavigate();
  const itemId = parseInt(params.id);

  const [item, setItem] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Stock actions state
  const [stockQty, setStockQty] = createSignal(1);
  const [stockNotes, setStockNotes] = createSignal("");
  const [stockSubmitting, setStockSubmitting] = createSignal(false);

  // Upload state
  const [uploadFile, setUploadFile] = createSignal<File | null>(null);
  const [uploading, setUploading] = createSignal(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [editName, setEditName] = createSignal("");
  const [editDesc, setEditDesc] = createSignal("");
  const [editSku, setEditSku] = createSignal("");
  const [editBarcode, setEditBarcode] = createSignal("");
  const [editMinQty, setEditMinQty] = createSignal(0);
  const [editCat, setEditCat] = createSignal("");
  const [editLoc, setEditLoc] = createSignal("");
  const [categories, setCategories] = createSignal<any[]>([]);
  const [locations, setLocations] = createSignal<any[]>([]);
  
  // Custom fields configuration inside modal
  const [categoryFields, setCategoryFields] = createSignal<any[]>([]);
  const [customFieldValues, setCustomFieldValues] = createSignal<Record<number, string>>({});

  const fetchItemDetails = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/items/${itemId}`);
      setItem(data);
      
      // Seed edit form values
      setEditName(data.name);
      setEditDesc(data.description || "");
      setEditSku(data.sku || "");
      setEditBarcode(data.barcode || "");
      setEditMinQty(data.min_quantity_alert || 0);
      setEditCat(data.category_id ? String(data.category_id) : "");
      setEditLoc(data.location_id ? String(data.location_id) : "");
      
      // Load current custom field values mapped to dict
      const valMap: Record<number, string> = {};
      data.custom_values.forEach((v: any) => {
        valMap[v.custom_field_id] = v.value;
      });
      setCustomFieldValues(valMap);
      
    } catch (err: any) {
      setError(err.message || "Failed to load item details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [cats, locs] = await Promise.all([
        apiFetch("/categories"),
        apiFetch("/locations?flat=true")
      ]);
      setCategories(cats);
      setLocations(locs);
    } catch (_) {}
  };

  onMount(() => {
    fetchItemDetails();
    fetchMetadata();
  });

  // Fetch custom field definitions when category changes
  const handleCategoryChange = async (catId: string) => {
    setEditCat(catId);
    if (!catId) {
      setCategoryFields([]);
      return;
    }
    try {
      const catDetails = await apiFetch(`/categories/${catId}`);
      setCategoryFields(catDetails.custom_fields || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Open modal & load fields
  const handleOpenEdit = async () => {
    setShowEditModal(true);
    if (editCat()) {
      handleCategoryChange(editCat());
    }
  };

  const handleStockAction = async (action: "check_in" | "check_out") => {
    setStockSubmitting(true);
    try {
      await apiFetch(`/items/${itemId}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity_change: stockQty(),
          action_type: action,
          notes: stockNotes() || `Stock adjusted via item view.`
        })
      });
      setStockNotes("");
      setStockQty(1);
      fetchItemDetails();
      alert("Inventory level adjusted successfully.");
    } catch (err: any) {
      alert(err.message || "Transaction adjustment failed.");
    } finally {
      setStockSubmitting(false);
    }
  };

  const handleFileUpload = async (e: Event) => {
    e.preventDefault();
    const file = uploadFile();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const url = `${backendUrl()}/uploads/item/${itemId}`;
      const tokenHeader = localStorage.getItem("sidekick_token");
      const headers: Record<string, string> = {};
      if (tokenHeader) {
        headers["Authorization"] = `Bearer ${tokenHeader}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: formData
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.detail || "Upload failed.");
      }

      setUploadFile(null);
      // Reset input element
      const fileInput = document.getElementById("file-input-field") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      fetchItemDetails();
      alert("Attachment uploaded successfully.");
    } catch (err: any) {
      alert(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachId: number) => {
    if (!confirm("Are you sure you want to delete this attachment?")) return;
    try {
      await apiFetch(`/uploads/${attachId}`, { method: "DELETE" });
      fetchItemDetails();
    } catch (err: any) {
      alert(err.message || "Deletion failed.");
    }
  };

  const handleUpdateItemDetails = async (e: Event) => {
    e.preventDefault();
    try {
      // Assemble custom field list
      const customValuesList = Object.entries(customFieldValues()).map(([fieldId, value]) => ({
        custom_field_id: parseInt(fieldId),
        value
      }));

      const payload = {
        name: editName(),
        description: editDesc(),
        sku: editSku() || null,
        barcode: editBarcode() || null,
        min_quantity_alert: editMinQty(),
        category_id: editCat() ? parseInt(editCat()) : null,
        location_id: editLoc() ? parseInt(editLoc()) : null,
        custom_values: customValuesList
      };

      await apiFetch(`/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setShowEditModal(false);
      fetchItemDetails();
      alert("Item details updated successfully.");
    } catch (err: any) {
      alert(err.message || "Modification failed.");
    }
  };

  const handleDeleteItem = async () => {
    if (!confirm("⚠️ DANGER: Are you sure you want to permanently delete this item? This action is irreversible.")) return;
    try {
      await apiFetch(`/items/${itemId}`, { method: "DELETE" });
      navigate("/inventory");
    } catch (err: any) {
      alert(err.message || "Failed to delete item.");
    }
  };

  return (
    <div class="space-y-6">
      {/* Back button */}
      <button 
        onClick={() => navigate("/inventory")}
        class="btn-secondary py-1.5 px-3 flex items-center gap-2 text-xs"
      >
        <ArrowLeft size={14} />
        Back to Catalog
      </button>

      <Show when={loading() && !item()}>
        <div class="glass-panel p-8 rounded-2xl animate-pulse h-64"></div>
      </Show>

      <Show when={error()}>
        <div class="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl">
          <h3 class="font-bold text-white mb-2">Error loading item details</h3>
          <p>{error()}</p>
        </div>
      </Show>

      <Show when={item()}>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ----------------- LEFT 2 COLS: ITEM INFO & ATTACHMENTS ----------------- */}
          <div class="lg:col-span-2 space-y-6">
            
            {/* Main Info Card */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6 relative overflow-hidden">
              <div class="absolute top-0 right-0 w-32 h-32 bg-accentCyan/5 rounded-full blur-2xl -z-10"></div>
              
              <div class="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <div class="flex items-center gap-3">
                    <h2 class="text-2xl font-bold text-white tracking-tight">{item().name}</h2>
                    <Show when={item().quantity < item().min_quantity_alert}>
                      <span class="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Low Stock
                      </span>
                    </Show>
                  </div>
                  <p class="text-gray-400 text-sm mt-2 leading-relaxed">{item().description || "No description provided."}</p>
                </div>
                
                {/* Edit details */}
                <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                  <button
                    onClick={handleOpenEdit}
                    class="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Edit3 size={14} />
                    Edit Details
                  </button>
                </Show>
              </div>

              {/* Standard Attributes */}
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-xs">
                <div>
                  <span class="text-gray-500 uppercase block font-semibold">SKU</span>
                  <span class="text-white font-mono font-medium block mt-1 truncate">{item().sku || "N/A"}</span>
                </div>
                <div>
                  <span class="text-gray-500 uppercase block font-semibold">Barcode</span>
                  <span class="text-white font-mono font-medium block mt-1 truncate">{item().barcode || "N/A"}</span>
                </div>
                <div>
                  <span class="text-gray-500 uppercase block font-semibold">Category</span>
                  <span class="text-white font-medium block mt-1 truncate">
                    {item().category?.name || "Uncategorized"}
                  </span>
                </div>
                <div>
                  <span class="text-gray-500 uppercase block font-semibold">Location</span>
                  <span class="text-white font-medium block mt-1 truncate">
                    {item().location?.name || "No location assigned"}
                  </span>
                </div>
              </div>

              {/* Custom Attributes Fields */}
              <Show when={item().custom_values.length > 0}>
                <div>
                  <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Custom Attributes</h4>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <For each={item().custom_values}>
                      {(v) => (
                        <div class="glass-card p-3 rounded-xl flex justify-between items-center text-xs">
                          <span class="text-gray-400 font-medium">{v.custom_field?.name}</span>
                          <span class="text-white font-semibold font-mono">{v.value}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>

            {/* Document Attachments Card */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={18} class="text-accentCyan" />
                Attachments (Datasheets, Drawings & Images)
              </h3>
              
              {/* Upload interface (Stocker/Admin) */}
              <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                <form onSubmit={handleFileUpload} class="flex flex-col sm:flex-row gap-3 items-end p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-xs">
                  <div class="flex-1 w-full">
                    <label class="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase">Select Attachment File</label>
                    <input
                      type="file"
                      id="file-input-field"
                      onChange={(e) => setUploadFile(e.currentTarget.files?.[0] || null)}
                      class="glass-input w-full py-2 px-3 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={uploading() || !uploadFile()}
                    class="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2"
                  >
                    <Upload size={14} />
                    {uploading() ? "Uploading..." : "Upload File"}
                  </button>
                </form>
              </Show>

              {/* Attachments List */}
              <Show when={item().attachments.length === 0}>
                <div class="text-center py-6 text-xs text-gray-500">
                  No files attached to this record yet.
                </div>
              </Show>

              <Show when={item().attachments.length > 0}>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <For each={item().attachments}>
                    {(att) => (
                      <div class="glass-card p-3 rounded-xl flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <div class="text-accentCyan shrink-0">
                            {att.file_type === "image" ? <ImageIcon size={18} /> : <FileText size={18} />}
                          </div>
                          <span class="font-medium text-white truncate max-w-[150px]">{att.filename}</span>
                        </div>

                        <div class="flex items-center gap-1.5 shrink-0">
                          {/* Download Button */}
                          <a
                            href={`${backendUrl()}/uploads/file/${itemId}/${att.filename}`}
                            target="_blank"
                            class="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                            title="Download/Open"
                          >
                            <Download size={12} />
                          </a>

                          {/* Delete Attachment Button */}
                          <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              class="p-1.5 rounded-lg bg-white/5 text-red-400 hover:text-red-300 hover:bg-red-500/5 cursor-pointer"
                              title="Delete File"
                            >
                              <Trash2 size={12} />
                            </button>
                          </Show>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          {/* ----------------- RIGHT 1 COL: INVENTORY CONTROLS & LOGS ----------------- */}
          <div class="space-y-6">
            
            {/* Inventory Levels Controls */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <Package size={18} class="text-accentCyan" />
                Inventory Stock Levels
              </h3>
              
              <div class="text-center bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <span class="text-[10px] text-gray-500 uppercase font-semibold">Current Count</span>
                <span class={`text-4xl font-extrabold block mt-2 ${
                  item().quantity < item().min_quantity_alert ? "text-amber-400" : "text-white"
                }`}>
                  {item().quantity}
                </span>
                <span class="text-[10px] text-gray-500 mt-2 block">
                  Alert threshold minimum: {item().min_quantity_alert || 0} units
                </span>
              </div>

              {/* Stock Actions (Only for Stockers / Pullers) */}
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                  {/* Stocker Check-In Button */}
                  <button
                    onClick={() => handleStockAction("check_in")}
                    disabled={stockSubmitting() || (user()?.role !== "admin" && user()?.role !== "stocker")}
                    class="btn-primary py-3 flex items-center justify-center gap-1.5 font-bold"
                  >
                    <Plus size={16} />
                    Check In
                  </button>

                  {/* Puller Check-Out Button */}
                  <button
                    onClick={() => handleStockAction("check_out")}
                    disabled={stockSubmitting() || (user()?.role !== "admin" && user()?.role !== "puller")}
                    class="btn-accent py-3 flex items-center justify-center gap-1.5 font-bold"
                  >
                    <Minus size={16} />
                    Pull Stock
                  </button>
                </div>

                <div class="space-y-3 text-xs">
                  <div>
                    <label class="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Adjust Quantity By</label>
                    <input
                      type="number"
                      value={stockQty()}
                      onInput={(e) => setStockQty(Math.max(1, parseInt(e.target.value) || 1))}
                      class="glass-input w-full text-center font-bold text-base"
                      min="1"
                    />
                  </div>

                  <div>
                    <label class="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Reference Notes</label>
                    <textarea
                      value={stockNotes()}
                      onInput={(e) => setStockNotes(e.target.value)}
                      placeholder="E.g. Job #404, stock purchase ref, drawer restock..."
                      class="glass-input w-full h-16 text-xs resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Audit log trail specific to item */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <History size={16} class="text-accentCyan" />
                Item History Log
              </h3>

              <div class="space-y-4 max-h-[300px] overflow-y-auto pr-1 text-xs">
                <For each={item().transactions}>
                  {(tx) => (
                    <div class="bg-white/[0.01] border border-white/5 rounded-xl p-3 space-y-2">
                      <div class="flex justify-between items-center text-[10px]">
                        <span class="text-gray-500">
                          {new Date(tx.created_at + "Z").toLocaleDateString()} at {new Date(tx.created_at + "Z").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span class="text-gray-400 font-semibold">{tx.user?.username || "System"}</span>
                      </div>
                      
                      <p class="text-gray-300 text-[11px] leading-normal">{tx.notes || "Stock updated."}</p>
                      
                      <div class="flex justify-between items-center text-[10px]">
                        <span class={`font-extrabold uppercase ${
                          tx.quantity_change > 0 ? "text-cyan-400" : tx.quantity_change < 0 ? "text-rose-400" : "text-purple-400"
                        }`}>
                          {tx.action_type}
                        </span>
                        <span class="font-bold text-white">
                          {tx.quantity_change > 0 ? `+${tx.quantity_change}` : tx.quantity_change === 0 ? "" : tx.quantity_change}
                        </span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
            
            {/* Danger Zone */}
            <Show when={user()?.role === "admin"}>
              <div class="glass-panel rounded-2xl p-6 border border-red-500/20 bg-red-500/[0.01] space-y-3">
                <h4 class="text-xs font-extrabold text-red-400 uppercase tracking-widest">Danger Zone</h4>
                <button
                  onClick={handleDeleteItem}
                  class="btn-secondary w-full border-red-500/30 hover:border-red-500/50 hover:bg-red-500/10 text-red-400 hover:text-red-300 py-2.5 text-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  Permanently Delete Item
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* ----------------- EDIT DETAILS DIALOG MODAL ----------------- */}
      <Show when={showEditModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div class="glass-panel max-w-lg w-full rounded-2xl p-6 border border-white/10 relative my-8">
            <button 
              onClick={() => setShowEditModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 class="text-lg font-bold text-white mb-6 uppercase tracking-wider">
              Edit Item Record
            </h3>
            
            <form onSubmit={handleUpdateItemDetails} class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Item Name</label>
                  <input
                    type="text"
                    required
                    value={editName()}
                    onInput={(e) => setEditName(e.target.value)}
                    class="glass-input w-full text-sm"
                  />
                </div>
                
                <div class="sm:col-span-2">
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Description</label>
                  <textarea
                    value={editDesc()}
                    onInput={(e) => setEditDesc(e.target.value)}
                    class="glass-input w-full text-sm h-20 resize-none"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">SKU</label>
                  <input
                    type="text"
                    value={editSku()}
                    onInput={(e) => setEditSku(e.target.value)}
                    class="glass-input w-full text-xs"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Barcode</label>
                  <input
                    type="text"
                    value={editBarcode()}
                    onInput={(e) => setEditBarcode(e.target.value)}
                    class="glass-input w-full text-xs"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Low Stock Alert Min</label>
                  <input
                    type="number"
                    value={editMinQty()}
                    onInput={(e) => setEditMinQty(parseInt(e.target.value) || 0)}
                    class="glass-input w-full text-sm"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Category</label>
                  <select
                    value={editCat()}
                    onChange={(e) => handleCategoryChange(e.currentTarget.value)}
                    class="glass-input w-full text-xs"
                  >
                    <option value="">Select Category...</option>
                    <For each={categories()}>
                      {(c) => <option value={c.id}>{c.name}</option>}
                    </For>
                  </select>
                </div>

                <div class="sm:col-span-2">
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Location</label>
                  <select
                    value={editLoc()}
                    onChange={(e) => setEditLoc(e.currentTarget.value)}
                    class="glass-input w-full text-xs"
                  >
                    <option value="">Select Location...</option>
                    <For each={locations()}>
                      {(l) => <option value={l.id}>{l.name}</option>}
                    </For>
                  </select>
                </div>
              </div>

              {/* Custom dynamic fields */}
              <Show when={categoryFields().length > 0}>
                <div class="border-t border-white/5 pt-4 space-y-4">
                  <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Custom Category Attributes</h4>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <For each={categoryFields()}>
                      {(f) => (
                        <div>
                          <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">{f.name}</label>
                          <input
                            type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                            value={customFieldValues()[f.id] || ""}
                            onInput={(e) => {
                              const vals = { ...customFieldValues() };
                              vals[f.id] = e.target.value;
                              setCustomFieldValues(vals);
                            }}
                            class="glass-input w-full text-xs"
                          />
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
              
              <div class="flex gap-3 pt-6 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn-primary flex-1"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
