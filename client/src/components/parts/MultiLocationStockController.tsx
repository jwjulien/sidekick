import { createSignal, Show, For, onCleanup, createEffect } from "solid-js";
import { ChevronDown, MapPin, Package, AlertTriangle, X } from "lucide-solid";
import StockController from "../StockController";
import { apiFetch } from "../../hooks/useAuth";

export interface LocationStockInfo {
  id: string;
  name: string;
  breadcrumb?: string;
  quantity: number;
  last_counted?: string | null;
}

export interface MultiLocationStockControllerProps {
  partId?: string;
  totalQty?: number;
  locations?: LocationStockInfo[];
  compact?: boolean;
  dropUp?: boolean;
  onChanged?: () => void;
}

export default function MultiLocationStockController(props: MultiLocationStockControllerProps) {
  const [showPopover, setShowPopover] = createSignal(false);
  const [popoverPlacement, setPopoverPlacement] = createSignal<"up" | "down">("down");
  const [fetchedLocations, setFetchedLocations] = createSignal<LocationStockInfo[] | null>(null);

  let triggerBtnRef: HTMLButtonElement | undefined;

  const togglePopover = () => {
    if (!showPopover()) {
      if (props.dropUp) {
        setPopoverPlacement("up");
      } else if (triggerBtnRef) {
        const rect = triggerBtnRef.getBoundingClientRect();
        const distFromBottom = window.innerHeight - rect.bottom;
        if (distFromBottom < 280) {
          setPopoverPlacement("up");
        } else {
          setPopoverPlacement("down");
        }
      }
      setShowPopover(true);
    } else {
      setShowPopover(false);
    }
  };

  createEffect(() => {
    if (!props.locations && props.partId) {
      apiFetch(`/locations?part_id=${props.partId}`)
        .then((data: any[]) => {
          const locs: LocationStockInfo[] = (data || []).map((s) => ({
            id: s.id,
            name: s.name,
            breadcrumb: s.name,
            quantity: s.quantity || 0,
            last_counted: s.last_counted
          }));
          setFetchedLocations(locs);
        })
        .catch((err) => console.warn("Failed to fetch part locations:", err));
    }
  });

  const locationsList = () => props.locations || fetchedLocations() || [];
  const locationCount = () => locationsList().length;

  const totalCalculated = () => {
    if (props.totalQty !== undefined) return props.totalQty;
    return locationsList().reduce((acc, loc) => acc + (loc.quantity || 0), 0);
  };

  // Close popover on Escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") setShowPopover(false);
  };

  createEffect(() => {
    if (showPopover()) {
      window.addEventListener("keydown", handleKeyDown);
    } else {
      window.removeEventListener("keydown", handleKeyDown);
    }
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div class="relative inline-block text-left">
      {/* 1. Single Location Case */}
      <Show when={locationCount() === 1}>
        <StockController
          storageId={locationsList()[0].id}
          currentQty={locationsList()[0].quantity}
          lastCounted={locationsList()[0].last_counted}
          compact={props.compact}
          onChanged={() => props.onChanged?.()}
        />
      </Show>

      {/* 2. Multiple Locations Case */}
      <Show when={locationCount() > 1}>
        <div class="flex items-center gap-2">
          <button
            ref={triggerBtnRef}
            onClick={togglePopover}
            class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white transition-all text-xs font-semibold"
            title="Click to view and adjust per-location stock"
          >
            <MapPin size={14} class="text-accentCyan" />
            <span class="font-extrabold text-sm">{totalCalculated()}</span>
            <span class="text-[10px] text-gray-400 font-normal">
              ({locationCount()} bins)
            </span>
            <ChevronDown size={12} class={`transition-transform ${showPopover() ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Popover Card */}
        <Show when={showPopover()}>
          {/* Backdrop overlay */}
          <div
            class="fixed inset-0 z-40"
            onClick={() => setShowPopover(false)}
          />

          <div
            class={`absolute right-0 w-80 max-w-[90vw] z-50 rounded-2xl glass-card border border-white/20 shadow-2xl p-4 space-y-3 bg-gray-900/95 backdrop-blur-xl ${
              popoverPlacement() === "up"
                ? "bottom-full mb-2"
                : "top-full mt-2"
            }`}
          >
            <div class="flex items-center justify-between border-b border-white/10 pb-2">
              <div class="flex items-center gap-2">
                <Package size={16} class="text-accentCyan" />
                <span class="text-xs font-bold text-white uppercase tracking-wider">
                  Locations ({locationCount()})
                </span>
              </div>
              <button
                onClick={() => setShowPopover(false)}
                class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </div>

            <div class="max-h-64 overflow-y-auto space-y-3 pr-1">
              <For each={locationsList()}>
                {(loc) => (
                  <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div class="flex items-start justify-between gap-2">
                      <div class="text-xs font-semibold text-gray-200 truncate">
                        {loc.name}
                      </div>
                      <Show when={loc.breadcrumb}>
                        <div class="text-[10px] text-gray-400 truncate max-w-[140px]">
                          {loc.breadcrumb}
                        </div>
                      </Show>
                    </div>
                    <StockController
                      storageId={loc.id}
                      currentQty={loc.quantity}
                      lastCounted={loc.last_counted}
                      compact={true}
                      onChanged={() => props.onChanged?.()}
                    />
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>

      {/* 3. Homeless / No Locations Case */}
      <Show when={locationCount() === 0}>
        <div class="flex items-center gap-1.5 text-amber-400 text-xs font-semibold px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <AlertTriangle size={13} />
          <span>0 (Unassigned)</span>
        </div>
      </Show>
    </div>
  );
}
