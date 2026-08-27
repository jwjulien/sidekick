import { createSignal, createEffect, Show } from "solid-js";
import { X, Nfc, AlertTriangle, CheckCircle2, RefreshCw, Smartphone, Cpu } from "lucide-solid";
import toast from "solid-toast";
import { nfcService, type ResolvedEntity, type NfcReaderStatus } from "../services/nfcService";

interface NfcWriteModalProps {
  isOpen: boolean;
  targetType: "location" | "part";
  targetId: string;
  targetName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalStep = "ready" | "scanning" | "overwrite_warning" | "writing" | "success" | "error";

export default function NfcWriteModal(props: NfcWriteModalProps) {
  const [step, setStep] = createSignal<ModalStep>("ready");
  const [errorMessage, setErrorMessage] = createSignal<string>("");
  const [existingEntity, setExistingEntity] = createSignal<ResolvedEntity | null>(null);
  const [existingPayload, setExistingPayload] = createSignal<string | null>(null);
  const [mockModeTagType, setMockModeTagType] = createSignal<"blank" | "existing">("blank");
  const [hardwareStatus, setHardwareStatus] = createSignal<NfcReaderStatus | null>(null);

  const targetUri = () => `fuse://${props.targetType}/${props.targetId}`;

  // Reset modal state & check reader status whenever opened
  createEffect(() => {
    if (props.isOpen) {
      setStep("ready");
      setErrorMessage("");
      setExistingEntity(null);
      setExistingPayload(null);

      // Check connected PC/SC USB hardware reader
      nfcService.getReaderStatus().then((status) => {
        setHardwareStatus(status);
      });
    }
  });

  const playSuccessBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (_) {
      // Audio fallback silent ignore
    }
  };

  const handleStartWriteProcess = async () => {
    setStep("scanning");

    // Configure mock payload if in dev mode test
    if (mockModeTagType() === "existing") {
      nfcService.setMockState("fuse://location/018f-dummy-existing-id");
    } else {
      nfcService.setMockState(null);
    }

    // Step 1: Read-Before-Write Safeguard Check
    const checkResult = await nfcService.checkTagBeforeWrite();

    if (checkResult.error) {
      setErrorMessage(checkResult.error);
      setStep("error");
      return;
    }

    if (!checkResult.canWriteDirectly && checkResult.resolvedEntity) {
      // Tag is already assigned to a valid DB entity -> Trigger Overwrite Warning!
      setExistingEntity(checkResult.resolvedEntity);
      setExistingPayload(checkResult.existingPayload);
      setStep("overwrite_warning");
      return;
    }

    // Tag is blank or unassigned -> Proceed directly to write
    await executeWrite();
  };

