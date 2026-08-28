import { Show } from "solid-js";
import { MapPin, Move, Scale, Printer, Nfc, Trash2 } from "lucide-solid";
import StockController from "../StockController";

export interface LocationCardProps {
  location: {
    id: string | number;
    name: string;
    quantity: number;
    last_counted?: string | null;
    path?: string;
    full_path?: string;
    [key: string]: any;
  };
  allLocations?: any[];
  pathString?: string;
  title?: string;
  hideTitle?: boolean;
  onMove?: (location: any) => void;
  onScale?: (location: any) => void;
  onPrint?: (location: any) => void;
  onWriteNfc?: (location: any) => void;
  onDelete?: (location: any) => void;
  onChanged?: (newQty: number, newLastCounted: string) => void;
  compact?: boolean;
  class?: string;
}

export const getLocationPathString = (loc: any, allLocations?: any[], defaultTitle?: string): string => {
  if (!loc) return "";
  if (loc.path) return loc.path;
  if (loc.full_path) return loc.full_path;
  if (!allLocations || allLocations.length === 0) return defaultTitle || loc.name || "";

  const chain: string[] = [];
  let curr: any = loc;
  const visited = new Set<string>();
  while (curr && !visited.has(String(curr.id))) {
    visited.add(String(curr.id));
    if (curr.name) chain.unshift(curr.name);
    if (curr.parent_id) {
      curr = allLocations.find((l: any) => String(l.id) === String(curr.parent_id));
    } else {
      curr = null;
    }
  }
  return chain.length > 0 ? chain.join(", ") : (defaultTitle || loc.name || "");
};

export default function LocationCard(props: LocationCardProps) {
  const fullLocationPath = () => {
    return getLocationPathString(props.location, props.allLocations, props.title || props.pathString);
  };

  return (
    <div class={`space-y-3 ${props.class || ""}`} title={fullLocationPath()}>
      {/* Header bar with optional location name & action buttons */}
      <div class={`flex items-center ${props.hideTitle ? "justify-center" : "justify-between px-1"}`}>
        <Show when={!props.hideTitle}>
          <div class="flex items-center gap-2 min-w-0 cursor-help" title={fullLocationPath()}>
            <MapPin size={13} class="text-accentCyan shrink-0" />
            <span class="text-xs text-gray-300 font-medium truncate">
              {props.title || props.location.name}
            </span>
          </div>
        </Show>
        <div class="flex items-center gap-1.5">
          <Show when={props.onMove}>
            <button
              onClick={() => props.onMove?.(props.location)}
              disabled={props.location.quantity === 0}
              class="p-1.5 rounded-lg bg-white/5 text-accentCyan hover:text-cyan-300 disabled:text-gray-600 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
              title="Move Parts"
            >
              <Move size={14} />
            </button>
          </Show>

          <Show when={props.onScale}>
            <button
              onClick={() => props.onScale?.(props.location)}
              class="p-1.5 rounded-lg bg-white/5 text-accentCyan hover:text-cyan-300 transition-colors"
              title="Count with Scale"
            >
              <Scale size={14} />
            </button>
          </Show>

          <Show when={props.onPrint}>
            <button
              onClick={() => props.onPrint?.(props.location)}
              class="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors"
              title="Print Label"
            >
              <Printer size={14} />
            </button>
          </Show>

          <Show when={props.onWriteNfc}>
            <button
              onClick={() => props.onWriteNfc?.(props.location)}
              class="p-1.5 rounded-lg bg-white/5 text-accentCyan hover:text-cyan-300 transition-colors"
              title="Write NFC Tag"
            >
              <Nfc size={14} />
            </button>
          </Show>

          <Show when={props.onDelete}>
            <button
              onClick={() => props.onDelete?.(props.location)}
              disabled={props.location.quantity > 0}
              class="p-1.5 rounded-lg bg-white/5 text-rose-400 hover:text-rose-300 disabled:text-gray-600 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
              title="Delete Location"
            >
              <Trash2 size={14} />
            </button>
          </Show>
        </div>
      </div>

      {/* StockController */}
      <StockController
        storageId={String(props.location.id)}
        currentQty={props.location.quantity}
        lastCounted={props.location.last_counted}
        compact={props.compact}
        onChanged={(qty, ts) => props.onChanged?.(qty, ts)}
      />
    </div>
  );
}
