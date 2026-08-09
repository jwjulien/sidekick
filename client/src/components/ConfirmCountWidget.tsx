import { createSignal, Show } from "solid-js";
import { CheckCircle2, Clock } from "lucide-solid";
import { apiFetch } from "../hooks/useAuth";
import toast from "solid-toast";

interface ConfirmCountWidgetProps {
  storageId: string;
  lastCounted?: string | null;
  onConfirmed?: (newLastCounted: string) => void;
}

export default function ConfirmCountWidget(props: ConfirmCountWidgetProps) {
  const [confirming, setConfirming] = createSignal(false);
  const [confirmed, setConfirmed] = createSignal(false);

  const handleConfirmCount = async (e: Event) => {
    e.stopPropagation(); // prevent triggering parent clicks/drills
    if (confirming()) return;
    setConfirming(true);
    try {
      const result = await apiFetch(`/locations/${props.storageId}/touch`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      });
      setConfirmed(true);
      props.onConfirmed?.(result.last_counted);
      setTimeout(() => setConfirmed(false), 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm count.");
    } finally {
      setConfirming(false);
    }
  };

  const formatLastCounted = () => {
    if (!props.lastCounted) return "Never counted";
    const d = new Date(props.lastCounted + "Z");
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 2) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  const getTooltip = () => {
    if (!props.lastCounted) return "Never counted";
    return new Date(props.lastCounted + "Z").toLocaleString();
  };

  return (
    <div class="flex items-center gap-2">
      <button
        onClick={handleConfirmCount}
        disabled={confirming()}
        class={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all duration-300 ${
          confirmed()
            ? "bg-green-500/20 border-green-500/40 text-green-400"
            : "bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20"
        }`}
      >
        <CheckCircle2 size={13} />
        {confirmed() ? "Count Confirmed!" : "Confirm Count"}
      </button>

      <div
        class="flex items-center gap-1 text-[10px] text-gray-600 shrink-0 cursor-help"
        title={getTooltip()}
      >
        <Clock size={10} />
        <span>{formatLastCounted()}</span>
      </div>
    </div>
  );
}
