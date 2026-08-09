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
  Tag,
  Boxes,
  Copy,
  Edit,
  Check,
  Link,
  HelpCircle
} from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";
import toast from "solid-toast";
import { useConfirm } from "../contexts/ConfirmContext";

export default function Projects() {
  const { confirm } = useConfirm();
  const [projects, setProjects] = createSignal<any[]>([]);
  const [parts, setParts] = createSignal<any[]>([]);
  
  const [selectedProjectId, setSelectedProjectId] = createSignal<number | null>(null);
  const [selectedProject, setSelectedProject] = createSignal<any>(null);
  
  const [selectedAssemblyId, setSelectedAssemblyId] = createSignal<number | null>(null);
  const [selectedAssembly, setSelectedAssembly] = createSignal<any>(null);
  
  const [selectedRevisionId, setSelectedRevisionId] = createSignal<number | null>(null);
  const [selectedRevision, setSelectedRevision] = createSignal<any>(null);
  
  const [loading, setLoading] = createSignal(true);

  // Add/Edit Project Modal
  const [showProjModal, setShowProjModal] = createSignal(false);
  const [editProjId, setEditProjId] = createSignal<number | null>(null);
  const [projTitle, setProjTitle] = createSignal("");
  const [projDesc, setProjDesc] = createSignal("");

  // Add/Edit Assembly Modal
  const [showAssemModal, setShowAssemModal] = createSignal(false);
  const [editAssemId, setEditAssemId] = createSignal<number | null>(null);
  const [assemName, setAssemName] = createSignal("");

  // Add/Edit Revision Modal
  const [showRevModal, setShowRevModal] = createSignal(false);
  const [editRevId, setEditRevId] = createSignal<number | null>(null);
  const [revVersion, setRevVersion] = createSignal("");
  const [revDate, setRevDate] = createSignal("");

  // Clone Revision Modal
  const [showCloneModal, setShowCloneModal] = createSignal(false);
  const [cloneRevVersion, setCloneRevVersion] = createSignal("");
  const [cloneRevDate, setCloneRevDate] = createSignal("");

  // Add BOM Material Modal
  const [showMatModal, setShowMatModal] = createSignal(false);
  const [matPartId, setMatPartId] = createSignal("");
  const [matDesignator, setMatDesignator] = createSignal("");
  const [matQuantity, setMatQuantity] = createSignal("1");
  const [matGhostDesc, setMatGhostDesc] = createSignal("");
  const [addSearchQuery, setAddSearchQuery] = createSignal("");

  const getSortedAddParts = () => {
    const query = addSearchQuery().toLowerCase().trim();
    if (!query) {
      return parts();
    }
    const terms = query.split(/[\s,]+/).filter(Boolean);
    if (terms.length === 0) {
      return parts();
    }
    const scored = parts().map(p => {
      let score = 0;
      const value = (p.value || "").toLowerCase();
      const number = (p.number || "").toLowerCase();
      const pkg = (p.package || "").toLowerCase();
      const catTitle = p.category ? (p.category.title || "").toLowerCase() : "";
      
      terms.forEach(term => {
        if (value.includes(term)) score += 3;
        if (number.includes(term)) score += 2;
        if (pkg.includes(term)) score += 2;
        if (catTitle.includes(term)) score += 1;
      });
      return { part: p, score };
    });
    return scored
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.part);
  };

  // Inline editing BOM materials
  const [editingMaterialId, setEditingMaterialId] = createSignal<number | null>(null);
  const [editQty, setEditQty] = createSignal("");
  const [editDesignator, setEditDesignator] = createSignal("");
  const [editGhostDesc, setEditGhostDesc] = createSignal("");

  // Map Ghost Material Modal
  const [showMapModal, setShowMapModal] = createSignal(false);
  const [mappingMaterialId, setMappingMaterialId] = createSignal<number | null>(null);
  const [mapPartId, setMapPartId] = createSignal("");
  const [mapSearchQuery, setMapSearchQuery] = createSignal("");

  const getSortedParts = () => {
    const query = mapSearchQuery().toLowerCase().trim();
    if (!query) {
      return parts();
    }
    
    // Split query by spaces or commas
    const terms = query.split(/[\s,]+/).filter(Boolean);
    if (terms.length === 0) {
      return parts();
    }
    
    const scored = parts().map(p => {
      let score = 0;
      const value = (p.value || "").toLowerCase();
      const number = (p.number || "").toLowerCase();
      const pkg = (p.package || "").toLowerCase();
      const catTitle = p.category ? (p.category.title || "").toLowerCase() : "";
      
      terms.forEach(term => {
        if (value.includes(term)) score += 3;
        if (number.includes(term)) score += 2;
        if (pkg.includes(term)) score += 2;
        if (catTitle.includes(term)) score += 1;
      });
      
      return { part: p, score };
    });
    
    return scored
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.part);
  };

  const [submitting, setSubmitting] = createSignal(false);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [projs, catalogParts] = await Promise.all([
        apiFetch("/projects"),
        apiFetch("/parts")
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

  const handleSelectProject = async (id: string, autoSelectAssemblyId?: number) => {
    setSelectedProjectId(id);
    setSelectedAssemblyId(null);
    setSelectedAssembly(null);
    setSelectedRevisionId(null);
    setSelectedRevision(null);
    try {
      const detailedProject = await apiFetch(`/projects/${id}`);
      setSelectedProject(detailedProject);
      
      // Auto select assembly
      if (detailedProject.assemblies && detailedProject.assemblies.length > 0) {
        const assemToSelect = autoSelectAssemblyId || detailedProject.assemblies[0].id;
        handleSelectAssembly(assemToSelect, detailedProject);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectAssembly = (assemId: string, projDetails = selectedProject()) => {
    setSelectedAssemblyId(assemId);
    setSelectedRevisionId(null);
    setSelectedRevision(null);
    
    if (projDetails) {
      const assem = projDetails.assemblies.find((a: any) => a.id === assemId);
      setSelectedAssembly(assem);
      
      // Auto select first revision if available
      if (assem && assem.revisions && assem.revisions.length > 0) {
        handleSelectRevision(assem.revisions[0].id, assem);
      }
    }
  };

  const handleSelectRevision = (revId: string, assemDetails = selectedAssembly()) => {
    setSelectedRevisionId(revId);
    if (assemDetails) {
      const rev = assemDetails.revisions.find((r: any) => r.id === revId);
      setSelectedRevision(rev);
    }
  };

  const handleSaveProject = async (e: Event) => {
    e.preventDefault();
    if (!projTitle()) return;
    
    setSubmitting(true);
    try {
      if (editProjId()) {
        await apiFetch(`/projects/${editProjId()}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: projTitle(), description: projDesc() })
        });
        toast.success("Project updated successfully.");
      } else {
        const newProj = await apiFetch("/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: projTitle(), description: projDesc() })
        });
        setSelectedProjectId(newProj.id);
        toast.success("Project created successfully.");
      }
      
      setEditProjId(null);
      setProjTitle("");
      setProjDesc("");
      setShowProjModal(false);
      
      // Refresh and select
      await loadInitialData();
      if (selectedProjectId()) {
        handleSelectProject(selectedProjectId()!);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save project.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProjectClick = () => {
    if (!selectedProject()) return;
    setEditProjId(selectedProject().id);
    setProjTitle(selectedProject().title);
    setProjDesc(selectedProject().description);
    setShowProjModal(true);
  };

  const handleDeleteProject = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Confirm Action",
      message: "Are you sure you want to permanently delete this project? All assemblies, revisions and materials records will be lost.",
      confirmText: "Proceed",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/projects/${id}`, { method: "DELETE" });
      setSelectedProjectId(null);
      setSelectedProject(null);
      setSelectedAssemblyId(null);
      setSelectedAssembly(null);
      setSelectedRevisionId(null);
      setSelectedRevision(null);
      loadInitialData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete project.");
    }
  };

  const handleSaveAssembly = async (e: Event) => {
    e.preventDefault();
    const projId = selectedProjectId();
    if (!projId || !assemName()) return;
    
    setSubmitting(true);
    try {
      const payload = {
        project_id: projId,
        name: assemName()
      };
      
      let targetAssemId = editAssemId();
      if (targetAssemId) {
        await apiFetch(`/projects/assemblies/${targetAssemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: assemName() })
        });
        toast.success("Assembly updated successfully.");
      } else {
        const newAssem = await apiFetch("/projects/assemblies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        targetAssemId = newAssem.id;
        toast.success("Assembly created successfully.");
      }
      
      setEditAssemId(null);
      setAssemName("");
      setShowAssemModal(false);
      
      // Refresh project detailed view and auto-select assembly
      await handleSelectProject(projId, targetAssemId!);
    } catch (err: any) {
      toast.error(err.message || "Failed to save assembly.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAssemblyClick = () => {
    if (!selectedAssembly()) return;
    setEditAssemId(selectedAssembly().id);
    setAssemName(selectedAssembly().name);
    setShowAssemModal(true);
  };

  const handleDeleteAssembly = async (assemId: string) => {
    const isConfirmed = await confirm({
      title: "Confirm Action",
      message: "Are you sure you want to delete this assembly? All revisions and materials records will be lost.",
      confirmText: "Proceed",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/projects/assemblies/${assemId}`, { method: "DELETE" });
      handleSelectProject(selectedProjectId()!);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete assembly.");
    }
  };

  const handleSaveRevision = async (e: Event) => {
    e.preventDefault();
    const assemId = selectedAssemblyId();
    if (!assemId || !revVersion() || !revDate()) return;
    
    setSubmitting(true);
    try {
      const payload = {
        assembly_id: assemId,
        version: revVersion(),
        date: revDate()
      };
      
      if (editRevId()) {
        await apiFetch(`/projects/revisions/${editRevId()}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: revVersion(), date: revDate() })
        });
        toast.success("Revision updated successfully.");
      } else {
        await apiFetch("/projects/revisions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        toast.success("Revision created successfully.");
      }
      
      setEditRevId(null);
      setRevVersion("");
      setRevDate("");
      setShowRevModal(false);
      
      // Refresh project detailed view and re-select assembly
      await handleSelectProject(selectedProjectId()!, assemId);
    } catch (err: any) {
      toast.error(err.message || "Failed to save revision.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRevisionClick = () => {
    if (!selectedRevision()) return;
    setEditRevId(selectedRevision().id);
    setRevVersion(selectedRevision().version);
    setRevDate(selectedRevision().date);
    setShowRevModal(true);
  };

  const handleDeleteRevision = async (revId: string) => {
    const isConfirmed = await confirm({
      title: "Confirm Action",
      message: "Are you sure you want to delete this revision version?",
      confirmText: "Proceed",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/projects/revisions/${revId}`, { method: "DELETE" });
      const currentAssemId = selectedAssemblyId()!;
      await handleSelectProject(selectedProjectId()!, currentAssemId);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete revision.");
    }
  };

  const handleCloneRevision = async (e: Event) => {
    e.preventDefault();
    const sourceRevId = selectedRevisionId();
    const assemId = selectedAssemblyId();
    if (!sourceRevId || !cloneRevVersion() || !cloneRevDate()) return;
    
    setSubmitting(true);
    try {
      const payload = {
        version: cloneRevVersion(),
        date: cloneRevDate()
      };
      
      const newRev = await apiFetch(`/projects/revisions/${sourceRevId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      toast.success("Revision cloned successfully.");
      
      setCloneRevVersion("");
      setCloneRevDate("");
      setShowCloneModal(false);
      
      // Refresh project detailed view and select the new revision
      await handleSelectProject(selectedProjectId()!, assemId!);
      handleSelectRevision(newRev.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to clone revision.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMaterial = async (e: Event) => {
    e.preventDefault();
    const revId = selectedRevisionId();
    if (!revId) return;
    
    setSubmitting(true);
    try {
      const payload = {
        revision_id: revId,
        part_id: matPartId() ? matPartId() : null,
        designator: matDesignator() || null,
        quantity: parseFloat(matQuantity()) || 1.0,
        ghost_description: matGhostDesc() || null
      };
      
      await apiFetch("/projects/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      setMatPartId("");
      setMatDesignator("");
      setMatQuantity("1");
      setMatGhostDesc("");
      setAddSearchQuery("");
      setShowMatModal(false);
      
      // Refresh project detailed view and select revision
      const currentAssemId = selectedAssemblyId()!;
      await handleSelectProject(selectedProjectId()!, currentAssemId);
      handleSelectRevision(revId, selectedProject().assemblies.find((a:any) => a.id === currentAssemId));
      toast.success("BOM component added successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to add BOM component.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartInlineEdit = (mat: any) => {
    setEditingMaterialId(mat.id);
    setEditQty(String(mat.quantity));
    setEditDesignator(mat.designator || "");
    setEditGhostDesc(mat.ghost_description || "");
  };

  const handleSaveInlineEdit = async (matId: string) => {
    try {
      const payload = {
        quantity: parseFloat(editQty()) || 1.0,
        designator: editDesignator() || null,
        ghost_description: editGhostDesc() || null
      };
      
      await apiFetch(`/projects/materials/${matId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      setEditingMaterialId(null);
      const currentAssemId = selectedAssemblyId()!;
      const currentRevId = selectedRevisionId()!;
      await handleSelectProject(selectedProjectId()!, currentAssemId);
      handleSelectRevision(currentRevId, selectedProject().assemblies.find((a:any) => a.id === currentAssemId));
      toast.success("BOM component updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update BOM component.");
    }
  };

  const handleMapGhostMaterial = async (e: Event) => {
    e.preventDefault();
    const matId = mappingMaterialId();
    if (!matId || !mapPartId()) return;
    
    setSubmitting(true);
    try {
      const payload = {
        part_id: mapPartId()
      };
      
      await apiFetch(`/projects/materials/${matId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      setShowMapModal(false);
      setMappingMaterialId(null);
      setMapPartId("");
      
      const currentAssemId = selectedAssemblyId()!;
      const currentRevId = selectedRevisionId()!;
      await handleSelectProject(selectedProjectId()!, currentAssemId);
      handleSelectRevision(currentRevId, selectedProject().assemblies.find((a:any) => a.id === currentAssemId));
      toast.success("Ghost component mapped to inventory part.");
    } catch (err: any) {
      toast.error(err.message || "Failed to map component.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (matId: string) => {
    const isConfirmed = await confirm({
      title: "Confirm Action",
      message: "Remove this component from the Bill of Materials?",
      confirmText: "Proceed",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await apiFetch(`/projects/materials/${matId}`, { method: "DELETE" });
      const currentAssemId = selectedAssemblyId()!;
      const currentRevId = selectedRevisionId()!;
      await handleSelectProject(selectedProjectId()!, currentAssemId);
      handleSelectRevision(currentRevId, selectedProject().assemblies.find((a:any) => a.id === currentAssemId));
    } catch (err: any) {
      toast.error(err.message || "Failed to remove BOM item.");
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
                  onClick={() => {
                    setEditProjId(null);
                    setProjTitle("");
                    setProjDesc("");
                    setShowProjModal(true);
                  }}
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

          {/* ----------------- RIGHT 2 COLS: DETAILED ASSEMBLIES, REVISIONS & BOM ----------------- */}
          <div class="lg:col-span-2 space-y-6">
            <Show when={!selectedProject()}>
              <div class="glass-panel rounded-2xl p-12 text-center text-gray-500 border border-white/5 flex flex-col items-center justify-center min-h-[300px]">
                <Cpu size={48} class="text-gray-600 mb-4" />
                <h4 class="text-white font-bold mb-1">Select a PCB Project</h4>
                <p class="text-xs">Choose or create a project on the left to manage assemblies and Bill of Materials (BOM).</p>
              </div>
            </Show>

            <Show when={selectedProject()}>
              <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-accentCyan/5 rounded-full blur-2xl -z-10"></div>
                
                {/* Project title and description */}
                <div class="flex justify-between items-start gap-4 pb-4 border-b border-white/5">
                  <div>
                    <h3 class="text-xl font-bold text-white tracking-tight">{selectedProject().title}</h3>
                    <p class="text-gray-400 text-xs mt-2 leading-relaxed">{selectedProject().description}</p>
                  </div>
                  <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        onClick={handleEditProjectClick}
                        class="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Edit Project"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProject(selectedProject().id)}
                        class="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/5 rounded transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Show>
                </div>

                {/* Assemblies Navigation Tab list */}
                <div class="space-y-4">
                  <div class="flex justify-between items-center">
                    <h4 class="text-sm font-bold text-white flex items-center gap-1.5">
                      <Boxes size={16} class="text-accentCyan" />
                      Assemblies
                    </h4>
                    
                    <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                      <button
                        onClick={() => {
                          setEditAssemId(null);
                          setAssemName("");
                          setShowAssemModal(true);
                        }}
                        class="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5"
                      >
                        <Plus size={12} />
                        New Assembly
                      </button>
                    </Show>
                  </div>

                  <Show when={!selectedProject().assemblies || selectedProject().assemblies.length === 0}>
                    <p class="text-xs text-gray-500 py-4 italic text-center bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                      No assemblies configured. Create an assembly to start defining versions and BOMs.
                    </p>
                  </Show>

                  <Show when={selectedProject().assemblies && selectedProject().assemblies.length > 0}>
                    <div class="flex flex-wrap gap-3">
                      <For each={selectedProject().assemblies}>
                        {(assem) => (
                          <button
                            onClick={() => handleSelectAssembly(assem.id)}
                            class={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                              selectedAssemblyId() === assem.id
                                ? "bg-white/10 border-white/20 text-white"
                                : "bg-white/[0.02] hover:bg-white/[0.05] border-white/5 text-gray-400"
                            }`}
                          >
                            <span>{assem.name}</span>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* Assembly Detailed Revisions & BOM */}
                <Show when={selectedAssembly()}>
                  <div class="bg-black/20 rounded-xl p-5 border border-white/5 space-y-6">
                    
                    <div class="flex justify-between items-center">
                      <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Layers size={14} />
                          {selectedAssembly().name} Revisions
                        </h4>
                      </div>
                      <div class="flex items-center gap-2">
                        <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                          <button
                            onClick={handleEditAssemblyClick}
                            class="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors text-xs"
                            title="Edit Assembly"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setEditRevId(null);
                              setRevVersion("");
                              setRevDate("");
                              setShowRevModal(true);
                            }}
                            class="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5"
                          >
                            <Plus size={12} />
                            New Version
                          </button>
                          <button
                            onClick={() => handleDeleteAssembly(selectedAssembly().id)}
                            class="btn-secondary py-1 px-2 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
                            title="Delete Assembly"
                          >
                            <Trash2 size={12} />
                          </button>
                        </Show>
                      </div>
                    </div>

                    <Show when={!selectedAssembly().revisions || selectedAssembly().revisions.length === 0}>
                      <p class="text-xs text-gray-500 italic">No revision layouts configured for this assembly.</p>
                    </Show>

                    <Show when={selectedAssembly().revisions && selectedAssembly().revisions.length > 0}>
                      <div class="flex flex-wrap gap-2">
                        <For each={selectedAssembly().revisions}>
                          {(rev) => (
                            <button
                              onClick={() => handleSelectRevision(rev.id)}
                              class={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                                selectedRevisionId() === rev.id
                                  ? "bg-accentCyan border-accentCyan text-black"
                                  : "bg-white/5 hover:bg-white/10 border-white/5 text-white"
                              }`}
                            >
                              <span>{rev.version}</span>
                              <span class={`text-[9px] ${selectedRevisionId() === rev.id ? "text-black/60" : "text-gray-500"}`}>
                                ({new Date(rev.date + "T00:00:00").toLocaleDateString()})
                              </span>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>

                    {/* Revision Detailed BOM list */}
                    <Show when={selectedRevision()}>
                      <div class="border-t border-white/5 pt-5 space-y-4">
                        <div class="flex justify-between items-center">
                          <div>
                            <h4 class="text-sm font-bold text-white">BOM for Version {selectedRevision().version}</h4>
                            <div class="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
                              <Calendar size={12} />
                              <span>Release Date: {new Date(selectedRevision().date + "T00:00:00").toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div class="flex gap-2 items-center">
                            <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                              <button
                                onClick={handleEditRevisionClick}
                                class="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors text-xs mr-2"
                                title="Edit Revision"
                              >
                                Edit
                              </button>
                              
                              <button
                                onClick={() => {
                                  setCloneRevVersion(`${selectedRevision().version}-clone`);
                                  setCloneRevDate(new Date().toISOString().split("T")[0]);
                                  setShowCloneModal(true);
                                }}
                                class="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 mr-2"
                                title="Clone Revision"
                              >
                                <Copy size={14} />
                                Clone Version
                              </button>
                              
                              <button
                                onClick={() => {
                                  setMatPartId("");
                                  setAddSearchQuery("");
                                  setMatGhostDesc("");
                                  setMatDesignator("");
                                  setMatQuantity("1");
                                  setShowMatModal(true);
                                }}
                                class="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                              >
                                <Plus size={14} />
                                Add Component
                              </button>
                              
                              <button
                                onClick={() => handleDeleteRevision(selectedRevision().id)}
                                class="btn-secondary py-1.5 px-3 text-xs border-red-500/20 text-red-400 hover:border-red-500/40 hover:bg-red-500/5 flex items-center gap-1.5"
                                title="Delete Revision"
                              >
                                <Trash2 size={14} />
                                Delete Version
                              </button>
                            </Show>
                          </div>
                        </div>

                        {/* BOM Table */}
                        <Show when={!selectedRevision().materials || selectedRevision().materials.length === 0}>
                          <div class="text-center py-8 text-gray-500 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                            <Cpu size={24} class="mx-auto mb-2 text-gray-600" />
                            <h5 class="text-white font-semibold text-xs">BOM is Empty</h5>
                            <p class="text-[10px] mt-0.5">Attach electronics components to this layout version.</p>
                          </div>
                        </Show>

                        <Show when={selectedRevision().materials && selectedRevision().materials.length > 0}>
                          <div class="overflow-x-auto border border-white/5 rounded-2xl">
                            <table class="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr class="bg-white/[0.02] border-b border-white/10 text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                                  <th class="py-3 px-4 w-24">Designator</th>
                                  <th class="py-3 px-4">Component / Description</th>
                                  <th class="py-3 px-4 w-20 text-center">Qty Req</th>
                                  <th class="py-3 px-4 text-center">Available Stock</th>
                                  <th class="py-3 px-4 text-center w-24">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                <For each={selectedRevision().materials}>
                                  {(mat) => {
                                    const part = mat.part || null;
                                    const isGhost = !mat.part_id;
                                    const isEditing = () => editingMaterialId() === mat.id;
                                    
                                    // Calculate total stock of this part
                                    const totalStock = part && part.storage_records ? part.storage_records.reduce((acc: number, curr: any) => acc + curr.quantity, 0) : 0;
                                    const isLowStock = part ? totalStock < (part.threshold || 0) : false;
                                    
                                    return (
                                      <tr class={`border-b border-white/5 transition-all ${
                                        isGhost 
                                          ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.06] text-amber-200/90" 
                                          : "hover:bg-white/[0.01]"
                                      }`}>
                                        {/* Designator */}
                                        <td class="py-3 px-4 font-mono font-bold text-sm">
                                          <Show when={isEditing()} fallback={
                                            <span class={isGhost ? "text-amber-400" : "text-accentCyan"}>
                                              {mat.designator || "N/A"}
                                            </span>
                                          }>
                                            <input 
                                              type="text" 
                                              value={editDesignator()} 
                                              onInput={(e) => setEditDesignator(e.target.value)} 
                                              class="glass-input font-mono font-bold text-xs px-2 py-1 w-20 text-white bg-black/40" 
                                            />
                                          </Show>
                                        </td>
                                        
                                        {/* Component / Description */}
                                        <td class="py-3 px-4">
                                          <Show when={isEditing()}>
                                            <Show when={isGhost} fallback={
                                              <div>
                                                <div class="font-medium text-white">{part.value || "Unknown"}</div>
                                                <div class="font-mono text-[10px] text-gray-400">{part.number || "N/A"}</div>
                                              </div>
                                            }>
                                              <div class="space-y-1">
                                                <input 
                                                  type="text" 
                                                  value={editGhostDesc()} 
                                                  onInput={(e) => setEditGhostDesc(e.target.value)} 
                                                  class="glass-input text-xs px-2 py-1 w-full text-white bg-black/40" 
                                                  placeholder="Ghost Description"
                                                />
                                                <span class="text-[9px] text-amber-500 font-semibold block">Unmapped Ghost Material</span>
                                              </div>
                                            </Show>
                                          </Show>
                                          
                                          <Show when={!isEditing()}>
                                            <Show when={isGhost} fallback={
                                              <div>
                                                <div class="font-medium text-white">{part.value || "Unknown"}</div>
                                                <div class="flex items-center gap-2 mt-0.5">
                                                  <span class="font-mono text-[10px] text-gray-400">{part.number || "N/A"}</span>
                                                  <span class="text-[10px] text-gray-500">({part.package || "No Package"})</span>
                                                </div>
                                              </div>
                                            }>
                                              <div class="flex items-center justify-between gap-4">
                                                <div>
                                                  <div class="font-semibold text-amber-400 flex items-center gap-1">
                                                    <HelpCircle size={12} class="text-amber-500" />
                                                    <span>{mat.ghost_description || "Ghost Component"}</span>
                                                  </div>
                                                  <span class="text-[10px] text-amber-500/80 italic block mt-0.5">Not linked to inventory part</span>
                                                </div>
                                                <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                                                  <button
                                                    onClick={() => {
                                                      setMappingMaterialId(mat.id);
                                                      setMapSearchQuery(mat.ghost_description || "");
                                                      setMapPartId("");
                                                      setShowMapModal(true);
                                                    }}
                                                    class="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-[10px] font-semibold flex items-center gap-1 transition-all border border-amber-500/30 cursor-pointer"
                                                  >
                                                    <Link size={10} />
                                                    Map to Part
                                                  </button>
                                                </Show>
                                              </div>
                                            </Show>
                                          </Show>
                                        </td>
                                        
                                        {/* Qty Required */}
                                        <td class="py-3 px-4 text-center">
                                          <Show when={isEditing()} fallback={
                                            <span class="font-semibold text-white">{mat.quantity}</span>
                                          }>
                                            <input 
                                              type="number" 
                                              step="any"
                                              value={editQty()} 
                                              onInput={(e) => setEditQty(e.target.value)} 
                                              class="glass-input text-xs px-2 py-1 w-16 text-center text-white bg-black/40" 
                                            />
                                          </Show>
                                        </td>
                                        
                                        {/* Available Stock */}
                                        <td class="py-3 px-4 text-center">
                                          <Show when={!isGhost} fallback={
                                            <span class="text-gray-500 italic text-[10px]">N/A</span>
                                          }>
                                            <div class="flex items-center justify-center gap-1.5">
                                              <Show when={isLowStock} fallback={<CheckCircle2 size={14} class="text-cyan-400" />}>
                                                <AlertTriangle size={14} class="text-amber-500 animate-pulse" />
                                              </Show>
                                              <span class={`font-bold ${isLowStock ? "text-amber-500" : "text-cyan-400"}`}>
                                                {totalStock} units
                                              </span>
                                            </div>
                                          </Show>
                                        </td>
                                        
                                        {/* Actions */}
                                        <td class="py-3 px-4 text-center">
                                          <Show when={user()?.role === "admin" || user()?.role === "designer"}>
                                            <div class="flex items-center justify-center gap-2">
                                              <Show when={isEditing()} fallback={
                                                <>
                                                  <button
                                                    onClick={() => handleStartInlineEdit(mat)}
                                                    class="text-gray-400 hover:text-white p-1 cursor-pointer transition-colors"
                                                    title="Edit Material"
                                                  >
                                                    <Edit size={14} />
                                                  </button>
                                                  <button
                                                    onClick={() => handleDeleteMaterial(mat.id)}
                                                    class="text-gray-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
                                                    title="Remove Component"
                                                  >
                                                    <Trash2 size={14} />
                                                  </button>
                                                </>
                                              }>
                                                <button
                                                  onClick={() => handleSaveInlineEdit(mat.id)}
                                                  class="text-green-400 hover:text-green-300 p-1 cursor-pointer transition-colors"
                                                  title="Save Changes"
                                                >
                                                  <Check size={14} />
                                                </button>
                                                <button
                                                  onClick={() => setEditingMaterialId(null)}
                                                  class="text-red-400 hover:text-red-300 p-1 cursor-pointer transition-colors"
                                                  title="Cancel Edit"
                                                >
                                                  <X size={14} />
                                                </button>
                                              </Show>
                                            </div>
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
              {editProjId() ? "Edit Project" : "New PCB Project"}
            </h3>
            
            <form onSubmit={handleSaveProject} class="space-y-4">
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

      {/* Add Assembly Modal */}
      <Show when={showAssemModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="glass-panel max-w-md w-full rounded-2xl p-6 border border-white/10 relative">
            <button 
              onClick={() => setShowAssemModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 class="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Boxes class="text-accentCyan" size={20} />
              {editAssemId() ? "Edit Assembly" : "New Assembly"}
            </h3>
            
            <form onSubmit={handleSaveAssembly} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Assembly Name</label>
                <input
                  type="text"
                  required
                  value={assemName()}
                  onInput={(e) => setAssemName(e.target.value)}
                  placeholder="E.g. Main Board, Top Assembly"
                  class="glass-input w-full text-sm"
                />
              </div>

              <div class="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAssemModal(false)}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting()}
                  class="btn-primary flex-1"
                >
                  {submitting() ? "Saving..." : "Save Assembly"}
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
              {editRevId() ? "Edit Revision" : "Add Layout Version"}
            </h3>
            
            <form onSubmit={handleSaveRevision} class="space-y-4">
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

      {/* Clone Revision Modal */}
      <Show when={showCloneModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="glass-panel max-w-md w-full rounded-2xl p-6 border border-white/10 relative">
            <button 
              onClick={() => setShowCloneModal(false)}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 class="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Copy class="text-accentCyan" size={20} />
              Clone Revision Version
            </h3>
            
            <form onSubmit={handleCloneRevision} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">New Version Code</label>
                <input
                  type="text"
                  required
                  value={cloneRevVersion()}
                  onInput={(e) => setCloneRevVersion(e.target.value)}
                  placeholder="E.g. v2.0, v1.1-clone"
                  class="glass-input w-full text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Layout Date</label>
                <input
                  type="date"
                  required
                  value={cloneRevDate()}
                  onInput={(e) => setCloneRevDate(e.target.value)}
                  class="glass-input w-full text-sm"
                />
              </div>

              <div class="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCloneModal(false)}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting()}
                  class="btn-primary flex-1"
                >
                  {submitting() ? "Cloning..." : "Clone Revision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Add BOM Material Modal */}
      <Show when={showMatModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="glass-panel max-w-lg w-full rounded-2xl p-6 border border-white/10 relative">
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
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Search Catalog</label>
                <input
                  type="text"
                  value={addSearchQuery()}
                  onInput={(e) => setAddSearchQuery(e.target.value)}
                  placeholder="Search parts to link..."
                  class="glass-input w-full text-sm text-white"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">
                  Select Part
                </label>
                <div class="max-h-48 overflow-y-auto space-y-1.5 border border-white/5 p-2 rounded-xl bg-black/30">
                  {/* Option to leave unmapped (create ghost) */}
                  <div
                    onClick={() => setMatPartId("")}
                    class={`p-2 rounded-lg border transition-all cursor-pointer text-xs font-semibold ${
                      matPartId() === ""
                        ? "bg-amber-500/20 border-amber-500 text-amber-300"
                        : "bg-white/[0.01] hover:bg-white/[0.04] border-white/5 text-amber-400"
                    }`}
                  >
                    Leave Unmapped (Create Ghost Component)
                  </div>
                  <For each={getSortedAddParts()}>
                    {(p) => {
                      return (
                        <div
                          onClick={() => setMatPartId(String(p.id))}
                          class={`p-2 rounded-lg border transition-all cursor-pointer flex justify-between items-center text-xs ${
                            matPartId() === String(p.id)
                              ? "bg-accentCyan/20 border-accentCyan text-white"
                              : "bg-white/[0.01] hover:bg-white/[0.04] border-white/5 text-gray-300"
                          }`}
                        >
                          <div>
                            <div class="font-bold text-white">{p.value}</div>
                            <div class="flex items-center gap-2 mt-0.5 text-gray-400 text-[10px]">
                              <span class="font-mono">{p.number || "No SKU"}</span>
                              <span>•</span>
                              <span>{p.package || "No Package"}</span>
                            </div>
                          </div>
                          <Show when={p.category}>
                            <span class="px-2 py-0.5 rounded-full bg-white/5 text-[9px] text-gray-400 uppercase">
                              {p.category.title}
                            </span>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>

              {/* Show Ghost Description input if no part is selected */}
              <Show when={!matPartId()}>
                <div class="bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg space-y-2">
                  <label class="block text-xs font-semibold text-amber-400 uppercase">Ghost Description</label>
                  <input
                    type="text"
                    required
                    value={matGhostDesc()}
                    onInput={(e) => setMatGhostDesc(e.target.value)}
                    placeholder="E.g. 10k Resistor 0603, STM32 MCU, Custom Header..."
                    class="glass-input w-full text-sm text-amber-100"
                  />
                </div>
              </Show>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Reference Designator</label>
                  <input
                    type="text"
                    value={matDesignator()}
                    onInput={(e) => setMatDesignator(e.target.value)}
                    placeholder="E.g. R1, C12, U3"
                    class="glass-input w-full text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Quantity Required</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={matQuantity()}
                    onInput={(e) => setMatQuantity(e.target.value)}
                    placeholder="E.g. 1, 4"
                    class="glass-input w-full text-sm font-semibold"
                  />
                </div>
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

      {/* Map Ghost Material Modal */}
      <Show when={showMapModal()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="glass-panel max-w-lg w-full rounded-2xl p-6 border border-white/10 relative">
            <button 
              onClick={() => {
                setShowMapModal(false);
                setMappingMaterialId(null);
                setMapPartId("");
              }}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 class="text-lg font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <Link class="text-accentCyan" size={20} />
              PartFinder - Map Ghost Material
            </h3>
            
            <form onSubmit={handleMapGhostMaterial} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Search Catalog</label>
                <input
                  type="text"
                  value={mapSearchQuery()}
                  onInput={(e) => setMapSearchQuery(e.target.value)}
                  placeholder="Search by value, SKU, package, or category..."
                  class="glass-input w-full text-sm text-white"
                  autofocus
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">
                  Select Matching Part (Sorted by Relevance)
                </label>
                <div class="max-h-60 overflow-y-auto space-y-1.5 border border-white/5 p-2 rounded-xl bg-black/30">
                  <Show when={getSortedParts().length === 0}>
                    <div class="text-center py-6 text-gray-500 text-xs">No parts match your search.</div>
                  </Show>
                  <For each={getSortedParts()}>
                    {(p) => {
                      return (
                        <div
                          onClick={() => setMapPartId(String(p.id))}
                          class={`p-2.5 rounded-lg border transition-all cursor-pointer flex justify-between items-center text-xs ${
                            mapPartId() === String(p.id)
                              ? "bg-accentCyan/20 border-accentCyan text-white"
                              : "bg-white/[0.01] hover:bg-white/[0.04] border-white/5 text-gray-300"
                          }`}
                        >
                          <div>
                            <div class="font-bold text-white text-sm">{p.value}</div>
                            <div class="flex items-center gap-2 mt-0.5 text-gray-400">
                              <span class="font-mono text-[10px]">{p.number || "No SKU"}</span>
                              <span>•</span>
                              <span>{p.package || "No Package"}</span>
                            </div>
                          </div>
                          <Show when={p.category}>
                            <span class="px-2 py-0.5 rounded-full bg-white/5 text-[9px] text-gray-400 border border-white/5 uppercase">
                              {p.category.title}
                            </span>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>

              <div class="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setShowMapModal(false);
                    setMappingMaterialId(null);
                    setMapPartId("");
                  }}
                  class="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting() || !mapPartId()}
                  class="btn-primary flex-1"
                >
                  {submitting() ? "Mapping..." : "Map Component"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
