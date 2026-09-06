import React, { useState, useEffect, useRef } from 'react';
import { X, Crop, ZoomIn, Sliders, Check, RotateCcw, Maximize2, Move } from 'lucide-react';

interface BannerCropperModalProps {
  imageFile: File | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (croppedDataUrl: string) => void;
}

export default function BannerCropperModal({
  imageFile,
  isOpen,
  onClose,
  onSave
}: BannerCropperModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [aspectRatio, setAspectRatio] = useState<number | null>(null); // null = Original natural ratio
  const [zoom, setZoom] = useState<number>(1);
  const [offsetY, setOffsetY] = useState<number>(50); // 0% (top) to 100% (bottom)
  const [offsetX, setOffsetX] = useState<number>(50); // 0% (left) to 100% (right)
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load image when imageFile changes
  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        setImageSrc(src);

        const img = new Image();
        img.onload = () => {
          setNaturalDimensions({ width: img.width, height: img.height });
        };
        img.src = src;
      };
      reader.readAsDataURL(imageFile);
    } else {
      setImageSrc(null);
    }

    // Reset controls
    setZoom(1);
    setOffsetY(50);
    setOffsetX(50);
    setRotation(0);
    setAspectRatio(null); // Default to natural ratio
  }, [imageFile, isOpen]);

  if (!isOpen || !imageSrc) return null;

  const handleCropAndSave = () => {
    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let targetWidth = img.width;
        let targetHeight = img.height;

        if (aspectRatio !== null && aspectRatio > 0) {
          // If specific aspect ratio is selected
          targetWidth = Math.min(img.width, 1920);
          targetHeight = Math.round(targetWidth / aspectRatio);
        } else {
          // Keep natural original size up to max 1920px width
          if (img.width > 1920) {
            targetWidth = 1920;
            targetHeight = Math.round((img.height * 1920) / img.width);
          }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Fill background
        ctx.fillStyle = '#0b0c0e';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Apply transformations
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Calculate scaling & offsets based on zoom and positions
        const scaledWidth = targetWidth * zoom;
        const scaledHeight = (targetWidth / (img.width / img.height)) * zoom;

        // Position alignment
        const shiftX = (targetWidth - scaledWidth) * (offsetX / 100);
        const shiftY = (targetHeight - scaledHeight) * (offsetY / 100);

        ctx.translate(targetWidth / 2, targetHeight / 2);
        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }
        ctx.translate(-targetWidth / 2, -targetHeight / 2);

        ctx.drawImage(img, shiftX, shiftY, scaledWidth, scaledHeight);
        ctx.restore();

        let croppedDataUrl = canvas.toDataURL('image/webp', 0.96);
        if (!croppedDataUrl.startsWith('data:image/webp') || croppedDataUrl.length < 50) {
          croppedDataUrl = canvas.toDataURL('image/jpeg', 0.96);
        }

        onSave(croppedDataUrl);
      } catch (err) {
        console.error('Crop error:', err);
        // Fallback: save original src
        onSave(imageSrc);
      } finally {
        setIsProcessing(false);
      }
    };
    img.src = imageSrc;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f1115] border border-cyan-500/30 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-[#14171d]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-cyan-200">
                Ковер зургийн хэмжээ засах & Тайрах
              </h3>
              <p className="text-[11px] text-zinc-400">
                Үндсэн хэмжээ: {naturalDimensions.width}x{naturalDimensions.height}px
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Live Preview Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5" /> Хөдөлгөөнт харагдах байдал (Live Preview)
              </span>
              <span>
                {aspectRatio === null
                  ? 'Үндсэн харьцаа (Original Auto)'
                  : `${aspectRatio === 21 / 9 ? '21:9 Өргөн' : aspectRatio === 16 / 9 ? '16:9 Стандарт' : '4:3 Компакт'}`}
              </span>
            </div>

            <div className="relative w-full overflow-hidden rounded-2xl bg-black border border-cyan-500/20 shadow-inner flex items-center justify-center min-h-[200px] max-h-[380px] p-2">
              <div
                className="relative overflow-hidden w-full transition-all duration-300 rounded-xl flex items-center justify-center"
                style={{
                  aspectRatio: aspectRatio !== null ? `${aspectRatio}` : `${naturalDimensions.width || 16} / ${naturalDimensions.height || 9}`,
                  maxHeight: '360px'
                }}
              >
                <img
                  src={imageSrc}
                  alt="Crop preview"
                  className="w-full h-full object-cover transition-all"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    objectPosition: `${offsetX}% ${offsetY}%`
                  }}
                />
                {/* Crop overlay grid */}
                <div className="absolute inset-0 border border-cyan-400/30 pointer-events-none grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-cyan-400/15" />
                  <div className="border-r border-b border-cyan-400/15" />
                  <div className="border-b border-cyan-400/15" />
                  <div className="border-r border-b border-cyan-400/15" />
                  <div className="border-r border-b border-cyan-400/15" />
                  <div className="border-b border-cyan-400/15" />
                  <div className="border-r border-cyan-400/15" />
                  <div className="border-r border-cyan-400/15" />
                  <div />
                </div>
              </div>
            </div>
          </div>

          {/* Aspect Ratio Options */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Харьцаа / Хэмжээ сонгох:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setAspectRatio(null)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  aspectRatio === null
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'bg-zinc-900/80 border-zinc-700/60 text-zinc-400 hover:text-white hover:border-zinc-500'
                }`}
              >
                <span>Үндсэн (Auto)</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio(21 / 9)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  aspectRatio === 21 / 9
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'bg-zinc-900/80 border-zinc-700/60 text-zinc-400 hover:text-white hover:border-zinc-500'
                }`}
              >
                <span>21:9 Өргөн баннер</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio(16 / 9)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  aspectRatio === 16 / 9
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'bg-zinc-900/80 border-zinc-700/60 text-zinc-400 hover:text-white hover:border-zinc-500'
                }`}
              >
                <span>16:9 Стандарт</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio(4 / 3)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  aspectRatio === 4 / 3
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'bg-zinc-900/80 border-zinc-700/60 text-zinc-400 hover:text-white hover:border-zinc-500'
                }`}
              >
                <span>4:3 Компакт</span>
              </button>
            </div>
          </div>

          {/* Adjustment Sliders (Zoom, Position) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-900/50 p-3.5 rounded-2xl border border-zinc-800/80">
            {/* Zoom Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-300 font-medium">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5 text-cyan-400" /> Томосгох / Багасгах
                </span>
                <span className="text-cyan-400 font-mono">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Vertical Position Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-300 font-medium">
                <span className="flex items-center gap-1">
                  <Move className="w-3.5 h-3.5 text-cyan-400" /> Босоо байрлал (Up/Down)
                </span>
                <span className="text-cyan-400 font-mono">{Math.round(offsetY)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={offsetY}
                onChange={(e) => setOffsetY(parseInt(e.target.value))}
                className="w-full accent-cyan-400 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-zinc-800 flex items-center justify-between bg-[#14171d]">
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffsetY(50);
              setOffsetX(50);
              setRotation(0);
              setAspectRatio(null);
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Анхны байдалд</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Цуцлах
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleCropAndSave}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-black bg-cyan-400 hover:bg-cyan-300 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isProcessing ? 'Боловсруулж байна...' : 'Тайрч Хадгалах'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
