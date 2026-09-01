import { onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import toast from "solid-toast";
import { parseDeepLink, type ParsedDeepLink } from "../utils/deepLink";
import { nfcService } from "../services/nfcService";

export function useDeepLink() {
  let navigate: ReturnType<typeof useNavigate> | null = null;
  try {
    navigate = useNavigate();
    console.info("[DeepLink Engine] Router navigate hook initialized successfully.");
  } catch (err) {
    console.warn("[DeepLink Engine] Router navigate hook initialization warning:", err);
  }

  onMount(() => {
    let unlistenDeepLink: (() => void) | undefined;
    let unlistenNfcEvent: (() => void) | undefined;
    let isMounted = true;

    let lastHandledUrl = "";
    let lastHandledTime = 0;

    const routeToDeepLink = (parsed: ParsedDeepLink, source: string) => {
      const now = Date.now();
      if (parsed.rawUrl === lastHandledUrl && now - lastHandledTime < 1500) {
        console.info(`[DeepLink Engine] [${source}] Suppressing duplicate scan within 1.5s: "${parsed.rawUrl}"`);
        return;
      }
      lastHandledUrl = parsed.rawUrl;
      lastHandledTime = now;

      console.info(`[DeepLink Engine] [${source}] Parsed deep link payload: action="${parsed.action}", targetRoute="${parsed.targetRoute}", id="${parsed.id || ""}"`, parsed);

      const evt = new CustomEvent("sidekick:nfc-scanned", { detail: parsed, cancelable: true });
      const handled = !window.dispatchEvent(evt);
      console.info(`[DeepLink Engine] [${source}] Custom Event "sidekick:nfc-scanned" dispatch result: handledInModal=${handled}`);

      if (!handled) {
        toast(`${source}: Navigating to ${parsed.action}`, { id: "deep-link-toast", icon: "🔗" });
        if (navigate) {
          console.info(`[DeepLink Engine] [${source}] Navigating to target route: "${parsed.targetRoute}"`);
          navigate(parsed.targetRoute);
        } else {
          console.warn(`[DeepLink Engine] [${source}] Router navigate function unavailable. Window fallback redirect to "${parsed.targetRoute}"`);
          window.location.href = parsed.targetRoute;
        }
      }
    };

    const setupListeners = async () => {
      const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
      if (!isTauri) {
        console.info("[DeepLink Engine] Running in Web environment (non-Tauri). Skipping native OS scheme and NFC listeners.");
        return;
      }
      console.info("[DeepLink Engine] Setting up native Tauri OS deep link scheme and NFC listeners...");

      // 1. Deep Link Plugin Listener (OS URIs like fuse://...)
      try {
        const { onOpenUrl, getCurrent } = await import("@tauri-apps/plugin-deep-link");

        const currentUrls = await getCurrent();
        console.info("[DeepLink Engine] Initial deep link URLs on startup:", currentUrls);
        if (currentUrls && currentUrls.length > 0) {
          for (const rawUrl of currentUrls) {
            const parsed = parseDeepLink(rawUrl);
            console.info("[DeepLink Engine] Processing initial startup URL:", rawUrl, "->", parsed);
            if (parsed) {
              routeToDeepLink(parsed, "OS Deep Link");
              break;
            }
          }
        }

        unlistenDeepLink = await onOpenUrl((urls: string[]) => {
          console.info("[DeepLink Engine] Received runtime OS deep link URLs:", urls);
          for (const rawUrl of urls) {
            const parsed = parseDeepLink(rawUrl);
            console.info("[DeepLink Engine] Processing runtime OS deep link URL:", rawUrl, "->", parsed);
            if (parsed) {
              routeToDeepLink(parsed, "OS Deep Link");
              break;
            }
          }
        });
        console.info("[DeepLink Engine] OS Deep Link plugin listener registered.");
      } catch (err) {
        console.warn("[DeepLink Engine] OS Deep Link plugin setup warning:", err);
      }

      // 2. Mobile Native NFC Reader Scan Loop (@tauri-apps/plugin-nfc)
      try {
        const { isAvailable, scan } = await import("@tauri-apps/plugin-nfc");
        const available = await isAvailable();
        console.info("[DeepLink Engine] Mobile Native NFC plugin availability:", available);
        if (available) {
          (async () => {
            console.info("[DeepLink Engine] Starting Mobile NFC continuous scan loop...");
            while (isMounted) {
              if (nfcService.isWriting()) {
                await new Promise((r) => setTimeout(r, 500));
                continue;
              }
              try {
                const tag = await scan({ type: "tag" });
                console.info("[DeepLink Engine] Mobile NFC tag scanned:", tag);
                if (tag && tag.records) {
                  for (const rec of tag.records) {
                    if (rec.payload && rec.payload.length > 0) {
                      const prefixCode = rec.payload[0];
                      const prefixes: Record<number, string> = {
                        0x00: "",
                        0x01: "http://www.",
                        0x02: "https://www.",
                        0x03: "http://",
                        0x04: "https://",
                      };
                      const prefix = prefixes[prefixCode] ?? "";
                      const body = new TextDecoder().decode(new Uint8Array(rec.payload.slice(1)));
                      const rawUrl = prefix + body;
                      console.info("[DeepLink Engine] Decoded Mobile NFC payload:", { prefixCode, prefix, body, rawUrl });
                      if (rawUrl.startsWith("fuse://")) {
                        const parsed = parseDeepLink(rawUrl);
                        if (parsed) {
                          routeToDeepLink(parsed, "Mobile NFC Tag");
                          break;
                        }
                      }
                    }
                  }
                }
              } catch (scanErr: any) {
                if (scanErr) {
                  console.info("[DeepLink Engine] Mobile NFC scan iteration event:", scanErr?.message || scanErr);
                }
                await new Promise((r) => setTimeout(r, 800));
              }
            }
          })();
        }
      } catch (err) {
        console.warn("[DeepLink Engine] Mobile NFC scanner loop setup warning:", err);
      }

      // 3. PC/SC Desktop NFC Hardware Scanner Listener ("nfc://tag-scanned")
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlistenNfcEvent = await listen<{ payload?: string | null; tag_uid?: string | null }>(
          "nfc://tag-scanned",
          (event) => {
            console.info("[DeepLink Engine] Desktop PC/SC NFC hardware event received:", event);
            const rawPayload = event.payload?.payload;
            if (rawPayload && rawPayload.startsWith("fuse://")) {
              const parsed = parseDeepLink(rawPayload);
              if (parsed) {
                routeToDeepLink(parsed, "Desktop NFC Reader");
              }
            }
          }
        );
        console.info("[DeepLink Engine] Desktop PC/SC NFC event listener registered.");
      } catch (err) {
        console.warn("[DeepLink Engine] Desktop NFC event listener setup warning:", err);
      }
    };

    setupListeners();

    onCleanup(() => {
      isMounted = false;
      if (unlistenDeepLink) unlistenDeepLink();
      if (unlistenNfcEvent) unlistenNfcEvent();
      console.info("[DeepLink Engine] Cleanup completed. Event listeners unhooked.");
    });
  });
}
