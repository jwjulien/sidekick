import { describe, it, expect } from "vitest";
import {
  parseGattPayload,
  calculateUnitWeight,
  calculateEstimatedCount,
  ScaleUnits,
} from "./scaleParser";

describe("scaleParser", () => {
  it("parses 16-byte Etekcity GATT payload in grams", () => {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);

    view.setUint8(10, 0); // Positive
    view.setUint16(11, 2540, true); // 254.0g -> raw int 2540
    view.setUint8(13, ScaleUnits.G); // 2 = g
    view.setUint8(14, 0); // Solid
    view.setUint8(15, 1); // Stable (final)

    const result = parseGattPayload(view);
    expect(result.scaledWeight).toBe(254);
    expect(result.unit).toBe("g");
    expect(result.unitEnum).toBe(ScaleUnits.G);
    expect(result.isStable).toBe(true);
    expect(result.isNegative).toBe(false);
  });

  it("parses 16-byte Etekcity GATT payload in ounces", () => {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);

    view.setUint8(10, 0); // Positive
    view.setUint16(11, 895, true); // 8.95 oz -> raw int 895
    view.setUint8(13, ScaleUnits.Oz); // 0 = oz
    view.setUint8(14, 0); // Solid
    view.setUint8(15, 1); // Stable (final)

    const result = parseGattPayload(view);
    expect(result.scaledWeight).toBe(8.95);
    expect(result.unit).toBe("oz");
    expect(result.unitEnum).toBe(ScaleUnits.Oz);
    expect(result.isStable).toBe(true);
  });

  it("handles negative weights correctly", () => {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);

    view.setUint8(10, 1); // Negative flag
    view.setUint16(11, 100, true); // 10.0g
    view.setUint8(13, ScaleUnits.G); // 2 = g
    view.setUint8(14, 0);
    view.setUint8(15, 0);

    const result = parseGattPayload(view);
    expect(result.scaledWeight).toBe(-10);
    expect(result.isNegative).toBe(true);
  });

  it("calculates per-piece unit weight accurately", () => {
    expect(calculateUnitWeight(150, 50)).toBe(3);
    expect(calculateUnitWeight(12.5, 10)).toBe(1.25);
    expect(calculateUnitWeight(0, 10)).toBe(0);
    expect(calculateUnitWeight(100, 0)).toBe(0);
  });

  it("calculates estimated count accurately", () => {
    expect(calculateEstimatedCount(300, 3)).toBe(100);
    expect(calculateEstimatedCount(126, 1.25)).toBe(101); // 126 / 1.25 = 100.8 -> 101
    expect(calculateEstimatedCount(0, 3)).toBe(0);
    expect(calculateEstimatedCount(100, 0)).toBe(0);
  });
});
