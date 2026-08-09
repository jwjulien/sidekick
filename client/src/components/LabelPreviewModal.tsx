import { createEffect, createSignal, Show } from "solid-js";
import { X, Printer } from "lucide-solid";
import bwipjs from "bwip-js";
import { apiFetch } from "../hooks/useAuth";

interface LabelPreviewModalProps {
  location: {
    id: number;
    name: string;
    description?: string;
  } | null;
  onClose: () => void;
}

export default function LabelPreviewModal(props: LabelPreviewModalProps) {
  let canvasRef!: HTMLCanvasElement;
  const [details, setDetails] = createSignal<any>(null);

  // Fetch full details of the location to get the associated parts/categories/attributes
  createEffect(async () => {
    const loc = props.location;
    if (!loc) {
      setDetails(null);
      return;
    }
    try {
      const data = await apiFetch(`/locations/${loc.id}`);
      setDetails(data);
    } catch (err) {
      console.error("Failed to fetch location details for label:", err);
      // Fallback to minimal data if details fetch fails
      setDetails({
        id: loc.id,
        name: loc.name,
        description: loc.description,
        part: null
      });
    }
  });

  createEffect(() => {
    const loc = details();
    if (!loc || !canvasRef) return;

    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    // Dimensions: 430 x 131
    const width = 430;
    const height = 131;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw DataMatrix (Left side - full height, slightly inset vertically)
    const deeplink = `fuse://storage?id=${loc.id}`;
    let datamatrixWidth = 0;

    try {
      const barcodeCanvas = document.createElement("canvas");
      bwipjs.toCanvas(barcodeCanvas, {
        bcid: "datamatrix",
        text: deeplink,
        scale: 4,
        includetext: false,
      });
      datamatrixWidth = barcodeCanvas.width;
      // Draw vertically centered, starting at left x=5
      const drawHeight = height - 10;
      const drawWidth = barcodeCanvas.width * (drawHeight / barcodeCanvas.height);
      ctx.drawImage(barcodeCanvas, 5, (height - drawHeight) / 2, drawWidth, drawHeight);
      datamatrixWidth = drawWidth;
    } catch (err) {
      console.error("Failed to generate DataMatrix:", err);
    }

    // Text rendering styles (Right side)
    const textLeftMargin = 5 + datamatrixWidth + 10;
    const availableWidth = width - textLeftMargin - 10;
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";

    // 1. Header: "Inventory Reference Tag" (bold, size 18px)
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("Inventory Reference Tag", textLeftMargin, 8, availableWidth);

    // 2. Location Name & ID: e.g. "Resistor Bin (#ID)" (size 16px)
    ctx.font = "bold 16px sans-serif";
    const nameLine = `${loc.name} (#${loc.id})`;
    ctx.fillText(nameLine, textLeftMargin, 30, availableWidth);

    // 3. Parts Concatenation: "Passive, Capacitor, 0.1uF, 16V" (size 12px)
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#333333";

    if (loc.part) {
      const p = loc.part;
      const partsList: string[] = [];
      
      // Category path
      if (p.category?.title) {
        partsList.push(p.category.title);
      }
      // Part value/name
      if (p.value) {
        partsList.push(p.value);
      }
      // Attributes (from part.attributes object if present)
      if (p.attributes && typeof p.attributes === "object") {
        Object.entries(p.attributes).forEach(([key, val]) => {
          if (val && key !== "barcode") {
            partsList.push(String(val));
          }
        });
      }
      const partsText = partsList.join(", ");
      ctx.fillText(partsText, textLeftMargin, 55, availableWidth);
    } else {
      ctx.fillStyle = "#666666";
      ctx.fillText("[No parts stored]", textLeftMargin, 55, availableWidth);
    }

    // Draw print date/version info (small, bottom right)
    ctx.fillStyle = "#888888";
    ctx.font = "10px sans-serif";
    const today = new Date();
    const dateStr = `${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getDate().toString().padStart(2, "0")}/${today.getFullYear().toString().slice(-2)}`;
    const metrics = ctx.measureText(dateStr);
    ctx.fillText(dateStr, width - metrics.width - 8, height - 18);
  });

  const handlePrint = () => {
    if (!canvasRef) return;
    const dataUrl = canvasRef.toDataURL("image/png");
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Reference Tag</title>
          <style>
            @page {
              size: 1.875in 0.5in;
              margin: 0;
            }
            body {
              margin: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background-color: white;
            }
            img {
              width: 100%;
              height: 100%;
              image-rendering: pixelated;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <img src="${dataUrl}" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Show when={props.location}>
      {(loc) => (
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="glass-panel max-w-lg w-full rounded-2xl p-6 border border-white/10 relative flex flex-col items-center">
            <button
              onClick={props.onClose}
              class="absolute right-4 top-4 p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <h3 class="text-base font-bold text-white mb-6 uppercase tracking-wider">
              Dymo 1/2" x 1-7/8" Label Preview
            </h3>

            {/* Canvas Container with horizontal aspect ratio preview */}
            <div class="bg-gray-900 p-4 rounded-xl border border-white/5 flex justify-center items-center mb-6 w-full overflow-auto">
              <canvas
                ref={canvasRef}
                width={430}
                height={131}
                class="w-[430px] h-[131px] rounded shadow-lg border border-black bg-white shrink-0"
              />
            </div>

            <div class="flex gap-3 w-full">
              <button
                onClick={props.onClose}
                class="btn-secondary flex-1 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handlePrint}
                class="btn-primary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 font-bold"
              >
                <Printer size={14} />
                Send to Printer
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
