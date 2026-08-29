import { createSignal } from "solid-js";
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-solid";
import ThemeToggle from "./ThemeToggle";

export default function NavigationToolbar(props: { compact?: boolean }) {
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

      <div class="w-px h-4 bg-white/10 mx-0.5" />

      <ThemeToggle compact={props.compact} />
    </div>
  );
}
