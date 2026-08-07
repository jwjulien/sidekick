import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { 
  isDevMode, setIsDevMode,
  oidcIssuer, setOidcIssuer,
  oidcClientId, setOidcClientId,
  loginDev, loginOidc
} from "../hooks/useAuth";
import { KeyRound, ShieldAlert, Sparkles, Server } from "lucide-solid";

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);
  const [showConfig, setShowConfig] = createSignal(false);

  const handleDevLogin = async (role: string) => {
    try {
      setError(null);
      await loginDev(role);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed mock login.");
    }
  };

  const handleOidcLogin = async () => {
    try {
      setError(null);
      if (!oidcIssuer()) {
        setError("OIDC Issuer URL is required. Please set it in Configuration.");
        return;
      }
      await loginOidc();
    } catch (err: any) {
      setError(err.message || "OIDC redirect initialization failed.");
    }
  };

  const devRoles = [
    { role: "admin", desc: "Full permissions, configurations" },
    { role: "designer", desc: "Define fields, categories, locations" },
    { role: "stocker", desc: "Check-in stock, manage inventory" },
    { role: "puller", desc: "Check-out stock, dispatch items" },
    { role: "analyst", desc: "View dashboards, audit history" }
  ];

  return (
    <div class="min-h-screen bg-[#0b0b0e] text-gray-200 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Visual background ambient blobs */}
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-accentCyan/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accentPurple/10 rounded-full blur-3xl -z-10 animate-pulse" style="animation-delay: 2s;"></div>

      <div class="glass-panel max-w-lg w-full rounded-2xl p-8 border border-white/10 relative shadow-2xl">
        {/* Brand header */}
        <div class="text-center mb-8">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accentCyan via-accentBlue to-accentPurple flex items-center justify-center font-black text-white text-3xl mx-auto mb-4 shadow-xl shadow-accentCyan/15">
            S
          </div>
          <h1 class="text-3xl font-extrabold text-white tracking-tight">Sidekick</h1>
          <p class="text-gray-400 text-sm mt-1">Physical Inventory Manager Companion</p>
        </div>

        {/* Display error */}
        <Show when={error()}>
          <div class="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl mb-6 flex items-start gap-3">
            <span class="text-base mt-0.5">⚠️</span>
            <p>{error()}</p>
          </div>
        </Show>

        {/* Sandbox vs OIDC Selector */}
        <div class="flex bg-white/5 p-1 rounded-xl mb-6 border border-white/5">
          <button 
            onClick={() => { setIsDevMode(true); setError(null); }}
            class={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
              isDevMode() 
                ? "bg-gradient-to-r from-accentCyan to-accentBlue text-white shadow-md shadow-accentCyan/10" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Sparkles size={16} />
            Dev Sandbox
          </button>
          <button 
            onClick={() => { setIsDevMode(false); setError(null); }}
            class={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
              !isDevMode() 
                ? "bg-gradient-to-r from-accentCyan to-accentBlue text-white shadow-md shadow-accentCyan/10" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <KeyRound size={16} />
            OIDC Login
          </button>
        </div>

        {/* ----------------- DEVELOPER SANDBOX VIEW ----------------- */}
        <Show when={isDevMode()}>
          <div>
            <div class="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] p-3 rounded-xl mb-6 flex items-center gap-3">
              <ShieldAlert size={18} class="shrink-0 animate-pulse" />
              <span>Sandbox is running locally. Click a role below to simulate immediate login.</span>
            </div>
            
            <div class="space-y-3">
              {devRoles.map((dev) => (
                <button
                  onClick={() => handleDevLogin(dev.role)}
                  class="glass-card glass-card-hover w-full p-4 rounded-xl flex items-center justify-between text-left cursor-pointer hover:border-accentCyan/30 group"
                >
                  <div>
                    <h3 class="font-bold text-white group-hover:text-accentCyan transition-colors text-sm uppercase tracking-wider">
                      {dev.role}
                    </h3>
                    <p class="text-gray-400 text-xs mt-0.5">{dev.desc}</p>
                  </div>
                  <span class="text-gray-600 group-hover:text-accentCyan group-hover:translate-x-1 transition-all text-lg">
                    ➔
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Show>

        {/* ----------------- PRODUCTION OIDC VIEW ----------------- */}
        <Show when={!isDevMode()}>
          <div class="space-y-6">
            <button
              onClick={handleOidcLogin}
              class="btn-primary w-full py-3.5 flex items-center justify-center gap-3 font-bold"
            >
              <KeyRound size={18} />
              Sign In with OIDC
            </button>
            
            {/* OIDC Config collapsible */}
            <div class="border-t border-white/5 pt-4">
              <button
                onClick={() => setShowConfig(!showConfig())}
                class="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 mx-auto cursor-pointer"
              >
                <Server size={12} />
                {showConfig() ? "Hide OIDC Configuration" : "Configure OIDC Client Settings"}
              </button>
              
              <Show when={showConfig()}>
                <div class="mt-4 space-y-4 bg-white/5 p-4 rounded-xl border border-white/5">
                  <div>
                    <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">
                      OIDC Issuer URL
                    </label>
                    <input
                      type="text"
                      value={oidcIssuer()}
                      onInput={(e) => setOidcIssuer(e.target.value)}
                      placeholder="https://auth.example.com/realms/sidekick"
                      class="glass-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={oidcClientId()}
                      onInput={(e) => setOidcClientId(e.target.value)}
                      placeholder="sidekick-client"
                      class="glass-input w-full text-xs"
                    />
                  </div>
                  <p class="text-[10px] text-gray-500 leading-normal">
                    Redirect URI is configured as:<br/>
                    <code class="text-accentCyan">{window.location.origin}/auth-callback</code>
                  </p>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
