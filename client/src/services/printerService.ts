import { DymoEsp32Driver, BrowserNativeDriver } from "./printerDriver";
import type {
  IPrinterDriver,
  PrinterStatusResult,
  PrintOptions,
} from "./printerDriver";
import { getDeviceSetting, setDeviceSetting } from "./deviceSettings";

export interface DiscoveredPrinter {
  address: string;
  name: string;
  status: PrinterStatusResult;
}

export interface DiscoveryResult {
  printers: DiscoveredPrinter[];
  autoSelected: DiscoveredPrinter | null;
  statusMessage: string;
}

class PrinterService {
  private dymoDriver: DymoEsp32Driver;
  private nativeDriver: BrowserNativeDriver;

  constructor() {
    this.dymoDriver = new DymoEsp32Driver(getDeviceSetting("printerAddress"));
    this.nativeDriver = new BrowserNativeDriver();
  }

  /**
   * Retrieves active driver based on saved user setting.
   */
  public getDriver(): IPrinterDriver {
    const driverType = getDeviceSetting("printerDriverType");
    if (driverType === "browser_native") {
      return this.nativeDriver;
    }
    const currentAddress = getDeviceSetting("printerAddress");
    return new DymoEsp32Driver(currentAddress);
  }

  /**
   * Checks status of currently configured printer.
   */
  public async checkCurrentStatus(): Promise<PrinterStatusResult> {
    const driver = this.getDriver();
    console.info(`[Printer Service] Checking current printer status using driver: ${driver.driverType}...`);
    const status = await driver.checkStatus();
    console.info(`[Printer Service] Current printer status: connected=${status.connected}, ready=${status.ready}, text="${status.statusText}"`);
    return status;
  }

  /**
   * Checks status of a specific IP / Hostname address using Native Rust IPC or direct fetch.
   */
  public async testAddress(address: string): Promise<PrinterStatusResult> {
    console.info(`[Printer Service] Testing printer address: "${address}"...`);
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    // 1. Try Tauri Native Rust IPC command if running in Tauri
    if (isTauri) {
      try {
        console.info(`[Printer Service] Invoking native Tauri IPC "printer_check_status" for "${address}"...`);
        const { invoke } = await import("@tauri-apps/api/core");
        const res: any = await invoke("printer_check_status", { address });
        if (res) {
          const result: PrinterStatusResult = {
            connected: res.connected ?? false,
            ready: res.ready ?? false,
            paperEmpty: res.paper_empty ?? false,
            hasError: res.has_error ?? false,
            rawStatus: res.raw_status ?? 0,
            statusText: res.status_text || "Offline",
            address: res.address || address,
          };
          console.info(`[Printer Service] Native status response for "${address}":`, result);
          return result;
        }
      } catch (err: any) {
        console.warn(`[Printer Service] Native status query failed for "${address}":`, err?.message || err);
      }
    } else {
      console.info(`[Printer Service] Running in Browser (non-Tauri environment). Direct fetch fallback for "${address}".`);
    }

    // 2. Direct driver fetch
    const result = await this.dymoDriver.checkStatus(address);
    console.info(`[Printer Service] Direct driver check result for "${address}":`, result);
    return result;
  }

