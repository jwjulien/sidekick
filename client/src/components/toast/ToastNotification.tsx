import { Show, For, type JSX } from "solid-js";
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from "lucide-solid";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastAction {
  title: string;
  onClick: (toastId?: string) => void | Promise<void>;
  variant?: "primary" | "secondary";
  icon?: JSX.Element;
}

export interface ToastNotificationProps {
  toastId?: string;
  message: string | JSX.Element;
  title?: string;
  variant?: ToastVariant;
  icon?: JSX.Element;
  actions?: ToastAction[];
  dismissible?: boolean;
  onDismiss?: (toastId?: string) => void;
}

export function ToastNotification(props: ToastNotificationProps) {
  const variant = () => props.variant || "info";

  const variantStyles = () => {
    switch (variant()) {
      case "success":
        return {
          icon: <CheckCircle2 class="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />,
          primaryBtn: "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold",
        };
      case "warning":
        return {
          icon: <AlertTriangle class="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />,
          primaryBtn: "bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold",
        };
      case "error":
        return {
          icon: <AlertCircle class="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0" />,
          primaryBtn: "bg-rose-500 hover:bg-rose-400 text-white font-bold",
        };
      case "info":
      default:
        return {
          icon: <Info class="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />,
          primaryBtn: "bg-accentCyan hover:brightness-110 text-slate-950 font-bold",
        };
    }
  };

  const handleDismiss = () => {
    props.onDismiss?.(props.toastId);
  };

  const handleActionClick = async (action: ToastAction) => {
    try {
      await action.onClick(props.toastId);
    } finally {
      handleDismiss();
    }
  };

  return (
    <div
      class={`toast-card toast-variant-${variant()} flex flex-col gap-2 p-3.5 rounded-2xl border backdrop-blur-md transition-all duration-200 min-w-[280px] max-w-[420px] toast-animate-in`}
      role="alert"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3 min-w-0 flex-1">
          <div class={`toast-badge-${variant()} p-1.5 rounded-xl shrink-0`}>
            {props.icon || variantStyles().icon}
          </div>
          <div class="flex flex-col gap-0.5 flex-1 min-w-0 pt-0.5">
            <Show when={props.title}>
              <h4 class="toast-card-title text-xs font-bold tracking-wide leading-tight">
                {props.title}
              </h4>
            </Show>
            <div class="toast-card-message text-xs font-medium leading-snug break-words">
              {props.message}
            </div>
          </div>
        </div>

        <Show when={props.dismissible !== false}>
          <button
            onClick={handleDismiss}
            class="toast-card-close p-1 rounded-lg transition-colors shrink-0 -mr-1 -mt-1"
            aria-label="Dismiss toast"
          >
            <X class="w-4 h-4" />
          </button>
        </Show>
      </div>

      <Show when={props.actions && props.actions.length > 0}>
        <div class="toast-card-divider flex items-center justify-end gap-2 pt-1.5 mt-1 border-t">
          <For each={props.actions}>
            {(action) => (
              <button
                type="button"
                onClick={() => handleActionClick(action)}
                class={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs tracking-wide transition-all shadow-sm active:scale-95 shrink-0 ${
                  action.variant === "primary"
                    ? variantStyles().primaryBtn
                    : "toast-card-btn-secondary font-semibold border"
                }`}
              >
                {action.icon}
                <span>{action.title}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
