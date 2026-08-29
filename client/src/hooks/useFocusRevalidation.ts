import { onMount, onCleanup } from "solid-js";

interface Options {
  /** Minimum time in milliseconds between revalidation triggers. Default: 3000ms */
  minIntervalMs?: number;
  /** Whether revalidation is enabled. Default: true */
  enabled?: boolean;
}

/**
 * Custom hook that automatically triggers a refetch callback whenever the user switches
 * back to the browser window or phone tab (via window focus or visibilitychange).
 */
export function useFocusRevalidation(
  refetch: () => void | Promise<void>,
  options: Options = {}
) {
  const minInterval = options.minIntervalMs ?? 3000;
  let lastFetchTime = Date.now();

  const triggerRevalidation = () => {
    if (options.enabled === false) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const now = Date.now();
    if (now - lastFetchTime >= minInterval) {
      lastFetchTime = now;
      refetch();
    }
  };

  onMount(() => {
    if (typeof window === "undefined") return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerRevalidation();
      }
    };

    const onFocus = () => {
      triggerRevalidation();
    };

    const onCustomRevalidate = () => {
      triggerRevalidation();
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("app:revalidate", onCustomRevalidate);

    onCleanup(() => {
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("app:revalidate", onCustomRevalidate);
    });
  });
}

/**
 * Dispatch an application-wide revalidation event so all active focus-listeners refresh.
 */
export function triggerAppRevalidate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:revalidate"));
  }
}
