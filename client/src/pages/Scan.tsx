import { createSignal, onMount, Show, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { 
  QrCode, 
  Search, 
  Plus, 
  Minus, 
  AlertTriangle, 
  Keyboard,
  Barcode,
  CheckCircle,
  Camera
} from "lucide-solid";
import { apiFetch, user } from "../hooks/useAuth";
import CameraScanModal from "../components/CameraScanModal";

export default function Scan() {
  const navigate = useNavigate();
  const [barcodeInput, setBarcodeInput] = createSignal("");
  const [scannedItem, setScannedItem] = createSignal<any>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [successMsg, setSuccessMsg] = createSignal<string | null>(null);
  const [showCameraModal, setShowCameraModal] = createSignal(false);

  // Quick action values
  const [qtyChange, setQtyChange] = createSignal(1);
  const [actionNotes, setActionNotes] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  
  let inputRef: HTMLInputElement | undefined;

  onMount(() => {
    focusInput();
  });

  const focusInput = () => {
    if (inputRef) inputRef.focus();
  };

  const handleBarcodeSubmit = async (e: Event) => {
    e.preventDefault();
    const barcode = barcodeInput().trim();
    if (!barcode) return;

    setError(null);
    setScannedItem(null);
    setSuccessMsg(null);

    try {
      // Find item by barcode
      const items = await apiFetch(`/items?q=${encodeURIComponent(barcode)}`);
      // Find exact barcode match
      const match = items.find((i: any) => i.barcode === barcode || i.sku === barcode);
      
      if (!match) {
        setError(`No item matches barcode or SKU "${barcode}".`);
        // Keep input selected for quick rescan
        if (inputRef) {
          inputRef.select();
        }
        return;
      }

      // Fetch full item details
      const fullItem = await apiFetch(`/items/${match.id}`);
      setScannedItem(fullItem);
      setBarcodeInput(""); // clear for next scan
      setActionNotes("");
      setQtyChange(1);
    } catch (err: any) {
      setError(err.message || "Failed to search barcode.");
    } finally {
      focusInput();
    }
  };

  const handleStockAction = async (action: "check_in" | "check_out") => {
    const item = scannedItem();
    if (!item) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch(`/items/${item.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity_change: qtyChange(),
          action_type: action,
          notes: actionNotes() || `Scanned ${action} action.`
        })
      });

      // Update scanned item in view to show new quantity
      setScannedItem(res);
      setSuccessMsg(`Successfully ${action === "check_in" ? "checked in" : "pulled"} ${qtyChange()} units!`);
      setActionNotes("");
      setQtyChange(1);
    } catch (err: any) {
      setError(err.message || "Stock transaction failed.");
    } finally {
      setSubmitting(false);
      focusInput();
    }
  };

  const testBarcodes = [
    { name: "Resistors Barcode", value: "074470123456" },
    { name: "Soldering Station Barcode", value: "085560987654" },
    { name: "M3 Screws Barcode", value: "093320112233" }
  ];

  const handleTestBarcodeClick = (val: string) => {
    setBarcodeInput(val);
    if (inputRef) inputRef.focus();
  };

  return (
    <div class="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <QrCode class="text-accentCyan animate-pulse" />
          Barcode Scanning Station
        </h2>
        <p class="text-gray-400 text-sm">Scan barcode labels to view items, check-in, or pull stock.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* ----------------- LEFT: SCANNER FIELD ----------------- */}
        <div class="md:col-span-2 space-y-6">
          <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Keyboard size={16} class="text-accentCyan" />
                Hardware & Camera Scanner
              </h3>
              <button
                type="button"
                onClick={() => setShowCameraModal(true)}
                class="btn-primary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <Camera size={14} />
                Open Camera Scanner
              </button>
            </div>
            
            <form onSubmit={handleBarcodeSubmit} class="relative">
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput()}
                onInput={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan barcode or type barcode/SKU..."
                class="glass-input w-full text-center text-lg font-bold tracking-widest py-3.5 pr-12 focus:ring-accentCyan"
              />
              <button
                type="submit"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-accentCyan hover:text-white"
              >
                <Search size={20} />
              </button>
            </form>
            
            <div class="flex justify-between items-center text-[10px] text-gray-500">
              <span>Scan via WinUSB scanner or click camera scanner to capture DataMatrix</span>
              <button 
                onClick={focusInput} 
                class="text-accentCyan hover:underline font-semibold cursor-pointer"
              >
                Refocus Input Box
              </button>
            </div>

            <Show when={error()}>
              <div class="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-xl flex items-start gap-2.5">
                <AlertTriangle size={16} class="shrink-0" />
                <p>{error()}</p>
              </div>
            </Show>

            <Show when={successMsg()}>
              <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-4 rounded-xl flex items-start gap-2.5">
                <CheckCircle size={16} class="shrink-0" />
                <p>{successMsg()}</p>
              </div>
            </Show>
          </div>

          <CameraScanModal
            isOpen={showCameraModal()}
            onClose={() => setShowCameraModal(false)}
          />

          {/* ----------------- SCAN RESULTS CARD ----------------- */}
          <Show when={scannedItem()}>
            {(item) => (
              <div class="glass-panel rounded-2xl p-6 border border-white/10 space-y-6 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-24 h-24 bg-accentCyan/5 rounded-full blur-2xl"></div>
                
                <div class="flex justify-between items-start gap-4">
                  <div>
                    <h3 class="font-extrabold text-white text-lg leading-tight">{item().name}</h3>
                    <div class="flex gap-3 text-xs text-gray-400 mt-1">
                      <span>SKU: {item().sku || "N/A"}</span>
                      <span>•</span>
                      <span>Location: {item().location?.name || "N/A"}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => navigate(`/inventory/item/${item().id}`)}
                    class="btn-secondary px-3 py-1.5 text-[10px] uppercase font-bold shrink-0"
                  >
                    View Details
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                  <div>
                    <span class="text-[10px] text-gray-500 uppercase font-semibold">Barcode Value</span>
                    <span class="text-white font-mono font-medium mt-1 block">{item().barcode}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-gray-500 uppercase font-semibold">Current Stock Level</span>
                    <span class={`text-xl font-extrabold mt-1 block ${
                      item().quantity < item().min_quantity_alert ? "text-amber-400" : "text-accentCyan"
                    }`}>
                      {item().quantity} units
                    </span>
                  </div>
                </div>

                {/* Stock transaction quick inputs */}
                <div class="border-t border-white/5 pt-4 space-y-4">
                  <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Perform Stock Action</h4>
                  
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase">Quantity</label>
                      <input
                        type="number"
                        value={qtyChange()}
                        onInput={(e) => setQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
                        class="glass-input w-full text-center font-bold text-base"
                        min="1"
                      />
                    </div>
                    
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase">Transaction Notes</label>
                      <input
                        type="text"
                        value={actionNotes()}
                        onInput={(e) => setActionNotes(e.target.value)}
                        placeholder="Reference, drawer check-in, etc."
                        class="glass-input w-full"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => handleStockAction("check_in")}
                      disabled={submitting() || (user()?.role !== "admin" && user()?.role !== "stocker")}
                      class="btn-primary py-3 flex items-center justify-center gap-1.5 font-bold"
                    >
                      <Plus size={16} />
                      Check In Stock
                    </button>
                    
                    <button
                      onClick={() => handleStockAction("check_out")}
                      disabled={submitting() || (user()?.role !== "admin" && user()?.role !== "puller")}
                      class="btn-accent py-3 flex items-center justify-center gap-1.5 font-bold"
                    >
                      <Minus size={16} />
                      Pull / Dispatch
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </div>

        {/* ----------------- RIGHT: SEEDED TESTING BARCODES ----------------- */}
        <div class="space-y-6">
          <div class="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
            <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Barcode size={16} class="text-accentPurple" />
              Sandbox Test Codes
            </h3>
            <p class="text-gray-400 text-xs leading-relaxed">
              If running in Developer Sandbox mode without a physical barcode scanner, click one of the seeded barcodes below to copy and simulate a scan.
            </p>
            
            <div class="space-y-2">
              <For each={testBarcodes}>
                {(tb) => (
                  <button
                    onClick={() => handleTestBarcodeClick(tb.value)}
                    class="glass-card glass-card-hover w-full p-3 rounded-xl flex items-center justify-between text-left text-xs cursor-pointer group"
                  >
                    <div>
                      <span class="text-gray-400 font-medium block">{tb.name}</span>
                      <span class="font-mono font-bold text-white group-hover:text-accentCyan transition-colors">{tb.value}</span>
                    </div>
                    <span class="text-gray-500 font-extrabold group-hover:translate-x-0.5 transition-transform">➔</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
