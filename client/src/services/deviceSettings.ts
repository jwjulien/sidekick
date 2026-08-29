/**
 * Device Settings Service
 * Handles hardware-local key-value settings stored strictly in browser localStorage
 * with zero network/API overhead.
 */

export interface DeviceSettings {
  theme: "system" | "dark" | "light";
  backendUrl: string;
  devMode: boolean;
  oidcIssuer: string;
  oidcClientId: string;
  dymoServiceUrl: string;
  scaleMacAddress: string;
  soundEffectsEnabled: boolean;
  printerDriverType: "dymo_esp32" | "browser_native";
  printerAddress: string;
  printerDensity: "light" | "medium" | "normal" | "dark";
  printerSpeed: "text" | "graphics";
}

const DEFAULT_SETTINGS: DeviceSettings = {
  theme: "system",
  backendUrl: "http://localhost:8000",
  devMode: true,
  oidcIssuer: "https://auth.example.com/realms/sidekick",
  oidcClientId: "sidekick-client",
  dymoServiceUrl: "http://localhost:41951/DYMO/DLS/Printing/Service.svc",
  scaleMacAddress: "",
  soundEffectsEnabled: true,
  printerDriverType: "dymo_esp32",
  printerAddress: "dymo-printer.local",
  printerDensity: "dark",
  printerSpeed: "graphics"
};

const STORAGE_PREFIX = "sidekick_device_";

export function getDeviceSetting<K extends keyof DeviceSettings>(key: K): DeviceSettings[K] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) {
      // Fallback for legacy theme key
      if (key === "theme") {
        const legacyTheme = localStorage.getItem("sidekick_app_theme");
        if (legacyTheme) return legacyTheme as DeviceSettings[K];
      }
      return DEFAULT_SETTINGS[key];
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_SETTINGS[key];
  }
}

export function setDeviceSetting<K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    if (key === "theme") {
      localStorage.setItem("sidekick_app_theme", value as string);
    }
  } catch (e) {
    console.error(`Failed to save device setting ${key}:`, e);
  }
}

export function getAllDeviceSettings(): DeviceSettings {
  const settings = { ...DEFAULT_SETTINGS };
  (Object.keys(DEFAULT_SETTINGS) as Array<keyof DeviceSettings>).forEach((key) => {
    (settings as any)[key] = getDeviceSetting(key);
  });
  return settings;
}
