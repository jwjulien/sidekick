import { Show, For } from "solid-js";
import { X, FileCode, ArrowRight, ShieldCheck, Clock, User, HardDrive, Package } from "lucide-solid";

export interface AuditLogItem {
  id: string;
  part_id?: string;
  location_id?: string;
  project_id?: string;
  user_id?: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  reason_code?: string;
  quantity_change: number;
  previous_state?: Record<string, any>;
  new_state?: Record<string, any>;
  method: string;
  notes?: string;
  created_at: string;
  part_name?: string;
  part_number?: string;
  location_name?: string;
  project_name?: string;
  user_name?: string;
}

interface AuditDiffDrawerProps {
  log: AuditLogItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditDiffDrawer(props: AuditDiffDrawerProps) {
  const getKeys = () => {
    if (!props.log) return [];
    const prevKeys = Object.keys(props.log.previous_state || {});
    const newKeys = Object.keys(props.log.new_state || {});
    return Array.from(new Set([...prevKeys, ...newKeys]));
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch (_) {
      return iso;
    }
  };

  return (
    <Show when={props.isOpen && props.log}>
      <div class="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fadeIn">
        <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div class="w-screen max-w-md bg-[#121319] border-l border-white/10 shadow-2xl flex flex-col text-gray-200">
            
            {/* Drawer Header */}
            <div class="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/5">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-xl bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
                  <FileCode size={20} />
                </div>
                <div>
                  <h3 class="font-bold text-white text-sm tracking-wide">Audit Record Inspector</h3>
                  <p class="text-[11px] font-mono text-gray-400">ID: {props.log!.id.slice(0, 18)}...</p>
                </div>
              </div>
              <button 
                onClick={props.onClose}
                class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Content */}
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Event Overview Card */}
              <div class="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-400">Action Type:</span>
                  <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-accentCyan/20 text-accentCyan border border-accentCyan/30">
                    {props.log!.action_type}
                  </span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-400">Reason Code:</span>
                  <span class="font-mono text-white font-semibold">{props.log!.reason_code || "N/A"}</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-400">Acquisition Method:</span>
                  <span class="font-mono text-emerald-400 font-semibold uppercase">{props.log!.method}</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-400">Timestamp (UTC):</span>
                  <span class="font-mono text-gray-300">{formatDate(props.log!.created_at)}</span>
                </div>
              </div>

              {/* Related Entity Details */}
              <div class="space-y-2">
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Associated Entities</h4>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <Show when={props.log!.part_name || props.log!.part_number}>
                    <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                      <div class="flex items-center gap-1.5 text-gray-400 text-[11px]">
                        <Package size={14} /> Component
                      </div>
                      <div class="font-bold text-white truncate">{props.log!.part_name}</div>
                      <div class="font-mono text-[10px] text-accentCyan">{props.log!.part_number}</div>
                    </div>
                  </Show>
                  <Show when={props.log!.location_name}>
                    <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                      <div class="flex items-center gap-1.5 text-gray-400 text-[11px]">
                        <HardDrive size={14} /> Location
                      </div>
                      <div class="font-bold text-white truncate">{props.log!.location_name}</div>
                    </div>
                  </Show>
                  <Show when={props.log!.user_name}>
                    <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                      <div class="flex items-center gap-1.5 text-gray-400 text-[11px]">
                        <User size={14} /> Triggered By
                      </div>
                      <div class="font-bold text-white truncate">{props.log!.user_name}</div>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Notes */}
              <Show when={props.log!.notes}>
                <div class="space-y-1">
                  <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Audit Notes</h4>
                  <div class="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 italic">
                    "{props.log!.notes}"
                  </div>
                </div>
              </Show>

              {/* State Diff Comparison */}
              <div class="space-y-3">
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>State Snapshot Comparison</span>
                  <span class="text-[10px] text-gray-500 font-mono">Before vs After</span>
                </h4>

                <Show 
                  when={getKeys().length > 0}
                  fallback={
                    <div class="p-4 text-center rounded-xl bg-white/5 border border-white/10 text-xs text-gray-500">
                      No structural state snapshot attached to this audit record.
                    </div>
                  }
                >
                  <div class="space-y-2">
                    <For each={getKeys()}>
                      {(key) => {
                        const prevVal = props.log!.previous_state?.[key];
                        const newVal = props.log!.new_state?.[key];
                        const isChanged = JSON.stringify(prevVal) !== JSON.stringify(newVal);

                        return (
                          <div class={`p-3 rounded-xl border text-xs transition-all ${
                            isChanged ? "bg-accentCyan/10 border-accentCyan/30" : "bg-white/5 border-white/5"
                          }`}>
                            <div class="font-mono text-[11px] text-gray-400 mb-1.5 font-bold uppercase">{key}</div>
                            <div class="grid grid-cols-2 gap-2 font-mono text-[11px]">
                              <div class="p-2 rounded bg-black/40 text-gray-400">
                                <span class="text-[9px] text-gray-500 block">BEFORE</span>
                                {prevVal !== undefined ? JSON.stringify(prevVal) : "<null>"}
                              </div>
                              <div class="p-2 rounded bg-black/40 text-emerald-400">
                                <span class="text-[9px] text-emerald-600 block">AFTER</span>
                                {newVal !== undefined ? JSON.stringify(newVal) : "<null>"}
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </Show>

              </div>

            </div>

            {/* Footer */}
            <div class="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs text-gray-400">
              <span class="flex items-center gap-1 text-[11px]">
                <ShieldCheck size={14} class="text-emerald-400" /> Immutable SQLite Entry
              </span>
              <button 
                onClick={props.onClose}
                class="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      </div>
    </Show>
  );
}
