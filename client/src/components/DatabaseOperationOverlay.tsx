import { Show } from "solid-js";
import { Database, Loader2 } from "lucide-solid";
import { useDatabase } from "../context/DatabaseContext";

export default function DatabaseOperationOverlay() {
  const { isOperationPending, pendingMessage } = useDatabase();

  return (
    <Show when={isOperationPending()}>
      <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeIn select-none">
        <div class="glass-panel p-8 rounded-3xl border border-white/10 max-w-md w-full shadow-2xl flex flex-col items-center gap-5">
          <div class="relative">
            <div class="w-16 h-16 rounded-2xl bg-accentCyan/10 border border-accentCyan/30 flex items-center justify-center text-accentCyan">
              <Database size={32} class="animate-pulse" />
            </div>
            <div class="absolute -bottom-1 -right-1 p-1 bg-black/80 rounded-full text-amber-400">
              <Loader2 size={18} class="animate-spin" />
            </div>
          </div>

          <div>
            <h3 class="text-xl font-bold text-white tracking-wide">Database File Operation</h3>
            <p class="text-xs text-gray-400 mt-1">Please wait while database operations and migrations complete...</p>
          </div>

          <div class="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl text-xs font-mono text-accentCyan flex items-center justify-center gap-2">
            <Loader2 size={14} class="animate-spin" />
            <span>{pendingMessage() || "Processing database operation..."}</span>
          </div>

          <p class="text-[11px] text-gray-500">
            ⚠️ Do not close or refresh your app while database files are being swapped or synchronized.
          </p>
        </div>
      </div>
    </Show>
  );
}
