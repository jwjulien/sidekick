import { onMount, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { handleOidcCallback } from "../hooks/useAuth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      await handleOidcCallback();
      navigate("/"); // Redirect to main dashboard
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "OIDC Authentication Callback failed.");
    }
  });

  return (
    <div class="min-h-screen bg-darkBg flex items-center justify-center p-4">
      <div class="glass-panel rounded-2xl p-8 max-w-md w-full text-center relative overflow-hidden">
        {/* Glow decorative effect */}
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-accentCyan/15 rounded-full blur-3xl -z-10"></div>
        
        {error() ? (
          <div>
            <div class="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ⚠️
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Authentication Failed</h2>
            <p class="text-gray-400 text-sm mb-6">{error()}</p>
            <button
              onClick={() => navigate("/login")}
              class="btn-primary w-full"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div>
            <div class="w-16 h-16 border-4 border-accentCyan/30 border-t-accentCyan rounded-full animate-spin mx-auto mb-6"></div>
            <h2 class="text-xl font-bold text-white mb-2">Completing Login</h2>
            <p class="text-gray-400 text-sm">
              Establishing secure session with Sidekick server...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