  const executeWrite = async () => {
    setStep("writing");
    const uri = targetUri();
    const writeResult = await nfcService.writeTag(uri);

    if (writeResult.success) {
      playSuccessBeep();
      setStep("success");
      toast.success(`NFC tag assigned to ${props.targetName}!`);
      if (props.onSuccess) props.onSuccess();
    } else {
      setErrorMessage(writeResult.error || "Failed to write NFC tag.");
      setStep("error");
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div class="w-full max-w-md bg-[#121319] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          
          {/* Header */}
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-[#161822]">
            <div class="flex items-center space-x-2">
              <div class="p-2 bg-accentCyan/10 rounded-lg text-accentCyan">
                <Nfc class="w-5 h-5" />
              </div>
              <div>
                <h3 class="text-sm font-semibold text-white">Write NFC Tag</h3>
                <p class="text-xs text-gray-400">Program physical sticker for {props.targetName}</p>
              </div>
            </div>
            <button 
              onClick={props.onClose}
              class="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          {/* Hardware Connection Banner */}
          <Show when={hardwareStatus()}>
            <div class="px-5 py-2 bg-[#171924] border-b border-gray-800/80 flex items-center justify-between text-xs">
              <span class="flex items-center gap-1.5 font-medium text-gray-300">
                <Cpu class={`w-3.5 h-3.5 ${hardwareStatus()?.connected ? "text-emerald-400" : "text-amber-400"}`} />
                <span>{hardwareStatus()?.readerName || "NFC Reader"}</span>
              </span>
              <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                hardwareStatus()?.connected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              }`}>
                <span class={`w-1.5 h-1.5 rounded-full ${hardwareStatus()?.connected ? "bg-emerald-400 animate-ping" : "bg-amber-400"}`}></span>
                {hardwareStatus()?.connected ? "Reader Active" : "No Hardware"}
              </span>
            </div>
          </Show>

          {/* Dev Mock Mode Switcher Banner */}
          <div class="px-5 py-2 bg-gray-900/80 border-b border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
            <span class="flex items-center gap-1.5 font-mono text-[11px]">
              <Smartphone class="w-3.5 h-3.5 text-accentPurple" /> Dev Scan Mode:
            </span>
            <div class="flex items-center space-x-2">
              <button 
                onClick={() => setMockModeTagType("blank")}
                class={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  mockModeTagType() === "blank" 
                    ? "bg-accentCyan/20 text-accentCyan border border-accentCyan/40" 
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                Blank Tag
              </button>
              <button 
                onClick={() => setMockModeTagType("existing")}
                class={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  mockModeTagType() === "existing" 
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" 
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                Assigned Tag
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div class="p-6 text-center flex flex-col items-center">
            
            {/* Step: Ready */}
            <Show when={step() === "ready"}>
              <div class="relative my-4 flex items-center justify-center">
                <div class="w-24 h-24 rounded-full bg-accentCyan/10 border-2 border-accentCyan/30 flex items-center justify-center animate-pulse">
                  <Nfc class="w-12 h-12 text-accentCyan" />
                </div>
              </div>
              <p class="text-sm font-medium text-white mt-2">Place NFC sticker on ACR122U or hold phone near tag</p>
              <p class="text-xs text-gray-400 mt-1 max-w-xs">
                Payload <span class="font-mono text-accentCyan bg-accentCyan/10 px-1.5 py-0.5 rounded">{targetUri()}</span> will be written to the physical tag.
              </p>
              <button
                onClick={handleStartWriteProcess}
                class="mt-6 w-full py-2.5 bg-accentCyan hover:bg-accentCyan/90 text-black font-semibold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
              >
                <Nfc class="w-4 h-4" />
                <span>Tap Tag to Write</span>
              </button>
            </Show>

            {/* Step: Scanning / Checking */}
            <Show when={step() === "scanning"}>
              <div class="my-6">
                <RefreshCw class="w-12 h-12 text-accentCyan animate-spin mx-auto" />
              </div>
              <p class="text-sm font-medium text-white">Scanning Reader & Tag...</p>
              <p class="text-xs text-gray-400 mt-1">Reading NDEF payload & checking database safeguards...</p>
            </Show>

            {/* Step: Overwrite Warning Safeguard */}
            <Show when={step() === "overwrite_warning"}>
              <div class="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center my-3 text-amber-400">
                <AlertTriangle class="w-8 h-8" />
              </div>
              <h4 class="text-base font-bold text-amber-400 mt-1">Overwrite Warning</h4>
              <p class="text-xs text-gray-300 mt-2">
                This physical NFC tag is currently assigned to:
              </p>
              <div class="w-full my-3 p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-left">
                <span class="text-[11px] uppercase tracking-wider text-amber-400 font-semibold block mb-0.5">Existing Assignment</span>
                <p class="text-xs font-semibold text-white">
                  {existingEntity()?.breadcrumb || existingEntity()?.display_name || existingPayload()}
                </p>
              </div>
              <p class="text-xs text-gray-400">
                Are you sure you want to overwrite this tag to <strong class="text-white">{props.targetName}</strong>?
              </p>

              <div class="flex space-x-3 w-full mt-5">
                <button
                  onClick={() => setStep("ready")}
                  class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeWrite}
                  class="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs rounded-xl transition-colors"
                >
                  Yes, Overwrite Tag
                </button>
              </div>
            </Show>

            {/* Step: Writing */}
            <Show when={step() === "writing"}>
              <div class="my-6">
                <RefreshCw class="w-12 h-12 text-accentCyan animate-spin mx-auto" />
              </div>
              <p class="text-sm font-medium text-white">Writing APDU NDEF Record...</p>
              <p class="text-xs text-gray-400 mt-1">Hold tag firmly on ACR122U reader surface.</p>
            </Show>

            {/* Step: Success */}
            <Show when={step() === "success"}>
              <div class="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center my-3 text-emerald-400">
                <CheckCircle2 class="w-9 h-9" />
              </div>
              <h4 class="text-base font-bold text-emerald-400 mt-1">NFC Tag Programmed!</h4>
              <p class="text-xs text-gray-300 mt-1">
                Sticker encoded with <span class="font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded">{targetUri()}</span>
              </p>
              <button
                onClick={props.onClose}
                class="mt-6 w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-sm rounded-xl transition-colors"
              >
                Done
              </button>
            </Show>

            {/* Step: Error */}
            <Show when={step() === "error"}>
              <div class="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center my-3 text-red-400">
                <AlertTriangle class="w-7 h-7" />
              </div>
              <h4 class="text-sm font-semibold text-red-400">NFC Operation Failed</h4>
              <p class="text-xs text-gray-400 mt-1">{errorMessage()}</p>
              <button
                onClick={() => setStep("ready")}
                class="mt-5 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-xs rounded-xl transition-colors"
              >
                Try Again
              </button>
            </Show>

          </div>
        </div>
      </div>
    </Show>
  );
}
