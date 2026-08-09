import { createSignal, onMount, Show } from "solid-js";
import { X, Download, AlertCircle } from "lucide-solid";
import { backendUrl, token } from "../hooks/useAuth";

interface DocumentViewerProps {
  document: {
    id: string;
    filename: string;
    label: string;
  };
  onClose: () => void;
}

export default function DocumentViewer(props: DocumentViewerProps) {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(false);

  const getDocUrl = (inline = false) => {
    const baseUrl = `${backendUrl()}/api/documents/${props.document.id}/download`;
    const authToken = token();
    const params = new URLSearchParams();
    if (authToken) params.append("token", authToken);
    if (inline) params.append("inline", "true");
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  };

  // Determine file type from extension
  const extension = props.document.filename.split('.').pop()?.toLowerCase() || '';
  
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(extension);
  const isPdf = extension === 'pdf';
  const isText = ['txt', 'md', 'csv', 'log', 'json', 'xml'].includes(extension);
  const isUnsupported = !isImage && !isPdf && !isText;

  onMount(() => {
    // Add escape key listener to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  });

  return (
    <div class="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Header Bar */}
      <div class="flex items-center justify-between px-4 py-3 bg-gray-900/50 border-b border-white/10 shrink-0">
        <div class="flex flex-col min-w-0">
          <span class="text-white font-medium truncate">{props.document.label}</span>
          <span class="text-gray-400 text-xs truncate">{props.document.filename}</span>
        </div>
        <div class="flex items-center gap-2">
          <a
            href={getDocUrl()}
            target="_blank"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            title="Download File"
          >
            <Download size={16} />
            <span class="hidden sm:inline">Download</span>
          </a>
          <button
            onClick={props.onClose}
            class="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-red-500/80 rounded-lg transition-colors ml-2"
            title="Close Viewer (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Viewer Content */}
      <div class="flex-1 overflow-hidden relative flex items-center justify-center p-4">
        {/* Loading Indicator */}
        <Show when={loading() && !isUnsupported}>
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        </Show>

        {/* Error State */}
        <Show when={error()}>
          <div class="flex flex-col items-center justify-center text-center max-w-md bg-gray-800/80 p-6 rounded-xl border border-red-500/30">
            <AlertCircle size={48} class="text-red-400 mb-4" />
            <h3 class="text-xl font-semibold text-white mb-2">Failed to load document</h3>
            <p class="text-gray-400 mb-4 text-sm">
              The document could not be loaded in the viewer. You can try downloading it instead.
            </p>
            <a
              href={getDocUrl()}
              target="_blank"
              class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
            >
              Download File
            </a>
          </div>
        </Show>

        <Show when={!error()}>
          {isImage && (
            <img 
              src={getDocUrl(true)} 
              alt={props.document.label}
              class="max-w-full max-h-full object-contain rounded-md shadow-2xl transition-opacity duration-300"
              style={{ opacity: loading() ? 0 : 1 }}
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
            />
          )}

          {(isPdf || isText) && (
            <iframe 
              src={getDocUrl(true)} 
              title={props.document.label}
              class="w-full h-full bg-white rounded-md shadow-2xl transition-opacity duration-300"
              style={{ opacity: loading() ? 0 : 1 }}
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
            />
          )}

          {isUnsupported && (
            <div class="flex flex-col items-center justify-center text-center max-w-md bg-gray-800/80 p-8 rounded-xl border border-white/10 shadow-2xl">
              <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Download size={32} class="text-indigo-400" />
              </div>
              <h3 class="text-xl font-semibold text-white mb-2">Preview Not Available</h3>
              <p class="text-gray-400 mb-6 text-sm">
                This file type (.{extension}) cannot be previewed within the application. Please download the file to view it in its native application.
              </p>
              <a
                href={getDocUrl()}
                target="_blank"
                class="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
              >
                Download File
              </a>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
