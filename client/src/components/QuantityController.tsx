import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { Plus, Minus, Trash2 } from "lucide-solid";

export interface QuantityControllerProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  compact?: boolean;
  disabled?: boolean;
  label?: string;
  onDelete?: () => void | Promise<void>;
  onChange?: (newVal: number) => void;
}

export default function QuantityController(props: QuantityControllerProps) {
  const [pendingVal, setPendingVal] = createSignal(props.value);
  const [isEditing, setIsEditing] = createSignal(false);

  const minLimit = () => (props.min !== undefined ? props.min : 0);
  const stepVal = () => props.step || 1;

  const isDeleteMode = () => props.onDelete !== undefined && pendingVal() <= 1;

  createEffect(() => {
    setPendingVal(props.value);
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const emitChange = (val: number) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    props.onChange?.(val);
  };

  const scheduleEmit = (val: number) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => emitChange(val), 400);
  };

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  const increment = () => {
    if (props.disabled) return;
    let next = pendingVal() + stepVal();
    if (props.max !== undefined && next > props.max) next = props.max;
    setPendingVal(next);
    scheduleEmit(next);
  };

  const decrement = () => {
    if (props.disabled) return;
    let next = Math.max(minLimit(), pendingVal() - stepVal());
    setPendingVal(next);
    scheduleEmit(next);
  };

  const handleLeftButtonClick = () => {
    if (props.disabled) return;
    if (isDeleteMode()) {
      props.onDelete?.();
    } else {
      decrement();
    }
  };

  const handleInput = (e: Event) => {
    const parsed = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(parsed) && parsed >= minLimit()) {
      let val = parsed;
      if (props.max !== undefined && val > props.max) val = props.max;
      setPendingVal(val);
    }
  };

  const commitInlineEdit = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    setIsEditing(false);
    emitChange(pendingVal());
  };

  const canAdjust = () => !props.disabled;

  return (
    <div class={props.compact ? "inline-block py-0.5" : "py-1 space-y-3"}>
      <div class={`flex items-center ${props.compact ? "gap-2 justify-center" : "gap-4 justify-center"}`}>
        <Show when={canAdjust()}>
          <button
            type="button"
            onClick={handleLeftButtonClick}
            disabled={props.disabled || (!isDeleteMode() && pendingVal() <= minLimit())}
            class={`rounded-xl border transition-all shadow-sm active:scale-95 disabled:opacity-30 flex items-center justify-center ${
              props.compact ? "w-8 h-8 shrink-0" : "w-11 h-11 shrink-0"
            } ${
              isDeleteMode()
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/50"
                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-300 hover:text-white"
            }`}
            title={isDeleteMode() ? "Remove item from list" : "Decrease quantity"}
          >
            <Show when={isDeleteMode()} fallback={<Minus size={props.compact ? 14 : 18} />}>
              <Trash2 size={props.compact ? 13 : 17} />
            </Show>
          </button>
        </Show>

        <div class="text-center min-w-[2.5rem]">
          <Show
            when={isEditing() && canAdjust()}
            fallback={
              <span
                onClick={() => canAdjust() && setIsEditing(true)}
                class={`font-extrabold block transition-colors select-none ${
                  props.compact ? "text-sm px-1.5" : "text-4xl"
                } ${
                  canAdjust() ? "cursor-text hover:text-accentCyan" : "cursor-default"
                } ${props.disabled ? "opacity-50" : ""} ${
                  pendingVal() !== props.value ? "text-amber-300" : "text-white"
                }`}
              >
                {pendingVal()}
              </span>
            }
          >
            <input
              type="number"
              min={minLimit()}
              max={props.max}
              step={stepVal()}
              value={pendingVal()}
              onInput={handleInput}
              onBlur={commitInlineEdit}
              onKeyDown={(e: KeyboardEvent) => e.key === "Enter" && commitInlineEdit()}
              autofocus
              class={`glass-input text-center font-extrabold text-white ${
                props.compact ? "w-16 text-xs py-1 !px-2" : "w-28 text-3xl py-1.5 !px-2"
              }`}
            />
          </Show>

          <Show when={!props.compact && props.label}>
            <span class="text-[10px] text-gray-500 uppercase tracking-widest mt-1 block font-semibold">
              {props.label}
            </span>
          </Show>
        </div>

        <Show when={canAdjust()}>
          <button
            type="button"
            onClick={increment}
            disabled={props.disabled || (props.max !== undefined && pendingVal() >= props.max)}
            class={`rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-30 ${
              props.compact ? "w-8 h-8 shrink-0" : "w-11 h-11 shrink-0"
            }`}
            title="Increase quantity"
          >
            <Plus size={props.compact ? 14 : 18} />
          </button>
        </Show>
      </div>
    </div>
  );
}
