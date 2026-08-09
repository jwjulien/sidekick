import { createSignal, createMemo, onMount, For, Show } from "solid-js";
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
  Cpu,
  X,
  Link2,
  Printer,
  Move
} from "lucide-solid";
import { apiFetch, user, backendUrl, token } from "../hooks/useAuth";
import toast from "solid-toast";
import { useConfirm } from "../contexts/ConfirmContext";
import StockController from "../components/StockController";
import LabelPreviewModal from "../components/LabelPreviewModal";
import PartImages from "../components/PartImages";
import DocumentViewer from "../components/DocumentViewer";
export default function PartDetails() {
  const { confirm } = useConfirm();
  const params = useParams();
  const navigate = useNavigate();
  const itemId = parseInt(params.id);

  const [item, setItem] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Stock panel state
  // drillTarget: null = list view, number = showing StockController for that storage ID
  const [drillTarget, setDrillTarget] = createSignal<number | null>(null);
  // Location link / create state
  const [showLocationPanel, setShowLocationPanel] = createSignal(false);
  const [locationPanelMode, setLocationPanelMode] = createSignal<"link" | "create">("link");
  const [linkLocationId, setLinkLocationId] = createSignal("");
  const [newLocationName, setNewLocationName] = createSignal("");
  const [newLocationParentId, setNewLocationParentId] = createSignal("");
  const [locationSubmitting, setLocationSubmitting] = createSignal(false);
  // All system locations (for link dropdown)
  const [allLocations, setAllLocations] = createSignal<any[]>([]);

  // Move Parts Dialog State
  const [showMoveModal, setShowMoveModal] = createSignal(false);
  const [moveQuantity, setMoveQuantity] = createSignal(0);
  const [moveDestMode, setMoveDestMode] = createSignal<"link" | "create">("link");
  const [moveDestLocationId, setMoveDestLocationId] = createSignal("");
  const [moveNewLocationName, setMoveNewLocationName] = createSignal("");
  const [moveNewLocationParentId, setMoveNewLocationParentId] = createSignal("");
  const [deleteSourceAfterMove, setDeleteSourceAfterMove] = createSignal(true);
  const [moveSourceLocation, setMoveSourceLocation] = createSignal<any>(null);
  const [moveSubmitting, setMoveSubmitting] = createSignal(false);
  const [activePrintLocation, setActivePrintLocation] = createSignal<any | null>(null);

  const activeDrillSlot = createMemo(() => {
    const target = drillTarget();
    if (target === null || !item()) return null;
    return item().storage_records?.find((s: any) => s.id === target) || null;
  });

  // Upload state
  const [uploadFile, setUploadFile] = createSignal<File | null>(null);
  const [uploadDocUrl, setUploadDocUrl] = createSignal("");
  const [uploading, setUploading] = createSignal(false);

  // Document Viewer state
  const [selectedDocumentForView, setSelectedDocumentForView] = createSignal<any>(null);

  // Link Supplier State
  const [newSupplierId, setNewSupplierId] = createSignal("");
  const [newSupplierSku, setNewSupplierSku] = createSignal("");
  const [linkingSupplier, setLinkingSupplier] = createSignal(false);
  const [showAddSupplierPanel, setShowAddSupplierPanel] = createSignal(false);
  const [products, setProducts] = createSignal<any[]>([]);
  const [editingProductId, setEditingProductId] = createSignal<number | null>(null);
  const [editSkuValue, setEditSkuValue] = createSignal("");
  const [savingEdit, setSavingEdit] = createSignal(false);

  const fetchProducts = async () => {
    try {
      const data = await apiFetch(`/parts/${itemId}/products`);
      setProducts(data);
    } catch (_) { }
  };

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

  // Carousel & Drag & Drop State
  const [activeImageIndex, setActiveImageIndex] = createSignal(0);
  const [isDraggingOver, setIsDraggingOver] = createSignal(false);
  const [showAddImageModal, setShowAddImageModal] = createSignal(false);
  const [newImageCaption, setNewImageCaption] = createSignal("");
  const [newImageNotes, setNewImageNotes] = createSignal("");


  const getLocationHeight = (locId: number, locs: any[]): number => {
    const children = locs.filter((l: any) => l.parent_id === locId);
    if (children.length === 0) return 0;
    const childHeights = children.map((c: any) => getLocationHeight(c.id, locs));
    return 1 + Math.max(...childHeights);
  };

  const splitParentIfNeeded = async (parentId: number) => {
    const parentLoc = allLocations().find((l: any) => l.id === parentId);
    if (parentLoc && parentLoc.part_id) {
      // Create child for the original part
      await apiFetch("/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${parentLoc.name} - ${parentLoc.part?.value || 'Original'}`,
          parent_id: parentLoc.id,
          part_id: parentLoc.part_id,
          quantity: parentLoc.quantity
        })
      });
      // Clear parent's part association
      await apiFetch(`/locations/${parentLoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_id: null })
      });
      await apiFetch(`/locations/${parentLoc.id}/count`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: 0 })
      });
    }
  };

  const parentLocations = createMemo(() => {
    const locs = allLocations();
    return locs.filter((l: any) => getLocationHeight(l.id, locs) <= 1);
  });

  const attributesEntries = () => {
    if (!item() || !item().attributes) return [];
    return Object.entries(item().attributes);
  };



  const fetchItemDetails = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/parts/${itemId}`);
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
      setAllLocations(locs);
      setSuppliers(sups);
    } catch (_) { }
  };

  onMount(() => {
    fetchItemDetails();
    fetchMetadata();
    fetchProducts();
  });

  const handleLinkLocation = async () => {
    if (!linkLocationId()) return;
    setLocationSubmitting(true);
    try {
      await apiFetch(`/locations/${linkLocationId()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_id: itemId })
      });
      setLinkLocationId("");
      setShowLocationPanel(false);
      fetchItemDetails();
      toast.success("Location linked successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to link location.");
    } finally {
      setLocationSubmitting(false);
    }
  };

  const handleCreateAndLinkLocation = async () => {
    if (!newLocationName()) return;
    setLocationSubmitting(true);
    try {
      const parentIdVal = newLocationParentId();
      if (parentIdVal) {
        await splitParentIfNeeded(parseInt(parentIdVal));
      }
      const created = await apiFetch("/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLocationName(),
          parent_id: parentIdVal ? parseInt(parentIdVal) : null,
          part_id: itemId,
          quantity: 0
        })
      });
      setNewLocationName("");
      setNewLocationParentId("");
      setShowLocationPanel(false);
      fetchItemDetails();
      toast.success(`Location "${created.name}" created and linked.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create location.");
    } finally {
      setLocationSubmitting(false);
    }
  };

  // Called by StockController when quantity or last_counted changes
  const handleStorageChanged = (storageId: number, newQty: number, newLastCounted: string) => {
    setItem((prev: any) => ({
      ...prev,
      total_quantity: (prev.storage_records || []).reduce((sum: number, s: any) =>
        sum + (s.id === storageId ? newQty : s.quantity), 0),
      storage_records: (prev.storage_records || []).map((s: any) =>
        s.id === storageId ? { ...s, quantity: newQty, last_counted: newLastCounted } : s
      )
    }));
  };
  const [uploadLabel, setUploadLabel] = createSignal("");

  const handleFileUpload = async (e: Event) => {
    e.preventDefault();
    const file = uploadFile();
    const urlValue = uploadDocUrl();

    if (!file && !urlValue) return;

    setUploading(true);

    try {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        const isDoc = !file.type.startsWith("image/");
        if (isDoc) {
          formData.append("label", uploadLabel() || file.name);
        }

        const url = isDoc
          ? `${backendUrl()}/parts/${itemId}/documents`
          : `${backendUrl()}/uploads/item/${itemId}`;

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
        toast.success(isDoc ? "Document uploaded successfully." : "Photo uploaded successfully.");
      } else if (urlValue) {
        await apiFetch(`/parts/${itemId}/documents/url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlValue, label: uploadLabel() || "" })
        });
        toast.success("Document downloaded from URL successfully.");
      }

      setUploadFile(null);
      setUploadDocUrl("");
      setUploadLabel("");
      const fileInput = document.getElementById("file-input-field-doc") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      fetchItemDetails();
    } catch (err: any) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    const isConfirmed = await confirm({
      title: "Confirm Action",
      message: "Are you sure you want to delete this photo?",
      confirmText: "Proceed",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/api/images/${imageId}`, { method: "DELETE" });
      setActiveImageIndex(0);
      fetchItemDetails();
      toast.success("Photo deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Deletion failed.");
    }
  };

  const [stagedDroppedUrl, setStagedDroppedUrl] = createSignal("");

  const uploadImageFromLocalFile = async (file: File, caption: string, notes?: string) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("caption", caption);
    if (notes) formData.append("notes", notes);

    try {
      const url = `${backendUrl()}/parts/${itemId}/images`;
      const tokenHeader = localStorage.getItem("sidekick_token");
      const headers: Record<string, string> = {};
      if (tokenHeader) {
        headers["Authorization"] = `Bearer ${tokenHeader}`;
      }

      const res = await fetch(url, { method: "POST", headers, body: formData });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || "Upload failed.");
      }

      toast.success("Image uploaded successfully.");
      fetchItemDetails();
    } catch (err: any) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const uploadImageFromUrl = async (imgUrl: string, caption: string, notes?: string) => {
    setUploading(true);
    try {
      await apiFetch(`/parts/${itemId}/images/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imgUrl, caption, notes })
      });
      toast.success("Image downloaded and attached successfully.");
      fetchItemDetails();
    } catch (err: any) {
      toast.error(err.message || "Failed to download image.");
    } finally {
      setUploading(false);
    }
  };

  const handleImageUploadForm = async (e: Event) => {
    e.preventDefault();

    // Check if we are uploading a downloaded URL
    const droppedUrl = stagedDroppedUrl();
    if (droppedUrl) {
      await uploadImageFromUrl(droppedUrl, newImageCaption() || "Dropped URL Image", newImageNotes());
      setStagedDroppedUrl("");
    } else {
      const file = uploadFile();
      if (!file) return;
      await uploadImageFromLocalFile(file, newImageCaption() || file.name, newImageNotes());
      setUploadFile(null);
    }

    setShowAddImageModal(false);
    setNewImageCaption("");
    setNewImageNotes("");
  };



  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    console.log("Drop event detected!");
    if (e.dataTransfer) {
      console.log("Types available:", e.dataTransfer.types);
      console.log("Files length:", e.dataTransfer.files?.length);
    }

    // 1. Check for files
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      console.log("Dropped file:", file.name, file.type);
      if (file.type.startsWith("image/")) {
        setUploadFile(file);
        setStagedDroppedUrl("");
        setNewImageCaption(file.name);
        setShowAddImageModal(true);
      } else {
        toast.error("Only image files can be dropped here.");
      }
      return;
    }

    // 2. Check for image url drag from browser (HTML source containing image tag)
    const htmlData = e.dataTransfer?.getData("text/html");
    if (htmlData) {
      console.log("Dropped HTML:", htmlData);
      const doc = new DOMParser().parseFromString(htmlData, "text/html");
      const img = doc.querySelector("img");
      if (img && img.src) {
        setStagedDroppedUrl(img.src);
        setUploadFile(null);
        setNewImageCaption("Dropped Browser Image");
        setShowAddImageModal(true);
        return;
      }
    }

    // 3. Fallback plaintext URL (e.g. mouser image URL links)
    const textData = e.dataTransfer?.getData("text/plain");
    if (textData) {
      console.log("Dropped text:", textData);
      const urlMatch = textData.match(/https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|gif|webp|svg)/i) || textData.trim().match(/^https?:\/\/[^\s"']+$/i);
      if (urlMatch) {
        const targetUrl = urlMatch[0];
        setStagedDroppedUrl(targetUrl);
        setUploadFile(null);
        setNewImageCaption("Dropped URL Image");
        setShowAddImageModal(true);
        return;
      }
    }

    toast.error("Could not extract image from drop data.");
  };


  const handleDeleteDocument = async (docId: number) => {
    const isConfirmed = await confirm({
      title: "Confirm Action",
      message: "Are you sure you want to delete this document?",
      confirmText: "Proceed",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/api/documents/${docId}`, { method: "DELETE" });
      fetchItemDetails();
      toast.success("Document deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Deletion failed.");
    }
  };

  const handleLinkSupplier = async (e: Event) => {
    e.preventDefault();
    if (!newSupplierId() || !newSupplierSku()) return;
    setLinkingSupplier(true);
    try {
      await apiFetch("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: parseInt(newSupplierId()),
          part_id: itemId,
          sku: newSupplierSku()
        })
      });
      setNewSupplierId("");
      setNewSupplierSku("");
      setShowAddSupplierPanel(false);
      fetchProducts();
      fetchItemDetails();
      toast.success("Supplier catalog link added successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to link supplier.");
    } finally {
      setLinkingSupplier(false);
    }
  };

  const handleUnlinkSupplier = async (prodId: number) => {
    const isConfirmed = await confirm({
      title: "Confirm Action",
      message: "Remove this supplier product catalog link?",
      confirmText: "Proceed",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/products/${prodId}`, { method: "DELETE" });
      fetchProducts();
      fetchItemDetails();
      toast.success("Supplier catalog link removed successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to unlink supplier.");
    }
  };

  const handleUpdateSupplierSku = async (prodId: number) => {
    if (!editSkuValue().trim()) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/products/${prodId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: editSkuValue()
        })
      });
      setEditingProductId(null);
      setEditSkuValue("");
      fetchProducts();
      fetchItemDetails();
      toast.success("Supplier SKU updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update SKU.");
    } finally {
      setSavingEdit(false);
    }
  };

  const openExternalUrl = async (url: string) => {
    try {
      const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== "undefined" || typeof (window as any).__TAURI__ !== "undefined";
      if (isTauri) {
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Failed to open URL:", err);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleUpdateItemDetails = async (e: Event) => {
    e.preventDefault();
    try {
      const payload = {
        value: editValue(),
        notes: editNotes(),
        number: editNumber() || null,
        threshold: editThreshold(),
        category_id: editCat() ? parseInt(editCat()) : null,
        package: editPackage() || null,
        price: editPrice(),
        weight: editWeight()
      };

      await apiFetch(`/parts/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setShowEditModal(false);
      fetchItemDetails();
      toast.success("Component updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Modification failed.");
    }
  };

  const handleDeleteItem = async () => {
    const isConfirmed = await confirm({
      title: "Confirm Action",
      message: "⚠️ DANGER: Are you sure you want to permanently delete this component? This action is irreversible.",
      confirmText: "Proceed",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/parts/${itemId}`, { method: "DELETE" });
      navigate("/inventory");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete component.");
    }
  };

  const handleMoveParts = async (e: Event) => {
    e.preventDefault();
    const source = moveSourceLocation();
    if (!source) return;

    const qtyToMove = moveQuantity();
    if (qtyToMove <= 0 || qtyToMove > source.quantity) {
      toast.error("Invalid quantity to move.");
      return;
    }

    setMoveSubmitting(true);
    try {
      let destId = 0;
      if (moveDestMode() === "create") {
        if (!moveNewLocationName()) {
          toast.error("Please enter a destination location name.");
          setMoveSubmitting(false);
          return;
        }
        const parentIdVal = moveNewLocationParentId();
        if (parentIdVal) {
          await splitParentIfNeeded(parseInt(parentIdVal));
        }
        const created = await apiFetch("/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: moveNewLocationName(),
            parent_id: parentIdVal ? parseInt(parentIdVal) : null,
            part_id: itemId,
            quantity: 0
          })
        });
        destId = created.id;
      } else {
        if (!moveDestLocationId()) {
          toast.error("Please select a destination location.");
          setMoveSubmitting(false);
          return;
        }
        destId = parseInt(moveDestLocationId());
        await apiFetch(`/locations/${destId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ part_id: itemId })
        });
      }

      const destDetails = await apiFetch(`/locations/${destId}`);
      const destCurrentQty = destDetails.quantity || 0;

      await apiFetch(`/locations/${destId}/count`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: destCurrentQty + qtyToMove })
      });

      const remainingQty = source.quantity - qtyToMove;
      await apiFetch(`/locations/${source.id}/count`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: remainingQty })
      });

      if (remainingQty === 0 && deleteSourceAfterMove()) {
        await apiFetch(`/locations/${source.id}`, { method: "DELETE" });
      }

      toast.success("Parts moved successfully.");
      setShowMoveModal(false);
      setDrillTarget(null);
      fetchItemDetails();
      fetchMetadata();
    } catch (err: any) {
      toast.error(err.message || "Failed to move parts.");
    } finally {
      setMoveSubmitting(false);
    }
  };

  const handleDeleteLocation = async (loc: any) => {
    if (!loc) return;
    const isConfirmed = await confirm({
      title: "Confirm Delete Location",
      message: `Are you sure you want to delete the storage location "${loc.name}" from the database?`,
      confirmText: "Delete",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/locations/${loc.id}`, { method: "DELETE" });
      toast.success(`Location "${loc.name}" deleted.`);
      setDrillTarget(null);
      fetchItemDetails();
      fetchMetadata();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete location.");
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
              <div class="space-y-3 pt-2">
                <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Attributes</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="glass-card p-3 rounded-xl flex justify-between items-center text-xs">
                    <span class="text-gray-400 font-medium">Category</span>
                    <span class="text-white font-semibold">{item().category?.title || "Uncategorized"}</span>
                  </div>
                  <For each={attributesEntries()}>
                    {([key, value]) => (
                      <div class="glass-card p-3 rounded-xl flex justify-between items-center text-xs">
                        <span class="text-gray-400 font-medium truncate max-w-[120px]">{key}</span>
                        <span class="text-white font-semibold truncate max-w-[120px]">{value as string}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>

            {/* Responsive Image block: Only visible on mobile/small screens, hidden on large desktop screens */}
            <PartImages
              class="lg:hidden flex flex-col"
              item={item()}
              user={user()}
              isDraggingOver={isDraggingOver()}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              setShowAddImageModal={setShowAddImageModal}
              activeImageIndex={activeImageIndex()}
              setActiveImageIndex={setActiveImageIndex}
              backendUrl={backendUrl()}
              handleDeleteImage={handleDeleteImage}
            />

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
              <div class="flex justify-between items-center">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 size={18} class="text-accentCyan" />
                  Linked Distributor Catalogs
                </h3>
                <Show when={!showAddSupplierPanel() && (user()?.role === "admin" || user()?.role === "stocker")}>
                  <button
                    onClick={() => setShowAddSupplierPanel(true)}
                    class="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Add Source
                  </button>
                </Show>
              </div>

              {/* Linked Suppliers List */}
              <Show when={!products() || products().length === 0}>
                <p class="text-xs text-gray-500 italic">No distributor order listings linked to this component.</p>
              </Show>

              <Show when={products() && products().length > 0}>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <For each={products()}>
                    {(prod) => (
                      <div class="glass-card p-3.5 rounded-xl border border-white/5 flex justify-between items-center">
                        <div class="flex-1 min-w-0 pr-2">
                          <span class="font-bold text-white block">{prod.supplier?.name}</span>
                          <Show when={editingProductId() === prod.id} fallback={
                            <span class="text-gray-400 font-mono text-[10px] block mt-0.5">{prod.sku}</span>
                          }>
                            <div class="flex items-center gap-1.5 mt-1">
                              <input
                                type="text"
                                value={editSkuValue()}
                                onInput={(e) => setEditSkuValue(e.target.value)}
                                class="glass-input py-0.5 px-2 text-[10px] w-full font-mono"
                              />
                              <button
                                onClick={() => handleUpdateSupplierSku(prod.id)}
                                disabled={savingEdit()}
                                class="text-cyan-400 hover:text-cyan-300 font-bold text-[10px]"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingProductId(null)}
                                class="text-gray-400 hover:text-gray-300 text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          </Show>
                        </div>

                        <Show when={editingProductId() !== prod.id}>
                          <div class="flex gap-2 items-center shrink-0">
                            <button
                              onClick={() => openExternalUrl(`${prod.supplier?.search}${prod.sku}`)}
                              class="text-gray-600 hover:text-cyan-400 p-1 cursor-pointer transition-colors"
                              title="Check Supplier"
                            >
                              <Search size={10} />
                            </button>

                            <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                              <button
                                onClick={() => {
                                  setEditingProductId(prod.id);
                                  setEditSkuValue(prod.sku);
                                }}
                                class="text-gray-600 hover:text-cyan-400 p-1 cursor-pointer transition-colors"
                                title="Edit SKU"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={() => handleUnlinkSupplier(prod.id)}
                                class="text-gray-600 hover:text-red-400 p-1 cursor-pointer transition-colors"
                                title="Delete Link"
                              >
                                <Trash2 size={12} />
                              </button>
                            </Show>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              {/* Add supplier listing form (Stocker/Admin) */}
              <Show when={showAddSupplierPanel() && (user()?.role === "admin" || user()?.role === "stocker")}>
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
                      value={newSupplierSku()}
                      onInput={(e) => setNewSupplierSku(e.target.value)}
                      placeholder="E.g. YAG10KCT-ND"
                      class="glass-input w-full py-2 text-xs"
                    />
                  </div>

                  <div class="flex gap-2 w-full sm:w-auto shrink-0">
                    <button
                      type="submit"
                      disabled={linkingSupplier() || !newSupplierId()}
                      class="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-1.5 font-bold py-2 px-4 rounded-xl"
                    >
                      <Plus size={14} />
                      Link SKU
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSupplierPanel(false);
                        setNewSupplierId("");
                        setNewSupplierSku("");
                      }}
                      class="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-1.5 font-bold py-2 px-4 rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </Show>
            </div>



            {/* Document Attachments Card */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={18} class="text-accentCyan" />
                Documents & Datasheets
              </h3>

              {/* Documents List */}
              <Show when={!item().documents || item().documents.length === 0}>
                <div class="text-center py-6 text-xs text-gray-500">
                  No datasheets or files attached to this component record.
                </div>
              </Show>

              <Show when={item().documents && item().documents.length > 0}>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <For each={item().documents}>
                    {(doc) => (
                      <div 
                        class="glass-card p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:bg-white/5 transition-colors group"
                        onClick={() => setSelectedDocumentForView(doc)}
                      >
                        <div class="flex flex-col min-w-0">
                          <span class="font-medium text-white truncate max-w-[150px] group-hover:text-indigo-300 transition-colors">{doc.label}</span>
                          <span class="text-[10px] text-gray-500 truncate max-w-[150px]">{doc.filename}</span>
                        </div>

                        <div class="flex items-center gap-1.5 shrink-0">
                          <a
                            href={token() ? `${backendUrl()}/api/documents/${doc.id}/download?token=${token()}` : `${backendUrl()}/api/documents/${doc.id}/download`}
                            target="_blank"
                            class="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                            title="Download/Open"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={12} />
                          </a>

                          <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
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

              {/* Upload interface */}
              <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                <form onSubmit={handleFileUpload} class="flex flex-col gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-xs">
                  <div class="w-full flex gap-2 items-end">
                    <div class="flex-1">
                      <label class="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase">Document URL or Local File</label>
                      <input
                        type="text"
                        placeholder="https://... or browse for a file"
                        value={uploadDocUrl()}
                        onInput={(e) => {
                          setUploadDocUrl(e.target.value);
                          if (uploadFile()) {
                            setUploadFile(null); // Clear selected file if user edits manually
                            const fileInput = document.getElementById("file-input-field-doc") as HTMLInputElement;
                            if (fileInput) fileInput.value = "";
                          }
                        }}
                        class="glass-input w-full py-2 px-3 text-xs"
                      />
                    </div>
                    <input
                      type="file"
                      id="file-input-field-doc"
                      accept=".pdf,.doc,.docx,.txt"
                      class="hidden"
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        if (file) {
                          setUploadFile(file);
                          setUploadDocUrl(file.name);
                        } else {
                          setUploadFile(null);
                          setUploadDocUrl("");
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById("file-input-field-doc")?.click()}
                      class="btn-secondary py-2 px-4 text-xs font-bold whitespace-nowrap"
                    >
                      Browse...
                    </button>
                  </div>
                  <div class="flex flex-col sm:flex-row gap-3 items-end w-full">
                    <div class="flex-1 w-full">
                      <label class="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase">Friendly Label Name</label>
                      <input
                        type="text"
                        placeholder="E.g. Texas Instruments Datasheet"
                        value={uploadLabel()}
                        onInput={(e) => setUploadLabel(e.target.value)}
                        class="glass-input w-full py-2 px-3 text-xs"
                      />
                    </div>
                      <button
                        type="submit"
                        disabled={uploading() || !uploadDocUrl().trim()}
                        class="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2"
                      >
                        <Upload size={14} />
                        {uploading() ? "Uploading..." : "Upload Document"}
                      </button>
                  </div>
                </form>
              </Show>
            </div>

          </div>

          {/* ----------------- RIGHT 1 COL: INVENTORY CONTROLS & LOGS ----------------- */}
          <div class="space-y-6">

            {/* Prominent Image Carousel / Drop Zone */}
            <PartImages
              class="hidden lg:flex flex-col"
              item={item()}
              user={user()}
              isDraggingOver={isDraggingOver()}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              setShowAddImageModal={setShowAddImageModal}
              activeImageIndex={activeImageIndex()}
              setActiveImageIndex={setActiveImageIndex}
              backendUrl={backendUrl()}
              handleDeleteImage={handleDeleteImage}
            />

            {/* Inventory Levels Controls */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <Package size={18} class="text-accentCyan" />
                Component Stock Levels
              </h3>

              {/* ── Shared: reusable add-location panel ── */}
              {/* This panel is conditionally shown at the bottom of all 3 states */}

              {/* STATE 1: No locations */}
              <Show when={!item().storage_records || item().storage_records.length === 0}>
                <div class="text-center py-8 space-y-5">
                  <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                    <MapPin size={22} class="text-gray-500" />
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-white">No storage locations</p>
                    <p class="text-xs text-gray-500 mt-1">Connect this part to a physical location to begin tracking stock.</p>
                  </div>
                  <div class="flex gap-2 justify-center">
                    <button
                      onClick={() => { setLocationPanelMode("link"); setShowLocationPanel(true); }}
                      class="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5"
                    >
                      <Link2 size={13} />
                      Link Existing
                    </button>
                    <button
                      onClick={() => { setLocationPanelMode("create"); setShowLocationPanel(true); }}
                      class="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
                    >
                      <Plus size={13} />
                      Create New
                    </button>
                  </div>
                </div>
              </Show>

              <Show when={item().storage_records && item().storage_records.length === 1}>
                {() => (
                  <div class="space-y-5">
                    {/* Total hero */}
                    <div class="text-center bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                      <span class="text-[10px] text-gray-500 uppercase font-semibold tracking-widest">Total On-Hand</span>
                      <span class={`text-5xl font-extrabold block mt-2 ${item().total_quantity < item().threshold ? "text-amber-400" : "text-white"
                        }`}>
                        {item().total_quantity}
                      </span>
                      <span class="text-[10px] text-gray-500 mt-2 block">Threshold: {item().threshold || 0}</span>
                    </div>

                    {/* Location label */}
                    <div class="flex items-center justify-between px-1">
                      <div class="flex items-center gap-2 min-w-0">
                        <MapPin size={13} class="text-accentCyan shrink-0" />
                        <span class="text-xs text-gray-300 font-medium truncate">{item().storage_records[0]?.name}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const rec = item().storage_records[0];
                            setMoveSourceLocation(rec);
                            setMoveQuantity(rec.quantity);
                            setMoveDestMode("create");
                            setMoveDestLocationId("");
                            setMoveNewLocationName("");
                            setMoveNewLocationParentId("");
                            setDeleteSourceAfterMove(true);
                            setShowMoveModal(true);
                          }}
                          disabled={item().storage_records[0]?.quantity === 0}
                          class="p-1.5 rounded-lg bg-white/5 text-accentCyan hover:text-cyan-300 disabled:text-gray-600 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
                          title="Move Parts"
                        >
                          <Move size={14} />
                        </button>
                        <button
                          onClick={() => setActivePrintLocation(item().storage_records[0])}
                          class="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors"
                          title="Print Label"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(item().storage_records[0])}
                          disabled={item().storage_records[0]?.quantity > 0}
                          class="p-1.5 rounded-lg bg-white/5 text-rose-400 hover:text-rose-300 disabled:text-gray-600 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
                          title="Delete Location"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* StockController */}
                    <StockController
                      storageId={item().storage_records[0]?.id}
                      currentQty={item().storage_records[0]?.quantity}
                      lastCounted={item().storage_records[0]?.last_counted}
                      onChanged={(qty, ts) => handleStorageChanged(item().storage_records[0]?.id, qty, ts)}
                    />
                  </div>
                )}
              </Show>

              {/* STATE 3: Multiple locations */}
              <Show when={item().storage_records && item().storage_records.length > 1}>
                {/* Drill-down: StockController for a specific location */}
                <Show when={drillTarget() !== null}>
                  {() => (
                    <div class="space-y-4">
                      {/* Header with back arrow */}
                      <div class="flex items-center gap-2">
                        <button
                          onClick={() => setDrillTarget(null)}
                          class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                          <ArrowLeft size={15} />
                        </button>
                        <div class="flex items-center justify-between w-full min-w-0">
                          <div class="flex items-center gap-2 min-w-0">
                            <MapPin size={13} class="text-accentCyan shrink-0" />
                            <span class="text-sm font-bold text-white truncate">{activeDrillSlot()?.name}</span>
                          </div>
                          <div class="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const rec = activeDrillSlot();
                                setMoveSourceLocation(rec);
                                setMoveQuantity(rec.quantity);
                                setMoveDestMode("link");
                                setMoveDestLocationId("");
                                setMoveNewLocationName("");
                                setMoveNewLocationParentId("");
                                setDeleteSourceAfterMove(true);
                                setShowMoveModal(true);
                              }}
                              disabled={activeDrillSlot()?.quantity === 0}
                              class="p-1.5 rounded-lg bg-white/5 text-accentCyan hover:text-cyan-300 disabled:text-gray-600 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
                              title="Move Parts"
                            >
                              <Move size={14} />
                            </button>
                            <button
                              onClick={() => setActivePrintLocation(activeDrillSlot())}
                              class="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors"
                              title="Print Label"
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(activeDrillSlot())}
                              disabled={activeDrillSlot()?.quantity > 0}
                              class="p-1.5 rounded-lg bg-white/5 text-rose-400 hover:text-rose-300 disabled:text-gray-600 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
                              title="Delete Location"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <StockController
                        storageId={activeDrillSlot()?.id || 0}
                        currentQty={activeDrillSlot()?.quantity || 0}
                        lastCounted={activeDrillSlot()?.last_counted}
                        onChanged={(qty, ts) => handleStorageChanged(activeDrillSlot()?.id || 0, qty, ts)}
                      />
                    </div>
                  )}
                </Show>

                {/* List view */}
                <Show when={drillTarget() === null}>
                  <div class="space-y-4">
                    {/* Total hero */}
                    <div class="text-center bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                      <span class="text-[10px] text-gray-500 uppercase font-semibold tracking-widest">Total On-Hand</span>
                      <span class={`text-5xl font-extrabold block mt-2 ${item().total_quantity < item().threshold ? "text-amber-400" : "text-white"
                        }`}>
                        {item().total_quantity}
                      </span>
                      <span class="text-[10px] text-gray-500 mt-2 block">Threshold: {item().threshold || 0}</span>
                    </div>

                    {/* Location rows — click to drill in */}
                    <div class="space-y-1.5">
                      <h4 class="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-1">Locations</h4>
                      <For each={item().storage_records}>
                        {(slot: any) => (
                          <button
                            onClick={() => setDrillTarget(slot.id)}
                            class="w-full flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl px-4 py-3 transition-all group"
                          >
                            <div class="flex items-center gap-2.5 min-w-0">
                              <MapPin size={13} class="text-accentCyan shrink-0" />
                              <span class="text-xs text-white font-medium truncate">{slot.name}</span>
                            </div>
                            <div class="flex items-center gap-3 shrink-0">
                              <span class={`text-sm font-bold ${slot.quantity === 0 ? "text-gray-600" : "text-accentCyan"}`}>
                                {slot.quantity}
                              </span>
                              <ArrowLeft size={12} class="text-gray-600 group-hover:text-gray-400 rotate-180 transition-colors" />
                            </div>
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </Show>

              {/* ── Add Location panel — shown in all states except when drilling ── */}
              <Show when={drillTarget() === null}>
                <Show when={!showLocationPanel()}>
                  <Show when={item().storage_records && item().storage_records.length > 0}>
                    <button
                      onClick={() => { setLocationPanelMode("link"); setShowLocationPanel(true); }}
                      class="w-full text-xs text-gray-500 hover:text-accentCyan transition-colors flex items-center justify-center gap-1.5 py-2"
                    >
                      <Plus size={12} />
                      Add Another Location
                    </button>
                  </Show>
                </Show>

                <Show when={showLocationPanel()}>
                  <div class="border border-white/10 rounded-xl p-4 space-y-3 bg-white/[0.02]">
                    {/* Tab toggle */}
                    <div class="flex rounded-lg overflow-hidden border border-white/10 text-xs font-semibold">
                      <button
                        onClick={() => setLocationPanelMode("link")}
                        class={`flex-1 py-1.5 transition-colors ${locationPanelMode() === "link" ? "bg-accentCyan/20 text-accentCyan" : "text-gray-500 hover:text-white"}`}
                      >
                        Link Existing
                      </button>
                      <button
                        onClick={() => setLocationPanelMode("create")}
                        class={`flex-1 py-1.5 transition-colors ${locationPanelMode() === "create" ? "bg-accentCyan/20 text-accentCyan" : "text-gray-500 hover:text-white"}`}
                      >
                        Create New
                      </button>
                    </div>

                    {/* Link existing */}
                    <Show when={locationPanelMode() === "link"}>
                      <select
                        value={linkLocationId()}
                        onChange={(e) => setLinkLocationId(e.currentTarget.value)}
                        class="glass-input w-full text-xs"
                      >
                        <option value="">Select a location...</option>
                        <For each={allLocations().filter((l: any) => getLocationHeight(l.id, allLocations()) === 0 && (!l.part_id || l.part_id === itemId))}>
                          {(loc: any) => <option value={loc.id}>{loc.name}</option>}
                        </For>
                      </select>
                      <div class="flex gap-2">
                        <button
                          onClick={() => setShowLocationPanel(false)}
                          class="flex-1 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleLinkLocation}
                          disabled={locationSubmitting() || !linkLocationId()}
                          class="flex-1 btn-primary py-1.5 text-xs disabled:opacity-50"
                        >
                          {locationSubmitting() ? "Linking..." : "Link"}
                        </button>
                      </div>
                    </Show>

                    {/* Create new */}
                    <Show when={locationPanelMode() === "create"}>
                      <input
                        type="text"
                        value={newLocationName()}
                        onInput={(e) => setNewLocationName(e.currentTarget.value)}
                        placeholder="Location name (e.g. Drawer B3)"
                        class="glass-input w-full text-xs"
                      />
                      <select
                        value={newLocationParentId()}
                        onChange={(e) => setNewLocationParentId(e.currentTarget.value)}
                        class="glass-input w-full text-xs"
                      >
                        <option value="">No parent (top-level)</option>
                        <For each={parentLocations()}>
                          {(loc: any) => <option value={loc.id}>{loc.name}</option>}
                        </For>
                      </select>
                      <div class="flex gap-2">
                        <button
                          onClick={() => setShowLocationPanel(false)}
                          class="flex-1 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateAndLinkLocation}
                          disabled={locationSubmitting() || !newLocationName()}
                          class="flex-1 btn-primary py-1.5 text-xs disabled:opacity-50"
                        >
                          {locationSubmitting() ? "Creating..." : "Create & Link"}
                        </button>
                      </div>
                    </Show>
                  </div>
                </Show>
              </Show>
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

      {/* ----------------- MOVE PARTS DIALOG MODAL ----------------- */}
      <Show when={showMoveModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div class="glass-panel max-w-lg w-full rounded-2xl p-6 border border-white/10 relative my-8">
            <button
              onClick={() => setShowMoveModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <h3 class="text-lg font-bold text-white mb-2 uppercase tracking-wider">
              Move Parts
            </h3>
            <p class="text-xs text-gray-400 mb-6">
              Transfer units of <span class="text-white font-semibold">{item()?.value}</span> from <span class="text-white font-semibold">{moveSourceLocation()?.name}</span> to another storage location.
            </p>

            <form onSubmit={handleMoveParts} class="space-y-5 text-xs">
              {/* Quantity Spinbox Selector */}
              <div>
                <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Quantity to Move</label>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMoveQuantity(prev => Math.max(1, prev - 1))}
                    disabled={moveQuantity() <= 1}
                    class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-all disabled:opacity-40"
                  >
                    <Minus size={16} />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max={moveSourceLocation()?.quantity || 1}
                    value={moveQuantity()}
                    onInput={(e) => {
                      const val = parseInt(e.currentTarget.value);
                      if (!isNaN(val)) {
                        setMoveQuantity(Math.max(1, Math.min(moveSourceLocation()?.quantity || 1, val)));
                      }
                    }}
                    class="glass-input flex-grow text-center text-xl font-bold py-1.5"
                  />

                  <button
                    type="button"
                    onClick={() => setMoveQuantity(prev => Math.min(moveSourceLocation()?.quantity || 1, prev + 1))}
                    disabled={moveQuantity() >= (moveSourceLocation()?.quantity || 1)}
                    class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-all disabled:opacity-40"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span class="text-[10px] text-gray-500 mt-1 block text-right">Available: {moveSourceLocation()?.quantity || 0} units</span>
              </div>
              {/* Destination Mode Tabs */}
              <div class="space-y-3">
                <label class="block font-semibold text-gray-400 uppercase">Destination Location</label>
                <div class="flex rounded-lg overflow-hidden border border-white/10 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setMoveDestMode("link")}
                    disabled={item().storage_records?.filter((r: any) => r.id !== moveSourceLocation()?.id).length === 0}
                    class={`flex-1 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${moveDestMode() === "link" ? "bg-accentCyan/20 text-accentCyan" : "text-gray-500 hover:text-white"}`}
                  >
                    Combine Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveDestMode("create")}
                    class={`flex-1 py-1.5 transition-colors ${moveDestMode() === "create" ? "bg-accentCyan/20 text-accentCyan" : "text-gray-500 hover:text-white"}`}
                  >
                    Create New
                  </button>
                </div>

                {/* Combine Stock / Quick Selects */}
                <Show when={moveDestMode() === "link"}>
                  <div class="space-y-2">
                    <Show
                      when={item().storage_records?.filter((r: any) => r.id !== moveSourceLocation()?.id).length > 0}
                      fallback={<p class="text-xs text-gray-500 italic">No other locations currently store this part. Use "Create New" to place stock in a new bin.</p>}
                    >
                      <div class="grid grid-cols-1 gap-2">
                        <For each={item().storage_records?.filter((r: any) => r.id !== moveSourceLocation()?.id)}>
                          {(loc: any) => (
                            <button
                              type="button"
                              onClick={() => setMoveDestLocationId(String(loc.id))}
                              class={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center ${moveDestLocationId() === String(loc.id)
                                ? "bg-accentCyan/15 border-accentCyan text-white"
                                : "bg-white/[0.02] border-white/5 hover:border-white/10 text-gray-300"
                                }`}
                            >
                              <div class="flex items-center gap-2">
                                <MapPin size={13} class={moveDestLocationId() === String(loc.id) ? "text-accentCyan" : "text-gray-500"} />
                                <span class="text-xs font-semibold">{loc.name}</span>
                              </div>
                              <span class="text-xs font-bold text-cyan-400">{loc.quantity} units</span>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>

                {/* Create New */}
                <Show when={moveDestMode() === "create"}>
                  <div class="space-y-3">
                    <input
                      type="text"
                      value={moveNewLocationName()}
                      onInput={(e) => setMoveNewLocationName(e.currentTarget.value)}
                      placeholder="Location name (e.g. Drawer B3)"
                      class="glass-input w-full text-xs"
                      required
                    />
                    <select
                      value={moveNewLocationParentId()}
                      onChange={(e) => setMoveNewLocationParentId(e.currentTarget.value)}
                      class="glass-input w-full text-xs"
                    >
                      <option value="">No parent (top-level)</option>
                      <For each={parentLocations()}>
                        {(loc: any) => <option value={loc.id}>{loc.name}</option>}
                      </For>
                    </select>
                  </div>
                </Show>
              </div>

              {/* Conditional Delete Checkbox */}
              <Show when={moveQuantity() === moveSourceLocation()?.quantity}>
                <div class="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="delete-source-checkbox"
                    checked={deleteSourceAfterMove()}
                    onChange={(e) => setDeleteSourceAfterMove(e.currentTarget.checked)}
                    class="rounded border-white/10 bg-white/5 text-accentCyan focus:ring-0 focus:ring-offset-0"
                  />
                  <label for="delete-source-checkbox" class="text-gray-300 select-none cursor-pointer">
                    Delete source location from database (no parts remaining)
                  </label>
                </div>
              </Show>

              {/* Actions */}
              <div class="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={moveSubmitting()}
                  class="btn-primary flex-1 disabled:opacity-50"
                >
                  {moveSubmitting() ? "Moving..." : "Confirm Move"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Add Image Modal */}
      <Show when={showAddImageModal()}>
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 space-y-4 animate-scaleUp">
            <div class="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 class="text-lg font-bold text-white">Add Component Image</h3>
              <button
                onClick={() => { setShowAddImageModal(false); setUploadFile(null); }}
                class="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImageUploadForm} class="space-y-4 text-xs">
              <Show when={!stagedDroppedUrl()}>
                <div class="space-y-1.5">
                  <label class="block font-semibold text-gray-400 uppercase">Select File</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadFile(e.currentTarget.files?.[0] || null)}
                    class="glass-input w-full py-2 px-3 text-xs"
                    required={!uploadFile()}
                  />
                </div>
              </Show>

              <Show when={stagedDroppedUrl()}>
                <div class="space-y-1.5 p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl text-[11px] text-cyan-300 truncate">
                  <span class="font-bold uppercase block text-[9px] text-cyan-400 mb-1">Source URL (Web Drag)</span>
                  {stagedDroppedUrl()}
                </div>
              </Show>

              <div class="space-y-1.5">
                <label class="block font-semibold text-gray-400 uppercase">Caption / Label</label>
                <input
                  type="text"
                  placeholder="E.g. Front Footprint, Package Outline (Optional)"
                  value={newImageCaption()}
                  onInput={(e) => setNewImageCaption(e.target.value)}
                  class="glass-input w-full py-2 px-3 text-xs"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block font-semibold text-gray-400 uppercase">Notes / Details</label>
                <textarea
                  placeholder="Additional context or Pinout details..."
                  value={newImageNotes()}
                  onInput={(e) => setNewImageNotes(e.target.value)}
                  class="glass-input w-full py-2 px-3 text-xs h-20"
                />
              </div>

              <div class="flex gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => { setShowAddImageModal(false); setUploadFile(null); setStagedDroppedUrl(""); }}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading() || (!uploadFile() && !stagedDroppedUrl())}
                  class="btn-primary flex-1 disabled:opacity-50"
                >
                  {uploading() ? "Uploading..." : "Save Image"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Label Print Modal */}
      <LabelPreviewModal
        location={activePrintLocation()}
        onClose={() => setActivePrintLocation(null)}
      />

      <Show when={selectedDocumentForView()}>
        <DocumentViewer 
          document={selectedDocumentForView()} 
          onClose={() => setSelectedDocumentForView(null)} 
        />
      </Show>
    </div>
  );
}

