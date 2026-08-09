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
  ArrowLeft,
  Search,
  Building2,
  Cpu
} from "lucide-solid";
import { apiFetch, user, backendUrl } from "../hooks/useAuth";

export default function ItemDetails() {
  const params = useParams();
  const navigate = useNavigate();
  const itemId = params.id;

  const [item, setItem] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Stock actions state
  const [stockQty, setStockQty] = createSignal(1);
  const [stockNotes, setStockNotes] = createSignal("");
  const [selectedStorageId, setSelectedStorageId] = createSignal("");
  const [stockSubmitting, setStockSubmitting] = createSignal(false);

  // Upload state
  const [uploadFile, setUploadFile] = createSignal<File | null>(null);
  const [uploading, setUploading] = createSignal(false);

  // Link Supplier State
  const [newSupplierId, setNewSupplierId] = createSignal("");
  const [newSupplierPartNo, setNewSupplierPartNo] = createSignal("");
  const [linkingSupplier, setLinkingSupplier] = createSignal(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  const [editNotes, setEditNotes] = createSignal("");
  const [editNumber, setEditNumber] = createSignal("");
  const [editPackage, setEditPackage] = createSignal("");
  const [editPrice, setEditPrice] = createSignal(0.0);
  const [editWeight, setEditWeight] = createSignal(0.0);
  const [editThreshold, setEditThreshold] = createSignal(0);
  const [editCat, setEditCat] = createSignal("");
  const [editLoc, setEditLoc] = createSignal("");
  const [categories, setCategories] = createSignal<any[]>([]);
  const [locations, setLocations] = createSignal<any[]>([]);
  const [suppliers, setSuppliers] = createSignal<any[]>([]);

  const [barcodeValue, setBarcodeValue] = createSignal("");

  const fetchItemDetails = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/items/${itemId}`);
      setItem(data);

      // Seed edit form values
      setEditValue(data.value);
      setEditNotes(data.notes || "");
      setEditNumber(data.number || "");
      setEditPackage(data.package || "");
      setEditPrice(data.price || 0.0);
      setEditWeight(data.weight || 0.0);
      setEditThreshold(data.threshold || 0);
      setEditCat(data.category_id ? String(data.category_id) : "");

      // Load current barcode from attributes
      const barcode = data.attributes?.barcode || "";
      setBarcodeValue(barcode);

      // Auto select first storage slot if available
      if (data.storage_records && data.storage_records.length > 0) {
        setSelectedStorageId(String(data.storage_records[0].id));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load component details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [cats, locs, sups] = await Promise.all([
        apiFetch("/categories"),
        apiFetch("/locations?flat=true"),
        apiFetch("/suppliers")
      ]);
      setCategories(cats);
      setLocations(locs);
      setSuppliers(sups);
    } catch (_) { }
  };

  onMount(() => {
    fetchItemDetails();
    fetchMetadata();
  });

  const handleStockAction = async (action: "check_in" | "check_out") => {
    setStockSubmitting(true);
    try {
      await apiFetch(`/items/${itemId}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity_change: stockQty(),
          action_type: action,
          notes: stockNotes() || `Stock adjusted via component details.`,
          location_id: selectedStorageId() ? selectedStorageId() : null
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

  const handleDeleteAttachment = async (attachId: string) => {
    if (!confirm("Are you sure you want to delete this attachment?")) return;
    try {
      await apiFetch(`/uploads/${attachId}`, { method: "DELETE" });
      fetchItemDetails();
    } catch (err: any) {
      alert(err.message || "Deletion failed.");
    }
  };

  const handleLinkSupplier = async (e: Event) => {
    e.preventDefault();
    if (!newSupplierId() || !newSupplierPartNo()) return;
    setLinkingSupplier(true);
    try {
      await apiFetch("/suppliers/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: newSupplierId(),
          part_id: itemId,
          number: newSupplierPartNo()
        })
      });
      setNewSupplierId("");
      setNewSupplierPartNo("");
      fetchItemDetails();
      alert("Supplier catalog link added successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to link supplier.");
    } finally {
      setLinkingSupplier(false);
    }
  };

  const handleUnlinkSupplier = async (prodId: string) => {
    if (!confirm("Remove this supplier product catalog link?")) return;
    try {
      await apiFetch(`/suppliers/products/${prodId}`, { method: "DELETE" });
      fetchItemDetails();
    } catch (err: any) {
      alert(err.message || "Failed to unlink supplier.");
    }
  };

  const handleUpdateItemDetails = async (e: Event) => {
    e.preventDefault();
    try {
      const payload = {
        name: editValue(),
        description: editNotes(),
        sku: editNumber() || null,
        min_quantity_alert: editThreshold(),
        category_id: editCat() ? editCat() : null,
        location_id: editLoc() ? editLoc() : null,
        barcode: barcodeValue() || null
      };

      await apiFetch(`/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Simple update extra fields directly in models.py requires backend logic or we can just send price, weight, package
      // Let's call details update on price, weight, package as well (if supported by PUT /items/{id})
      // Since our items PUT router accepts updates, let's see: we can set package, price, weight too!
      // In items.py, we have update_item. Let's make sure it handles price, weight, package:
      // Oh! In items.py, we mapped name to value, description to notes, sku to number.
      // Wait, we didn't add price, weight, package in ItemUpdateCompat. Let's make sure our PUT router handles them!
      // Let's look at what we wrote in items.py: Yes, we wrote: db_part.value = payload.name, notes = description, number = sku.
      // To support updating price, weight, package, let's add them to ItemUpdateCompat and save them in db_part!
      // Let's check: yes, we can do that in the backend. Let's update backend PUT handler to support package, price, weight.
      // Wait, let's write it in this payload, and we'll ensure items.py supports it! (I will check if items.py already updates other fields, or I'll patch items.py to be safe.)
      // Actually, we can add them to payload:
      // Let's add price, weight, package to payload:
      const fullPayload = {
        name: editValue(),
        description: editNotes(),
        sku: editNumber() || null,
        min_quantity_alert: editThreshold(),
        category_id: editCat() ? editCat() : null,
        location_id: editLoc() ? editLoc() : null,
        barcode: barcodeValue() || null,
        package: editPackage() || null,
        price: editPrice(),
        weight: editWeight()
      };

      await apiFetch(`/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPayload)
      });

      setShowEditModal(false);
      fetchItemDetails();
      alert("Component details updated successfully.");
    } catch (err: any) {
      alert(err.message || "Modification failed.");
    }
  };

  const handleDeleteItem = async () => {
    if (!confirm("⚠️ DANGER: Are you sure you want to permanently delete this component? This action is irreversible.")) return;
    try {
      await apiFetch(`/items/${itemId}`, { method: "DELETE" });
      navigate("/inventory");
    } catch (err: any) {
      alert(err.message || "Failed to delete component.");
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
          <h3 class="font-bold text-white mb-2">Error loading component</h3>
          <p>{error()}</p>
        </div>
      </Show>

      <Show when={item()}>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ----------------- LEFT 2 COLS: PART INFO & ATTACHMENTS ----------------- */}
          <div class="lg:col-span-2 space-y-6">

            {/* Main Info Card */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6 relative overflow-hidden">
              <div class="absolute top-0 right-0 w-32 h-32 bg-accentCyan/5 rounded-full blur-2xl -z-10"></div>

              <div class="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <div class="flex items-center gap-3">
                    <h2 class="text-2xl font-bold text-white tracking-tight">{item().value}</h2>
                    <Show when={item().total_quantity < item().threshold}>
                      <span class="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Low Stock
                      </span>
                    </Show>
                  </div>
                  <p class="text-gray-400 text-sm mt-2 leading-relaxed">{item().notes || "No description/notes provided."}</p>
                </div>

                {/* Edit details */}
                <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                  <button
                    onClick={() => setShowEditModal(true)}
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
                  <span class="text-gray-500 uppercase block font-semibold">Part Number</span>
                  <span class="text-white font-mono font-medium block mt-1 truncate">{item().number || "N/A"}</span>
                </div>
                <div>
                  <span class="text-gray-500 uppercase block font-semibold">Package</span>
                  <span class="text-white font-mono font-medium block mt-1 truncate">{item().package || "N/A"}</span>
                </div>
                <div>
                  <span class="text-gray-500 uppercase block font-semibold">Price</span>
                  <span class="text-white font-medium block mt-1 truncate">
                    {item().price !== null ? `$${item().price.toFixed(3)}` : "N/A"}
                  </span>
                </div>
                <div>
                  <span class="text-gray-500 uppercase block font-semibold">Weight</span>
                  <span class="text-white font-medium block mt-1 truncate">
                    {item().weight !== null ? `${item().weight}g` : "N/A"}
                  </span>
                </div>
              </div>

              {/* Dynamic properties from JSON attributes */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div class="glass-card p-3 rounded-xl flex justify-between items-center text-xs">
                  <span class="text-gray-400 font-medium">Category</span>
                  <span class="text-white font-semibold">{item().category?.title || "Uncategorized"}</span>
                </div>
                <div class="glass-card p-3 rounded-xl flex justify-between items-center text-xs">
                  <span class="text-gray-400 font-medium">Barcode Value</span>
                  <span class="text-white font-semibold font-mono">{barcodeValue() || "N/A"}</span>
                </div>
              </div>

              {/* Bins List */}
              <div class="space-y-3">
                <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Inventory Storage Slots</h4>
                <Show when={!item().storage_records || item().storage_records.length === 0}>
                  <p class="text-xs text-gray-500 italic">No storage bins currently hold this component. Check stock in to assign location.</p>
                </Show>
                <Show when={item().storage_records && item().storage_records.length > 0}>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <For each={item().storage_records}>
                      {(bin) => (
                        <div class="glass-card p-3 rounded-xl flex justify-between items-center text-xs">
                          <span class="text-white font-medium flex items-center gap-1.5">
                            <MapPin size={14} class="text-accentCyan" />
                            {bin.name}
                          </span>
                          <span class="text-cyan-400 font-bold text-sm">{bin.quantity} units</span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>

            {/* Consumed by PCB projects Card */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <Cpu size={18} class="text-accentCyan" />
                Consumed by PCB Assemblies
              </h3>

              <Show when={!item().materials || item().materials.length === 0}>
                <p class="text-xs text-gray-500 italic">This component is not currently consumed by any active project BOM lists.</p>
              </Show>

              <Show when={item().materials && item().materials.length > 0}>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <For each={item().materials}>
                    {(mat) => (
                      <div class="glass-card p-3.5 rounded-xl border border-white/5 flex justify-between items-center">
                        <div>
                          <span class="font-bold text-white block">{mat.revision?.project?.title || "Project"}</span>
                          <span class="text-gray-400 text-[10px] block mt-0.5">Layout Version: {mat.revision?.version || "N/A"}</span>
                        </div>
                        <span class="bg-accentCyan/10 border border-accentCyan/20 text-accentCyan text-xs font-bold px-2 py-0.5 rounded font-mono">
                          {mat.designator}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Linked distributor catalog lines */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <Building2 size={18} class="text-accentCyan" />
                Linked Distributor Catalogs
              </h3>

              {/* Linked Suppliers List */}
              <Show when={!item().products || item().products.length === 0}>
                <p class="text-xs text-gray-500 italic">No distributor order listings linked to this component.</p>
              </Show>

              <Show when={item().products && item().products.length > 0}>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <For each={item().products}>
                    {(prod) => (
                      <div class="glass-card p-3.5 rounded-xl border border-white/5 flex justify-between items-center">
                        <div>
                          <span class="font-bold text-white block">{prod.supplier?.name}</span>
                          <span class="text-gray-400 font-mono text-[10px] block mt-0.5">{prod.number}</span>
                        </div>

                        <div class="flex gap-2 items-center">
                          <a
                            href={`${prod.supplier?.search}${prod.number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="btn-secondary py-1 px-2.5 text-[10px] flex items-center gap-1.5"
                          >
                            <Search size={10} />
                            Check Supplier
                          </a>

                          <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                            <button
                              onClick={() => handleUnlinkSupplier(prod.id)}
                              class="text-gray-600 hover:text-red-400 p-1 cursor-pointer transition-colors"
                              title="Delete Link"
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

              {/* Add supplier listing form (Stocker/Admin) */}
              <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                <form onSubmit={handleLinkSupplier} class="flex flex-col sm:flex-row gap-3 items-end p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-xs">
                  <div class="w-full sm:w-1/2">
                    <label class="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase">Select Supplier</label>
                    <select
                      required
                      value={newSupplierId()}
                      onChange={(e) => setNewSupplierId(e.currentTarget.value)}
                      class="glass-input w-full text-xs"
                    >
                      <option value="">Choose Supplier...</option>
                      <For each={suppliers()}>
                        {(s) => <option value={s.id}>{s.name}</option>}
                      </For>
                    </select>
                  </div>

                  <div class="flex-1 w-full">
                    <label class="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase">Distributor SKU / Code</label>
                    <input
                      type="text"
                      required
                      value={newSupplierPartNo()}
                      onInput={(e) => setNewSupplierPartNo(e.target.value)}
                      placeholder="E.g. YAG10KCT-ND"
                      class="glass-input w-full py-2 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={linkingSupplier() || !newSupplierId()}
                    class="btn-primary w-full sm:w-auto flex items-center justify-center gap-1.5 font-bold"
                  >
                    <Plus size={14} />
                    Link SKU
                  </button>
                </form>
              </Show>
            </div>

            {/* Document Attachments Card */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={18} class="text-accentCyan" />
                Attachments (Datasheets & Layout Images)
              </h3>

              {/* Upload interface */}
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
              <Show when={!item().attachments || item().attachments.length === 0}>
                <div class="text-center py-6 text-xs text-gray-500">
                  No datasheets or files attached to this component record.
                </div>
              </Show>

              <Show when={item().attachments && item().attachments.length > 0}>
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
                          <a
                            href={`${backendUrl()}/uploads/file/${itemId}/${att.filename}`}
                            target="_blank"
                            class="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                            title="Download/Open"
                          >
                            <Download size={12} />
                          </a>

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
                Component Stock Levels
              </h3>

              <div class="text-center bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <span class="text-[10px] text-gray-500 uppercase font-semibold">Total Catalog Count</span>
                <span class={`text-4xl font-extrabold block mt-2 ${item().total_quantity < item().threshold ? "text-amber-400" : "text-white"
                  }`}>
                  {item().total_quantity}
                </span>
                <span class="text-[10px] text-gray-500 mt-2 block">
                  Alert threshold minimum: {item().threshold || 0} units
                </span>
              </div>

              {/* Stock Actions (Only for Stockers / Pullers) */}
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleStockAction("check_in")}
                    disabled={stockSubmitting() || (user()?.role !== "admin" && user()?.role !== "stocker")}
                    class="btn-primary py-3 flex items-center justify-center gap-1.5 font-bold"
                  >
                    <Plus size={16} />
                    Check In
                  </button>

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
                    <label class="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Adjust At Storage Bin</label>
                    <select
                      value={selectedStorageId()}
                      onChange={(e) => setSelectedStorageId(e.currentTarget.value)}
                      class="glass-input w-full text-xs"
                    >
                      <option value="">Choose Storage Slot...</option>
                      <For each={locations()}>
                        {(loc) => (
                          <option value={loc.id}>
                            {loc.name} {loc.parent_id ? `(Bin)` : "(Root Box)"}
                          </option>
                        )}
                      </For>
                    </select>
                    <p class="text-[9px] text-gray-500 mt-1">Specify which storage drawer or cabinet slot inventory check-in/out occurs at.</p>
                  </div>

                  <div>
                    <label class="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Reference Notes</label>
                    <textarea
                      value={stockNotes()}
                      onInput={(e) => setStockNotes(e.target.value)}
                      placeholder="E.g. restock order #45, PCB assembly run #2..."
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
                History Movement Log
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
                        <span class={`font-extrabold uppercase ${tx.quantity_change > 0 ? "text-cyan-400" : tx.quantity_change < 0 ? "text-rose-400" : "text-purple-400"
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
                  Permanently Delete Component
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
              Edit Component Parameters
            </h3>

            <form onSubmit={handleUpdateItemDetails} class="space-y-4 text-xs">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Component Value / Name</label>
                  <input
                    type="text"
                    required
                    value={editValue()}
                    onInput={(e) => setEditValue(e.target.value)}
                    class="glass-input w-full text-sm"
                  />
                </div>

                <div class="sm:col-span-2">
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Description Notes</label>
                  <textarea
                    value={editNotes()}
                    onInput={(e) => setEditNotes(e.target.value)}
                    class="glass-input w-full text-sm h-20 resize-none"
                  />
                </div>

                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Manufacturer Part No.</label>
                  <input
                    type="text"
                    value={editNumber()}
                    onInput={(e) => setEditNumber(e.target.value)}
                    class="glass-input w-full text-xs font-mono"
                  />
                </div>

                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Package / Footprint</label>
                  <input
                    type="text"
                    value={editPackage()}
                    onInput={(e) => setEditPackage(e.target.value)}
                    placeholder="E.g. 0805, LQFP-48"
                    class="glass-input w-full text-xs font-mono"
                  />
                </div>

                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Price ($ USD)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={editPrice()}
                    onInput={(e) => setEditPrice(parseFloat(e.target.value) || 0.0)}
                    class="glass-input w-full text-xs"
                  />
                </div>

                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Weight (grams)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={editWeight()}
                    onInput={(e) => setEditWeight(parseFloat(e.target.value) || 0.0)}
                    class="glass-input w-full text-xs"
                  />
                </div>

                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Low Stock Alert Min</label>
                  <input
                    type="number"
                    value={editThreshold()}
                    onInput={(e) => setEditThreshold(parseInt(e.target.value) || 0)}
                    class="glass-input w-full text-sm"
                  />
                </div>

                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Barcode ID</label>
                  <input
                    type="text"
                    value={barcodeValue()}
                    onInput={(e) => setBarcodeValue(e.target.value)}
                    class="glass-input w-full text-xs font-mono"
                  />
                </div>

                <div class="sm:col-span-2">
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Category</label>
                  <select
                    value={editCat()}
                    onChange={(e) => setEditCat(e.currentTarget.value)}
                    class="glass-input w-full text-xs"
                  >
                    <option value="">Select Category...</option>
                    <For each={categories()}>
                      {(c) => <option value={c.id}>{c.title}</option>}
                    </For>
                  </select>
                </div>
              </div>

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
