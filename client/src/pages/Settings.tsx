import { createSignal, createEffect, onMount, Show, For } from "solid-js";
import { 
  backendUrl, setBackendUrl,
  isDevMode, setIsDevMode,
  oidcIssuer, setOidcIssuer,
  oidcClientId, setOidcClientId,
  user, apiFetch
} from "../hooks/useAuth";
import toast from "solid-toast";
import { Server, Settings as SettingsIcon, ShieldCheck, RefreshCw, UserCheck } from "lucide-solid";

export default function Settings() {
  const [localUrl, setLocalUrl] = createSignal(backendUrl());
  const [localDevMode, setLocalDevMode] = createSignal(isDevMode());
  const [localIssuer, setLocalIssuer] = createSignal(oidcIssuer());
  const [localClientId, setLocalClientId] = createSignal(oidcClientId());
  
  const [seeding, setSeeding] = createSignal(false);
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

  const handleSeedDatabase = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await apiFetch("/dev/seed", { method: "POST" });
      setSeedResult(res.message || "Seeding complete!");
      fetchUsers();
    } catch (err: any) {
      setSeedResult(`Error: ${err.message}`);
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
            Sandbox Seeding Utility
          </h3>
          
          <div class="space-y-4">
            <p class="text-gray-400 text-sm leading-relaxed">
              If running in Developer Sandbox mode, you can recreate database tables and inject a mock set of categories, nested locations, custom fields, items, and log records.
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
            
            <button
              onClick={handleSeedDatabase}
              disabled={seeding()}
              class="btn-accent w-full flex items-center justify-center gap-2 py-3"
            >
              <RefreshCw size={16} class={seeding() ? "animate-spin" : ""} />
              {seeding() ? "Resetting and Seeding..." : "Reset and Seed Mock Database"}
            </button>
            <p class="text-[10px] text-gray-500">
              ⚠️ WARNING: Seeding deletes all current tables in SQLite and creates fresh mock entries.
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
