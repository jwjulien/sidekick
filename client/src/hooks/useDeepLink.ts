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

    let unlistenDeepLink: (() => void) | undefined;
    let unlistenNfcEvent: (() => void) | undefined;

    const setupListeners = async () => {
      // Check if Tauri is present
      if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
        return;
      }

      // 1. Deep Link Plugin Listener (OS URIs like fuse://...)
      try {
        const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");

        unlistenDeepLink = await onOpenUrl((urls: string[]) => {
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

      // 2. PC/SC Desktop NFC Hardware Scanner Listener ("nfc://tag-scanned")
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlistenNfcEvent = await listen<{ payload?: string | null; tag_uid?: string | null }>(
          "nfc://tag-scanned",
          (event) => {
            console.log("NFC Event:", event);
            const rawPayload = event.payload?.payload;
            if (rawPayload && rawPayload.startsWith("fuse://")) {
              const parsed = parseDeepLink(rawPayload);
              if (parsed) {
                toast(`NFC Reader: Navigating to ${parsed.action}`, { id: "nfc-tap-toast", icon: "🏷️" });
                window.dispatchEvent(new CustomEvent("sidekick:nfc-scanned", { detail: parsed }));
                if (navigate) {
                  navigate(parsed.targetRoute);
                } else {
                  window.location.href = parsed.targetRoute;
                }
              }
            }
          }
        );
      } catch (err) {
        console.warn("[NFC Event] Hardware listener setup warning:", err);
      }
    };

    setupListeners();

    onCleanup(() => {
      if (unlistenDeepLink) unlistenDeepLink();
      if (unlistenNfcEvent) unlistenNfcEvent();
    });
  });
}
