import { Show } from "solid-js";
import { Image as ImageIcon, Plus, Trash2, Minus } from "lucide-solid";

export default function PartImages(props: any) {
  return (
    <div
      onDragOver={props.handleDragOver}
      onDragLeave={props.handleDragLeave}
      onDrop={props.handleDrop}
      class={`${props.class} glass-panel rounded-2xl border transition-all duration-200 overflow-hidden relative justify-center items-center group h-64 ${props.isDraggingOver ? "border-accentCyan bg-accentCyan/10 scale-[1.02]" : "border-white/5 bg-white/[0.01]"
        }`}
    >
      <Show when={!props.item?.images || props.item.images.length === 0}>
        <div class="text-center p-6 space-y-3 flex flex-col items-center pointer-events-none">
          <div class="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-accentCyan group-hover:border-accentCyan/30 transition-colors pointer-events-none">
            <ImageIcon size={28} />
          </div>
          <div class="pointer-events-none">
            <p class="text-sm font-semibold text-white">No Component Photo</p>
            <p class="text-xs text-gray-500 mt-1 max-w-[200px]">Drag & drop an image file or web image link here to upload.</p>
          </div>
          <Show when={props.user?.role === "admin" || props.user?.role === "stocker"}>
            <button
              onClick={() => props.setShowAddImageModal(true)}
              class="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1 pointer-events-auto"
            >
              <Plus size={12} /> Add Image
            </button>
          </Show>
        </div>
      </Show>

      <Show when={props.item?.images && props.item.images.length > 0}>
        {() => {
          const currentImage = () => props.item.images[props.activeImageIndex] || props.item.images[0];
          return (
            <div class="w-full h-full relative flex flex-col justify-between">
              {/* Render Image */}
              <div
                onDragOver={props.handleDragOver}
                onDragLeave={props.handleDragLeave}
                onDrop={props.handleDrop}
                class="flex-1 w-full relative flex items-center justify-center overflow-hidden bg-black/20"
              >
                <img
                  src={`${props.backendUrl}/api/images/${currentImage()?.id}/render`}
                  alt={currentImage()?.caption}
                  class="max-w-full max-h-full object-contain pointer-events-none"
                />

                {/* Image Caption overlay */}
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6 text-xs text-white pointer-events-none">
                  <p class="font-bold truncate">{currentImage()?.caption}</p>
                  <Show when={currentImage()?.notes}>
                    <p class="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{currentImage()?.notes}</p>
                  </Show>
                </div>

                {/* Deletion & Add actions top right */}
                <div class="absolute top-3 right-3 flex gap-2">
                  <Show when={props.user?.role === "admin" || props.user?.role === "stocker"}>
                    <button
                      onClick={() => props.setShowAddImageModal(true)}
                      class="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                      title="Add another photo"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => props.handleDeleteImage(currentImage()?.id)}
                      class="p-1.5 rounded-lg bg-black/60 text-red-400 hover:text-red-300 hover:bg-black/80 transition-colors cursor-pointer"
                      title="Delete this photo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Show>
                </div>
              </div>

              {/* Carousel controls if > 1 image */}
              <Show when={props.item.images.length > 1}>
                <div class="absolute inset-y-0 left-0 right-0 flex justify-between items-center px-2 pointer-events-none">
                  <button
                    onClick={() => props.setActiveImageIndex((prev: number) => (prev > 0 ? prev - 1 : props.item.images.length - 1))}
                    class="pointer-events-auto p-1 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    onClick={() => props.setActiveImageIndex((prev: number) => (prev < props.item.images.length - 1 ? prev + 1 : 0))}
                    class="pointer-events-auto p-1 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </Show>
            </div>
          );
        }}
      </Show>
    </div>
  );
}
