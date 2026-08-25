import { For, Show } from "solid-js";
import { Scale } from "lucide-solid";

export interface ContainerTareSelectorProps {
  tareWeights: any[];
  selectedTareId: string | null;
  onSelectTare: (tareId: string | null) => void;
  tareOffset: number;
  unit: string;
}

export default function ContainerTareSelector(props: ContainerTareSelectorProps) {
  return (
    <div class="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
      <div class="flex items-center justify-between text-gray-400 font-semibold">
        <span class="flex items-center gap-1.5 text-gray-300">
          <Scale size={14} class="text-accentCyan" />
          Container Tare Weight:
        </span>
        <Show when={props.tareOffset > 0}>
          <span class="text-[11px] font-mono text-cyan-300 bg-accentCyan/10 px-2 py-0.5 rounded border border-accentCyan/20 font-bold">
            -{props.tareOffset} {props.unit}
          </span>
        </Show>
      </div>
      <div class="flex items-center gap-2">
        <select
          value={props.selectedTareId || ""}
          onChange={(e) => {
            const val = e.currentTarget.value;
            props.onSelectTare(val ? val : null);
          }}
          class="w-full bg-black/50 border border-white/10 rounded-lg py-2 px-3 text-white text-xs font-semibold focus:outline-none focus:border-accentCyan cursor-pointer"
        >
          <option value="">No Container / Tare to Zero (0 g)</option>
          <For each={props.tareWeights}>
            {(t) => (
              <option value={t.id}>
                {t.name} ({t.weight} {props.unit})
              </option>
            )}
          </For>
        </select>
        <button
          onClick={() => props.onSelectTare(null)}
          class={`px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition-colors ${
            !props.selectedTareId
              ? "bg-accentCyan/20 text-accentCyan border border-accentCyan/30"
              : "bg-white/5 text-gray-300 hover:bg-white/10"
          }`}
          title="Tare scale to live zero"
        >
          Tare Zero
        </button>
      </div>
    </div>
  );
}
