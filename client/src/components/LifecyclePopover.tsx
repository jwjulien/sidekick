import { Show, onMount, onCleanup } from "solid-js";
import { History, X, CheckCircle2, ArrowUpRight, ArrowDownRight, PackagePlus } from "lucide-solid";

export interface LifecycleTimestamps {
  firstAdded?: string | null;
  lastCounted?: string | null;
  lastStocked?: string | null;
  lastUsed?: string | null;
}

export interface LifecyclePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  storageName?: string;
  timestamps: LifecycleTimestamps;
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return "Never recorded";
  const str = isoString.endsWith("Z") ? isoString : isoString + "Z";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "";
  const str = isoString.endsWith("Z") ? isoString : isoString + "Z";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 45) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LifecyclePopover(props: LifecyclePopoverProps) {
  let popoverRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (props.isOpen && popoverRef && !popoverRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  return (
    <Show when={props.isOpen}>
      <div
        ref={popoverRef}
        class="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 rounded-2xl bg-[#12141a]/95 backdrop-blur-xl border border-white/10 shadow-2xl p-4 text-left animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
          <div class="flex items-center gap-2">
            <History size={15} class="text-accentCyan" />
            <span class="text-xs font-bold text-white tracking-wide">
              {props.storageName ? `${props.storageName} Lifecycle` : "Location Lifecycle"}
            </span>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* 4 Chronological Events */}
        <div class="space-y-2.5">
          {/* 1. First Added */}
          <div class="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div class="p-1.5 rounded-lg bg-cyan-500/10 text-accentCyan shrink-0 mt-0.5">
              <PackagePlus size={14} />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-semibold text-gray-300">First Added</span>
                <Show when={props.timestamps.firstAdded}>
                  <span class="text-[10px] text-accentCyan/80 font-mono">
                    {formatRelativeTime(props.timestamps.firstAdded)}
                  </span>
                </Show>
              </div>
              <div class="text-[10px] text-gray-400 truncate">
                {formatDateTime(props.timestamps.firstAdded)}
              </div>
            </div>
          </div>

          {/* 2. Last Counted */}
          <div class="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div class="p-1.5 rounded-lg bg-green-500/10 text-green-400 shrink-0 mt-0.5">
              <CheckCircle2 size={14} />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-semibold text-gray-300">Last Counted</span>
                <Show when={props.timestamps.lastCounted}>
                  <span class="text-[10px] text-green-400/80 font-mono">
                    {formatRelativeTime(props.timestamps.lastCounted)}
                  </span>
                </Show>
              </div>
              <div class="text-[10px] text-gray-400 truncate">
                {formatDateTime(props.timestamps.lastCounted)}
              </div>
            </div>
          </div>

          {/* 3. Last Stocked */}
          <div class="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <ArrowUpRight size={14} />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-semibold text-gray-300">Last Stocked (+)</span>
                <Show when={props.timestamps.lastStocked}>
                  <span class="text-[10px] text-emerald-400/80 font-mono">
                    {formatRelativeTime(props.timestamps.lastStocked)}
                  </span>
                </Show>
              </div>
              <div class="text-[10px] text-gray-400 truncate">
                {formatDateTime(props.timestamps.lastStocked)}
              </div>
            </div>
          </div>

          {/* 4. Last Used */}
          <div class="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div class="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
              <ArrowDownRight size={14} />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-semibold text-gray-300">Last Used (-)</span>
                <Show when={props.timestamps.lastUsed}>
                  <span class="text-[10px] text-amber-400/80 font-mono">
                    {formatRelativeTime(props.timestamps.lastUsed)}
                  </span>
                </Show>
              </div>
              <div class="text-[10px] text-gray-400 truncate">
                {formatDateTime(props.timestamps.lastUsed)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
