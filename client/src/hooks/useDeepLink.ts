import { onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import toast from "solid-toast";
import { parseDeepLink } from "../utils/deepLink";

export function useDeepLink() {
  onMount(() => {
    let navigate: ReturnType<typeof useNavigate> | null = null;
    try {
      navigate = useNavigate();
    } catch (_) {
      // Catch error if invoked outside a Route context
    }

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      // Check if Tauri is present
      if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
        return;
      }

      try {
        const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
        
        unlisten = await onOpenUrl((urls: string[]) => {
          for (const rawUrl of urls) {
            const parsed = parseDeepLink(rawUrl);
            if (parsed) {
              toast(`Deep link: Navigating to ${parsed.action}`, { id: "deep-link-toast", icon: "🔗" });
              if (navigate) {
                navigate(parsed.targetRoute);
              } else {
                window.location.href = parsed.targetRoute;
              }
              break;
            }
          }
        });
      } catch (err) {
        console.warn("[DeepLink] Plugin setup warning:", err);
      }
    };

    setupListener();

    onCleanup(() => {
      if (unlisten) {
        unlisten();
      }
    });
  });
}
