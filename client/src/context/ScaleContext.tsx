import {
  createContext,
  useContext,
  createSignal,
  createMemo,
} from "solid-js";
import type { JSX } from "solid-js";
import { parseGattPayload } from "../utils/scaleParser";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ScaleContextType {
  status: () => ConnectionStatus;
  errorMessage: () => string | null;
  rawWeight: () => number;
  netWeight: () => number;
  unit: () => "g" | "oz" | "ml";
  isStable: () => boolean;
  tareOffset: () => number;
  mockMode: () => boolean;
  simulatedWeight: () => number;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  tare: (customOffset?: number) => void;
  resetTare: () => void;
  setTareOffset: (val: number) => void;
  setMockMode: (val: boolean) => void;
  setSimulatedWeight: (val: number) => void;
  setUnit: (u: "g" | "oz" | "ml") => void;
}

const ScaleContext = createContext<ScaleContextType>();

const SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const CHAR_UUID = "0000fff1-0000-1000-8000-00805f9b34fb";

export function ScaleProvider(props: { children: JSX.Element }) {
  const [status, setStatus] = createSignal<ConnectionStatus>("disconnected");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [rawWeight, setRawWeight] = createSignal<number>(0);
  const [unit, setUnit] = createSignal<"g" | "oz" | "ml">("g");
  const [isStable, setIsStable] = createSignal<boolean>(true);
  const [tareOffset, setTareOffset] = createSignal<number>(0);
  const [mockMode, setMockMode] = createSignal<boolean>(false);
  const [simulatedWeight, setSimulatedWeight] = createSignal<number>(100);

  let gattServer: any = null;
  let characteristic: any = null;

  const netWeight = createMemo(() => {
    const current = mockMode() ? simulatedWeight() : rawWeight();
    const net = current - tareOffset();
    return Math.max(0, Math.round(net * 100) / 100);
  });

  const handleCharacteristicValueChange = (event: any) => {
    if (mockMode()) return;
    const value: DataView = event.target.value;
    const parsed = parseGattPayload(value);
    setRawWeight(parsed.scaledWeight);
    setUnit(parsed.unit);
    setIsStable(parsed.isStable);
  };

  const connect = async (): Promise<boolean> => {
    if (status() === "connecting") return false;

    setErrorMessage(null);
    setStatus("connecting");

    // If mock mode is explicitly set or navigator.bluetooth is not available
    if (mockMode() || !navigator.bluetooth) {
      if (!navigator.bluetooth) {
        setMockMode(true);
      }
      return new Promise<boolean>((resolve) => {
        setTimeout(() => {
          setStatus("connected");
          setIsStable(true);
          resolve(true);
        }, 600);
      });
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { namePrefix: "Etekcity" },
          { services: [SERVICE_UUID] },
        ],
        optionalServices: [SERVICE_UUID],
      }).catch(async () => {
        return await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [SERVICE_UUID],
        });
      });

      device.addEventListener("gattserverdisconnected", () => {
        setStatus("disconnected");
        setRawWeight(0);
      });

      gattServer = await device.gatt.connect();
      const service = await gattServer.getPrimaryService(SERVICE_UUID);
      characteristic = await service.getCharacteristic(CHAR_UUID);

      await characteristic.startNotifications();
      characteristic.addEventListener(
        "characteristicvaluechanged",
        handleCharacteristicValueChange
      );

      setStatus("connected");
      return true;
    } catch (err: any) {
      console.warn("Bluetooth connection failed or cancelled:", err);
      // Fallback option for developer/browser testing: auto-switch to mock mode on error
      if (err.name === "NotFoundError" || err.name === "SecurityError" || err.message?.includes("User cancelled")) {
        setStatus("disconnected");
        setErrorMessage(err.message || "Device selection cancelled.");
      } else {
        setErrorMessage(err.message || "Failed to connect to BLE device.");
        setStatus("error");
      }
      return false;
    }
  };

  const disconnect = () => {
    if (characteristic) {
      try {
        characteristic.removeEventListener(
          "characteristicvaluechanged",
          handleCharacteristicValueChange
        );
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    if (gattServer && gattServer.connected) {
      gattServer.disconnect();
    }
    gattServer = null;
    characteristic = null;
    setStatus("disconnected");
    setRawWeight(0);
  };

  const tare = (customOffset?: number) => {
    if (customOffset !== undefined) {
      setTareOffset(customOffset);
    } else {
      const current = mockMode() ? simulatedWeight() : rawWeight();
      setTareOffset(current);
    }
  };

  const resetTare = () => {
    setTareOffset(0);
  };

  const value: ScaleContextType = {
    status,
    errorMessage,
    rawWeight: () => (mockMode() ? simulatedWeight() : rawWeight()),
    netWeight,
    unit,
    isStable,
    tareOffset,
    mockMode,
    simulatedWeight,
    connect,
    disconnect,
    tare,
    resetTare,
    setTareOffset,
    setMockMode: (val: boolean) => {
      setMockMode(val);
      if (val && status() === "disconnected") {
        setStatus("connected");
      }
    },
    setSimulatedWeight,
    setUnit,
  };

  return (
    <ScaleContext.Provider value={value}>
      {props.children}
    </ScaleContext.Provider>
  );
}

export function useScale() {
  const context = useContext(ScaleContext);
  if (!context) {
    throw new Error("useScale must be used within a ScaleProvider");
  }
  return context;
}
