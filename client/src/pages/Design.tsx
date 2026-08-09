import { createSignal, onMount, For, Show } from "solid-js";
import { 
  FolderTree, 
  Tag, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronDown
} from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";
import toast from "solid-toast";
import { useConfirm } from "../contexts/ConfirmContext";


const CategoryNode = (props: {
  category: any;
  allCategories: any[];
  depth: number;
  onDelete: (id: string) => void;
  onEdit: (cat: any) => void;
}) => {
  const [expanded, setExpanded] = createSignal(false);
  const children = () => props.allCategories.filter(c => c.parent_id === props.category.id);
  const hasChildren = () => children().length > 0;

  return (
    <div class="space-y-2">
      <div 
        style={{ "margin-left": `${props.depth * 20}px` }}
        class="glass-card p-3.5 rounded-xl border border-white/5 flex items-center justify-between gap-3 text-xs"
      >
        <div class="flex items-center gap-2 cursor-pointer" onClick={() => hasChildren() && setExpanded(!expanded())}>
          <span class="text-accentCyan shrink-0 w-4 flex justify-center">
            {hasChildren() ? (
              expanded() ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <Tag size={14} class={props.depth > 0 ? "opacity-60" : ""} />
            )}
          </span>
          <div>
            <span class="font-bold text-white text-sm">{props.category.title}</span>
            <Show when={props.category.designator}>
              <span class="bg-accentCyan/10 border border-accentCyan/20 text-accentCyan text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono ml-2 uppercase">
                Prefix: {props.category.designator}
              </span>
            </Show>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button
            onClick={() => props.onEdit(props.category)}
            class="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => props.onDelete(props.category.id)}
            class="p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/5 rounded transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <Show when={expanded()}>
        <For each={children()}>
          {(child) => (
            <CategoryNode 
              category={child} 
              allCategories={props.allCategories} 
              depth={props.depth + 1} 
              onDelete={props.onDelete}
              onEdit={props.onEdit}
            />
          )}
        </For>
      </Show>
    </div>
  );
};

export default function Design() {
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = createSignal<"categories">("categories");
  const [categories, setCategories] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Category Form State
  const [editCatId, setEditCatId] = createSignal<number | null>(null);
  const [catTitle, setCatTitle] = createSignal("");
  const [catDesignator, setCatDesignator] = createSignal("");
  const [catParentId, setCatParentId] = createSignal("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats] = await Promise.all([
        apiFetch("/categories")
      ]);
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load design structures:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  const handleSaveCategory = async (e: Event) => {
    e.preventDefault();
    if (!catTitle()) return;
    try {
      if (editCatId()) {
        await apiFetch(`/categories/${editCatId()}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            title: catTitle(), 
            designator: catDesignator() || null,
            parent_id: catParentId() ? catParentId() : null
          })
        });
        toast.success("Category updated successfully.");
      } else {
        await apiFetch("/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            title: catTitle(), 
            designator: catDesignator() || null,
            parent_id: catParentId() ? catParentId() : null
          })
        });
        toast.success("Category created successfully.");
      }
      resetCatForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save category.");
    }
  };

  const resetCatForm = () => {
    setEditCatId(null);
    setCatTitle("");
    setCatDesignator("");
    setCatParentId("");
  };

  const handleEditCategoryClick = (cat: any) => {
    setEditCatId(cat.id);
    setCatTitle(cat.title);
    setCatDesignator(cat.designator || "");
    setCatParentId(cat.parent_id ? String(cat.parent_id) : "");
  };

  const handleDeleteCategory = async (catId: string) => {
    const isConfirmed = await confirm({
      title: "Confirm Action",
      message: "Are you sure you want to delete this category? Any subcategories or parts attached will have catalog references deleted.",
      confirmText: "Proceed",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/categories/${catId}`, { method: "DELETE" });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete category.");
    }
  };

  // Helper to resolve parents
  const getParentCategoryName = (parentId: string | null) => {
    if (!parentId) return "";
    const parent = categories().find(c => c.id === parentId);
    return parent ? parent.title : "";
  };

  return (
    <div class="space-y-6">
      {/* Page Header */}
      <div>
        <h2 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <FolderTree class="text-accentCyan" />
          Component Structure Designer
        </h2>
        <p class="text-gray-400 text-sm">Define dynamic component categories, silkscreen designators, and storage drawers.</p>
      </div>

      {/* Selector Tabs */}
      <div class="flex border-b border-white/5 space-x-6 text-sm font-semibold mb-6">
        <button
          onClick={() => setActiveTab("categories")}
          class={`pb-3 border-b-2 px-1 transition-colors cursor-pointer border-accentCyan text-white`}
        >
          <span class="flex items-center gap-2">
            <Tag size={16} />
            Categories & Reference Designators
          </span>
        </button>
      </div>

      <Show when={loading()}>
        <div class="glass-panel p-8 rounded-2xl animate-pulse h-64"></div>
      </Show>

      <Show when={!loading()}>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ----------------- CATEGORIES PANEL ----------------- */}
          <Show when={activeTab() === "categories"}>
            {/* Left 1 Col: Category creation */}
            <div class="glass-panel rounded-2xl p-6 border border-white/5 h-fit">
              <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Plus size={16} class="text-accentCyan" />
                {editCatId() ? "Edit Category" : "Add Category"}
              </h3>
              
              <form onSubmit={handleSaveCategory} class="space-y-4 text-xs">
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Category Name</label>
                  <input
                    type="text"
                    required
                    value={catTitle()}
                    onInput={(e) => setCatTitle(e.target.value)}
                    placeholder="E.g. Resistors, Capacitors, Passives"
                    class="glass-input w-full text-xs"
                  />
                </div>
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Silkscreen Designator Prefix (Optional)</label>
                  <input
                    type="text"
                    value={catDesignator()}
                    onInput={(e) => setCatDesignator(e.target.value)}
                    placeholder="E.g. R, C, U, Q"
                    class="glass-input w-full text-xs font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label class="block font-semibold text-gray-400 mb-1.5 uppercase">Parent Category (Optional)</label>
                  <select
                    value={catParentId()}
                    onChange={(e) => setCatParentId(e.currentTarget.value)}
                    class="glass-input w-full text-xs"
                  >
                    <option value="">No Parent (Top Level)</option>
                    <For each={categories()}>
                      {(c) => <option value={c.id}>{c.title}</option>}
                    </For>
                  </select>
                </div>
                <div class="flex gap-2">
                  <button type="submit" class="btn-primary flex-1 py-2.5">
                    {editCatId() ? "Update Category" : "Save Category"}
                  </button>
                  <Show when={editCatId()}>
                    <button type="button" onClick={resetCatForm} class="bg-white/10 hover:bg-white/20 text-white flex-1 py-2.5 rounded-lg transition-colors font-bold">
                      Cancel
                    </button>
                  </Show>
                </div>
              </form>
            </div>

            {/* Right 2 Cols: Category Listing Indented Tree */}
            <div class="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
              <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Tag size={16} class="text-accentCyan" />
                Category Classifications
              </h3>
              
              <Show when={categories().length === 0}>
                <div class="text-center py-10 text-xs text-gray-500">
                  No categories designed yet. Define one on the left.
                </div>
              </Show>

              <Show when={categories().length > 0}>
                <div class="space-y-2 text-xs">
                  <For each={categories().filter(c => !c.parent_id)}>
                    {(cat) => (
                      <CategoryNode 
                        category={cat} 
                        allCategories={categories()} 
                        depth={0} 
                        onDelete={handleDeleteCategory}
                        onEdit={handleEditCategoryClick}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

        </div>
      </Show>
    </div>
  );
}
