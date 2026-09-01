import { createSignal, createMemo, Show, For } from "solid-js";
import { diagnosticsService, type LogEntry } from "../services/diagnosticsService";
import toast from "solid-toast";
import { Terminal, X, Trash2, Copy, Search, Bug, Filter } from "lucide-solid";

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DiagnosticsModal(props: DiagnosticsModalProps) {
  const [filter, setFilter] = createSignal<"all" | "nfc" | "error">("all");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedLogId, setExpandedLogId] = createSignal<string | null>(null);

  const logs = () => diagnosticsService.getLogs();

  const filteredLogs = createMemo(() => {
    let result = logs();
    const currentFilter = filter();
    const query = searchQuery().toLowerCase().trim();

    if (currentFilter === "nfc") {
      result = result.filter((l) => l.message.includes("[NFC") || l.details?.includes("[NFC"));
    } else if (currentFilter === "error") {
      result = result.filter((l) => l.level === "error" || l.level === "warn");
    }

    if (query) {
      result = result.filter(
        (l) => l.message.toLowerCase().includes(query) || (l.details && l.details.toLowerCase().includes(query))
      );
    }

    return result;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs()
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message} ${l.details ? "\n" + l.details : ""}`)
      .join("\n---\n");

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success("Diagnostics logs copied to clipboard!");
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
        <div class="w-full max-w-4xl h-[90vh] bg-[#0d0f17] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-mono text-xs">
          
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#121522]">
            <div class="flex items-center space-x-2">
              <div class="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Terminal class="w-4 h-4" />
              </div>
              <div>
                <h3 class="font-bold text-white text-sm">Diagnostics Console</h3>
                <p class="text-[10px] text-gray-400">Live app logs & hardware event capture</p>
              </div>
            </div>

            <div class="flex items-center space-x-2">
              <button
                onClick={handleCopyLogs}
                class="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-sans font-medium transition-colors flex items-center space-x-1"
                title="Copy Logs"
              >
                <Copy class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Copy Logs</span>
              </button>
              <button
                onClick={() => diagnosticsService.clearLogs()}
                class="px-2.5 py-1.5 bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-300 rounded-lg text-xs font-sans font-medium transition-colors flex items-center space-x-1"
                title="Clear Logs"
              >
                <Trash2 class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Clear</span>
              </button>
              <button
                onClick={props.onClose}
                class="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div class="p-3 border-b border-gray-800/80 bg-[#10121d] flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div class="relative flex-1">
              <Search class="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search console logs..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-full bg-[#161928] border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-accentCyan text-xs"
              />
            </div>

            <div class="flex items-center space-x-1.5 bg-[#161928] p-1 rounded-lg border border-gray-800 text-[11px] font-sans">
              <button
                onClick={() => setFilter("all")}
                class={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filter() === "all" ? "bg-accentCyan/20 text-accentCyan font-bold" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                All ({logs().length})
              </button>
              <button
                onClick={() => setFilter("nfc")}
                class={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filter() === "nfc" ? "bg-purple-500/20 text-purple-400 font-bold" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                NFC-DEBUG
              </button>
              <button
                onClick={() => setFilter("error")}
                class={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filter() === "error" ? "bg-red-500/20 text-red-400 font-bold" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Errors/Warns
              </button>
            </div>
          </div>

          {/* Log Stream */}
          <div class="flex-1 overflow-y-auto p-3 space-y-1.5 bg-[#090a10]">
            <Show
              when={filteredLogs().length > 0}
              fallback={
                <div class="h-full flex flex-col items-center justify-center text-gray-500 font-sans space-y-2 py-12">
                  <Bug class="w-8 h-8 text-gray-600" />
                  <p class="text-xs">No matching diagnostic logs captured.</p>
                </div>
              }
            >
              <For each={filteredLogs()}>
                {(entry) => {
                  const isExpanded = () => expandedLogId() === entry.id;
                  const levelBg =
                    entry.level === "error"
                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                      : entry.level === "warn"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : entry.message.includes("[NFC")
                      ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/30";

                  return (
                    <div
                      onClick={() => entry.details && setExpandedLogId(isExpanded() ? null : entry.id)}
                      class={`p-2 rounded-lg border bg-[#10121e] hover:bg-[#151828] transition-colors cursor-pointer ${
                        entry.level === "error" ? "border-red-900/40" : "border-gray-800/60"
                      }`}
                    >
                      <div class="flex items-start space-x-2">
                        <span class="text-[10px] text-gray-500 select-none pt-0.5">{entry.timestamp}</span>
                        <span class={`px-1.5 py-0.2 text-[9px] font-bold rounded uppercase tracking-wide border ${levelBg}`}>
                          {entry.level}
                        </span>
                        <span class="flex-1 text-gray-200 break-all leading-relaxed whitespace-pre-wrap">{entry.message}</span>
                        <Show when={entry.details}>
                          <span class="text-[10px] text-gray-500 underline font-sans">{isExpanded() ? "Less" : "Details"}</span>
                        </Show>
                      </div>

                      <Show when={entry.details && isExpanded()}>
                        <div class="mt-2 p-2 rounded bg-[#090b14] border border-gray-800/80 text-gray-400 text-[11px] overflow-x-auto whitespace-pre-wrap">
                          {entry.details}
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* Footer */}
          <div class="px-4 py-2 bg-[#121522] border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400 font-sans">
            <span>Showing {filteredLogs().length} of {logs().length} logs</span>
            <span>Sidekick Android Diagnostics v1.0</span>
          </div>

        </div>
      </div>
    </Show>
  );
}
