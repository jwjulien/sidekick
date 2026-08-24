/**
 * Scale GATT Notification Payload Parser and Math Utilities
 * Specially tuned for Etekcity and standard BLE kitchen/postal scales.
 */

export enum ScaleUnits {
  Oz = 0,
  LbOz = 1,
  G = 2,
  Ml = 3,
  FlOz = 4,
}

export enum ScaleLiquid {
  Solid = 0,
  Water = 1,
  Milk = 2,
}

export interface ParsedScaleData {
  rawWeight: number;
  scaledWeight: number;
  unit: "g" | "oz" | "ml";
  unitEnum: ScaleUnits;
  liquidEnum: ScaleLiquid;
  isStable: boolean;
  isNegative: boolean;
}

/**
 * Parses a standard 15+ byte GATT notification payload from BLE kitchen/postal scales (e.g. Etekcity).
 *
 * Payload byte structure:
 * - Byte 10: Sign flag (non-zero = negative)
 * - Bytes 11 & 12: 16-bit weight integer (little endian: data[11] + (data[12] << 8))
 * - Byte 13: Unit code (0 = Oz, 1 = LbOz, 2 = Grams, 3 = Ml, 4 = FlOz)
 * - Byte 14: Liquid / mode code (0 = Solid, 1 = Water, 2 = Milk)
 * - Byte 15: Stability flag (non-zero = stable/final value)
 */
export function parseGattPayload(dataView: DataView): ParsedScaleData {
  if (dataView.byteLength < 15) {
    return {
      rawWeight: 0,
      scaledWeight: 0,
      unit: "g",
      unitEnum: ScaleUnits.G,
      liquidEnum: ScaleLiquid.Solid,
      isStable: false,
      isNegative: false,
    };
  }

  // Byte 10: Sign flag
  const signByte = dataView.getUint8(10);
  const isNegative = Boolean(signByte);

  // Bytes 11 & 12: 16-bit weight integer (little-endian)
  const rawWeightInt = dataView.getUint16(11, true);

  // Byte 13: Unit code
  const unitByte: ScaleUnits = dataView.getUint8(13);
  let unit: "g" | "oz" | "ml" = "g";
  const scaleFactor = unitByte === ScaleUnits.G || unitByte === ScaleUnits.Ml ? 0.1 : 0.01;

  switch (unitByte) {
    case ScaleUnits.Oz:
    case ScaleUnits.LbOz:
    case ScaleUnits.FlOz:
      unit = "oz";
      break;
    case ScaleUnits.Ml:
      unit = "ml";
      break;
    case ScaleUnits.G:
    default:
      unit = "g";
      break;
  }

  let scaledWeight = rawWeightInt * scaleFactor;
  if (isNegative) {
    scaledWeight = -scaledWeight;
  }

  // Byte 14: Liquid mode
  const liquidByte: ScaleLiquid = dataView.byteLength > 14 ? dataView.getUint8(14) : ScaleLiquid.Solid;

  // Byte 15: Stability flag (if byteLength >= 16 or byte 15 exists)
  const stabilityByte = dataView.byteLength >= 16 ? dataView.getUint8(15) : dataView.getUint8(14);
  const isStable = Boolean(stabilityByte);

  return {
    rawWeight: rawWeightInt,
    scaledWeight: Math.round(scaledWeight * 100) / 100,
    unit,
    unitEnum: unitByte,
    liquidEnum: liquidByte,
    isStable,
    isNegative,
  };
}

/**
 * Calculates per-piece weight from scale weight and integer part count.
 */
export function calculateUnitWeight(scaleWeight: number, partCount: number): number {
  if (partCount <= 0 || scaleWeight <= 0) return 0;
  const unitWeight = scaleWeight / partCount;
  return Math.round(unitWeight * 10000) / 10000; // 4 decimal places
}

/**
 * Calculates estimated part count from total net weight and per-piece unit weight.
 */
export function calculateEstimatedCount(scaleWeight: number, unitWeight: number): number {
  if (unitWeight <= 0 || scaleWeight <= 0) return 0;
  return Math.max(0, Math.round(scaleWeight / unitWeight));
}
