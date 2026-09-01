import { createSignal } from "solid-js";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "log" | "info" | "warn" | "error";
  message: string;
  details?: string;
}

const MAX_LOGS = 300;
const [logs, setLogs] = createSignal<LogEntry[]>([]);

let originalLog: typeof console.log;
let originalWarn: typeof console.warn;
let originalError: typeof console.error;
let originalInfo: typeof console.info;

let isInitialized = false;

export function initDiagnosticsService() {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  originalLog = console.log.bind(console);
  originalWarn = console.warn.bind(console);
  originalError = console.error.bind(console);
  originalInfo = console.info.bind(console);

  const formatArgs = (args: any[]): { message: string; details?: string } => {
    if (args.length === 0) return { message: "" };
    const first = args[0];
    const message = typeof first === "string" ? first : JSON.stringify(first);
    if (args.length > 1) {
      const rest = args.slice(1).map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
      return { message, details: rest };
    }
    return { message };
  };

  const addLog = (level: "log" | "info" | "warn" | "error", args: any[]) => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
    const { message, details } = formatArgs(args);
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: time,
      level,
      message,
      details,
    };

    setLogs((prev) => {
      const updated = [entry, ...prev];
      return updated.length > MAX_LOGS ? updated.slice(0, MAX_LOGS) : updated;
    });
  };

  console.log = (...args: any[]) => {
    originalLog(...args);
    addLog("log", args);
  };

  console.info = (...args: any[]) => {
    originalInfo(...args);
    addLog("info", args);
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    addLog("warn", args);
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    addLog("error", args);
  };

  console.log("[Diagnostics] In-app logging service initialized.");
}

export const diagnosticsService = {
  getLogs() {
    return logs();
  },
  clearLogs() {
    setLogs([]);
  },
};
