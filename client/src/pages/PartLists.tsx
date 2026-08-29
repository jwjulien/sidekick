import { createSignal, createEffect, Show, For, onMount } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import {
  ShoppingBag,
  Plus,
  Copy,
  Trash2,
  Download,
  Edit2,
  Check,
  X,
  Search,
  Package,
  ArrowLeft,
  CheckCircle
} from "lucide-solid";
import { apiFetch } from "../hooks/useAuth";
import toast from "solid-toast";
import PartListItemsTable from "../components/lists/PartListItemsTable";
import UniversalPartFinderModal from "../components/parts/UniversalPartFinderModal";
import { useActiveList } from "../context/ActiveListContext";
import Markdown from "../components/Markdown";

export default function PartLists() {
  const params = useParams();
  const navigate = useNavigate();
  const activeListCtx = useActiveList();

  const [lists, setLists] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch] = createSignal("");
  const [selectedType, setSelectedType] = createSignal("All");

  // Single list view state
  const [currentList, setCurrentList] = createSignal<any | null>(null);
  const [listLoading, setListLoading] = createSignal(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [newListName, setNewListName] = createSignal("");
  const [newListDesc, setNewListDesc] = createSignal("");
  const [newListType, setNewListType] = createSignal("General");

  const [showFinderModal, setShowFinderModal] = createSignal(false);
  const [itemNotesInput, setItemNotesInput] = createSignal("");

  // Edit list header metadata state
  const [isEditingHeader, setIsEditingHeader] = createSignal(false);
  const [editTitleValue, setEditTitleValue] = createSignal("");
  const [editDescValue, setEditDescValue] = createSignal("");
  const [editTypeValue, setEditTypeValue] = createSignal("General");

  const openHeaderEdit = () => {
    if (!currentList()) return;
    setEditTitleValue(currentList().name || "");
    setEditDescValue(currentList().description || "");
    setEditTypeValue(currentList().type || "General");
    setIsEditingHeader(true);
  };

  const fetchLists = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/lists");
      setLists(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load part lists.");
    } finally {
      setLoading(false);
    }
  };

  const fetchListDetails = async (id: string) => {
    setListLoading(true);
    try {
      const data = await apiFetch(`/lists/${id}`);
      setCurrentList(data);
      setEditTitleValue(data.name);
    } catch (err: any) {
      toast.error(err.message || "Failed to load list details.");
      navigate("/lists");
    } finally {
      setListLoading(false);
    }
  };

  onMount(() => {
    fetchLists();
  });

  createEffect(() => {
    if (params.id) {
      fetchListDetails(params.id);
    } else {
      setCurrentList(null);
    }
  });

  const handleCreateList = async (e: Event) => {
    e.preventDefault();
    if (!newListName().trim()) return;

    try {
      const created = await apiFetch("/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newListName().trim(),
          description: newListDesc().trim() || null,
          type: newListType()
        })
      });
      toast.success("Part list created!");
      setShowCreateModal(false);
      setNewListName("");
      setNewListDesc("");
      setNewListType("General");
      await fetchLists();
      navigate(`/lists/${created.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create list.");
    }
  };

  const handleDuplicateList = async (id: string) => {
    try {
      const dup = await apiFetch(`/lists/${id}/duplicate`, { method: "POST" });
      toast.success("List duplicated!");
      await fetchLists();
      navigate(`/lists/${dup.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate list.");
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm("Are you sure you want to delete this list and all its items?")) return;
    try {
      await apiFetch(`/lists/${id}`, { method: "DELETE" });
      toast.success("List deleted.");
      if (activeListCtx.activeListId() === id) {
        await activeListCtx.clearActiveList();
      }
      await fetchLists();
      navigate("/lists");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete list.");
    }
  };

  const handleToggleActivate = async (list: any) => {
    if (activeListCtx.activeListId() === list.id) {
      await activeListCtx.clearActiveList();
    } else {
      await activeListCtx.setActiveListId(list.id);
    }
    await fetchLists();
    if (currentList()?.id === list.id) {
      await fetchListDetails(list.id);
    }
  };

  const handleSaveHeader = async () => {
    if (!currentList() || !editTitleValue().trim()) return;
    try {
      const updated = await apiFetch(`/lists/${currentList().id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTitleValue().trim(),
          description: editDescValue().trim() || null,
          type: editTypeValue()
        })
      });
      setCurrentList({
        ...currentList(),
        name: updated.name,
        description: updated.description,
        type: updated.type
      });
      setIsEditingHeader(false);
      toast.success("List header details updated!");
      await fetchLists();
      await activeListCtx.refreshActiveList();
    } catch (err: any) {
      toast.error(err.message || "Failed to update list details.");
    }
  };

  const handleAddItemFromFinder = async (part: any, quantity: number, notes: any) => {
    const listId = currentList()?.id;
    if (!listId) return;

    try {
      await apiFetch(`/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_id: part.id,
          quantity: quantity,
          notes: itemNotesInput().trim() || (typeof notes === "string" ? notes : "")
        })
      });
      toast.success(`Added ${part.value} to list!`);
      setItemNotesInput("");
      await fetchListDetails(listId);
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
                activeListCtx.highlightPartInDrawer(part.id);
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
        toast.error(err.message || "Failed to add item to list.");
      }
    }
  };



  const handleExportCsv = async () => {
    const listId = currentList()?.id;
    if (!listId) return;
    try {
      const res = await fetch(`/api/lists/${listId}/export`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `part_list_${currentList().name.replace(/\s+/g, "_").toLowerCase()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Failed to download CSV export.");
    }
  };

  const filteredLists = () => {
    return lists().filter((l) => {
      const matchSearch =
        l.name.toLowerCase().includes(search().toLowerCase()) ||
        (l.description && l.description.toLowerCase().includes(search().toLowerCase()));
      const matchType = selectedType() === "All" || l.type === selectedType();
      return matchSearch && matchType;
    });
  };

  return (
    <div class="space-y-6 pb-20">
      {/* Detail View Mode */}
      <Show when={params.id && currentList()}>
        <div class="space-y-6">
          {/* Back button & Action Header */}
          <div class="flex items-center justify-between">
            <button
              onClick={() => navigate("/lists")}
              class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-colors text-xs font-semibold"
            >
              <ArrowLeft size={14} />
              <span>Back to Lists</span>
            </button>

            <div class="flex items-center gap-3">
              <button
                onClick={() => handleToggleActivate(currentList())}
                class={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                  activeListCtx.activeListId() === currentList()?.id
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-white/10 text-gray-200 hover:bg-white/20 border border-white/10"
                }`}
              >
                <CheckCircle size={14} />
                <span>
                  {activeListCtx.activeListId() === currentList()?.id
                    ? "Active List (Docked)"
                    : "Activate List"}
                </span>
              </button>

              <button
                onClick={() => setShowFinderModal(true)}
                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-accentCyan text-gray-950 font-bold text-xs hover:brightness-110 transition-all shadow-lg shadow-accentCyan/10"
              >
                <Plus size={14} />
                <span>Add Component</span>
              </button>

              <button
                onClick={handleExportCsv}
                class="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 text-xs font-semibold"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => handleDuplicateList(currentList().id)}
                class="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white"
                title="Duplicate list"
              >
                <Copy size={16} />
              </button>

              <button
                onClick={() => handleDeleteList(currentList().id)}
                class="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400"
                title="Delete list"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* List Title & Header Card */}
          <div class="glass-card p-6 rounded-3xl border border-white/15 shadow-xl bg-gray-900/80 space-y-4">
            <Show
              when={isEditingHeader()}
              fallback={
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <span class="text-xs font-bold px-3 py-1 rounded-full bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
                        {currentList()?.type}
                      </span>
                      <span class="text-xs text-gray-400">
                        {currentList()?.items?.length || 0} unique components
                      </span>
                    </div>

                    <button
                      onClick={openHeaderEdit}
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-xs font-semibold"
                    >
                      <Edit2 size={14} />
                      <span>Edit Details</span>
                    </button>
                  </div>

                  <h1 class="text-2xl font-extrabold text-white">
                    {currentList()?.name}
                  </h1>

                  <div class="mt-2">
                    <Markdown
                      content={currentList()?.description}
                      fallback={<span class="italic text-gray-500 text-sm">No description provided. Click "Edit Details" to add description notes.</span>}
                      class="text-sm text-gray-300 leading-relaxed"
                    />
                  </div>
                </div>
              }
            >
              {/* Header Inline Edit Form */}
              <div class="space-y-4 border-l-2 border-accentCyan pl-4">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-accentCyan uppercase tracking-wider">
                    Editing List Metadata
                  </span>
                  <div class="flex items-center gap-2">
                    <button
                      onClick={handleSaveHeader}
                      class="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-accentCyan text-gray-950 font-bold text-xs hover:brightness-110 transition-all shadow-md"
                    >
                      <Check size={14} />
                      <span>Save Changes</span>
                    </button>
                    <button
                      onClick={() => setIsEditingHeader(false)}
                      class="p-1.5 rounded-xl bg-white/10 text-gray-300 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="md:col-span-2 space-y-1">
                    <label class="text-xs font-semibold text-gray-300">List Title</label>
                    <input
                      type="text"
                      value={editTitleValue()}
                      onInput={(e) => setEditTitleValue(e.currentTarget.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveHeader()}
                      class="glass-input w-full text-base font-bold text-white py-1.5 px-3"
                      autofocus
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-gray-300">Category Type</label>
                    <select
                      value={editTypeValue()}
                      onChange={(e) => setEditTypeValue(e.currentTarget.value)}
                      class="glass-input w-full text-xs py-2 px-3 bg-gray-900 text-white"
                    >
                      <option value="Wishlist">Wishlist (Procurement)</option>
                      <option value="Bench Kit">Bench Kit (Prototyping)</option>
                      <option value="Pick List">Pick List (Audit / Staging)</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-semibold text-gray-300">Description Notes</label>
                  <textarea
                    value={editDescValue()}
                    onInput={(e) => setEditDescValue(e.currentTarget.value)}
                    placeholder="Enter description notes for this list..."
                    class="glass-input w-full text-xs py-2 px-3 h-20 resize-none"
                  />
                </div>
              </div>
            </Show>
          </div>

          {/* List Item Table */}
          <div class="glass-card rounded-3xl border border-white/15 shadow-2xl bg-gray-900/80 overflow-hidden">
            <Show
              when={currentList()?.items?.length > 0}
              fallback={
                <div class="text-center py-16 space-y-4">
                  <div class="w-14 h-14 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500">
                    <Package size={24} />
                  </div>
                  <div class="space-y-1">
                    <h3 class="text-base font-bold text-white">No components in this list yet</h3>
                    <p class="text-xs text-gray-400 max-w-sm mx-auto">
                      Click "Add Component" to search your inventory catalog and attach parts to this list.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFinderModal(true)}
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accentCyan text-gray-950 font-bold text-xs"
                  >
                    <Plus size={14} />
                    <span>Add First Component</span>
                  </button>
                </div>
              }
            >
              <PartListItemsTable
                items={currentList()?.items || []}
                listId={currentList().id}
                onItemUpdated={() => {
                  fetchListDetails(currentList().id);
                  activeListCtx.refreshActiveList();
                }}
              />
            </Show>
          </div>
        </div>
      </Show>

      {/* Lists Dashboard Mode */}
      <Show when={!params.id}>
        <div class="space-y-6">
          {/* Header Bar */}
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-extrabold text-white flex items-center gap-3">
                <ShoppingBag class="text-accentCyan" size={28} />
                <span>Part Kits & Lists</span>
              </h1>
              <p class="text-xs text-gray-400 mt-1">
                Create and manage wishlists, bench test kits, and component staging lists.
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accentCyan text-gray-950 font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-accentCyan/10"
            >
              <Plus size={16} />
              <span>New List</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div class="flex flex-col md:flex-row items-center gap-4">
            <div class="relative flex-1 w-full">
              <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                placeholder="Search lists by name or description..."
                class="glass-input w-full !pl-10 pr-4 py-2.5 text-sm"
              />
            </div>

            <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <For each={["All", "Wishlist", "Bench Kit", "Pick List", "General"]}>
                {(t) => (
                  <button
                    onClick={() => setSelectedType(t)}
                    class={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                      selectedType() === t
                        ? "bg-accentCyan/20 text-accentCyan border border-accentCyan/40"
                        : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
                    }`}
                  >
                    {t}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Grid of List Cards */}
          <Show
            when={!loading() && filteredLists().length > 0}
            fallback={
              <Show
                when={loading()}
                fallback={
                  <div class="glass-card rounded-3xl p-12 text-center space-y-4 border border-white/10">
                    <div class="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500">
                      <ShoppingBag size={28} />
                    </div>
                    <div class="space-y-1">
                      <h3 class="text-base font-bold text-white">No Part Lists Found</h3>
                      <p class="text-xs text-gray-400 max-w-sm mx-auto">
                        Get started by creating your first component wishlist, bench kit, or pick list.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accentCyan text-gray-950 font-bold text-xs"
                    >
                      <Plus size={16} />
                      <span>Create New List</span>
                    </button>
                  </div>
                }
              >
                <div class="text-center py-12 text-gray-400 text-sm">Loading lists...</div>
              </Show>
            }
          >
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <For each={filteredLists()}>
                {(l) => (
                  <div
                    onClick={() => navigate(`/lists/${l.id}`)}
                    class={`glass-card p-5 rounded-2xl border transition-all cursor-pointer space-y-4 group hover:border-accentCyan/50 hover:shadow-xl ${
                      activeListCtx.activeListId() === l.id
                        ? "border-emerald-500/50 bg-emerald-950/20"
                        : "border-white/10 bg-gray-900/60 hover:bg-gray-900/90"
                    }`}
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="space-y-1">
                        <div class="flex items-center gap-2">
                          <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
                            {l.type}
                          </span>
                          <Show when={activeListCtx.activeListId() === l.id}>
                            <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Active
                            </span>
                          </Show>
                        </div>
                        <h3 class="text-base font-extrabold text-white group-hover:text-accentCyan transition-colors truncate">
                          {l.name}
                        </h3>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActivate(l);
                        }}
                        class={`p-2 rounded-xl text-xs font-bold transition-all ${
                          activeListCtx.activeListId() === l.id
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
                        }`}
                        title="Toggle Active List"
                      >
                        <CheckCircle size={16} />
                      </button>
                    </div>

                    <Show when={l.description}>
                      <Markdown
                        content={l.description}
                        compact={true}
                        class="text-xs text-gray-400 line-clamp-2 mt-1"
                      />
                    </Show>

                    <div class="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
                      <div class="flex items-center gap-1.5">
                        <Package size={14} class="text-gray-400" />
                        <span class="font-bold text-white">{l.item_count}</span> items
                      </div>

                      <div class="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDuplicateList(l.id)}
                          class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                          title="Duplicate list"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteList(l.id)}
                          class="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Delete list"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Modal: Create New List */}
      <Show when={showCreateModal()}>
        <div
          class="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            class="glass-card max-w-md w-full p-6 rounded-3xl border border-white/20 shadow-2xl bg-gray-900/95 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 class="text-base font-bold text-white">Create Part List</h3>
              <button onClick={() => setShowCreateModal(false)} class="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateList} class="space-y-4">
              <div class="space-y-1">
                <label class="text-xs font-semibold text-gray-300">List Name</label>
                <input
                  type="text"
                  value={newListName()}
                  onInput={(e) => setNewListName(e.currentTarget.value)}
                  placeholder="e.g. DigiKey Shopping Cart"
                  required
                  class="glass-input w-full text-sm py-2 px-3"
                  autofocus
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-semibold text-gray-300">Category Type</label>
                <select
                  value={newListType()}
                  onChange={(e) => setNewListType(e.currentTarget.value)}
                  class="glass-input w-full text-sm py-2 px-3 bg-gray-900"
                >
                  <option value="Wishlist">Wishlist (Procurement)</option>
                  <option value="Bench Kit">Bench Kit (Prototyping)</option>
                  <option value="Pick List">Pick List (Audit / Staging)</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-xs font-semibold text-gray-300">Description (Optional)</label>
                <textarea
                  value={newListDesc()}
                  onInput={(e) => setNewListDesc(e.currentTarget.value)}
                  placeholder="Brief notes about this list..."
                  class="glass-input w-full text-sm py-2 px-3 h-20 resize-none"
                />
              </div>

              <div class="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  class="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="px-5 py-2 rounded-xl bg-accentCyan text-gray-950 font-bold text-xs hover:brightness-110"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Modal: Universal Part Finder Modal with Custom Notes Slot */}
      <UniversalPartFinderModal
        isOpen={showFinderModal()}
        onClose={() => setShowFinderModal(false)}
        title="Add Component to List"
        onConfirm={handleAddItemFromFinder}
      >
        {(selectedPart, setExtraData) => (
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-300">Item Notes (Optional)</label>
            <input
              type="text"
              value={itemNotesInput()}
              onInput={(e) => {
                const val = e.currentTarget.value;
                setItemNotesInput(val);
                setExtraData(val);
              }}
              placeholder="e.g. Order 2 extra for backup"
              class="glass-input w-full text-xs py-1.5 px-3"
            />
          </div>
        )}
      </UniversalPartFinderModal>
    </div>
  );
}
