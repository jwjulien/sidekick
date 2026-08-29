import { createSignal, createContext, useContext, onMount, createEffect, type ParentProps } from "solid-js";
import { apiFetch } from "../hooks/useAuth";
import toast from "solid-toast";

export interface SnapshotItem {
  filename: string;
  filepath: string;
  created_at: string;
  mtime: number;
  size_bytes: number;
  hash: string | null;
}

export interface DbStatusResponse {
  active_mode: "prod" | "testing";
  active_db_file: string;
  active_db_path: string;
  active_db_hash: string | null;
  latest_snapshot: SnapshotItem | null;
  has_changes_since_snapshot: boolean;
}

interface DatabaseContextValue {
  dbMode: () => "prod" | "testing";
  activeDbFile: () => string;
  isOperationPending: () => boolean;
  pendingMessage: () => string;
  snapshots: () => SnapshotItem[];
  hasUnsavedChanges: () => boolean;
  latestSnapshot: () => SnapshotItem | null;
  refreshStatus: () => Promise<void>;
  switchMode: (mode: "prod" | "testing", copyProdToTesting?: boolean) => Promise<boolean>;
  createSnapshot: () => Promise<SnapshotItem | null>;
  deleteSnapshot: (filename: string) => Promise<boolean>;
  restoreSnapshot: (filename: string, createSnapshotFirst?: boolean) => Promise<boolean>;
}

const DatabaseContext = createContext<DatabaseContextValue>();

export function DatabaseProvider(props: ParentProps) {
  const [dbMode, setDbMode] = createSignal<"prod" | "testing">(
    (localStorage.getItem("sidekick_db_mode") as "prod" | "testing") || "prod"
  );
  const [activeDbFile, setActiveDbFile] = createSignal<string>("sidekick.db");
  const [isOperationPending, setIsOperationPending] = createSignal<boolean>(false);
  const [pendingMessage, setPendingMessage] = createSignal<string>("");
  const [snapshots, setSnapshots] = createSignal<SnapshotItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal<boolean>(false);
  const [latestSnapshot, setLatestSnapshot] = createSignal<SnapshotItem | null>(null);

  // Sync mode signal to localStorage for apiFetch header
  createEffect(() => {
    localStorage.setItem("sidekick_db_mode", dbMode());
  });

  const refreshStatus = async () => {
    try {
      const statusData: DbStatusResponse = await apiFetch("/system/db/status");
      setDbMode(statusData.active_mode);
      setActiveDbFile(statusData.active_db_file);
      setHasUnsavedChanges(statusData.has_changes_since_snapshot);
      setLatestSnapshot(statusData.latest_snapshot);
    } catch (err) {
      console.error("Failed to fetch DB status:", err);
    }

    try {
      const snapData: SnapshotItem[] = await apiFetch("/system/db/snapshots");
      setSnapshots(snapData);
    } catch (err) {
      console.error("Failed to fetch snapshots:", err);
    }
  };

  onMount(() => {
    refreshStatus();
  });

  const switchMode = async (mode: "prod" | "testing", copyProdToTesting = false): Promise<boolean> => {
    setIsOperationPending(true);
    setPendingMessage(
      mode === "testing" 
        ? (copyProdToTesting ? "Copying production data & switching to Testing Sandbox..." : "Mounting Testing Sandbox database & running migrations...")
        : "Switching to Production database & running migrations..."
    );

    try {
      const res = await apiFetch("/system/db/mode", {
        method: "POST",
        body: JSON.stringify({ mode, copy_prod_to_testing: copyProdToTesting })
      });
      setDbMode(res.active_mode);
      setActiveDbFile(res.active_db_file);
      toast.success(res.message || `Switched to ${mode === "testing" ? "Testing Sandbox" : "Production"} mode.`);
      await refreshStatus();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to switch database mode.");
      return false;
    } finally {
      setIsOperationPending(false);
      setPendingMessage("");
    }
  };

  const createSnapshot = async (): Promise<SnapshotItem | null> => {
    setIsOperationPending(true);
    setPendingMessage("Flushing database & creating snapshot file...");

    try {
      const res = await apiFetch("/system/db/snapshots", { method: "POST" });
      toast.success(res.message || "Snapshot created successfully!");
      await refreshStatus();
      return res.snapshot;
    } catch (err: any) {
      toast.error(err.message || "Failed to create database snapshot.");
      return null;
    } finally {
      setIsOperationPending(false);
      setPendingMessage("");
    }
  };

  const deleteSnapshot = async (filename: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/system/db/snapshots/${encodeURIComponent(filename)}`, { method: "DELETE" });
      toast.success(res.message || `Snapshot ${filename} deleted.`);
      await refreshStatus();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to delete snapshot.");
      return false;
    }
  };

  const restoreSnapshot = async (filename: string, createSnapshotFirst = false): Promise<boolean> => {
    setIsOperationPending(true);
    setPendingMessage(
      createSnapshotFirst
        ? `Saving safety snapshot & restoring ${filename}...`
        : `Restoring database snapshot '${filename}' & running migrations...`
    );

    try {
      const res = await apiFetch(`/system/db/snapshots/${encodeURIComponent(filename)}/restore`, {
        method: "POST",
        body: JSON.stringify({ create_snapshot_first: createSnapshotFirst })
      });
      setDbMode(res.active_mode);
      setActiveDbFile(res.active_db_file);
      toast.success(res.message || "Database snapshot restored successfully!");
      await refreshStatus();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to restore snapshot.");
      return false;
    } finally {
      setIsOperationPending(false);
      setPendingMessage("");
    }
  };

  return (
    <DatabaseContext.Provider value={{
      dbMode,
      activeDbFile,
      isOperationPending,
      pendingMessage,
      snapshots,
      hasUnsavedChanges,
      latestSnapshot,
      refreshStatus,
      switchMode,
      createSnapshot,
      deleteSnapshot,
      restoreSnapshot
    }}>
      {props.children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}
