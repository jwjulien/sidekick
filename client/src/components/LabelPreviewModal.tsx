import { createEffect, createSignal, Show } from "solid-js";
import { X, Printer } from "lucide-solid";
import bwipjs from "bwip-js";
import { apiFetch } from "../hooks/useAuth";

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

    // Dimensions: 430 x 131
    const width = 430;
    const height = 131;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw DataMatrix (Left side - full height, slightly inset vertically)
    const deepLinkScheme = isPartEntity() ? `fuse://part?id=${id}` : `fuse://storage?id=${id}`;
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
    const textLeftMargin = 5 + datamatrixWidth + 10;
    const availableWidth = width - textLeftMargin - 10;
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";

    // Row 1: Header - "Inventory Reference Tag" (Audiowide)
    ctx.font = '24px "Audiowide", sans-serif';
    ctx.fillText("Inventory Reference Tag", textLeftMargin, 0, availableWidth);

    // Row 2: UUID string - e.g. "#<ID>" (Quicksand)
    ctx.font = '20px "Quicksand", sans-serif';
    ctx.fillStyle = "#333333";
    ctx.fillText(`#${id}`, textLeftMargin, 30, availableWidth);

    // Row 3: Current location.name or part.value (Quicksand Bold)
    ctx.font = '20px "Quicksand", sans-serif';
    ctx.fillStyle = "#000000";
    ctx.fillText(resolvedNameOrValue() || "[Unnamed]", textLeftMargin, 58, availableWidth);

    // Row 4: Location path or Part Category chain (Quicksand)
    ctx.font = '14px "Roboto", sans-serif';
    ctx.fillStyle = "#444444";
    ctx.fillText(resolvedPathOrCategory() || "[No Path]", textLeftMargin, 88, availableWidth);

    // Row 5: Muted footer containing Version: 3 (Georgia) & print date (Roboto)
    ctx.fillStyle = "#666666";
    const footerY = 115;

    // 5a. Version: 3 (Georgia font)
    ctx.font = '12px "Georgia", serif';
    ctx.fillText("Version: 3", textLeftMargin, footerY);

    // 5b. Print date in mm/dd/yy format (Roboto font)
    ctx.font = '12px "Georgia", sans-serif';
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const day = today.getDate().toString().padStart(2, "0");
    const year = today.getFullYear().toString().slice(-2);
    const dateStr = `${month}/${day}/${year}`;
    const dateMetrics = ctx.measureText(dateStr);
    ctx.fillText(dateStr, width - dateMetrics.width - 8, footerY);

    // Ensure re-render once web fonts are fully loaded
    if (document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => {
        if (canvasRef) {
          ctx.font = '16px "Audiowide", sans-serif';
        }
      });
    }
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
    <Show when={props.location || props.part}>
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
    </Show>
  );
}

