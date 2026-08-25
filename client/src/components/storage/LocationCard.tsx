import { Show } from "solid-js";
import { MapPin, Move, Scale, Printer, Trash2 } from "lucide-solid";
import StockController from "../StockController";

export interface LocationCardProps {
  location: {
    id: string | number;
    name: string;
    quantity: number;
    last_counted?: string | null;
    [key: string]: any;
  };
  title?: string;
  hideTitle?: boolean;
  onMove?: (location: any) => void;
  onScale?: (location: any) => void;
  onPrint?: (location: any) => void;
  onDelete?: (location: any) => void;
  onChanged?: (newQty: number, newLastCounted: string) => void;
  compact?: boolean;
  class?: string;
}

export default function LocationCard(props: LocationCardProps) {
  return (
    <div class={`space-y-3 ${props.class || ""}`}>
      {/* Header bar with optional location name & action buttons */}
      <div class={`flex items-center ${props.hideTitle ? "justify-center" : "justify-between px-1"}`}>
        <Show when={!props.hideTitle}>
          <div class="flex items-center gap-2 min-w-0">
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
