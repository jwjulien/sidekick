import { createSignal, Show } from "solid-js";
import { ArrowLeft, ArrowRight, RotateCw, Terminal } from "lucide-solid";
import ThemeToggle from "./ThemeToggle";

export default function NavigationToolbar(props: { compact?: boolean; onOpenDiagnostics?: () => void }) {
  const [isRefreshing, setIsRefreshing] = createSignal(false);

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    }
  };

  const handleForward = () => {
    window.history.forward();
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  return (
    <div class="relative z-50 flex items-center justify-between gap-1.5 p-1 rounded-xl glass-panel border border-white/5 w-full">
      <button
        type="button"
        onClick={handleBack}
        title="Go Back (History)"
        class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
      >
        <ArrowLeft size={16} />
      </button>

      <button
        type="button"
        onClick={handleForward}
        title="Go Forward (History)"
        class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <ArrowRight size={16} />
      </button>

      <button
        type="button"
        onClick={handleRefresh}
        title="Reload Page"
        class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <RotateCw size={15} class={isRefreshing() ? "animate-spin text-accentCyan" : ""} />
      </button>

      <Show when={props.onOpenDiagnostics}>
        <button
          type="button"
          onClick={props.onOpenDiagnostics}
          title="Diagnostics Console"
          class="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer"
        >
          <Terminal size={15} />
        </button>
      </Show>

      <div class="w-px h-4 bg-white/10 mx-0.5" />

      <ThemeToggle compact={props.compact} />
    </div>
  );
}
