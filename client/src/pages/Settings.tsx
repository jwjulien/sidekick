import { createSignal, onMount, Show, For } from "solid-js";
import { 
  backendUrl, setBackendUrl,
  isDevMode, setIsDevMode,
  oidcIssuer, setOidcIssuer,
  oidcClientId, setOidcClientId,
  user, apiFetch
} from "../hooks/useAuth";
import toast from "solid-toast";
import { Server, Settings as SettingsIcon, RefreshCw, UserCheck, Palette, Sun, Moon, Monitor } from "lucide-solid";
import { useTheme } from "../context/ThemeContext";

export default function Settings() {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const [localUrl, setLocalUrl] = createSignal(backendUrl());
  const [localDevMode, setLocalDevMode] = createSignal(isDevMode());
  const [localIssuer, setLocalIssuer] = createSignal(oidcIssuer());
  const [localClientId, setLocalClientId] = createSignal(oidcClientId());
  
  const [seeding, setSeeding] = createSignal(false);
  const [savingReference, setSavingReference] = createSignal(false);
  const [seedResult, setSeedResult] = createSignal<string | null>(null);
  
  const [users, setUsers] = createSignal<any[]>([]);
  const [loadingUsers, setLoadingUsers] = createSignal(false);

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

  onMount(() => {
    fetchUsers();
  });

  const handleSaveConnection = () => {
    setBackendUrl(localUrl());
    setIsDevMode(localDevMode());
    setOidcIssuer(localIssuer());
    setOidcClientId(localClientId());
    toast.success("Connection configurations saved successfully! Please refresh or re-login if you modified modes.");
  };

  const handleRestoreReferenceDatabase = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await apiFetch("/dev/seed?mode=reference", { method: "POST" });
      setSeedResult(res.message || "Reference database restored successfully!");
      toast.success("Reference database restored successfully!");
      fetchUsers();
    } catch (err: any) {
      setSeedResult(`Error: ${err.message}`);
      toast.error(`Restoration failed: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveCurrentAsReference = async () => {
    setSavingReference(true);
    setSeedResult(null);
    try {
      const res = await apiFetch("/dev/seed/save-reference", { method: "POST" });
      setSeedResult(res.message || "Reference seed dataset updated!");
      toast.success("Current database captured as reference seed dataset!");
    } catch (err: any) {
      setSeedResult(`Error: ${err.message}`);
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSavingReference(false);
    }
  };

  const handleSeedMockDatabase = async () => {
    if (!confirm("Are you sure you want to replace your database with synthetic 3-part test data?")) return;
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await apiFetch("/dev/seed?mode=mock", { method: "POST" });
      setSeedResult(res.message || "Synthetic mock seeding complete!");
      toast.success("Synthetic mock data seeded.");
      fetchUsers();
    } catch (err: any) {
      setSeedResult(`Error: ${err.message}`);
      toast.error(`Seeding failed: ${err.message}`);
    } finally {
      setSeeding(false);
    }
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

  return (
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <SettingsIcon class="text-accentCyan" />
          Settings
        </h2>
        <p class="text-gray-400 text-sm">Configure system connections, sandbox databases, and roles.</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ----------------- APPEARANCE & THEME SETTINGS CARD ----------------- */}
        <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
          <h3 class="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Palette size={18} class="text-accentCyan" />
            Appearance & Theme Settings
          </h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">Color Theme Preference</label>
              <p class="text-xs text-gray-400 mb-3">
                Saved locally on this device in browser storage (<code class="text-accentCyan">localStorage</code>).
              </p>
              
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
              <p class="text-[11px] text-gray-500">
                {theme() === "system" 
                  ? "Automatically mirroring OS light/dark preferences via window.matchMedia." 
                  : "Explicit local device override active."}
              </p>
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
              <p class="text-[10px] text-gray-500 mt-1">
                The local HTTP API address of your self-hosted FastAPI server.
              </p>
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
                    placeholder="https://auth.example.com/realms/sidekick"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">OIDC Client ID</label>
                  <input
                    type="text"
                    value={localClientId()}
                    onInput={(e) => setLocalClientId(e.target.value)}
                    class="glass-input w-full text-sm"
                    placeholder="sidekick-client"
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

        {/* ----------------- DATA SEEDING CARD (DEV ONLY) ----------------- */}
        <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-6">
          <h3 class="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <RefreshCw size={18} class="text-accentPurple" />
            Database Reference & Seeding Utilities
          </h3>
          
          <div class="space-y-4">
            <p class="text-gray-400 text-sm leading-relaxed">
              Manage your reference dataset snapshots and sandbox environments.
            </p>
            
            <Show when={seedResult()}>
              <div class={`text-xs p-4 rounded-xl border ${
                seedResult()?.startsWith("Error") 
                  ? "bg-red-500/10 border-red-500/20 text-red-400" 
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              }`}>
                {seedResult()}
              </div>
            </Show>

            <div class="space-y-3">
              <button
                onClick={handleRestoreReferenceDatabase}
                disabled={seeding() || savingReference()}
                class="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                <RefreshCw size={16} class={seeding() ? "animate-spin" : ""} />
                {seeding() ? "Restoring..." : "Restore Full Reference Database"}
              </button>

              <button
                onClick={handleSaveCurrentAsReference}
                disabled={seeding() || savingReference()}
                class="btn-secondary w-full flex items-center justify-center gap-2 py-2.5 text-xs"
              >
                <RefreshCw size={14} class={savingReference() ? "animate-spin" : ""} />
                {savingReference() ? "Saving Snapshot..." : "Save Current Database as New Reference"}
              </button>
            </div>

            <div class="border-t border-white/5 pt-3">
              <button
                onClick={handleSeedMockDatabase}
                disabled={seeding() || savingReference()}
                class="text-xs text-gray-400 hover:text-red-400 underline transition-colors block mx-auto text-center"
              >
                Seed Minimal Synthetic Mock Data
              </button>
            </div>
            
            <p class="text-[10px] text-gray-500">
              💡 NOTE: Automatic migrations upgrade your active database in-place. Restoring from reference snapshot resets active data to your master dataset.
            </p>
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
    </div>
  );
}
