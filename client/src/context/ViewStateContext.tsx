import { createContext, useContext, createSignal } from "solid-js";
import type { JSX } from "solid-js";

export interface PartsFilterState {
  search: string;
  selectedCat: string;
  filterLowStock: boolean;
  viewMode: "table" | "grid" | "picker";
  sortField: string;
  sortOrder: "asc" | "desc";
  lastViewedPartId: string | null;
  lastViewedPartName: string | null;
}

export interface ProjectsSelectionState {
  selectedProjectId: number | null;
  selectedAssemblyId: number | null;
  selectedRevisionId: number | null;
}

export interface DesignState {
  activeTab: "categories" | "tares";
  expandedCategoryIds: string[];
}

export interface StorageState {
  activePath: string[];
}

export interface ViewStateContextType {
  // Storage
  storagePath: () => string[];
  setStoragePath: (path: string[]) => void;

  // Parts Catalog
  partsState: () => PartsFilterState;
  setPartsState: (updater: Partial<PartsFilterState> | ((prev: PartsFilterState) => PartsFilterState)) => void;

  // Projects
  projectsState: () => ProjectsSelectionState;
  setProjectsState: (updater: Partial<ProjectsSelectionState> | ((prev: ProjectsSelectionState) => ProjectsSelectionState)) => void;

  // Design
  designState: () => DesignState;
  setDesignState: (updater: Partial<DesignState> | ((prev: DesignState) => DesignState)) => void;
}

const ViewStateContext = createContext<ViewStateContextType>();

export function ViewStateProvider(props: { children: JSX.Element }) {
  // 1. Storage Location active path
  const [storagePath, setStoragePathSignal] = createSignal<string[]>([]);

  // 2. Parts Catalog filters & sort
  const [partsState, setPartsStateSignal] = createSignal<PartsFilterState>({
    search: "",
    selectedCat: "",
    filterLowStock: false,
    viewMode: "table",
    sortField: "value",
    sortOrder: "asc",
    lastViewedPartId: null,
    lastViewedPartName: null,
  });

  // 3. PCB Projects selection
  const [projectsState, setProjectsStateSignal] = createSignal<ProjectsSelectionState>({
    selectedProjectId: null,
    selectedAssemblyId: null,
    selectedRevisionId: null,
  });

  // 4. Design Structure tab & expanded nodes
  const [designState, setDesignStateSignal] = createSignal<DesignState>({
    activeTab: "categories",
    expandedCategoryIds: [],
  });

  const setStoragePath = (path: string[]) => {
    setStoragePathSignal(path);
  };

  const setPartsState = (
    updater: Partial<PartsFilterState> | ((prev: PartsFilterState) => PartsFilterState)
  ) => {
    if (typeof updater === "function") {
      setPartsStateSignal(updater);
    } else {
      setPartsStateSignal((prev) => ({ ...prev, ...updater }));
    }
  };

  const setProjectsState = (
    updater: Partial<ProjectsSelectionState> | ((prev: ProjectsSelectionState) => ProjectsSelectionState)
  ) => {
    if (typeof updater === "function") {
      setProjectsStateSignal(updater);
    } else {
      setProjectsStateSignal((prev) => ({ ...prev, ...updater }));
    }
  };

  const setDesignState = (
    updater: Partial<DesignState> | ((prev: DesignState) => DesignState)
  ) => {
    if (typeof updater === "function") {
      setDesignStateSignal(updater);
    } else {
      setDesignStateSignal((prev) => ({ ...prev, ...updater }));
    }
  };

  return (
    <ViewStateContext.Provider
      value={{
        storagePath,
        setStoragePath,
        partsState,
        setPartsState,
        projectsState,
        setProjectsState,
        designState,
        setDesignState,
      }}
    >
      {props.children}
    </ViewStateContext.Provider>
  );
}

export function useViewState() {
  const ctx = useContext(ViewStateContext);
  if (!ctx) {
    throw new Error("useViewState must be used within a ViewStateProvider");
  }
  return ctx;
}
