import { createSignal, onMount, For, Show } from "solid-js";
import { 
  FolderGit2, 
  Plus, 
  Trash2, 
  Cpu, 
  Calendar,
  Layers,
  X,
  AlertTriangle,
  CheckCircle2,
  Tag
} from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";

export default function Projects() {
  const [projects, setProjects] = createSignal<any[]>([]);
  const [parts, setParts] = createSignal<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = createSignal<number | null>(null);
  const [selectedProject, setSelectedProject] = createSignal<any>(null);
  const [selectedRevisionId, setSelectedRevisionId] = createSignal<number | null>(null);
  const [selectedRevision, setSelectedRevision] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);

  // Add Project Modal
  const [showProjModal, setShowProjModal] = createSignal(false);
  const [projTitle, setProjTitle] = createSignal("");
  const [projDesc, setProjDesc] = createSignal("");

  // Add Revision Modal
  const [showRevModal, setShowRevModal] = createSignal(false);
  const [revVersion, setRevVersion] = createSignal("");
  const [revDate, setRevDate] = createSignal("");

  // Add BOM Material Modal
  const [showMatModal, setShowMatModal] = createSignal(false);
  const [matPartId, setMatPartId] = createSignal("");
  const [matDesignator, setMatDesignator] = createSignal("");

  const [submitting, setSubmitting] = createSignal(false);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [projs, catalogParts] = await Promise.all([
        apiFetch("/projects"),
        apiFetch("/items")
      ]);
      setProjects(projs);
      setParts(catalogParts);
      
      // Auto select first project
      if (projs.length > 0 && !selectedProjectId()) {
        handleSelectProject(projs[0].id);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadInitialData();
  });

  const handleSelectProject = async (id: number) => {
    setSelectedProjectId(id);
    setSelectedRevisionId(null);
    setSelectedRevision(null);
    try {
      const detailedProject = await apiFetch(`/projects/${id}`);
      setSelectedProject(detailedProject);
      
      // Auto select first revision if available
      if (detailedProject.revisions.length > 0) {
        handleSelectRevision(detailedProject.revisions[0].id, detailedProject);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectRevision = (revId: number, projDetails = selectedProject()) => {
    setSelectedRevisionId(revId);
    if (projDetails) {
      const rev = projDetails.revisions.find((r: any) => r.id === revId);
      setSelectedRevision(rev);
    }
  };

  const handleCreateProject = async (e: Event) => {
    e.preventDefault();
    if (!projTitle()) return;
    
    setSubmitting(true);
    try {
      const newProj = await apiFetch("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: projTitle(), description: projDesc() })
      });
      
      setProjTitle("");
      setProjDesc("");
      setShowProjModal(false);
      
      // Refresh and select
      await loadInitialData();
      handleSelectProject(newProj.id);
      alert("Project created successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this project? All revisions and materials records will be lost.")) return;
    try {
      await apiFetch(`/projects/${id}`, { method: "DELETE" });
      setSelectedProjectId(null);
      setSelectedProject(null);
      setSelectedRevisionId(null);
      setSelectedRevision(null);
      loadInitialData();
    } catch (err: any) {
      alert(err.message || "Failed to delete project.");
    }
  };

  const handleCreateRevision = async (e: Event) => {
    e.preventDefault();
    const projId = selectedProjectId();
    if (!projId || !revVersion() || !revDate()) return;
    
    setSubmitting(true);
    try {
      const payload = {
        project_id: projId,
        version: revVersion(),
        date: revDate()
      };
      
      await apiFetch("/projects/revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      setRevVersion("");
      setRevDate("");
      setShowRevModal(false);
      
      // Refresh project detailed view
      await handleSelectProject(projId);
      alert("Revision created successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to create revision.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRevision = async (revId: number) => {
    if (!confirm("Are you sure you want to delete this revision version?")) return;
    try {
      await apiFetch(`/projects/revisions/${revId}`, { method: "DELETE" });
      handleSelectProject(selectedProjectId()!);
    } catch (err: any) {
      alert(err.message || "Failed to delete revision.");
    }
  };

  const handleAddMaterial = async (e: Event) => {
    e.preventDefault();
    const revId = selectedRevisionId();
    if (!revId || !matPartId() || !matDesignator()) return;
    
    setSubmitting(true);
    try {
      const payload = {
        revision_id: revId,
        part_id: parseInt(matPartId()),
        designator: matDesignator()
      };
      
      await apiFetch("/projects/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      setMatPartId("");
      setMatDesignator("");
      setShowMatModal(false);
      
      // Refresh project detailed view and select revision
      await handleSelectProject(selectedProjectId()!);
      handleSelectRevision(revId);
      alert("BOM component added successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to add BOM component.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (matId: number) => {
    if (!confirm("Remove this component from the Bill of Materials?")) return;
    try {
      await apiFetch(`/projects/materials/${matId}`, { method: "DELETE" });
      const currentRevId = selectedRevisionId()!;
      await handleSelectProject(selectedProjectId()!);
      handleSelectRevision(currentRevId);
    } catch (err: any) {
      alert(err.message || "Failed to remove BOM item.");
    }
  };

  return (
    <div class="space-y-6">
      {/* View Header */}
      <div>
        <h2 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <FolderGit2 class="text-accentCyan" />
          Projects & PCB Assemblies
        </h2>
        <p class="text-gray-400 text-sm">Design PCB layouts, configure versions, and track stock on component materials.</p>
      </div>

      <Show when={loading()}>
        <div class="glass-panel p-8 rounded-2xl animate-pulse h-64"></div>
      </Show>

      <Show when={!loading()}>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ----------------- LEFT 1 COL: PROJECT LISTING ----------------- */}
          <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-4 h-fit">
            <div class="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 class="text-sm font-bold text-white uppercase tracking-wider">PCB Projects</h3>
              <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                <button
                  onClick={() => setShowProjModal(true)}
                  class="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 font-semibold"
                >
                  <Plus size={14} />
                  Add
                </button>
              </Show>
            </div>

            <Show when={projects().length === 0}>
              <p class="text-xs text-gray-500 py-6 text-center">No PCB Projects designed yet.</p>
            </Show>

            <Show when={projects().length > 0}>
              <div class="space-y-2">
                <For each={projects()}>
                  {(proj) => (
                    <div
                      onClick={() => handleSelectProject(proj.id)}
                      class={`p-3.5 rounded-xl text-left cursor-pointer transition-all border ${
                        selectedProjectId() === proj.id
                          ? "bg-gradient-to-r from-accentCyan/10 to-accentBlue/5 border-accentCyan text-white"
                          : "bg-white/[0.01] hover:bg-white/[0.03] border-white/5 text-gray-400"
                      }`}
                    >
                      <h4 class="font-bold text-sm text-white truncate">{proj.title}</h4>
                      <p class="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-normal">
                        {proj.description}
                      </p>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* ----------------- RIGHT 2 COLS: DETAILED REVISIONS & BOM ----------------- */}
          <div class="lg:col-span-2 space-y-6">
            <Show when={!selectedProject()}>
              <div class="glass-panel rounded-2xl p-12 text-center text-gray-500 border border-white/5 flex flex-col items-center justify-center min-h-[300px]">
                <Cpu size={48} class="text-gray-600 mb-4" />
                <h4 class="text-white font-bold mb-1">Select a PCB Project</h4>
                <p class="text-xs">Choose or create a project on the left to manage revisions and Bill of Materials (BOM).</p>
              </div>
            </Show>

            <Show when={selectedProject()}>
              <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-accentCyan/5 rounded-full blur-2xl -z-10"></div>
                
                {/* Project title and description */}
                <div class="flex justify-between items-start gap-4">
                  <div>
                    <h3 class="text-xl font-bold text-white tracking-tight">{selectedProject().title}</h3>
                    <p class="text-gray-400 text-xs mt-2 leading-relaxed">{selectedProject().description}</p>
                  </div>
                  <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                    <button
                      onClick={() => handleDeleteProject(selectedProject().id)}
                      class="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/5 rounded transition-colors shrink-0"
                      title="Delete Project"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Show>
                </div>

                {/* Revisions Navigation Tab list */}
                <div class="space-y-4">
                  <div class="flex justify-between items-center pb-2 border-b border-white/5">
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Layers size={14} />
                      Revision Layout Versions
                    </h4>
                    
                    <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                      <button
                        onClick={() => setShowRevModal(true)}
                        class="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5"
                      >
                        <Plus size={12} />
                        New Version
                      </button>
                    </Show>
                  </div>

                  <Show when={selectedProject().revisions.length === 0}>
                    <p class="text-xs text-gray-500 py-4 italic">No revision layouts configured. Define a layout version to start building a BOM.</p>
                  </Show>

                  <Show when={selectedProject().revisions.length > 0}>
                    <div class="flex flex-wrap gap-2">
                      <For each={selectedProject().revisions}>
                        {(rev) => (
                          <button
                            onClick={() => handleSelectRevision(rev.id)}
                            class={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                              selectedRevisionId() === rev.id
                                ? "bg-accentCyan border-accentCyan text-black"
                                : "bg-white/5 hover:bg-white/10 border-white/5 text-white"
                            }`}
                          >
                            <span>{rev.version}</span>
                            <span class={`text-[10px] ${selectedRevisionId() === rev.id ? "text-black/60" : "text-gray-500"}`}>
                              ({new Date(rev.date + "T00:00:00").toLocaleDateString()})
                            </span>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* Revision Detailed BOM list */}
                <Show when={selectedRevision()}>
                  <div class="border-t border-white/5 pt-6 space-y-4">
                    <div class="flex justify-between items-center">
                      <div>
                        <h4 class="text-sm font-bold text-white">BOM for Version {selectedRevision().version}</h4>
                        <div class="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
                          <Calendar size={12} />
                          <span>Release Date: {new Date(selectedRevision().date + "T00:00:00").toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div class="flex gap-2">
                        <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                          <button
                            onClick={() => setShowMatModal(true)}
                            class="btn-primary py-2 px-3 text-xs flex items-center gap-1.5"
                          >
                            <Plus size={14} />
                            Add Component
                          </button>
                          
                          <button
                            onClick={() => handleDeleteRevision(selectedRevision().id)}
                            class="btn-secondary py-2 px-3 text-xs border-red-500/20 text-red-400 hover:border-red-500/40 hover:bg-red-500/5 flex items-center gap-1.5"
                            title="Delete Revision"
                          >
                            <Trash2 size={14} />
                            Delete Version
                          </button>
                        </Show>
                      </div>
                    </div>

                    {/* BOM Table */}
                    <Show when={selectedRevision().materials.length === 0}>
                      <div class="text-center py-10 text-gray-500 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                        <Cpu size={32} class="mx-auto mb-2 text-gray-600" />
                        <h5 class="text-white font-semibold text-xs">BOM is Empty</h5>
                        <p class="text-[10px] mt-0.5">Attach electronics components from the catalog to this board layout version.</p>
                      </div>
                    </Show>

                    <Show when={selectedRevision().materials.length > 0}>
                      <div class="overflow-x-auto border border-white/5 rounded-2xl">
                        <table class="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr class="bg-white/[0.02] border-b border-white/10 text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                              <th class="py-3 px-4 w-20">Designator</th>
                              <th class="py-3 px-4">Component Value</th>
                              <th class="py-3 px-4">Manufacturer SKU</th>
                              <th class="py-3 px-4">Package</th>
                              <th class="py-3 px-4 text-center">Available Stock</th>
                              <th class="py-3 px-4 text-center w-12">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={selectedRevision().materials}>
                              {(mat) => {
                                const part = mat.part || {};
                                // Calculate total stock of this part
                                const totalStock = part.storage_records ? part.storage_records.reduce((acc: number, curr: any) => acc + curr.quantity, 0) : 0;
                                const isLowStock = totalStock < (part.threshold || 0);
                                
                                return (
                                  <tr class="border-b border-white/5 hover:bg-white/[0.01] transition-all">
                                    <td class="py-3.5 px-4 font-mono font-bold text-accentCyan text-sm">{mat.designator}</td>
                                    <td class="py-3.5 px-4 font-medium text-white">{part.value || "Unknown"}</td>
                                    <td class="py-3.5 px-4 font-mono text-gray-400">{part.number || "N/A"}</td>
                                    <td class="py-3.5 px-4 text-gray-400">{part.package || "N/A"}</td>
                                    <td class="py-3.5 px-4 text-center">
                                      <div class="flex items-center justify-center gap-1.5">
                                        <Show when={isLowStock} fallback={<CheckCircle2 size={14} class="text-cyan-400" />}>
                                          <AlertTriangle size={14} class="text-amber-500 animate-pulse" />
                                        </Show>
                                        <span class={`font-bold ${isLowStock ? "text-amber-500" : "text-cyan-400"}`}>
                                          {totalStock} units
                                        </span>
                                      </div>
                                    </td>
                                    <td class="py-3.5 px-4 text-center">
                                      <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                                        <button
                                          onClick={() => handleDeleteMaterial(mat.id)}
                                          class="text-gray-600 hover:text-red-400 p-1 cursor-pointer transition-colors"
                                          title="Remove Component"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </Show>
                                    </td>
                                  </tr>
                                );
                              }}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Add Project Modal */}
      <Show when={showProjModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="glass-panel max-w-md w-full rounded-2xl p-6 border border-white/10 relative">
            <button 
              onClick={() => setShowProjModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 class="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <FolderGit2 class="text-accentCyan" size={20} />
              New PCB Project
            </h3>
            
            <form onSubmit={handleCreateProject} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Project Title</label>
                <input
                  type="text"
                  required
                  value={projTitle()}
                  onInput={(e) => setProjTitle(e.target.value)}
                  placeholder="E.g. Sensor Node PCB"
                  class="glass-input w-full text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Description</label>
                <textarea
                  required
                  value={projDesc()}
                  onInput={(e) => setProjDesc(e.target.value)}
                  placeholder="E.g. IoT wireless environmental telemetry design layout..."
                  class="glass-input w-full h-24 text-sm resize-none"
                />
              </div>

              <div class="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowProjModal(false)}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting()}
                  class="btn-primary flex-1"
                >
                  {submitting() ? "Creating..." : "Save Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Add Revision Modal */}
      <Show when={showRevModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="glass-panel max-w-md w-full rounded-2xl p-6 border border-white/10 relative">
            <button 
              onClick={() => setShowRevModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 class="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Layers class="text-accentCyan" size={20} />
              Add Layout Version
            </h3>
            
            <form onSubmit={handleCreateRevision} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Version Code</label>
                <input
                  type="text"
                  required
                  value={revVersion()}
                  onInput={(e) => setRevVersion(e.target.value)}
                  placeholder="E.g. v1.0.0, v2.1-beta"
                  class="glass-input w-full text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Layout Date</label>
                <input
                  type="date"
                  required
                  value={revDate()}
                  onInput={(e) => setRevDate(e.target.value)}
                  class="glass-input w-full text-sm"
                />
              </div>

              <div class="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowRevModal(false)}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting()}
                  class="btn-primary flex-1"
                >
                  {submitting() ? "Saving..." : "Save Revision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Add BOM Material Modal */}
      <Show when={showMatModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="glass-panel max-w-md w-full rounded-2xl p-6 border border-white/10 relative">
            <button 
              onClick={() => setShowMatModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 class="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Cpu class="text-accentCyan" size={20} />
              Add Component to BOM
            </h3>
            
            <form onSubmit={handleAddMaterial} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Select Component</label>
                <select
                  required
                  value={matPartId()}
                  onChange={(e) => setMatPartId(e.currentTarget.value)}
                  class="glass-input w-full text-sm"
                >
                  <option value="">Choose Component...</option>
                  <For each={parts()}>
                    {(p) => <option value={p.id}>{p.value} - {p.number} ({p.package || "No Package"})</option>}
                  </For>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Reference Designator</label>
                <input
                  type="text"
                  required
                  value={matDesignator()}
                  onInput={(e) => setMatDesignator(e.target.value)}
                  placeholder="E.g. R1, C12, U3"
                  class="glass-input w-full text-sm font-mono font-bold"
                />
                <p class="text-[9px] text-gray-500 mt-1">
                  Specific position reference on the PCB silkscreen layout.
                </p>
              </div>

              <div class="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowMatModal(false)}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting()}
                  class="btn-primary flex-1"
                >
                  {submitting() ? "Adding..." : "Add to BOM"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
