import { createContext, useContext, createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-solid";

export type ConfirmType = "info" | "warning" | "error" | "success";

export interface ConfirmOptions {
  title: string;
  message: string;
  type?: ConfirmType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>();

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used within ConfirmProvider");
  return context;
}

export function ConfirmProvider(props: { children: JSX.Element }) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [options, setOptions] = createSignal<ConfirmOptions | null>(null);
  const [resolvePromise, setResolvePromise] = createSignal<(val: boolean) => void>();
  const [isProcessing, setIsProcessing] = createSignal(false);

  const confirm = (opts: ConfirmOptions) => {
    setOptions({
      type: "warning",
      confirmText: "Confirm",
      cancelText: "Cancel",
      ...opts
    });
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
    });
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      if (options()?.onConfirm) {
        await options()!.onConfirm!();
      }
      resolvePromise()?.(true);
    } finally {
      setIsProcessing(false);
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    if (options()?.onCancel) {
      options()!.onCancel!();
    }
    resolvePromise()?.(false);
    setIsOpen(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {props.children}
      {isOpen() && options() && (
        <Portal>
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div class="flex items-start gap-4">
                <div class="shrink-0 mt-1">
                  {options()?.type === "error" && <AlertCircle class="w-6 h-6 text-red-500" />}
                  {options()?.type === "warning" && <AlertTriangle class="w-6 h-6 text-yellow-500" />}
                  {options()?.type === "info" && <Info class="w-6 h-6 text-blue-500" />}
                  {options()?.type === "success" && <CheckCircle class="w-6 h-6 text-green-500" />}
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-bold text-white mb-2">{options()?.title}</h3>
                  <p class="text-gray-300 text-sm mb-6">{options()?.message}</p>
                  
                  <div class="flex justify-end gap-3">
                    <button 
                      class="btn-secondary text-sm py-2 px-4" 
                      onClick={handleCancel}
                      disabled={isProcessing()}
                    >
                      {options()?.cancelText}
                    </button>
                    <button 
                      class={`text-white font-semibold py-2 px-4 rounded-xl shadow-lg transition-all duration-150 cursor-pointer disabled:opacity-50 text-sm ${
                        options()?.type === "error" ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : 
                        options()?.type === "info" ? "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20" :
                        "btn-primary"
                      }`}
                      onClick={handleConfirm}
                      disabled={isProcessing()}
                    >
                      {isProcessing() ? (
                        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block align-middle"></div>
                      ) : options()?.confirmText}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </ConfirmContext.Provider>
  );
}
