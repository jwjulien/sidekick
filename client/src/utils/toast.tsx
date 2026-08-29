import type { JSX } from "solid-js";
import solidToast, { type ToastOptions } from "solid-toast";
import { ToastNotification, type ToastVariant, type ToastAction } from "../components/toast/ToastNotification";
import { RotateCcw } from "lucide-solid";

export type { ToastVariant, ToastAction };

export interface ShowToastOptions extends Omit<ToastOptions, "icon"> {
  title?: string;
  variant?: ToastVariant;
  icon?: JSX.Element;
  actions?: ToastAction[];
  dismissible?: boolean;
}

export function showToast(message: string | JSX.Element, options: ShowToastOptions = {}) {
  const { title, variant = "info", icon, actions, dismissible = true, duration = 4000, ...solidOptions } = options;

  return solidToast(
    (t) => (
      <ToastNotification
        toastId={t.id}
        title={title}
        message={message}
        variant={variant}
        icon={icon}
        actions={actions}
        dismissible={dismissible}
        onDismiss={(id) => solidToast.dismiss(id || t.id)}
      />
    ),
    {
      duration,
      style: {
        background: "transparent",
        boxShadow: "none",
        padding: "0",
      },
      ...solidOptions,
    }
  );
}

// Variant helper shortcuts
showToast.info = (message: string | JSX.Element, options?: ShowToastOptions) =>
  showToast(message, { ...options, variant: "info" });

showToast.success = (message: string | JSX.Element, options?: ShowToastOptions) =>
  showToast(message, { ...options, variant: "success" });

showToast.warning = (message: string | JSX.Element, options?: ShowToastOptions) =>
  showToast(message, { ...options, variant: "warning" });

showToast.error = (message: string | JSX.Element, options?: ShowToastOptions) =>
  showToast(message, { ...options, variant: "error" });

// Dedicated Undo Toast pattern
showToast.undo = (
  message: string | JSX.Element,
  onUndo: (toastId?: string) => void | Promise<void>,
  options?: ShowToastOptions
) => {
  return showToast(message, {
    variant: "info",
    duration: 6000,
    ...options,
    actions: [
      {
        title: "Undo",
        variant: "primary",
        icon: <RotateCcw class="w-3.5 h-3.5" />,
        onClick: onUndo,
      },
      ...(options?.actions || []),
    ],
  });
};

// Dismiss & Remove utilities
showToast.dismiss = (toastId?: string) => solidToast.dismiss(toastId);
showToast.remove = (toastId?: string) => solidToast.remove(toastId);

// Export alias for drop-in compatibility
export const toast = showToast;
export default showToast;
