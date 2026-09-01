import { onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import toast from "solid-toast";
import { parseDeepLink, type ParsedDeepLink } from "../utils/deepLink";

import { nfcService } from "../services/nfcService";

export function useDeepLink() {
  let navigate: ReturnType<typeof useNavigate> | null = null;
  try {
    navigate = useNavigate();
    console.log("[NFC-DEBUG] [useDeepLink] useNavigate initialized successfully.");
  } catch (err) {
    console.warn("[NFC-DEBUG] [useDeepLink] useNavigate initialization warning:", err);
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
        console.log(`[NFC-DEBUG] [${source}] Suppressing duplicate scan within 1.5s:`, parsed.rawUrl);
        return;
      }
      lastHandledUrl = parsed.rawUrl;
      lastHandledTime = now;

      console.log(`[NFC-DEBUG] [${source}] Dispatching sidekick:nfc-scanned event:`, parsed);
      const evt = new CustomEvent("sidekick:nfc-scanned", { detail: parsed, cancelable: true });
      const handled = !window.dispatchEvent(evt);
      console.log(`[NFC-DEBUG] [${source}] Event handled status:`, handled, `navigate function present:`, !!navigate);
      if (!handled) {
        toast(`${source}: Navigating to ${parsed.action}`, { id: "deep-link-toast", icon: "🔗" });
        if (navigate) {
          console.log(`[NFC-DEBUG] [${source}] Calling SolidJS navigate("${parsed.targetRoute}")`);
          navigate(parsed.targetRoute);
        } else {
          console.warn(`[NFC-DEBUG] [${source}] navigate is null! Falling back to window.location.href = "${parsed.targetRoute}"`);
          window.location.href = parsed.targetRoute;
        }
      }
    };

    const setupListeners = async () => {
      if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
        console.log("[NFC-DEBUG] Not running inside Tauri window, skipping native listeners.");
        return;
      }
      console.log("[NFC-DEBUG] [setupListeners] Initializing Tauri deep link and NFC listeners...");

      // 1. Deep Link Plugin Listener (OS URIs like fuse://...)
      try {
        const { onOpenUrl, getCurrent } = await import("@tauri-apps/plugin-deep-link");

        const currentUrls = await getCurrent();
        console.log("[NFC-DEBUG] [DeepLink getCurrent] Initial URLs:", currentUrls);
        if (currentUrls && currentUrls.length > 0) {
          for (const rawUrl of currentUrls) {
            const parsed = parseDeepLink(rawUrl);
            console.log("[NFC-DEBUG] [DeepLink getCurrent] Parsed initial URL:", rawUrl, "->", parsed);
            if (parsed) {
              routeToDeepLink(parsed, "Deep link");
              break;
            }
          }
        }

        unlistenDeepLink = await onOpenUrl((urls: string[]) => {
          console.log("[NFC-DEBUG] [DeepLink onOpenUrl] Received URLs:", urls);
          for (const rawUrl of urls) {
            const parsed = parseDeepLink(rawUrl);
            console.log("[NFC-DEBUG] [DeepLink onOpenUrl] Parsed URL:", rawUrl, "->", parsed);
            if (parsed) {
              routeToDeepLink(parsed, "Deep link");
              break;
            }
          }
        });
        console.log("[NFC-DEBUG] [DeepLink] Listener registered.");
      } catch (err) {
        console.warn("[NFC-DEBUG] [DeepLink] Plugin setup warning:", err);
      }

      // 2. Mobile Native NFC Reader Scan Loop (@tauri-apps/plugin-nfc)
      try {
        const { isAvailable, scan } = await import("@tauri-apps/plugin-nfc");
        const available = await isAvailable();
        console.log("[NFC-DEBUG] [Mobile NFC] isAvailable:", available);
        if (available) {
          (async () => {
            console.log("[NFC-DEBUG] [Mobile NFC] Starting continuous scan loop...");
            while (isMounted) {
              if (nfcService.isWriting()) {
                await new Promise((r) => setTimeout(r, 500));
                continue;
              }
              try {
                const tag = await scan({ type: "tag" });
                console.log("[NFC-DEBUG] [Mobile NFC scan()] Tag scanned:", tag);
                if (tag && tag.records) {
                  for (const rec of tag.records) {
                    console.log("[NFC-DEBUG] [Mobile NFC scan()] Tag record:", rec);
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
                      console.log("[NFC-DEBUG] [Mobile NFC scan()] Decoded payload:", { prefixCode, prefix, body, rawUrl });
                      if (rawUrl.startsWith("fuse://")) {
                        const parsed = parseDeepLink(rawUrl);
                        console.log("[NFC-DEBUG] [Mobile NFC scan()] Parsed fuse URL:", parsed);
                        if (parsed) {
                          routeToDeepLink(parsed, "NFC Tag");
                          break;
                        }
                      }
                    }
                  }
                }
              } catch (scanErr: any) {
                if (scanErr) {
                  console.log("[NFC-DEBUG] [Mobile NFC scan()] Scan result/error:", scanErr);
                }
                await new Promise((r) => setTimeout(r, 800));
              }
            }
          })();
        }
      } catch (err) {
        console.warn("[NFC-DEBUG] [Mobile NFC] Scanner loop setup warning:", err);
      }

      // 3. PC/SC Desktop NFC Hardware Scanner Listener ("nfc://tag-scanned")
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlistenNfcEvent = await listen<{ payload?: string | null; tag_uid?: string | null }>(
          "nfc://tag-scanned",
          (event) => {
            console.log("[NFC-DEBUG] [Desktop NFC Event]:", event);
            const rawPayload = event.payload?.payload;
            if (rawPayload && rawPayload.startsWith("fuse://")) {
              const parsed = parseDeepLink(rawPayload);
              if (parsed) {
                routeToDeepLink(parsed, "NFC Reader");
              }
            }
          }
        );
      } catch (err) {
        console.warn("[NFC-DEBUG] [Desktop NFC Event] Listener setup warning:", err);
      }
    };

    setupListeners();

    onCleanup(() => {
      isMounted = false;
      if (unlistenDeepLink) unlistenDeepLink();
      if (unlistenNfcEvent) unlistenNfcEvent();
    });
  });
}