  /**
   * Network discovery via Native Rust sockets (app-side) or mDNS fallback probes.
   */
  public async discoverPrinters(
    onProgress?: (scanned: number, total: number) => void
  ): Promise<DiscoveredPrinter[]> {
    console.info("[Printer Service] Starting printer network discovery workflow...");
    const discovered: DiscoveredPrinter[] = [];
    const seenAddresses = new Set<string>();

    const addDiscovered = (addr: string, name: string, status: PrinterStatusResult) => {
      const cleanAddr = addr.trim().toLowerCase();
      if (!seenAddresses.has(cleanAddr) && status.connected) {
        seenAddresses.add(cleanAddr);
        discovered.push({ address: addr, name, status });
        console.info(`[Printer Service] Discovered printer found: "${name}" at address "${addr}"`, status);
      }
    };

    onProgress?.(10, 100);
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    // 1. Native Tauri Rust Subnet & mDNS Scan (Zero CORS restrictions, app-side)
    if (isTauri) {
      try {
        console.info("[Printer Service] Running Tauri mDNS/subnet discovery socket scan...");
        onProgress?.(40, 100);
        const { invoke } = await import("@tauri-apps/api/core");
        const nativeResults: any = await invoke("printer_discover");
        onProgress?.(90, 100);

        console.info("[Printer Service] Raw native discovery results:", nativeResults);
        if (Array.isArray(nativeResults)) {
          for (const item of nativeResults) {
            if (item.address) {
              const rawStatus = item.status || 1;
              const ready = (rawStatus & 1) !== 0 || rawStatus === 1;
              const paperEmpty = (rawStatus & 32) !== 0;
              const hasError = (rawStatus & 128) !== 0;

              addDiscovered(item.address, item.name || `Dymo ESP32 (${item.address})`, {
                connected: true,
                ready: ready && !paperEmpty && !hasError,
                paperEmpty,
                hasError,
                rawStatus,
                statusText: ready ? "Online & Ready" : "Not Ready",
                address: item.address,
              });
            }
          }
        }
        onProgress?.(100, 100);
        if (discovered.length > 0) {
          console.info(`[Printer Service] Native Rust discovery complete. Found ${discovered.length} printer(s).`);
          return discovered;
        } else {
          console.info("[Printer Service] Native Rust discovery returned 0 printers. Moving to mDNS fallback probes...");
        }
      } catch (err: any) {
        console.warn("[Printer Service] Native Rust discovery error:", err?.message || err);
      }
    } else {
      console.info("[Printer Service] Pure web environment detected. Skipping Tauri native IPC discovery.");
    }

    // 2. Fallback: query user's saved address and standard mDNS hostnames directly
    onProgress?.(80, 100);
    const savedAddress = getDeviceSetting("printerAddress");
    const candidates = Array.from(
      new Set([savedAddress, "dymo-printer.local", "dymo.local"]).values()
    ).filter(Boolean);

    console.info(`[Printer Service] Probing fallback candidate printer addresses: ${JSON.stringify(candidates)}`);

    for (const cand of candidates) {
      try {
        console.info(`[Printer Service] Probing fallback candidate: "${cand}"...`);
        const res = await this.testAddress(cand);
        if (res.connected) {
          addDiscovered(cand, `Dymo ESP32 (${cand})`, res);
        } else {
          console.info(`[Printer Service] Candidate "${cand}" responded but not connected:`, res.statusText);
        }
      } catch (candErr: any) {
        console.warn(`[Printer Service] Failed candidate check for "${cand}":`, candErr?.message || candErr);
      }
    }

    onProgress?.(100, 100);
    console.info(`[Printer Service] Printer network discovery completed. Found ${discovered.length} total printer(s).`);
    return discovered;
  }

  /**
   * Executes discovery workflow with auto-selection rules:
   * - 1 printer found -> Auto select it!
   * - >1 printers found -> Prompt user to pick.
   * - 0 printers found -> Alert user.
   */
  public async runPrinterDiscovery(
    onProgress?: (scanned: number, total: number) => void
  ): Promise<DiscoveryResult> {
    console.info("[Printer Service] Initiating printer discovery workflow...");
    const printers = await this.discoverPrinters(onProgress);

    if (printers.length === 1) {
      const selected = printers[0];
      setDeviceSetting("printerAddress", selected.address);
      setDeviceSetting("printerDriverType", "dymo_esp32");
      const msg = `Found 1 Dymo ESP32 printer at ${selected.address}. Selected automatically!`;
      console.info(`[Printer Service] ${msg}`);
      return {
        printers,
        autoSelected: selected,
        statusMessage: msg,
      };
    } else if (printers.length > 1) {
      const msg = `Found ${printers.length} printers on your network. Please select one.`;
      console.info(`[Printer Service] ${msg}`, printers);
      return {
        printers,
        autoSelected: null,
        statusMessage: msg,
      };
    } else {
      const msg = "No Dymo ESP32 print servers found on network.";
      console.warn(`[Printer Service] ${msg}`);
      return {
        printers: [],
        autoSelected: null,
        statusMessage: msg,
      };
    }
  }

  /**
   * High-level print canvas method.
   */
  public async printCanvas(
    canvas: HTMLCanvasElement,
    options?: PrintOptions
  ): Promise<void> {
    const driver = this.getDriver();
    const density = options?.density || getDeviceSetting("printerDensity");
    const speed = options?.speed || getDeviceSetting("printerSpeed");

    console.info(`[Printer Service] Printing canvas (${canvas.width}x${canvas.height}px) using driver="${driver.driverType}", density="${density}", speed="${speed}"...`);

    try {
      await driver.printCanvas(canvas, {
        ...options,
        density,
        speed,
      });
      console.info("[Printer Service] Canvas print job finished successfully!");
    } catch (err: any) {
      console.error("[Printer Service] Print job failed with error:", err?.message || err);
      throw err;
    }
  }
}

export const printerService = new PrinterService();
