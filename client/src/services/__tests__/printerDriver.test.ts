import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DymoEsp32Driver,
  BrowserNativeDriver,
  PrinterStatusBit,
} from "../printerDriver";

describe("PrinterDriver Unit Tests", () => {
  let driver: DymoEsp32Driver;

  beforeEach(() => {
    driver = new DymoEsp32Driver("192.168.1.120");
    vi.restoreAllMocks();
  });

  describe("Address formatting & getter", () => {
    it("strips http and trailing slashes from address", () => {
      expect(driver.getAddress("http://192.168.1.150/")).toBe("192.168.1.150");
      expect(driver.getAddress("https://dymo-printer.local///")).toBe("dymo-printer.local");
      expect(driver.getAddress("")).toBe("192.168.1.120");
    });
  });

  describe("Rasterization Engine", () => {
    it("correctly converts canvas context into packed 1-bit vertical column byte array", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 8; // 8 vertical pixels = 1 byte per column

      const mockImageData = {
        data: new Uint8ClampedArray(10 * 8 * 4),
      };
      // Fill black rectangle on top left 5x8
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 8; y++) {
          const idx = (y * 10 + x) * 4;
          mockImageData.data[idx] = 0;
          mockImageData.data[idx + 1] = 0;
          mockImageData.data[idx + 2] = 0;
          mockImageData.data[idx + 3] = 255;
        }
      }
      // Fill white rectangle on top right 5x8
      for (let x = 5; x < 10; x++) {
        for (let y = 0; y < 8; y++) {
          const idx = (y * 10 + x) * 4;
          mockImageData.data[idx] = 255;
          mockImageData.data[idx + 1] = 255;
          mockImageData.data[idx + 2] = 255;
          mockImageData.data[idx + 3] = 255;
        }
      }

      const mockContext = {
        fillStyle: "",
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue(mockImageData),
      };

      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext as any);

      // Execute rasterization with doubleWidth = false for simple 10x8 mapping
      const result = driver.rasterizeCanvas(canvas, false);

      expect(result).toBeInstanceOf(Uint8Array);
      // Width = 10 columns, Height = 8 pixels => 1 byte per column = 10 bytes total
      expect(result.length).toBe(10);

      // The first 5 columns should have all 8 bits filled with 1s (0xFF = 255)
      for (let i = 0; i < 5; i++) {
        expect(result[i]).toBe(255);
      }
      // The last 5 columns (white) should have 0s
      for (let i = 5; i < 10; i++) {
        expect(result[i]).toBe(0);
      }
    });

    it("handles double-width canvas scaling correctly", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 8;

      const mockImageData = {
        data: new Uint8ClampedArray(20 * 8 * 4),
      };
      const mockContext = {
        fillStyle: "",
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue(mockImageData),
      };
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext as any);

      const result = driver.rasterizeCanvas(canvas, true);
      // Double width: 10 * 2 = 20 columns * 1 byte/column = 20 bytes total
      expect(result.length).toBe(20);
    });
  });

  describe("Status bitmask parsing", () => {
    it("correctly identifies status bitmasks", async () => {
      // Mock fetch returning status bitmask 1 (Ready)
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: PrinterStatusBit.Ready }),
      } as any);

      const status = await driver.checkStatus();
      expect(status.connected).toBe(true);
      expect(status.ready).toBe(true);
      expect(status.paperEmpty).toBe(false);
      expect(status.hasError).toBe(false);
      expect(status.statusText).toBe("Online & Ready");
    });

    it("correctly flags paper empty state", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: PrinterStatusBit.Ready | PrinterStatusBit.Empty }),
      } as any);

      const status = await driver.checkStatus();
      expect(status.connected).toBe(true);
      expect(status.ready).toBe(false);
      expect(status.paperEmpty).toBe(true);
      expect(status.statusText).toBe("Paper Empty");
    });

    it("handles unreachable printer gracefully", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

      const status = await driver.checkStatus("192.168.1.999");
      expect(status.connected).toBe(false);
      expect(status.ready).toBe(false);
      expect(status.statusText).toContain("Failed to reach printer");
    });
  });

  describe("BrowserNativeDriver", () => {
    it("reports native driver as ready", async () => {
      const native = new BrowserNativeDriver();
      const status = await native.checkStatus();
      expect(status.connected).toBe(true);
      expect(status.ready).toBe(true);
      expect(native.driverType).toBe("browser_native");
    });
  });
});
