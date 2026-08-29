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
    return await driver.checkStatus();
  }

  /**
   * Checks status of a specific IP / Hostname address using Native Rust IPC or direct fetch.
   */
  public async testAddress(address: string): Promise<PrinterStatusResult> {
    // 1. Try Tauri Native Rust IPC command if running in Tauri
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res: any = await invoke("printer_check_status", { address });
        if (res) {
          return {
            connected: res.connected ?? false,
            ready: res.ready ?? false,
            paperEmpty: res.paper_empty ?? false,
            hasError: res.has_error ?? false,
            rawStatus: res.raw_status ?? 0,
            statusText: res.status_text || "Offline",
            address: res.address || address,
          };
        }
      } catch (err) {
        console.warn("[Printer Service] Native status query failed, falling back:", err);
      }
    }

    // 2. Direct driver fetch
    return await this.dymoDriver.checkStatus(address);
  }

  /**
   * Network discovery via Native Rust sockets (app-side).
   */
  public async discoverPrinters(
    onProgress?: (scanned: number, total: number) => void
  ): Promise<DiscoveredPrinter[]> {
    const discovered: DiscoveredPrinter[] = [];
    const seenAddresses = new Set<string>();

    const addDiscovered = (addr: string, name: string, status: PrinterStatusResult) => {
      const cleanAddr = addr.trim().toLowerCase();
      if (!seenAddresses.has(cleanAddr) && status.connected) {
        seenAddresses.add(cleanAddr);
        discovered.push({ address: addr, name, status });
      }
    };

    onProgress?.(10, 100);

    // 1. Native Tauri Rust Subnet & mDNS Scan (Zero CORS restrictions, app-side)
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        onProgress?.(40, 100);
        const { invoke } = await import("@tauri-apps/api/core");
        const nativeResults: any = await invoke("printer_discover");
        onProgress?.(90, 100);

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
        if (discovered.length > 0) return discovered;
      } catch (err) {
        console.warn("[Printer Service] Native Rust discovery failed:", err);
      }
    }

    // 2. Fallback: query user's saved address and standard mDNS hostnames directly
    onProgress?.(80, 100);
    const savedAddress = getDeviceSetting("printerAddress");
    const candidates = Array.from(
      new Set([savedAddress, "dymo-printer.local", "dymo.local"]).values()
    ).filter(Boolean);

    for (const cand of candidates) {
      try {
        const res = await this.testAddress(cand);
        if (res.connected) {
          addDiscovered(cand, `Dymo ESP32 (${cand})`, res);
        }
      } catch (_) {}
    }

    onProgress?.(100, 100);
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
    const printers = await this.discoverPrinters(onProgress);

    if (printers.length === 1) {
      const selected = printers[0];
      setDeviceSetting("printerAddress", selected.address);
      setDeviceSetting("printerDriverType", "dymo_esp32");
      return {
        printers,
        autoSelected: selected,
        statusMessage: `Found 1 Dymo ESP32 printer at ${selected.address}. Selected automatically!`,
      };
    } else if (printers.length > 1) {
      return {
        printers,
        autoSelected: null,
        statusMessage: `Found ${printers.length} printers on your network. Please select one.`,
      };
    } else {
      return {
        printers: [],
        autoSelected: null,
        statusMessage: "No Dymo ESP32 print servers found on network.",
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

    await driver.printCanvas(canvas, {
      ...options,
      density,
      speed,
    });
  }
}

export const printerService = new PrinterService();
