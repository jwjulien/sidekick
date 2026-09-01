import { apiFetch } from "../hooks/useAuth";

export interface NfcTagData {
  success: boolean;
  payload: string | null;
  tagUid: string | null;
  error?: string;
}

export interface NfcReaderStatus {
  connected: boolean;
  readerName: string | null;
  cardPresent: boolean;
  error?: string;
}

export interface ResolvedEntity {
  entity_type: "location" | "part";
  entity_id: string;
  display_name: string;
  breadcrumb: string;
  target_route: string;
}

export interface NfcWriteCheckResult {
  canWriteDirectly: boolean;
  existingPayload: string | null;
  resolvedEntity: ResolvedEntity | null;
  error?: string;
}

// Dev Mock State for Desktop Browser Testing
let mockCurrentTagPayload: string | null = null; // Set to simulate an already programmed tag

let isWritingActive = false;

export const nfcService = {
  isWriting(): boolean {
    return isWritingActive;
  },

  setIsWriting(val: boolean) {
    isWritingActive = val;
  },

  /**
   * Configure dev mock state for browser testing
   */
  setMockState(payload: string | null) {
    mockCurrentTagPayload = payload;
  },

  /**
   * Checks connection status of PC/SC USB Reader (ACR122U).
   */
  async getReaderStatus(): Promise<NfcReaderStatus> {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      // 1. Try mobile native plugin check first
      try {
        const { isAvailable } = await import("@tauri-apps/plugin-nfc");
        const available = await isAvailable();
        if (available) {
          return {
            connected: true,
            readerName: "Android NFC Adapter",
            cardPresent: false,
          };
        }
      } catch (_) {
        // Fall back to desktop Rust PC/SC query
      }

      // 2. Desktop PC/SC reader check via Tauri Rust IPC
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res: any = await invoke("nfc_get_status");
        if (res) {
          return {
            connected: res.connected ?? false,
            readerName: res.reader_name || null,
            cardPresent: res.card_present ?? false,
            error: res.error || undefined,
          };
        }
      } catch (err) {
        console.warn("[NFC Service] Reader status query failed:", err);
      }
    }

    return {
      connected: true,
      readerName: "Dev Mock Reader",
      cardPresent: false,
    };
  },

  /**
   * Reads NFC tag using native mobile plugin (@tauri-apps/plugin-nfc) on Android/iOS,
   * Tauri native Rust PC/SC commands on Desktop, or Dev Mock Mode.
   */
  async readTag(): Promise<NfcTagData> {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      // 1. Try mobile native NFC scan if available
      try {
        const { isAvailable, scan } = await import("@tauri-apps/plugin-nfc");
        if (await isAvailable()) {
          const tag = await scan({ type: "tag" });
          const tagUid = tag.id && tag.id.length > 0
            ? tag.id.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":")
            : null;

          let payload: string | null = null;
          if (tag.records && tag.records.length > 0) {
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
                payload = prefix + body;
                if (payload) break;
              }
            }
          }

          return {
            success: true,
            payload,
            tagUid,
          };
        }
      } catch (mobileErr: any) {
        console.warn("[NFC Service] Native mobile scan error:", mobileErr);
        const errMsg = typeof mobileErr === "string" ? mobileErr : mobileErr?.message || "NFC scan failed or cancelled";
        return {
          success: false,
          payload: null,
          tagUid: null,
          error: errMsg,
        };
      }

      // 2. Desktop PC/SC Rust command fallback
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res: any = await invoke("nfc_read_tag");
        if (res) {
          return {
            success: res.success ?? false,
            payload: res.payload || null,
            tagUid: res.tag_uid || null,
            error: res.error || undefined,
          };
        }
      } catch (err) {
        console.warn("[NFC Service] Native desktop read invoke failed:", err);
      }
    }

    // 3. Dev Mock Fallback Mode
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      success: true,
      payload: mockCurrentTagPayload,
      tagUid: "MOCK-NFC-UID-778899",
    };
  },

  /**
   * Safety Check: Reads existing tag payload and resolves it via backend API to check for overwrites.
   */
  async checkTagBeforeWrite(): Promise<NfcWriteCheckResult> {
    const scanResult = await this.readTag();
    if (!scanResult.success) {
      return {
        canWriteDirectly: false,
        existingPayload: null,
        resolvedEntity: null,
        error: scanResult.error || "Failed to scan NFC tag",
      };
    }

    const payload = scanResult.payload;
    if (!payload || !payload.trim()) {
      return {
        canWriteDirectly: true,
        existingPayload: null,
        resolvedEntity: null,
      };
    }

    try {
      const resolved: ResolvedEntity = await apiFetch(`/resolve/${encodeURIComponent(payload)}`);
      return {
        canWriteDirectly: false,
        existingPayload: payload,
        resolvedEntity: resolved,
      };
    } catch (err) {
      return {
        canWriteDirectly: true,
        existingPayload: payload,
        resolvedEntity: null,
      };
    }
  },

  /**
   * Programs an NDEF URI payload (e.g. fuse://location/{id} or fuse://part/{id}) to the physical tag.
   */
  async writeTag(uri: string): Promise<NfcTagData> {
    if (!uri || !uri.startsWith("fuse://")) {
      return {
        success: false,
        payload: null,
        tagUid: null,
        error: "Invalid payload format. Must use fuse:// scheme.",
      };
    }

    this.setIsWriting(true);

    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        // 1. Try mobile native NFC plugin write first
        try {
          const { isAvailable, scan, write, uriRecord } = await import("@tauri-apps/plugin-nfc");
          if (await isAvailable()) {
            console.log("[NFC-DEBUG] [nfcService writeTag] Initiating scan-then-write sequence for URI:", uri);
            const rec = uriRecord(uri);

            // Step 1: Scan and hold tag connection alive
            console.log("[NFC-DEBUG] [nfcService writeTag] Step 1: Scanning tag with keepSessionAlive: true...");
            const scannedTag = await scan({ type: "tag" }, { keepSessionAlive: true });
            console.log("[NFC-DEBUG] [nfcService writeTag] Step 1 complete! Connected tag:", scannedTag);

            // Step 2: Write NDEF record to connected tag
            console.log("[NFC-DEBUG] [nfcService writeTag] Step 2: Writing NDEF record to connected tag...");
            await write([rec]);
            console.log("[NFC-DEBUG] [nfcService writeTag] Step 2 complete! Native NDEF write succeeded!");

            mockCurrentTagPayload = uri;
            return {
              success: true,
              payload: uri,
              tagUid: null,
            };
          }
        } catch (mobileErr: any) {
          console.warn("[NFC-DEBUG] [nfcService writeTag] Native mobile write error:", mobileErr);
          const errMsg = typeof mobileErr === "string" ? mobileErr : mobileErr?.message || "NFC write failed or cancelled";
          return {
            success: false,
            payload: null,
            tagUid: null,
            error: errMsg,
          };
        }

        // 2. Desktop PC/SC Rust command fallback
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const res: any = await invoke("nfc_write_tag", { uri });
          if (res) {
            if (res.success) {
              mockCurrentTagPayload = uri;
            }
            return {
              success: res.success ?? false,
              payload: res.payload || null,
              tagUid: res.tag_uid || null,
              error: res.error || undefined,
            };
          }
        } catch (err) {
          console.warn("[NFC Service] Native desktop write invoke failed:", err);
        }
      }

      // 3. Dev Mock Fallback Mode
      await new Promise((resolve) => setTimeout(resolve, 1000));
      mockCurrentTagPayload = uri;
      return {
        success: true,
        payload: uri,
        tagUid: "MOCK-NFC-UID-778899",
      };
    } finally {
      this.setIsWriting(false);
    }
  },
};
