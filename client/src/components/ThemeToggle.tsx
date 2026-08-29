import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { Sun, Moon, Monitor, Check, ChevronDown } from "lucide-solid";

export default function ThemeToggle(props: { compact?: boolean }) {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("click", handleClickOutside);
  });

  const selectTheme = (mode: ThemeMode) => {
    setTheme(mode);
    setIsOpen(false);
  };

  const getLabel = () => {
    const t = theme();
    if (t === "system") return `System (${effectiveTheme() === "dark" ? "Dark" : "Light"})`;
    return t === "dark" ? "Dark" : "Light";
  };

  return (
    <div ref={containerRef} class="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen())}
        title={`Current Theme: ${getLabel()}. Click to change.`}
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border glass-panel hover:bg-white/10 transition-all duration-150 text-xs font-semibold cursor-pointer text-gray-300 hover:text-white"
      >
        {theme() === "dark" && <Moon size={15} class="text-accentCyan" />}
        {theme() === "light" && <Sun size={15} class="text-amber-400" />}
        {theme() === "system" && <Monitor size={15} class="text-accentPurple" />}

        {!props.compact && (
          <span class="capitalize text-xs font-semibold">
            {theme()}
          </span>
        )}

        <ChevronDown size={12} class={`transition-transform duration-200 ${isOpen() ? "rotate-180" : ""}`} />
      </button>

      <Show when={isOpen()}>
        <div class="absolute right-0 mt-2 w-36 glass-dropdown rounded-xl shadow-2xl p-1 z-[100] space-y-0.5">
          <button
            type="button"
            onClick={() => selectTheme("dark")}
            class={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              theme() === "dark"
                ? "bg-accentCyan/20 text-accentCyan font-bold"
                : "text-gray-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <div class="flex items-center gap-2">
              <Moon size={14} class="text-accentCyan" />
              <span>Dark</span>
            </div>
            {theme() === "dark" && <Check size={14} />}
          </button>

          <button
            type="button"
            onClick={() => selectTheme("light")}
            class={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              theme() === "light"
                ? "bg-accentCyan/20 text-accentCyan font-bold"
                : "text-gray-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <div class="flex items-center gap-2">
              <Sun size={14} class="text-amber-400" />
              <span>Light</span>
            </div>
            {theme() === "light" && <Check size={14} />}
          </button>

          <button
            type="button"
            onClick={() => selectTheme("system")}
            class={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              theme() === "system"
                ? "bg-accentCyan/20 text-accentCyan font-bold"
                : "text-gray-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <div class="flex items-center gap-2">
              <Monitor size={14} class="text-accentPurple" />
              <span>System</span>
            </div>
            {theme() === "system" && <Check size={14} />}
          </button>
        </div>
      </Show>
    </div>
  );
}
