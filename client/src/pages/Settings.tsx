import { createSignal, onMount, Show, For } from "solid-js";
import { 
  backendUrl, setBackendUrl,
  isDevMode, setIsDevMode,
  oidcIssuer, setOidcIssuer,
  oidcClientId, setOidcClientId,
  user, apiFetch
} from "../hooks/useAuth";
import toast from "solid-toast";
import { 
  Server, 
  Settings as SettingsIcon, 
  UserCheck, 
  Palette, 
  Sun, 
  Moon, 
  Monitor,
  Database,
  Camera,
  RotateCcw,
  Trash2,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRightLeft,
  Printer,
  Wifi,
  Search,
  RefreshCw,
  AlertCircle,
  Zap,
  QrCode,
  Cpu
} from "lucide-solid";
import { useTheme } from "../context/ThemeContext";
import { useDatabase, type SnapshotItem } from "../context/DatabaseContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { getDeviceSetting, setDeviceSetting } from "../services/deviceSettings";
import { printerService, type DiscoveredPrinter } from "../services/printerService";
import type { PrinterStatusResult } from "../services/printerDriver";
import { usbScannerService, type UsbDeviceInfo, type UsbScannerStatusResult } from "../services/usbScannerService";

export default function Settings() {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const { 
    dbMode, 
    activeDbFile, 
    snapshots, 
    hasUnsavedChanges, 
    latestSnapshot,
    recentlyCreatedFilename,
    switchMode, 
    createSnapshot, 
    deleteSnapshot, 
    restoreSnapshot,
    isOperationPending,
    refreshStatus
  } = useDatabase();

  const { confirm } = useConfirm();

  const [localUrl, setLocalUrl] = createSignal(backendUrl());
  const [localDevMode, setLocalDevMode] = createSignal(isDevMode());
  const [localIssuer, setLocalIssuer] = createSignal(oidcIssuer());
  const [localClientId, setLocalClientId] = createSignal(oidcClientId());
  
  const [users, setUsers] = createSignal<any[]>([]);
  const [loadingUsers, setLoadingUsers] = createSignal(false);

  // Modal signal for snapshot restore decision when un-snapshotted changes exist
  const [restoreModalTarget, setRestoreModalTarget] = createSignal<SnapshotItem | null>(null);

  // Printer hardware signals
  const [printerDriverType, setPrinterDriverType] = createSignal<"dymo_esp32" | "browser_native">(getDeviceSetting("printerDriverType"));
  const [printerAddress, setPrinterAddress] = createSignal(getDeviceSetting("printerAddress"));
  const [printerDensity, setPrinterDensity] = createSignal(getDeviceSetting("printerDensity"));
  const [printerSpeed, setPrinterSpeed] = createSignal(getDeviceSetting("printerSpeed"));
  const [printerStatus, setPrinterStatus] = createSignal<PrinterStatusResult | null>(null);
  const [isTestingPrinter, setIsTestingPrinter] = createSignal(false);
  const [isScanningPrinters, setIsScanningPrinters] = createSignal(false);
  const [scanProgress, setScanProgress] = createSignal<{ scanned: number; total: number } | null>(null);
  const [discoveredPrinters, setDiscoveredPrinters] = createSignal<DiscoveredPrinter[]>([]);
  const [showDiscoveryModal, setShowDiscoveryModal] = createSignal(false);

  // USB Barcode Scanner hardware signals
  const [usbEnabled, setUsbEnabled] = createSignal(getDeviceSetting("usbScannerEnabled"));
  const [usbVid, setUsbVid] = createSignal(getDeviceSetting("usbScannerVid"));
  const [usbPid, setUsbPid] = createSignal(getDeviceSetting("usbScannerPid"));
  const [usbStatus, setUsbStatus] = createSignal<UsbScannerStatusResult | null>(null);
  const [usbDevices, setUsbDevices] = createSignal<UsbDeviceInfo[]>([]);
  const [isEnumeratingUsb, setIsEnumeratingUsb] = createSignal(false);
  const [manualUsbEdit, setManualUsbEdit] = createSignal(false);

  const refreshUsbStatus = async () => {
    const status = await usbScannerService.getStatus();
    setUsbStatus(status);
  };

  const handleToggleUsb = async (enabled: boolean) => {
    setUsbEnabled(enabled);
    const status = await usbScannerService.updateConfig(enabled, usbVid(), usbPid());
    setUsbStatus(status);
    if (enabled) {
      toast.success(status.connected ? "USB Scanner connected & active!" : "USB Scanner service enabled. Waiting for device...");
    } else {
      toast("USB Scanner service disabled.");
    }
  };

  const handleEnumerateUsb = async () => {
    setIsEnumeratingUsb(true);
    try {
      const list = await usbScannerService.enumerateUsbDevices();
      setUsbDevices(list);
      if (list.length > 0) {
        toast.success(`Found ${list.length} USB device(s)`);
      } else {
        toast.error("No USB devices detected or desktop app not active.");
      }
    } catch (err: any) {
      toast.error(`USB scan failed: ${err.message || err}`);
    } finally {
      setIsEnumeratingUsb(false);
    }
  };

  const handleSelectUsbDevice = async (device: UsbDeviceInfo) => {
    setUsbVid(device.vid);
    setUsbPid(device.pid);
    const status = await usbScannerService.updateConfig(usbEnabled(), device.vid, device.pid);
    setUsbStatus(status);
    toast.success(`Selected USB device ${device.product || device.vid + '/' + device.pid}`);
  };

  const handleSaveUsbSettings = async () => {
    const status = await usbScannerService.updateConfig(usbEnabled(), usbVid(), usbPid());
    setUsbStatus(status);
    toast.success("USB scanner configuration saved!");
  };

  const fetchUsers = async () => {
    if (user()?.role !== "admin") return;
    setLoadingUsers(true);
    try {
      const data = await apiFetch("/auth/users");
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleTestPrinter = async (targetAddr?: string) => {
    if (printerDriverType() === "browser_native") {
      setPrinterStatus({
        connected: true,
        ready: true,
        paperEmpty: false,
        hasError: false,
        rawStatus: 1,
        statusText: "Browser System Dialog Mode",
        address: "localhost",
      });
      return;
    }

    setIsTestingPrinter(true);
    try {
      const addr = targetAddr || printerAddress();
      const res = await printerService.testAddress(addr);
      setPrinterStatus(res);
      if (res.connected && res.ready) {
        toast.success(`Printer connected & ready at ${res.address}`);
      } else if (res.connected) {
        toast.error(`Printer connected but reported: ${res.statusText}`);
      } else {
        toast.error(`Printer unreachable at ${addr}`);
      }
    } catch (err: any) {
      toast.error(`Printer check failed: ${err.message || err}`);
    } finally {
      setIsTestingPrinter(false);
    }
  };

  const handleScanNetworkPrinters = async () => {
    setIsScanningPrinters(true);
    setScanProgress({ scanned: 0, total: 254 });
    try {
      const result = await printerService.runPrinterDiscovery((scanned, total) => {
        setScanProgress({ scanned, total });
      });

      setDiscoveredPrinters(result.printers);

      if (result.autoSelected) {
        setPrinterAddress(result.autoSelected.address);
        setPrinterDriverType("dymo_esp32");
        setDeviceSetting("printerAddress", result.autoSelected.address);
        setDeviceSetting("printerDriverType", "dymo_esp32");
        toast.success(result.statusMessage);
        handleTestPrinter(result.autoSelected.address);
      } else if (result.printers.length > 1) {
        setShowDiscoveryModal(true);
        toast.success(result.statusMessage);
      } else {
        toast.error(result.statusMessage);
      }
    } catch (err: any) {
      toast.error(`Printer discovery failed: ${err.message || err}`);
    } finally {
      setIsScanningPrinters(false);
      setScanProgress(null);
    }
  };

  const handleSavePrinterSettings = () => {
    setDeviceSetting("printerDriverType", printerDriverType());
    setDeviceSetting("printerAddress", printerAddress());
    setDeviceSetting("printerDensity", printerDensity());
    setDeviceSetting("printerSpeed", printerSpeed());
    toast.success("Printer hardware configurations saved!");
    handleTestPrinter();
  };

  onMount(() => {
    fetchUsers();
    refreshStatus();
    handleTestPrinter();
    refreshUsbStatus();
  });

  const handleSaveConnection = () => {
    setBackendUrl(localUrl());
    setIsDevMode(localDevMode());
    setOidcIssuer(localIssuer());
    setOidcClientId(localClientId());
    toast.success("Connection configurations saved successfully!");
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiFetch(`/auth/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole })
      });
      fetchUsers();
      toast.success("User role updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role.");
    }
  };

  const handleRestoreClick = (snap: SnapshotItem) => {
    if (hasUnsavedChanges()) {
      // Open decision modal to prompt for snapshot creation
      setRestoreModalTarget(snap);
    } else {
      // No unsaved changes, execute restore directly
      confirm({
        title: "Restore Snapshot",
        message: `Are you sure you want to replace your active production database with snapshot '${snap.filename}'?`,
        confirmText: "Restore Snapshot",
        type: "warning"
      }).then((confirmed) => {
        if (confirmed) {
          restoreSnapshot(snap.filename, false);
        }
      });
    }
  };

  const handleDeleteClick = async (snap: SnapshotItem) => {
    const confirmed = await confirm({
      title: "Delete Snapshot",
      message: `Are you sure you want to permanently delete '${snap.filename}' from disk? This action cannot be undone.`,
      confirmText: "Delete File",
      type: "error"
    });

    if (confirmed) {
      deleteSnapshot(snap.filename);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div class="space-y-8 pb-12">
      <div>
        <h2 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <SettingsIcon class="text-accentCyan" />
          Settings
        </h2>
        <p class="text-gray-400 text-sm">Configure system connection, database environments, snapshots, and user access roles.</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ----------------- DATABASE MODE & SNAPSHOT MANAGEMENT CARD ----------------- */}
        <div class="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
          <div class="flex items-center justify-between border-b border-white/5 pb-4">
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
              <Database size={20} class="text-accentCyan" />
              Database Mode & Snapshot Management
            </h3>
            <div class="flex items-center gap-2">
              <span class={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                dbMode() === "testing" 
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}>
                {dbMode() === "testing" ? <FlaskConical size={14} /> : <CheckCircle2 size={14} />}
                Active: <code class="font-mono text-xs">{activeDbFile()}</code> ({dbMode() === "testing" ? "Testing Sandbox" : "Production"})
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Mode Swapping Panel */}
            <div class="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-4">
              <h4 class="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRightLeft size={16} class="text-accentCyan" />
                Database Runtime Environment
              </h4>
              <p class="text-xs text-gray-400 leading-relaxed">
                Switch between your live Production database and an isolated Testing sandbox mode to experiment safely without altering production data.
              </p>

              <div class="space-y-3">
                <div class={`p-3 rounded-xl border flex items-center justify-between ${
                  dbMode() === "prod" 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-white" 
                    : "glass-card border-white/5 text-gray-400"
                }`}>
                  <div>
                    <span class="text-xs font-bold block text-white">Production Mode</span>
                    <span class="text-[11px] font-mono text-gray-400">data/sidekick.db</span>
                  </div>
                  <Show when={dbMode() === "prod"} fallback={
                    <button
                      onClick={() => switchMode("prod")}
                      disabled={isOperationPending()}
                      class="btn-secondary text-xs py-1.5 px-3"
                    >
                      Switch to Prod
                    </button>
                  }>
                    <span class="text-xs bg-emerald-500 text-black px-2 py-0.5 rounded font-extrabold">Active</span>
                  </Show>
                </div>

                <div class={`p-3 rounded-xl border flex items-center justify-between ${
                  dbMode() === "testing" 
                    ? "bg-amber-500/10 border-amber-500/30 text-white" 
                    : "glass-card border-white/5 text-gray-400"
                }`}>
                  <div>
                    <span class="text-xs font-bold block text-white">Testing Sandbox Mode</span>
                    <span class="text-[11px] font-mono text-gray-400">data/sidekick_testing.db</span>
                  </div>
                  <Show when={dbMode() === "testing"} fallback={
                    <div class="flex gap-2">
                      <button
                        onClick={() => switchMode("testing", true)}
                        disabled={isOperationPending()}
                        class="btn-primary text-xs py-1.5 px-3"
                      >
                        Copy Prod & Switch
                      </button>
                      <button
                        onClick={() => switchMode("testing", false)}
                        disabled={isOperationPending()}
                        class="btn-secondary text-xs py-1.5 px-3"
                      >
                        Switch Mode
                      </button>
                    </div>
                  }>
                    <span class="text-xs bg-amber-500 text-black px-2 py-0.5 rounded font-extrabold">Active</span>
                  </Show>
                </div>
              </div>
            </div>

            {/* Snapshot Creator Panel */}
            <div class="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
              <div>
                <h4 class="text-sm font-bold text-white flex items-center gap-2">
                  <Camera size={16} class="text-accentPurple" />
                  Save Database Snapshot
                </h4>
                <p class="text-xs text-gray-400 leading-relaxed mt-1">
                  Flush write-ahead logs and save a complete timestamped copy of your database (<code class="text-accentCyan font-mono">Sidekick_YYYY-MM-DD_HHMMSS.db</code>) to disk as a restore point.
                </p>

                <div class="mt-4 p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-400">Snapshot Status:</span>
                    <Show when={hasUnsavedChanges()} fallback={
                      <span class="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={13} /> Active DB synced with latest snapshot
                      </span>
                    }>
                      <span class="text-amber-400 font-semibold flex items-center gap-1">
                        <AlertTriangle size={13} /> Un-snapshotted changes in active DB
                      </span>
                    </Show>
                  </div>
                  <Show when={latestSnapshot()}>
                    <div class="text-[11px] text-gray-500">
                      Latest: <code class="font-mono text-gray-400">{latestSnapshot()?.filename}</code> ({latestSnapshot()?.created_at})
                    </div>
                  </Show>
                </div>
              </div>

              <button
                onClick={() => createSnapshot()}
                disabled={isOperationPending()}
                class="btn-primary py-3 w-full flex items-center justify-center gap-2"
              >
                <Camera size={16} />
                Save Current DB Snapshot Point
              </button>
            </div>
          </div>

          {/* Snapshots Glob List Table */}
          <div class="space-y-3 pt-2">
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              <Layers size={16} class="text-accentCyan" />
              Available Snapshots on Disk ({snapshots().length})
            </h4>

            <Show when={snapshots().length === 0}>
              <div class="p-8 text-center glass-card border border-white/5 rounded-2xl text-gray-400 text-xs">
                No database snapshot files found in the data directory. Click "Save Current DB Snapshot Point" to create one.
              </div>
            </Show>

            <Show when={snapshots().length > 0}>
              <div class="max-h-[270px] overflow-y-auto overflow-x-auto rounded-xl border border-white/5 custom-scrollbar">
                <table class="w-full text-left border-collapse text-xs">
                  <thead class="sticky top-0 bg-[#0f172a] border-b border-white/10 z-10 shadow-sm">
                    <tr class="text-gray-400 font-semibold uppercase tracking-wider">
                      <th class="py-3 px-4">Snapshot Filename</th>
                      <th class="py-3 px-4">Created Date / Time</th>
                      <th class="py-3 px-4">File Size</th>
                      <th class="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    <For each={snapshots()}>
                      {(snap) => {
                        const isRecentlyCreated = () => snap.filename === recentlyCreatedFilename();
                        return (
                          <tr class={`border-b transition-all duration-700 ${
                            isRecentlyCreated()
                              ? "bg-accentCyan/20 border-l-4 border-l-accentCyan text-white shadow-lg shadow-accentCyan/10 animate-in fade-in slide-in-from-top-3 duration-500"
                              : "border-white/5 hover:bg-white/[0.02]"
                          }`}>
                            <td class="py-3.5 px-4 font-mono font-semibold text-white flex items-center gap-2">
                              <span>{snap.filename}</span>
                              <Show when={isRecentlyCreated()}>
                                <span class="bg-accentCyan text-black font-extrabold text-[10px] uppercase px-1.5 py-0.5 rounded tracking-wide animate-pulse">
                                  NEW
                                </span>
                              </Show>
                            </td>

                          <td class="py-3.5 px-4 text-gray-400">
                            {snap.created_at}
                          </td>
                          <td class="py-3.5 px-4 text-gray-400 font-mono">
                            {formatFileSize(snap.size_bytes)}
                          </td>
                          <td class="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleRestoreClick(snap)}
                              disabled={isOperationPending()}
                              class="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1 hover:border-accentCyan/50"
                              title="Restore snapshot into production database"
                            >
                              <RotateCcw size={13} class="text-accentCyan" />
                              Restore
                            </button>
                            <button
                              onClick={() => handleDeleteClick(snap)}
                              disabled={isOperationPending()}
                              class="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer inline-flex items-center"
                              title="Delete snapshot file"
                            >
                              <Trash2 size={13} />
                            </button>
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
        </div>

        {/* ----------------- HARDWARE PRINTER SETTINGS CARD ----------------- */}
        <div class="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
          <div class="flex items-center justify-between border-b border-white/5 pb-4">
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
              <Printer size={20} class="text-accentCyan" />
              Hardware Printer Integration & Network Discovery
            </h3>
            <Show when={printerStatus()}>
              <span class={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                printerStatus()?.ready
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : printerStatus()?.paperEmpty
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-red-500/20 text-red-300 border-red-500/30"
              }`}>
                <Show when={printerStatus()?.ready} fallback={<AlertCircle size={13} />}>
                  <CheckCircle2 size={13} />
                </Show>
                {printerStatus()?.statusText}
              </span>
            </Show>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Driver & Connection Setup */}
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Printer Driver Engine</label>
                <div class="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPrinterDriverType("dymo_esp32");
                      setDeviceSetting("printerDriverType", "dymo_esp32");
                      handleTestPrinter();
                    }}
                    class={`p-3 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                      printerDriverType() === "dymo_esp32"
                        ? "bg-accentCyan/15 border-accentCyan text-white shadow-lg shadow-accentCyan/10"
                        : "glass-card border-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Wifi size={18} class={printerDriverType() === "dymo_esp32" ? "text-accentCyan" : ""} />
                    <div>
                      <span class="text-xs font-bold block">Dymo ESP32</span>
                      <span class="text-[10px] text-gray-400">Direct Network HTTP</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrinterDriverType("browser_native");
                      setDeviceSetting("printerDriverType", "browser_native");
                      handleTestPrinter();
                    }}
                    class={`p-3 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                      printerDriverType() === "browser_native"
                        ? "bg-accentCyan/15 border-accentCyan text-white shadow-lg shadow-accentCyan/10"
                        : "glass-card border-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Printer size={18} class={printerDriverType() === "browser_native" ? "text-accentPurple" : ""} />
                    <div>
                      <span class="text-xs font-bold block">System Print</span>
                      <span class="text-[10px] text-gray-400">Browser Print Dialog</span>
                    </div>
                  </button>
                </div>
              </div>

              <Show when={printerDriverType() === "dymo_esp32"}>
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">
                      Printer Address / IP (mDNS Hostname or IPv4)
                    </label>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        value={printerAddress()}
                        onInput={(e) => setPrinterAddress(e.target.value)}
                        placeholder="dymo-printer.local or 192.168.1.120"
                        class="glass-input flex-1 text-sm font-mono"
                      />
                      <button
                        onClick={() => handleTestPrinter()}
                        disabled={isTestingPrinter()}
                        class="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 whitespace-nowrap"
                        title="Ping printer status endpoint"
                      >
                        <Show when={isTestingPrinter()} fallback={<Zap size={14} class="text-accentCyan" />}>
                          <RefreshCw size={14} class="animate-spin text-accentCyan" />
                        </Show>
                        Test
                      </button>
                    </div>
                  </div>

                  {/* Network Discovery Button */}
                  <div class="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="text-xs font-semibold text-white block">WiFi Subnet Scanner</span>
                        <span class="text-[11px] text-gray-400">Auto-discover Dymo ESP32 printers on network</span>
                      </div>
                      <button
                        onClick={handleScanNetworkPrinters}
                        disabled={isScanningPrinters()}
                        class="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                      >
                        <Show when={isScanningPrinters()} fallback={<Search size={14} />}>
                          <RefreshCw size={14} class="animate-spin" />
                        </Show>
                        {isScanningPrinters() ? "Scanning..." : "Scan Network"}
                      </button>
                    </div>

                    <Show when={scanProgress()}>
                      <div class="space-y-1">
                        <div class="flex justify-between text-[10px] text-gray-400">
                          <span>Probing LAN subnets...</span>
                          <span>{scanProgress()?.scanned} / {scanProgress()?.total}</span>
                        </div>
                        <div class="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div
                            class="bg-accentCyan h-full transition-all duration-200"
                            style={{ width: `${((scanProgress()?.scanned || 0) / (scanProgress()?.total || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>

            {/* Print Hardware Tuning */}
            <Show when={printerDriverType() === "dymo_esp32"}>
              <div class="space-y-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                <div class="space-y-4">
                  <h4 class="text-xs font-bold text-white uppercase tracking-wider">Hardware Fine-Tuning</h4>
                  <div>
                    <label class="block text-xs font-semibold text-gray-400 mb-1.5">Print Density / Shade</label>
                    <select
                      value={printerDensity()}
                      onChange={(e) => setPrinterDensity(e.currentTarget.value as any)}
                      class="glass-input w-full text-xs"
                    >
                      <option value="dark">Dark (Recommended for DataMatrix barcodes)</option>
                      <option value="normal">Normal</option>
                      <option value="medium">Medium</option>
                      <option value="light">Light</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-gray-400 mb-1.5">Print Speed</label>
                    <select
                      value={printerSpeed()}
                      onChange={(e) => setPrinterSpeed(e.currentTarget.value as any)}
                      class="glass-input w-full text-xs"
                    >
                      <option value="graphics">Graphics Mode (High Detail)</option>
                      <option value="text">Text Mode (Fast)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSavePrinterSettings}
                  class="btn-primary py-2.5 w-full text-xs font-bold"
                >
                  Save Printer Configurations
                </button>
              </div>
            </Show>
          </div>
        </div>

        {/* ----------------- DESKTOP USB BARCODE SCANNER SETTINGS CARD ----------------- */}
        <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
          <div class="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
              <QrCode size={18} class="text-accentCyan" />
              Desktop USB Barcode Scanner (WinUSB)
            </h3>

            <Show when={usbStatus()}>
              <span class={`text-xs px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                usbStatus()?.connected
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : usbStatus()?.enabled
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-gray-500/20 text-gray-400 border-gray-500/30"
              }`}>
                <Show when={usbStatus()?.connected} fallback={usbStatus()?.enabled ? <AlertCircle size={13} /> : <AlertTriangle size={13} />}>
                  <CheckCircle2 size={13} />
                </Show>
                {usbStatus()?.connected
                  ? `Connected (${usbStatus()?.device_name})`
                  : usbStatus()?.enabled
                  ? "Enabled — Waiting for Scanner..."
                  : "Service Disabled"}
              </span>
            </Show>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div class="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl">
                <div>
                  <span class="text-xs font-bold text-white block">Background USB Monitoring</span>
                  <span class="text-[11px] text-gray-400">Intercept raw WinUSB scans across all screens</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleUsb(!usbEnabled())}
                  class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    usbEnabled() ? "bg-accentCyan" : "bg-white/10"
                  }`}
                >
                  <span
                    class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      usbEnabled() ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* USB Device Picker Section */}
              <div class="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-xs font-semibold text-white block">Attached USB Device Picker</span>
                    <span class="text-[11px] text-gray-400">Enumerate hardware connected to desktop PC</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnumerateUsb}
                    disabled={isEnumeratingUsb()}
                    class="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <Show when={isEnumeratingUsb()} fallback={<Search size={14} />}>
                      <RefreshCw size={14} class="animate-spin" />
                    </Show>
                    {isEnumeratingUsb() ? "Scanning..." : "Scan for Devices"}
                  </button>
                </div>

                <Show when={usbDevices().length > 0}>
                  <div class="space-y-1.5">
                    <label class="block text-[11px] font-semibold text-gray-400 uppercase">Select Target Scanner</label>
                    <select
                      class="glass-input w-full text-xs font-mono"
                      onChange={(e) => {
                        const idx = parseInt(e.target.value);
                        if (!isNaN(idx) && usbDevices()[idx]) {
                          handleSelectUsbDevice(usbDevices()[idx]);
                        }
                      }}
                    >
                      <option value="">-- Select connected USB device --</option>
                      <For each={usbDevices()}>
                        {(dev, index) => (
                          <option value={index()}>
                            {dev.product ? `${dev.product} (${dev.manufacturer || "USB"})` : "USB Device"} [{dev.vid}:{dev.pid}]
                          </option>
                        )}
                      </For>
                    </select>
                  </div>
                </Show>
              </div>
            </div>

            {/* Manual Hex Override Section */}
            <div class="space-y-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-bold text-white uppercase tracking-wider">Device Identifiers (VID / PID)</h4>
                  <button
                    type="button"
                    onClick={() => setManualUsbEdit(!manualUsbEdit())}
                    class="text-[11px] text-accentCyan hover:underline cursor-pointer"
                  >
                    {manualUsbEdit() ? "Hide Manual Edit" : "Manual Edit"}
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-semibold text-gray-400 mb-1 uppercase">Vendor ID (VID)</label>
                    <input
                      type="text"
                      value={usbVid()}
                      onInput={(e) => setUsbVid(e.target.value)}
                      disabled={!manualUsbEdit()}
                      placeholder="0x0581"
                      class="glass-input w-full text-xs font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-gray-400 mb-1 uppercase">Product ID (PID)</label>
                    <input
                      type="text"
                      value={usbPid()}
                      onInput={(e) => setUsbPid(e.target.value)}
                      disabled={!manualUsbEdit()}
                      placeholder="0x011C"
                      class="glass-input w-full text-xs font-mono disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveUsbSettings}
                class="btn-primary py-2.5 w-full text-xs font-bold"
              >
                Save USB Scanner Configurations
              </button>
            </div>
          </div>
        </div>

        {/* ----------------- APPEARANCE & THEME SETTINGS CARD ----------------- */}
        <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
          <h3 class="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Palette size={18} class="text-accentCyan" />
            Appearance & Theme Settings
          </h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Color Theme Preference</label>
              
              <div class="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  class={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    theme() === "dark"
                      ? "bg-accentCyan/15 border-accentCyan text-white shadow-lg shadow-accentCyan/10"
                      : "glass-card border-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  <Moon size={20} class={theme() === "dark" ? "text-accentCyan" : ""} />
                  <span class="text-xs font-semibold">Dark</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  class={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    theme() === "light"
                      ? "bg-accentCyan/15 border-accentCyan text-white shadow-lg shadow-accentCyan/10"
                      : "glass-card border-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  <Sun size={20} class={theme() === "light" ? "text-amber-400" : ""} />
                  <span class="text-xs font-semibold">Light</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  class={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    theme() === "system"
                      ? "bg-accentCyan/15 border-accentCyan text-white shadow-lg shadow-accentCyan/10"
                      : "glass-card border-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  <Monitor size={20} class={theme() === "system" ? "text-accentPurple" : ""} />
                  <span class="text-xs font-semibold">System</span>
                </button>
              </div>
            </div>

            <div class="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-gray-400 space-y-1">
              <div class="flex items-center justify-between text-white font-medium">
                <span>Active Effective Theme:</span>
                <span class="capitalize font-bold text-accentCyan">{effectiveTheme()} Mode</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* ----------------- CONNECTION SETTINGS CARD ----------------- */}
        <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
          <h3 class="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Server size={18} class="text-accentCyan" />
            Server & Connection Settings
          </h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Backend Server URL</label>
              <input
                type="text"
                value={localUrl()}
                onInput={(e) => setLocalUrl(e.target.value)}
                class="glass-input w-full text-sm"
                placeholder="http://localhost:8000"
              />
            </div>

            <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
              <div>
                <span class="text-sm font-semibold text-white block">Developer Sandbox Mode</span>
                <span class="text-xs text-gray-400 block mt-0.5">Bypass OIDC server and use mock roles</span>
              </div>
              <input
                type="checkbox"
                checked={localDevMode()}
                onChange={(e) => setLocalDevMode(e.currentTarget.checked)}
                class="w-5 h-5 accent-accentCyan rounded cursor-pointer"
              />
            </div>

            <Show when={!localDevMode()}>
              <div class="space-y-4 border-t border-white/5 pt-4">
                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">OIDC Issuer URL</label>
                  <input
                    type="text"
                    value={localIssuer()}
                    onInput={(e) => setLocalIssuer(e.target.value)}
                    class="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">OIDC Client ID</label>
                  <input
                    type="text"
                    value={localClientId()}
                    onInput={(e) => setLocalClientId(e.target.value)}
                    class="glass-input w-full text-sm"
                  />
                </div>
              </div>
            </Show>

            <button
              onClick={handleSaveConnection}
              class="btn-primary w-full"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* ----------------- ADMIN PANEL: USER ROLE MANAGEMENTS ----------------- */}
        <Show when={user()?.role === "admin"}>
          <div class="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
            <h3 class="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
              <UserCheck size={18} class="text-accentCyan" />
              User Access & Role Management Panel (Admin Only)
            </h3>
            
            <Show when={loadingUsers()}>
              <div class="space-y-2 py-4">
                <div class="h-10 bg-white/5 rounded-lg animate-pulse"></div>
                <div class="h-10 bg-white/5 rounded-lg animate-pulse"></div>
              </div>
            </Show>
            
            <Show when={!loadingUsers() && users().length > 0}>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr class="border-b border-white/10 text-gray-400 font-semibold text-xs uppercase">
                      <th class="py-3 px-4">Username</th>
                      <th class="py-3 px-4">Email</th>
                      <th class="py-3 px-4">OIDC Subject ID</th>
                      <th class="py-3 px-4">Current App Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={users()}>
                      {(u) => (
                        <tr class="border-b border-white/5 hover:bg-white/[0.01]">
                          <td class="py-3.5 px-4 font-medium text-white">{u.username || "N/A"}</td>
                          <td class="py-3.5 px-4 text-gray-400">{u.email || "N/A"}</td>
                          <td class="py-3.5 px-4 font-mono text-xs text-gray-500 truncate max-w-[150px]">{u.oidc_sub}</td>
                          <td class="py-3.5 px-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.currentTarget.value)}
                              disabled={u.id === user()?.id}
                              class="glass-input py-1.5 px-3 text-xs w-36"
                            >
                              <option value="admin">Admin</option>
                              <option value="designer">Designer</option>
                              <option value="stocker">Stocker</option>
                              <option value="puller">Puller</option>
                              <option value="analyst">Analyst</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* ----------------- RESTORE DECISION MODAL ----------------- */}
      <Show when={restoreModalTarget()}>
        <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="glass-panel max-w-lg w-full p-6 rounded-2xl border border-white/10 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div class="flex items-start gap-3">
              <div class="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 class="text-base font-bold text-white">Un-snapshotted Changes Detected</h3>
                <p class="text-xs text-gray-300 mt-1 leading-relaxed">
                  Your active database has modified data since the last snapshot was taken. Would you like to create a snapshot of your active database before restoring <code class="text-accentCyan font-mono">{restoreModalTarget()?.filename}</code>?
                </p>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row justify-end gap-2.5 border-t border-white/5 pt-4">
              <button
                onClick={() => setRestoreModalTarget(null)}
                class="btn-secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const target = restoreModalTarget()!;
                  setRestoreModalTarget(null);
                  restoreSnapshot(target.filename, false);
                }}
                class="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs py-2 px-4 rounded-xl border border-white/15 cursor-pointer"
              >
                Restore Without Saving
              </button>
              <button
                onClick={() => {
                  const target = restoreModalTarget()!;
                  setRestoreModalTarget(null);
                  restoreSnapshot(target.filename, true);
                }}
                class="btn-primary text-xs py-2 px-4"
              >
                Save Snapshot & Restore
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* ----------------- MULTI-PRINTER DISCOVERY SELECTION MODAL ----------------- */}
      <Show when={showDiscoveryModal()}>
        <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="glass-panel max-w-md w-full p-6 rounded-2xl border border-white/10 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div class="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <Printer class="text-accentCyan" size={20} />
                Select Target Dymo Printer
              </h3>
              <button
                onClick={() => setShowDiscoveryModal(false)}
                class="text-gray-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p class="text-xs text-gray-300">
              Multiple Dymo ESP32 print servers were found on your WiFi network. Select the printer you want to connect to:
            </p>

            <div class="space-y-2.5 max-h-60 overflow-y-auto">
              <For each={discoveredPrinters()}>
                {(p) => (
                  <button
                    type="button"
                    onClick={() => {
                      setPrinterAddress(p.address);
                      setPrinterDriverType("dymo_esp32");
                      setDeviceSetting("printerAddress", p.address);
                      setDeviceSetting("printerDriverType", "dymo_esp32");
                      setShowDiscoveryModal(false);
                      toast.success(`Selected printer at ${p.address}`);
                      handleTestPrinter(p.address);
                    }}
                    class={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      printerAddress() === p.address
                        ? "bg-accentCyan/20 border-accentCyan text-white"
                        : "glass-card border-white/5 hover:border-white/20 text-gray-300 hover:text-white"
                    }`}
                  >
                    <div>
                      <span class="text-xs font-bold block text-white">{p.name}</span>
                      <span class="text-[11px] font-mono text-gray-400">{p.address}</span>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                      {p.status.statusText}
                    </span>
                  </button>
                )}
              </For>
            </div>

            <div class="flex justify-end pt-2">
              <button
                onClick={() => setShowDiscoveryModal(false)}
                class="btn-secondary text-xs py-2 px-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
