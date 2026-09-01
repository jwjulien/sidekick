/**
 * Hardware Printer Driver System
 * Supports Dymo LabelWriter 450 connected via ESP32 Print Server HTTP API
 * executed strictly via App-side Tauri Rust Backend (0 CORS constraints, 0 FastAPI server calls).
 */

export const PrinterStatusBit = {
  None: 0,
  Ready: 1 << 0,  // 1
  Top: 1 << 1,    // 2
  Empty: 1 << 5,  // 32
  Error: 1 << 7,  // 128
} as const;

export type FeedType = "forward" | "reverse" | "short";
export type PrintSpeed = "text" | "graphics";
export type PrintDensity = "light" | "medium" | "normal" | "dark";

export class PrinterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrinterError";
  }
}

export interface PrinterStatusResult {
  connected: boolean;
  ready: boolean;
  paperEmpty: boolean;
  hasError: boolean;
  rawStatus: number;
  statusText: string;
  address: string;
}

export interface PrintOptions {
  density?: PrintDensity;
  speed?: PrintSpeed;
  feedType?: FeedType;
  doubleWidth?: boolean;
  onProgress?: (stage: string, percent: number) => void;
}

export interface IPrinterDriver {
  driverType: string;
  checkStatus(targetAddress?: string): Promise<PrinterStatusResult>;
  printCanvas(canvas: HTMLCanvasElement, options?: PrintOptions, targetAddress?: string): Promise<void>;
}

/**
 * Dymo ESP32 Hardware Printer Driver
 * Handles network binary stream transmission and monochrome 1-bit rasterization
 * directly via Tauri Rust backend sockets.
 */
export class DymoEsp32Driver implements IPrinterDriver {
  readonly driverType = "dymo_esp32";
  private defaultAddress: string;

  constructor(address: string = "dymo-printer.local") {
    this.defaultAddress = address;
  }

  public getAddress(overrideAddress?: string): string {
    let addr = (overrideAddress || this.defaultAddress || "dymo-printer.local").trim();
    // Strip trailing slash or protocol prefix if included by mistake
    addr = addr.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return addr;
  }

  private async request(
    endpoint: string,
    method: "get" | "post" = "get",
    params?: Record<string, any>,
    data?: Uint8Array,
    mime?: string,
    targetAddress?: string,
    timeoutMs: number = 5000
  ): Promise<Response> {
    const address = this.getAddress(targetAddress);
    const paramStr = params ? "?" + new URLSearchParams(params).toString() : "";
    const headers: Record<string, string> = {
      "Content-Type": mime || "text/plain",
    };

    console.info(`[Printer Driver] HTTP ${method.toUpperCase()} address="${address}", endpoint="${endpoint}"${paramStr}`);

    // 1. App-side Native Tauri Rust Execution (0 CORS constraints, 0 FastAPI server overhead)
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        console.info(`[Printer Driver] Invoking Tauri IPC "printer_send_request" for http://${address}/${endpoint}...`);
        const { invoke } = await import("@tauri-apps/api/core");
        const res: any = await invoke("printer_send_request", {
          address,
          endpoint,
          method,
          params: params ? Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) : null,
          body: data ? Array.from(data) : null,
          mime: mime || "text/plain",
        });

