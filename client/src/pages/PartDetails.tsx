import { createSignal, createMemo, onMount, For, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import {
  Package,
  MapPin,
  AlertTriangle,
  Plus,
  FileText,
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
  Scale,
  Nfc,
  ShoppingBag
} from "lucide-solid";
import { apiFetch, user, backendUrl, token } from "../hooks/useAuth";
import toast from "solid-toast";
import { useConfirm } from "../contexts/ConfirmContext";
import { useViewState } from "../context/ViewStateContext";
import { useActiveList } from "../context/ActiveListContext";
import LocationCard, { getLocationPathString } from "../components/storage/LocationCard";
import LabelPreviewModal from "../components/LabelPreviewModal";
import PartImages from "../components/PartImages";
import DocumentViewer from "../components/DocumentViewer";
import ScaleModal from "../components/ScaleModal";
import PartWeightCalibrationModal from "../components/PartWeightCalibrationModal";
import MovePartModal from "../components/storage/MovePartModal";
import NfcWriteModal from "../components/NfcWriteModal";
import UniversalLocationSelector from "../components/storage/UniversalLocationSelector";

export default function PartDetails(props: { id?: string; onCloseInline?: () => void; hideBackButton?: boolean }) {
  const { confirm } = useConfirm();
  const viewState = useViewState();
  const activeListCtx = useActiveList();
  const params = useParams();
  const navigate = useNavigate();
  const itemId = props.id || params.id;

  const [item, setItem] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [showNfcModal, setShowNfcModal] = createSignal(false);
  const [nfcTargetLocation, setNfcTargetLocation] = createSignal<any | null>(null);

  // Stock panel state
  // drillTarget: null = list view, number = showing StockController for that storage ID
  const [drillTarget, setDrillTarget] = createSignal<number | null>(null);
  // Location link / create state
  const [showLocationModal, setShowLocationModal] = createSignal(false);
  const [selectedLocationId, setSelectedLocationId] = createSignal("");
  const [locationSubmitting, setLocationSubmitting] = createSignal(false);
  // All system locations (for link dropdown)
  const [allLocations, setAllLocations] = createSignal<any[]>([]);

  // Move Parts Dialog State
  const [showMoveModal, setShowMoveModal] = createSignal(false);
  const [moveSourceLocation, setMoveSourceLocation] = createSignal<any>(null);

  // Scale Modal State
  const [showScaleModal, setShowScaleModal] = createSignal(false);
  const [showCalibrationModal, setShowCalibrationModal] = createSignal(false);
  const [scaleTargetLocation, setScaleTargetLocation] = createSignal<any>(null);
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
  const [newSupplierUrl, setNewSupplierUrl] = createSignal("");
  const [linkingSupplier, setLinkingSupplier] = createSignal(false);
  const [showAddSupplierPanel, setShowAddSupplierPanel] = createSignal(false);
  const [products, setProducts] = createSignal<any[]>([]);
  const [editingProductId, setEditingProductId] = createSignal<string | null>(null);
  const [editSkuValue, setEditSkuValue] = createSignal("");
  const [editUrlValue, setEditUrlValue] = createSignal("");
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
  const [categories, setCategories] = createSignal<any[]>([]);
  const [suppliers, setSuppliers] = createSignal<any[]>([]);

  const categoryChain = () => {
    const currentCat = item()?.category;
    if (!currentCat) return "Uncategorized";

    const allCats = categories();
    const chain: string[] = [];

    let curr: any = currentCat;
    if (allCats && allCats.length > 0) {
      const found = allCats.find((c: any) => String(c.id) === String(curr.id));
      if (found) curr = found;
    }

    const visited = new Set<string>();
    while (curr && !visited.has(String(curr.id))) {
      visited.add(String(curr.id));
      chain.unshift(curr.title);
      if (curr.parent_id && allCats && allCats.length > 0) {
        curr = allCats.find((c: any) => String(c.id) === String(curr.parent_id));
      } else {
        curr = null;
      }
    }

    return chain.length > 0 ? chain.join(", ") : (currentCat.title || "Uncategorized");
  };

  // Carousel & Drag & Drop State
  const [activeImageIndex, setActiveImageIndex] = createSignal(0);
  const [isDraggingOver, setIsDraggingOver] = createSignal(false);
  const [showAddImageModal, setShowAddImageModal] = createSignal(false);
  const [newImageCaption, setNewImageCaption] = createSignal("");
  const [newImageNotes, setNewImageNotes] = createSignal("");


  const getLocationHeight = (locId: string, locs: any[]): number => {
    const children = locs.filter((l: any) => l.parent_id === locId);
    if (children.length === 0) return 0;
    const childHeights = children.map((c: any) => getLocationHeight(c.id, locs));
    return 1 + Math.max(...childHeights);
  };

  const attributesEntries = () => {
    if (!item() || !item().attributes) return [];
    return Object.entries(item().attributes);
  };



  const fetchItemDetails = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/parts/${itemId}`);
      setItem(data);

      if (data && data.id) {
        viewState.setPartsState({
          lastViewedPartId: String(data.id),
          lastViewedPartName: data.value ? `${data.value}${data.number ? ` (${data.number})` : ""}` : (data.number || String(data.id))
        });
      }

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
    if (!selectedLocationId()) return;
    setLocationSubmitting(true);
    try {
      await apiFetch("/locations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_id: itemId,
          location_id: selectedLocationId(),
          quantity: 0,
          notes: `Linked location for component '${item()?.value || ""}'`
        })
      });
      setSelectedLocationId("");
      setShowLocationModal(false);
      await Promise.all([fetchItemDetails(), fetchMetadata()]);
      toast.success("Location linked successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to link location.");
    } finally {
      setLocationSubmitting(false);
    }
  };

  // Called by StockController when quantity or last_counted changes
  const handleStorageChanged = (storageId: string, newQty: number, newLastCounted: string) => {
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

  const handleDeleteImage = async (imageId: string) => {
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


  const handleDeleteDocument = async (docId: string) => {
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
          supplier_id: newSupplierId(),
          part_id: itemId,
          sku: newSupplierSku(),
          url: newSupplierUrl() || null
        })
      });
      setNewSupplierId("");
      setNewSupplierSku("");
      setNewSupplierUrl("");
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

  const handleUnlinkSupplier = async (prodId: string) => {
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

  const handleUpdateSupplierSku = async (prodId: string) => {
    if (!editSkuValue().trim()) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/products/${prodId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: editSkuValue(),
          url: editUrlValue() || null
        })
      });
      setEditingProductId(null);
      setEditSkuValue("");
      setEditUrlValue("");
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
        category_id: editCat() ? editCat() : null,
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

  const handleAddPartToActiveList = async () => {
    const activeList = activeListCtx.activeList();
    if (activeList) {
      try {
        await apiFetch(`/lists/${activeList.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ part_id: itemId, quantity: 1 })
        });
        toast.success(`Added "${item()?.value || "component"}" to active list "${activeList.name}"!`);
        await activeListCtx.refreshActiveList();
      } catch (err: any) {
        if (err.message?.includes("already in list")) {
          toast((t) => (
            <div class="flex items-center justify-between gap-4 py-1 px-1">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span class="text-xs font-bold text-white tracking-wide">Item already in list</span>
              </div>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  activeListCtx.highlightPartInDrawer(itemId!);
                }}
                class="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-gray-950 font-extrabold text-[11px] uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
              >
                Locate in Drawer
              </button>
            </div>
          ), {
            duration: 6000,
            style: {
              background: "#0f172a",
              color: "#ffffff",
              border: "1px solid rgba(245, 158, 11, 0.5)",
              "border-radius": "0.85rem",
              "box-shadow": "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
              padding: "0.5rem 0.75rem"
            }
          });
        } else {
          toast.error(err.message || "Failed to add component to active list.");
        }
      }
    } else {
      toast.error("No active list selected. Redirecting to Part Kits...");
      navigate("/lists");
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
      <Show when={!props.hideBackButton}>
        <button
          onClick={() => {
            if (props.onCloseInline) {
              props.onCloseInline();
            } else if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/parts");
            }
          }}
          class="btn-secondary py-1.5 px-3 flex items-center gap-2 text-xs"
        >
          <ArrowLeft size={14} />
          {props.onCloseInline ? "Back to Storage Layout" : "Back to Browser"}
        </button>
      </Show>

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
                  <span class="text-white font-semibold" title={categoryChain()}>{categoryChain()}</span>
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

                {/* Edit & NFC details */}
                <Show when={user()?.role === "admin" || user()?.role === "stocker"}>
                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleAddPartToActiveList}
                      class="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-2 text-xs rounded-xl flex items-center gap-1.5 font-medium transition-colors"
                      title={activeListCtx.activeList() ? `Add component to active list "${activeListCtx.activeList()?.name}"` : "Add component to a part list"}
                    >
                      <ShoppingBag size={14} />
                      <span>
                        {activeListCtx.activeList()
                          ? `+ Add to Active List`
                          : "Add to List"}
                      </span>
                    </button>
                    <button
                      onClick={() => setShowNfcModal(true)}
                      class="bg-accentCyan/10 hover:bg-accentCyan/20 text-accentCyan border border-accentCyan/30 px-3 py-2 text-xs rounded-xl flex items-center gap-1.5 font-medium transition-colors"
                      title="Program physical NFC tag for this component"
                    >
                      <Nfc size={14} />
                      Write NFC
                    </button>
                    <button
                      onClick={() => setShowEditModal(true)}
                      class="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
                    >
                      <Edit3 size={14} />
                      Edit Details
                    </button>
                  </div>
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
                  <div class="flex items-center justify-between">
                    <span class="text-gray-500 uppercase block font-semibold">Weight</span>
                    <button
                      onClick={() => setShowCalibrationModal(true)}
                      class="text-[10px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 transition-colors"
                      title="Calibrate Part Weight with Scale"
                    >
                      <Scale size={11} /> Calibrate
                    </button>
                  </div>
                  <span class="text-white font-medium block mt-1 truncate">
                    {item().weight !== null ? `${item().weight}g` : "N/A"}
                  </span>
                </div>
              </div>

              {/* Dynamic properties from JSON attributes */}
              <div class="space-y-3 pt-2">
                <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Attributes</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase shrink-0 bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
                            {doc.filename?.includes(".") ? doc.filename.split(".").pop() : "FILE"}
                          </span>
                          <div class="flex flex-col min-w-0">
                            <span class="font-medium text-white truncate max-w-[150px] group-hover:text-indigo-300 transition-colors">{doc.label}</span>
                            <span class="text-[10px] text-gray-500 truncate max-w-[150px]">{doc.filename}</span>
                          </div>
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
                <div class="text-center py-8 space-y-4">
                  <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                    <MapPin size={22} class="text-gray-500" />
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-white">No storage locations</p>
                    <p class="text-xs text-gray-500 mt-1">Connect this part to a physical location to begin tracking stock.</p>
                  </div>
                  <div class="flex justify-center pt-1">
                    <button
                      onClick={() => { setSelectedLocationId(""); setShowLocationModal(true); }}
                      class="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 font-bold"
                    >
                      <MapPin size={14} />
                      Assign Storage Location
                    </button>
                  </div>
                </div>
              </Show>

              {/* STATE 2: 1 location */}
              <Show when={item().storage_records && item().storage_records.length === 1}>
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

                  {/* Location card */}
                  <LocationCard
                    location={item().storage_records[0]}
                    allLocations={allLocations()}
                    onMove={(rec) => {
                      setMoveSourceLocation(rec);
                      setShowMoveModal(true);
                    }}
                    onScale={(rec) => {
                      setScaleTargetLocation(rec);
                      setShowScaleModal(true);
                    }}
                    onPrint={(rec) => setActivePrintLocation(rec)}
                    onWriteNfc={(rec) => setNfcTargetLocation(rec)}
                    onDelete={(rec) => handleDeleteLocation(rec)}
                    onChanged={(qty, ts) => handleStorageChanged(item().storage_records[0]?.id, qty, ts)}
                  />
                </div>
              </Show>

              {/* STATE 3: Multiple locations */}
              <Show when={item().storage_records && item().storage_records.length > 1}>
                {/* Drill-down: StockController for a specific location */}
                <Show when={drillTarget() !== null}>
                  <div class="space-y-4">
                    {/* Header with back arrow */}
                    <div class="flex items-start gap-2">
                      <button
                        onClick={() => setDrillTarget(null)}
                        class="p-1.5 mt-0.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
                        title="Back to location list"
                      >
                        <ArrowLeft size={15} />
                      </button>
                      <div class="flex-1 min-w-0">
                        <LocationCard
                          location={activeDrillSlot()}
                          allLocations={allLocations()}
                          onMove={(rec) => {
                            setMoveSourceLocation(rec);
                            setShowMoveModal(true);
                          }}
                          onScale={(rec) => {
                            setScaleTargetLocation(rec);
                            setShowScaleModal(true);
                          }}
                          onPrint={(rec) => setActivePrintLocation(rec)}
                          onWriteNfc={(rec) => setNfcTargetLocation(rec)}
                          onDelete={(rec) => handleDeleteLocation(rec)}
                          onChanged={(qty, ts) => handleStorageChanged(activeDrillSlot()?.id, qty, ts)}
                        />
                      </div>
                    </div>
                  </div>
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
                            title={getLocationPathString(slot, allLocations())}
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

              {/* ── Add Location button — shown in states 2 & 3 when clicking "Add Another Location" ── */}
              <Show when={drillTarget() === null && item().storage_records && item().storage_records.length > 0}>
                <button
                  onClick={() => { setSelectedLocationId(""); setShowLocationModal(true); }}
                  class="w-full text-xs text-gray-500 hover:text-accentCyan transition-colors flex items-center justify-center gap-1.5 py-2"
                >
                  <Plus size={12} />
                  Add Another Location
                </button>
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
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="block font-semibold text-gray-400 uppercase text-xs">Weight (grams)</label>
                    <button
                      type="button"
                      onClick={() => setShowCalibrationModal(true)}
                      class="text-[10px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 transition-colors"
                      title="Calibrate Weight with Scale"
                    >
                      <Scale size={11} /> Calibrate
                    </button>
                  </div>
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
      <Show when={showMoveModal() && moveSourceLocation()}>
        <MovePartModal
          location={{ ...moveSourceLocation(), part: item() }}
          allLocations={allLocations()}
          onClose={() => setShowMoveModal(false)}
          onMoved={() => {
            setShowMoveModal(false);
            setDrillTarget(null);
            fetchItemDetails();
            fetchMetadata();
          }}
        />
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

      {/* Bluetooth Scale Integration Modal */}
      <ScaleModal
        isOpen={showScaleModal()}
        onClose={() => setShowScaleModal(false)}
        part={item()}
        storageLocation={scaleTargetLocation()}
        onSuccess={() => fetchItemDetails()}
      />

      {/* Part Weight Calibration Modal (Feature 017) */}
      <PartWeightCalibrationModal
        isOpen={showCalibrationModal()}
        onClose={() => setShowCalibrationModal(false)}
        part={item()}
        onSuccess={(newWeight) => {
          setEditWeight(newWeight);
          fetchItemDetails();
        }}
      />

      {/* NFC Write Modal (Part) */}
      <Show when={showNfcModal() && item()}>
        <NfcWriteModal
          isOpen={showNfcModal()}
          targetType="part"
          targetId={item()?.id}
          targetName={`${item()?.number || 'Part'} (${item()?.value || ''})`}
          onClose={() => setShowNfcModal(false)}
        />
      </Show>

      {/* NFC Write Modal (Location) */}
      <Show when={nfcTargetLocation()}>
        <NfcWriteModal
          isOpen={!!nfcTargetLocation()}
          targetType="location"
          targetId={String(nfcTargetLocation()?.id)}
          targetName={nfcTargetLocation()?.name || "Storage Location"}
          onClose={() => setNfcTargetLocation(null)}
        />
      </Show>

      {/* ----------------- LOCATION SELECTOR MODAL ----------------- */}
      <Show when={showLocationModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div class="glass-panel max-w-2xl w-full max-h-[90vh] rounded-2xl p-4 sm:p-6 border border-white/10 relative my-auto flex flex-col space-y-4 overflow-hidden shadow-2xl">
            {/* Header */}
            <div class="flex items-start justify-between shrink-0">
              <div>
                <h3 class="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <MapPin class="text-accentCyan" size={22} />
                  Assign Storage Location
                </h3>
                <p class="text-xs text-gray-400 mt-0.5">
                  Select or create a physical bin/container for <span class="text-white font-semibold">{item()?.value}</span>.
                </p>
              </div>
              <button
                onClick={() => { setShowLocationModal(false); setSelectedLocationId(""); }}
                class="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Selector Body */}
            <div class="flex-1 overflow-y-auto space-y-4 pr-1">
              <UniversalLocationSelector
                locations={allLocations()}
                selectedLocationId={selectedLocationId()}
                part={item()}
                onSelectLocation={(loc) => setSelectedLocationId(loc ? loc.id : "")}
                initialMode="miller"
                showInlineCreate={true}
              />
            </div>

            {/* Modal Actions Footer */}
            <div class="flex justify-end pt-3 border-t border-white/10 gap-3 shrink-0">
              <button
                type="button"
                onClick={() => { setShowLocationModal(false); setSelectedLocationId(""); }}
                class="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkLocation}
                disabled={locationSubmitting() || !selectedLocationId()}
                class="btn-primary flex items-center justify-center gap-2 text-xs min-w-[140px] disabled:opacity-50"
              >
                {locationSubmitting() ? (
                  <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Link2 size={14} />
                    Confirm Location
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

