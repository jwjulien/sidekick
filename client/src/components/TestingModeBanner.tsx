import { Show } from "solid-js";
import { FlaskConical, ArrowRightLeft } from "lucide-solid";
import { useDatabase } from "../context/DatabaseContext";

export default function TestingModeBanner() {
  const { dbMode, switchMode, isOperationPending } = useDatabase();

  return (
    <Show when={dbMode() === "testing"}>
      <div class="bg-gradient-to-r from-amber-600/90 via-amber-500/90 to-orange-600/90 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold border-b border-amber-400/30 shadow-md backdrop-blur-sm sticky top-0 z-40 animate-fadeIn">
        <div class="flex items-center gap-2">
          <span class="p-1 bg-black/20 rounded-md">
            <FlaskConical size={16} class="text-amber-200 animate-pulse" />
          </span>
          <div>
            <span class="font-extrabold uppercase tracking-wide bg-black/30 px-1.5 py-0.5 rounded text-[10px] mr-1.5">
              Testing Sandbox Mode
            </span>
            <span>Operating on <code class="bg-black/30 px-1.5 py-0.5 rounded text-amber-200 font-mono">sidekick_testing.db</code>. Changes do not affect production inventory.</span>
          </div>
        </div>

        <button
          onClick={() => switchMode("prod")}
          disabled={isOperationPending()}
          class="bg-black/30 hover:bg-black/50 text-white px-3 py-1 rounded-lg flex items-center gap-1.5 font-bold transition-all border border-white/15 hover:border-white/30 cursor-pointer text-[11px]"
        >
          <ArrowRightLeft size={13} />
          Return to Production
        </button>
      </div>
    </Show>
  );
}
