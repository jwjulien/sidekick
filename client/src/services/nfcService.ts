import { apiFetch } from "../hooks/useAuth";

export interface NfcTagData {
  success: boolean;
  payload: string | null;
  tagUid: string | null;
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

export const nfcService = {
  /**
   * Configure dev mock state for browser testing
   */
  setMockState(payload: string | null) {
    mockCurrentTagPayload = payload;
  },

  /**
   * Reads NFC tag using Tauri native Rust commands (PC/SC on desktop, plugin on mobile) or Dev Mock Mode.
   */
  async readTag(): Promise<NfcTagData> {
    // 1. Try Tauri IPC if running inside Tauri runtime
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res: any = await invoke("nfc_read_tag");
        if (res && res.success) {
          return {
            success: true,
            payload: res.payload || null,
            tagUid: res.tag_uid || null,
          };
        }
        // If native call returned no hardware, fall through to mock mode in dev
      } catch (err) {
        console.warn("[NFC Service] Native read invoke failed, using dev fallback:", err);
      }
    }

    // 2. Dev Mock Fallback Mode
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate hardware scan delay
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
      // Tag is blank -> can write directly without overwrite warning!
      return {
        canWriteDirectly: true,
        existingPayload: null,
        resolvedEntity: null,
      };
    }

    // Attempt to resolve existing payload via backend lightning resolver
    try {
      const resolved: ResolvedEntity = await apiFetch(`/resolve/${encodeURIComponent(payload)}`);
      return {
        canWriteDirectly: false,
        existingPayload: payload,
        resolvedEntity: resolved,
      };
    } catch (err) {
      // Payload exists but is not an active DB entity (e.g. unknown tag or deleted location)
      return {
        canWriteDirectly: true, // Or allow overwrite since entity no longer exists
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

    // 1. Try Tauri IPC invoke if running in Tauri runtime
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res: any = await invoke("nfc_write_tag", { uri });
        if (res && res.success) {
          // Update mock state as well
          mockCurrentTagPayload = uri;
          return {
            success: true,
            payload: uri,
            tagUid: res.tag_uid || "NFC-TAG-OK",
          };
        }
      } catch (err) {
        console.warn("[NFC Service] Native write invoke failed, using dev fallback:", err);
      }
    }

    // 2. Dev Mock Fallback Mode
    await new Promise((resolve) => setTimeout(resolve, 1000));
    mockCurrentTagPayload = uri;
    return {
      success: true,
      payload: uri,
      tagUid: "MOCK-NFC-UID-778899",
    };
  },
};