        if (res && res.ok) {
          console.info(`[Printer Driver] Tauri IPC printer response OK (${res.status_code || 200})`);
          return new Response(res.text, {
            status: res.status_code || 200,
            statusText: "OK",
            headers,
          });
        } else {
          const msg = res?.text || "Native Rust printer request failed";
          console.warn(`[Printer Driver] Tauri IPC printer response NOT OK: ${msg}`);
          throw new PrinterError(msg);
        }
      } catch (err: any) {
        console.warn(`[Printer Driver] Tauri IPC printer error for http://${address}/${endpoint}:`, err?.message || err);
        if (err instanceof PrinterError) throw err;
        throw new PrinterError(`Tauri Rust printer error: ${err.message || err}`);
      }
    }

    // 2. Direct browser fetch fallback (for pure web browser dev mode)
    const directUrl = `http://${address}/${endpoint}${paramStr}`;
    console.info(`[Printer Driver] Direct browser fetch to URL: ${directUrl}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(directUrl, {
        method,
        headers,
        body: data as any,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.warn(`[Printer Driver] Direct fetch HTTP ${response.status} error from ${directUrl}: ${errorText}`);
        throw new PrinterError(`Printer returned error (${response.status}): ${errorText}`);
      }

      console.info(`[Printer Driver] Direct fetch HTTP ${response.status} successful for ${directUrl}`);
      return response;
    } catch (err: any) {
      clearTimeout(timer);
      console.warn(`[Printer Driver] Direct fetch failed for ${directUrl}:`, err?.message || err);
      if (err instanceof PrinterError) throw err;
      throw new PrinterError(`Failed to reach printer at ${address}: ${err.message || err}`);
    }
  }

  /**
   * Queries status from ESP32 printer server.
   */
  public async checkStatus(targetAddress?: string): Promise<PrinterStatusResult> {
    const address = this.getAddress(targetAddress);
    console.info(`[Printer Driver] Querying status endpoint for address: "${address}"...`);
    try {
      const response = await this.request("status", "get", undefined, undefined, undefined, address, 4000);
      const json = await response.json();
      const rawStatus = typeof json.status === "number" ? json.status : 1;

      const ready = (rawStatus & PrinterStatusBit.Ready) !== 0 || rawStatus === 1;
      const paperEmpty = (rawStatus & PrinterStatusBit.Empty) !== 0;
      const hasError = (rawStatus & PrinterStatusBit.Error) !== 0;

      let statusText = "Online & Ready";
      if (paperEmpty) statusText = "Paper Empty";
      else if (hasError) statusText = "Printer Hardware Error";
      else if (!ready) statusText = "Not Ready";

      const res: PrinterStatusResult = {
        connected: true,
        ready: ready && !paperEmpty && !hasError,
        paperEmpty,
        hasError,
        rawStatus,
        statusText,
        address,
      };
      console.info(`[Printer Driver] Status result for "${address}":`, res);
      return res;
    } catch (err: any) {
      const res: PrinterStatusResult = {
        connected: false,
        ready: false,
        paperEmpty: false,
        hasError: true,
        rawStatus: 0,
        statusText: err.message || "Offline / Unreachable",
        address,
      };
      console.warn(`[Printer Driver] Check status failed for "${address}":`, res.statusText);
      return res;
    }
  }

  /**
   * Resets the ESP32 print buffer state.
   */
  public async reset(targetAddress?: string): Promise<void> {
    console.info(`[Printer Driver] Resetting print buffer for address "${targetAddress || this.defaultAddress}"...`);
    await this.request("reset", "post", undefined, undefined, undefined, targetAddress);
  }

  /**
   * Sets canvas height in pixels on printer.
   */
  public async setHeight(pixels: number, targetAddress?: string): Promise<void> {
    console.info(`[Printer Driver] Setting height=${pixels}px for address "${targetAddress || this.defaultAddress}"...`);
    await this.request("height", "post", { pixels }, undefined, undefined, targetAddress);
  }

  /**
   * Configures print feed type.
   */
  public async feed(type: FeedType = "forward", targetAddress?: string): Promise<void> {
    console.info(`[Printer Driver] Feeding label (type=${type}) for address "${targetAddress || this.defaultAddress}"...`);
    await this.request("feed", "post", { type }, undefined, undefined, targetAddress);
  }

  /**
   * Configures print speed.
   */
  public async setSpeed(mode: PrintSpeed, targetAddress?: string): Promise<void> {
    console.info(`[Printer Driver] Setting print speed=${mode} for address "${targetAddress || this.defaultAddress}"...`);
    await this.request("speed", "post", { mode }, undefined, undefined, targetAddress);
  }

  /**
   * Configures print density.
   */
  public async setDensity(shade: PrintDensity, targetAddress?: string): Promise<void> {
    console.info(`[Printer Driver] Setting print density=${shade} for address "${targetAddress || this.defaultAddress}"...`);
    await this.request("density", "post", { shade }, undefined, undefined, targetAddress);
  }

  /**
   * POSTs raw binary 1-bit raster data to printer.
   */
  public async print(data: Uint8Array, targetAddress?: string): Promise<void> {
    console.info(`[Printer Driver] Transmitting ${data.length} bytes binary raster data to address "${targetAddress || this.defaultAddress}"...`);
    await this.request("print", "post", undefined, data, "application/octet-stream", targetAddress, 15000);
  }

  /**
   * Converts HTML5 Canvas into vertical column packed Uint8Array binary format.
   */
  public rasterizeCanvas(canvas: HTMLCanvasElement, doubleWidth?: boolean): Uint8Array {
    console.info(`[Printer Driver] Rasterizing canvas (${canvas.width}x${canvas.height}px, doubleWidth=${doubleWidth ?? (canvas.width < 800)})...`);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new PrinterError("Failed to get 2D rendering context from canvas.");

    const shouldDouble = doubleWidth ?? (canvas.width < 800);
    const scaleX = shouldDouble ? 2 : 1;
    const targetWidth = canvas.width * scaleX;
    const targetHeight = canvas.height;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) throw new PrinterError("Failed to create temporary canvas for rasterization.");

    // Fill white background to ensure transparency is treated as white
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, targetWidth, targetHeight);
    tempCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
    const pixels = imageData.data;
    const printerColumns: number[][] = [];

    // Column by column (left to right)
    for (let x = 0; x < targetWidth; x++) {
      const columnBytes: number[] = [];
      let currentByte = 0;
      let bitIndex = 7;

      // Bottom to top pixel iteration per column
      for (let y = targetHeight - 1; y >= 0; y--) {
        const pixelIndex = (y * targetWidth + x) * 4;
        const r = pixels[pixelIndex];
        const g = pixels[pixelIndex + 1];
        const b = pixels[pixelIndex + 2];
        const a = pixels[pixelIndex + 3];

        // Evaluate pixel darkness (black if luminance < 180 and opaque)
        const isBlack = a > 32 && (r + g + b) / 3 < 180;
        if (isBlack) {
          currentByte |= 1 << bitIndex;
        }

        if (bitIndex === 0 || y === 0) {
          columnBytes.push(currentByte);
          currentByte = 0;
          bitIndex = 7;
        } else {
          bitIndex--;
        }
      }
      printerColumns.push(columnBytes);
    }

    const rasterBytes = new Uint8Array(printerColumns.flat());
    console.info(`[Printer Driver] Rasterization complete: generated ${rasterBytes.length} bytes for printer stream.`);
    return rasterBytes;
  }

  /**
   * Complete print execution sequence.
   */
  public async printCanvas(
    canvas: HTMLCanvasElement,
    options?: PrintOptions,
    targetAddress?: string
  ): Promise<void> {
    const address = this.getAddress(targetAddress);
    const onProgress = options?.onProgress;

    console.info(`[Printer Driver] Starting full printCanvas workflow for target "${address}"...`);

    onProgress?.("Connecting to printer...", 10);
    await this.reset(address);

    onProgress?.("Rasterizing label canvas...", 30);
    const binaryData = this.rasterizeCanvas(canvas, options?.doubleWidth ?? true);

    onProgress?.("Configuring printer height & density...", 50);
    await this.setHeight(canvas.height, address);
    await this.setSpeed(options?.speed || "graphics", address);
    await this.setDensity(options?.density || "dark", address);

    onProgress?.("Transmitting bitmap payload to ESP32...", 75);
    await this.print(binaryData, address);

    onProgress?.("Feeding label paper...", 90);
    await this.feed(options?.feedType || "forward", address);

    onProgress?.("Print completed successfully!", 100);
    console.info(`[Printer Driver] printCanvas workflow completed successfully for target "${address}"!`);
  }
}

/**
 * Fallback Browser Native Printer Driver
 * Uses system window.print() dialog.
 */
export class BrowserNativeDriver implements IPrinterDriver {
  readonly driverType = "browser_native";

  public async checkStatus(): Promise<PrinterStatusResult> {
    console.info("[Printer Driver] Checking browser native printer driver status...");
    return {
      connected: true,
      ready: true,
      paperEmpty: false,
      hasError: false,
      rawStatus: 1,
      statusText: "System Default Printer Available",
      address: "localhost",
    };
  }

  public async printCanvas(canvas: HTMLCanvasElement, options?: PrintOptions): Promise<void> {
    console.info("[Printer Driver] Printing via browser native print dialog window...");
    options?.onProgress?.("Opening system print dialog...", 50);
    const dataUrl = canvas.toDataURL("image/png");
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      console.error("[Printer Driver] Failed to open print window (popup blocker active).");
      throw new PrinterError("Failed to open print window. Check popup blocker.");
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Label</title>
          <style>
            @page { size: auto; margin: 0; }
            body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: white; }
            img { max-width: 100%; height: auto; image-rendering: pixelated; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <img src="${dataUrl}" />
        </body>
      </html>
    `);
    printWindow.document.close();
    options?.onProgress?.("Print dialog launched", 100);
    console.info("[Printer Driver] Native print dialog window created.");
  }
}
