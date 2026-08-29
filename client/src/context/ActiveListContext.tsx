import { createSignal, createContext, useContext, onMount } from "solid-js";
import type { JSX } from "solid-js";
import { apiFetch } from "../hooks/useAuth";
import toast from "solid-toast";

interface ActiveListContextType {
  activeList: () => any | null;
  activeListId: () => string | null;
  setActiveListId: (id: string | null) => Promise<void>;
  clearActiveList: () => Promise<void>;
  refreshActiveList: () => Promise<void>;
  drawerExpanded: () => boolean;
  setDrawerExpanded: (val: boolean) => void;
  highlightedPartId: () => string | null;
  highlightPartInDrawer: (partId: string) => void;
}

const ActiveListContext = createContext<ActiveListContextType>();

const LOCAL_STORAGE_KEY = "sidekick_active_list_id";

export function ActiveListProvider(props: { children: JSX.Element }) {
  const [activeListId, setActiveListIdState] = createSignal<string | null>(null);
  const [activeList, setActiveListState] = createSignal<any | null>(null);
  const [drawerExpanded, setDrawerExpanded] = createSignal(false);
  const [highlightedPartId, setHighlightedPartId] = createSignal<string | null>(null);

  let highlightTimer: ReturnType<typeof setTimeout> | null = null;

  const highlightPartInDrawer = (partId: string) => {
    setDrawerExpanded(true);
    setHighlightedPartId(partId);

    setTimeout(() => {
      const el = document.getElementById(`drawer-part-${partId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);

    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      setHighlightedPartId(null);
    }, 10000);
  };

  const fetchActiveListDetails = async (id: string) => {
    try {
      const data = await apiFetch(`/lists/${id}`);
      setActiveListState(data);
      setActiveListIdState(id);
      localStorage.setItem(LOCAL_STORAGE_KEY, id);
    } catch (err: any) {
      console.warn("Failed to fetch active list details:", err);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setActiveListIdState(null);
      setActiveListState(null);
    }
  };

  const setActiveListId = async (id: string | null) => {
    if (!id) {
      await clearActiveList();
      return;
    }
    try {
      // Mark as active in backend
      await apiFetch(`/lists/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true })
      });
      await fetchActiveListDetails(id);
      toast.success("List activated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to set active list.");
    }
  };

  const clearActiveList = async () => {
    const currentId = activeListId();
    if (currentId) {
      try {
        await apiFetch(`/lists/${currentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: false })
        });
      } catch (err) {
        console.warn("Error unsetting active flag on backend:", err);
      }
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setActiveListIdState(null);
    setActiveListState(null);
    toast.success("Active list closed.");
  };

  const refreshActiveList = async () => {
    const currentId = activeListId();
    if (currentId) {
      await fetchActiveListDetails(currentId);
    }
  };

  onMount(async () => {
    const storedId = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedId) {
      await fetchActiveListDetails(storedId);
    } else {
      // Check if backend has an active list
      try {
        const lists = await apiFetch("/lists");
        const active = lists.find((l: any) => l.is_active);
        if (active) {
          await fetchActiveListDetails(active.id);
        }
      } catch (e) {
        // Ignored if unauthenticated on initial mount
      }
    }
  });

  return (
    <ActiveListContext.Provider
      value={{
        activeList,
        activeListId,
        setActiveListId,
        clearActiveList,
        refreshActiveList,
        drawerExpanded,
        setDrawerExpanded,
        highlightedPartId,
        highlightPartInDrawer
      }}
    >
      {props.children}
    </ActiveListContext.Provider>
  );
}

export function useActiveList() {
  const ctx = useContext(ActiveListContext);
  if (!ctx) {
    throw new Error("useActiveList must be used within an ActiveListProvider");
  }
  return ctx;
}
