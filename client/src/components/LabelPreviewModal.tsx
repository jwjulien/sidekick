import { createEffect, createSignal, Show, For } from "solid-js";
import { X, Printer, RefreshCw, Wifi, Search } from "lucide-solid";
import bwipjs from "bwip-js";
import toast from "solid-toast";
import { apiFetch } from "../hooks/useAuth";
import { printerService, type DiscoveredPrinter } from "../services/printerService";
import { getDeviceSetting, setDeviceSetting } from "../services/deviceSettings";
import type { PrinterStatusResult } from "../services/printerDriver";

interface LabelPreviewModalProps {
  location?: {
    id: string;
    name?: string;
    label?: string;
    path?: string;
    description?: string;
    parent_id?: string;
    part?: any;
  } | null;
  part?: {
    id: string;
    name?: string;
    value?: string;
    category?: any;
    category_id?: string;
    category_path?: string;
  } | null;
  onClose: () => void;
}

export default function LabelPreviewModal(props: LabelPreviewModalProps) {
  let canvasRef!: HTMLCanvasElement;
  const [resolvedPathOrCategory, setResolvedPathOrCategory] = createSignal<string>("");
  const [resolvedNameOrValue, setResolvedNameOrValue] = createSignal<string>("");
  const [resolvedId, setResolvedId] = createSignal<string>("");
  const [isPartEntity, setIsPartEntity] = createSignal<boolean>(false);

  // Printing state signals
  const [printerStatus, setPrinterStatus] = createSignal<PrinterStatusResult | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = createSignal<boolean>(false);
  const [isPrinting, setIsPrinting] = createSignal<boolean>(false);
  const [printStage, setPrintStage] = createSignal<string>("");
  const [printPercent, setPrintPercent] = createSignal<number>(0);
  const [useSystemFallback, setUseSystemFallback] = createSignal<boolean>(
    getDeviceSetting("printerDriverType") === "browser_native"
  );

  // Multi-printer discovery state inside modal
  const [isScanning, setIsScanning] = createSignal<boolean>(false);
  const [discoveredPrinters, setDiscoveredPrinters] = createSignal<DiscoveredPrinter[]>([]);
  const [showPrinterSelector, setShowPrinterSelector] = createSignal<boolean>(false);

  const currentAddress = () => getDeviceSetting("printerAddress");

  const checkStatus = async () => {
    if (useSystemFallback()) return;
    setIsCheckingStatus(true);
    try {
      const res = await printerService.checkCurrentStatus();
      setPrinterStatus(res);
    } catch (_) {
      setPrinterStatus(null);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Fetch full details and hierarchy (location path or part category chain)
  createEffect(async () => {
    const loc = props.location;
    const pt = props.part;

    if (!loc && !pt) {
      setResolvedId("");
      setResolvedNameOrValue("");
      setResolvedPathOrCategory("");
      setIsPartEntity(false);
      return;
    }

    checkStatus();

    if (pt) {
      setIsPartEntity(true);
      setResolvedId(pt.id);
      setResolvedNameOrValue(pt.value || pt.name || "Part");

      if (pt.category_path) {
        setResolvedPathOrCategory(pt.category_path);
      } else if (pt.category?.title) {
        setResolvedPathOrCategory(pt.category.title);
      } else {
        try {
          const cats = await apiFetch("/categories");
          const catMap = new Map<string, any>(cats.map((c: any) => [c.id, c]));
          const targetCatId = pt.category_id || pt.category?.id;

          if (targetCatId && catMap.has(targetCatId)) {
            const chain: string[] = [];
            let currentId: string | null = targetCatId;
            while (currentId && catMap.has(currentId)) {
              const cat = catMap.get(currentId)!;
              chain.push(cat.title);
              currentId = cat.parent_id || null;
            }
            chain.reverse();
            setResolvedPathOrCategory(chain.join(", "));
          } else {
            setResolvedPathOrCategory("[No Category]");
          }
        } catch (err) {
          console.error("Failed to fetch categories for part label:", err);
          setResolvedPathOrCategory("[No Category]");
        }
      }
    } else if (loc) {
      setIsPartEntity(false);
      setResolvedId(loc.id);
      setResolvedNameOrValue(loc.name || loc.label || "Storage Location");

      if (loc.path) {
        setResolvedPathOrCategory(loc.path);
      } else {
        try {
          const resData = await apiFetch(`/resolve/${loc.id}`);
          if (resData && resData.breadcrumb) {
            const formattedPath = "/" + resData.breadcrumb.split(" > ").join("/");
            setResolvedPathOrCategory(formattedPath);
          } else {
            setResolvedPathOrCategory(`/${loc.name || loc.id}`);
          }
        } catch (err) {
          console.error("Failed to resolve location path for label:", err);
          setResolvedPathOrCategory(`/${loc.name || loc.id}`);
        }
      }
    }
  });

  createEffect(() => {
    const id = resolvedId();
    if (!id || !canvasRef) return;

    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    // Dimensions: 430 x 131 (Visual aspect ratio layout - rasterizer doubleWidth scales 2x to 860 for Graphics Mode)
    const width = 430;
    const height = 131;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw DataMatrix (Left side - full height, slightly inset vertically)
    const deepLinkScheme = isPartEntity() ? `fuse://part/${id}` : `fuse://location/${id}`;
    let datamatrixWidth = 0;

    try {
      const barcodeCanvas = document.createElement("canvas");
      bwipjs.toCanvas(barcodeCanvas, {
        bcid: "datamatrix",
        text: deepLinkScheme,
        scale: 4,
        includetext: false,
      });
      const drawHeight = height - 10;
      const drawWidth = barcodeCanvas.width * (drawHeight / barcodeCanvas.height);
      ctx.drawImage(barcodeCanvas, 5, (height - drawHeight) / 2, drawWidth, drawHeight);
      datamatrixWidth = drawWidth;
    } catch (err) {
      console.error("Failed to generate DataMatrix:", err);
      datamatrixWidth = 110; // Fallback width calculation
    }

    // Text rendering styles (Right side)
    const textLeftMargin = 5 + datamatrixWidth + 8;
    const availableWidth = width - textLeftMargin - 6;
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";

    // Row 1: Header - "Inventory Reference Tag" (Audiowide)
    ctx.font = '24px "Audiowide", sans-serif';
    ctx.fillText("Inventory Reference Tag", textLeftMargin, 0, availableWidth);

    // Row 2: UUID string - e.g. "#<ID>" (Quicksand)
    ctx.font = '20px "Quicksand", sans-serif';
    ctx.fillStyle = "#222222";
    ctx.fillText(`#${id}`, textLeftMargin, 30, availableWidth);

    // Row 3: Current location.name or part.value (Quicksand Bold)
    ctx.font = '20px "Quicksand", sans-serif';
    ctx.fillStyle = "#000000";
    ctx.fillText(resolvedNameOrValue() || "[Unnamed]", textLeftMargin, 58, availableWidth);

    // Row 4: Location path or Part Category chain (Roboto)
    ctx.font = '14px "Roboto", sans-serif';
    ctx.fillStyle = "#333333";
    ctx.fillText(resolvedPathOrCategory() || "[No Path]", textLeftMargin, 88, availableWidth);

    // Row 5: Muted footer containing Version: 3 (Georgia) & print date (Roboto)
    ctx.fillStyle = "#444444";
    const footerY = 115;

    // 5a. Version: 3 (Georgia font)
    ctx.font = '12px "Georgia", serif';
    ctx.fillText("Version: 3", textLeftMargin, footerY);

    // 5b. Print date in mm/dd/yy format (Georgia font)
    ctx.font = '12px "Georgia", serif';
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const day = today.getDate().toString().padStart(2, "0");
    const year = today.getFullYear().toString().slice(-2);
    const dateStr = `${month}/${day}/${year}`;
    const dateMetrics = ctx.measureText(dateStr);
    ctx.fillText(dateStr, width - dateMetrics.width - 6, footerY);

    // Ensure re-render once web fonts are fully loaded
    if (document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => {
        if (canvasRef) {
          ctx.font = 'bold 16px "Audiowide", sans-serif';
        }
      });
    }
  });

  const handleScanForPrinters = async () => {
    setIsScanning(true);
    try {
      const result = await printerService.runPrinterDiscovery();
      if (result.autoSelected) {
        toast.success(result.statusMessage);
        checkStatus();
      } else if (result.printers.length > 1) {
        setDiscoveredPrinters(result.printers);
        setShowPrinterSelector(true);
      } else {
        toast.error(result.statusMessage);
      }
    } catch (err: any) {
      toast.error(`Scan error: ${err.message || err}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSendToPrinter = async () => {
    if (!canvasRef) return;

    if (useSystemFallback()) {
      // Standard browser print window fallback
      try {
        await printerService.printCanvas(canvasRef);
      } catch (err: any) {
        toast.error(`Print failed: ${err.message || err}`);
      }
      return;
    }

    setIsPrinting(true);
    setPrintStage("Initializing...");
    setPrintPercent(10);

    try {
      await printerService.printCanvas(canvasRef, {
        onProgress: (stage, percent) => {
          setPrintStage(stage);
          setPrintPercent(percent);
        },
      });
      toast.success("Label printed successfully!");
    } catch (err: any) {
      toast.error(`Dymo print failed: ${err.message || err}`);
    } finally {
      setIsPrinting(false);
      setPrintStage("");
      setPrintPercent(0);
      checkStatus();
    }
  };

  return (
    <Show when={props.location || props.part}>
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div class="glass-panel max-w-lg w-full rounded-2xl p-6 border border-white/10 relative flex flex-col items-center">
          <button
            onClick={props.onClose}
            class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>

          <h3 class="text-base font-bold text-white mb-4 uppercase tracking-wider">
            Dymo 1/2" x 1-7/8" Label Preview
          </h3>

          {/* Canvas Container with horizontal aspect ratio preview */}
          <div class="bg-gray-900 p-4 rounded-xl border border-white/5 flex justify-center items-center mb-4 w-full overflow-auto relative">
            <canvas
              ref={canvasRef}
              width={430}
              height={131}
              class="w-[430px] h-[131px] rounded shadow-lg border border-black bg-white shrink-0"
            />

            {/* Print Progress Overlay */}
            <Show when={isPrinting()}>
              <div class="absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-6 space-y-3">
                <RefreshCw size={24} class="animate-spin text-accentCyan" />
                <span class="text-xs font-bold text-white tracking-wide">{printStage()}</span>
                <div class="w-48 bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    class="bg-accentCyan h-full transition-all duration-300"
                    style={{ width: `${printPercent()}%` }}
                  />
                </div>
              </div>
            </Show>
          </div>

          {/* Printer Connection Status Badge & Controls */}
          <div class="w-full flex items-center justify-between bg-white/5 p-2.5 px-3 rounded-xl border border-white/5 mb-4 text-xs">
            <div class="flex items-center gap-2">
              <Show when={!useSystemFallback()} fallback={
                <span class="text-accentPurple font-bold flex items-center gap-1">
                  <Printer size={14} /> System Print Dialog
                </span>
              }>
                <Wifi size={14} class="text-accentCyan" />
                <span class="text-gray-300 font-mono text-[11px] truncate max-w-[150px]">
                  {currentAddress()}
                </span>
                <Show when={printerStatus()}>
                  <span class={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${printerStatus()?.ready
                    ? "bg-emerald-500/20 text-emerald-300"
                    : printerStatus()?.paperEmpty
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-red-500/20 text-red-300"
                    }`}>
                    {printerStatus()?.statusText}
                  </span>
                </Show>
              </Show>
            </div>

            <div class="flex items-center gap-1.5">
              <Show when={!useSystemFallback()}>
                <button
                  onClick={checkStatus}
                  disabled={isCheckingStatus()}
                  class="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10"
                  title="Check printer status"
                >
                  <RefreshCw size={13} class={isCheckingStatus() ? "animate-spin text-accentCyan" : ""} />
                </button>
                <button
                  onClick={handleScanForPrinters}
                  disabled={isScanning()}
                  class="text-[11px] text-accentCyan hover:underline font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accentCyan/10"
                  title="Auto-scan network for ESP32 printers"
                >
                  <Search size={12} />
                  {isScanning() ? "Scanning..." : "Scan"}
                </button>
              </Show>

              <button
                onClick={() => setUseSystemFallback(!useSystemFallback())}
                class="text-[10px] text-gray-400 hover:text-white border border-white/10 px-2 py-0.5 rounded hover:bg-white/5"
              >
                {useSystemFallback() ? "Use Dymo ESP32" : "Use System Print"}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div class="flex gap-3 w-full">
            <button
              onClick={props.onClose}
              disabled={isPrinting()}
              class="btn-secondary flex-1 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSendToPrinter}
              disabled={isPrinting()}
              class="btn-primary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 font-bold"
            >
              <Printer size={14} />
              {isPrinting() ? "Sending..." : "Send to Printer"}
            </button>
          </div>

          {/* In-Modal Printer Discovery Choice Dialog */}
          <Show when={showPrinterSelector()}>
            <div class="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div class="glass-panel max-w-sm w-full p-5 rounded-xl border border-white/10 space-y-4">
                <h4 class="text-xs font-bold text-white uppercase tracking-wider">Select Dymo Printer</h4>
                <div class="space-y-2 max-h-48 overflow-y-auto">
                  <For each={discoveredPrinters()}>
                    {(p) => (
                      <button
                        type="button"
                        onClick={() => {
                          setDeviceSetting("printerAddress", p.address);
                          setDeviceSetting("printerDriverType", "dymo_esp32");
                          setShowPrinterSelector(false);
                          toast.success(`Connected to printer at ${p.address}`);
                          checkStatus();
                        }}
                        class="w-full p-2.5 rounded-lg border border-white/5 bg-white/5 hover:border-accentCyan text-left flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div>
                          <span class="font-bold text-white block">{p.name}</span>
                          <span class="font-mono text-[10px] text-gray-400">{p.address}</span>
                        </div>
                        <span class="text-[10px] text-emerald-400 font-semibold">{p.status.statusText}</span>
                      </button>
                    )}
                  </For>
                </div>
                <button
                  onClick={() => setShowPrinterSelector(false)}
                  class="btn-secondary w-full py-1.5 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </Show>

        </div>
      </div>
    </Show>
  );
}
