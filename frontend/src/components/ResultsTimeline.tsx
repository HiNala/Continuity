"use client";

import { useState, useCallback } from "react";
import { 
  ArrowRight, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Layers,
  ExternalLink,
  ImageIcon,
  Loader2
} from "lucide-react";

interface PhaseResult {
  phase: string;
  imagePath: string;
  iterationId?: string;
  weaveTraceId?: string;
}

interface ResultsTimelineProps {
  originalImage: string;
  phases: PhaseResult[];
  styleVariations?: PhaseResult[];
  onViewWeaveTrace?: (traceId: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const resolveImagePath = (imagePath: string) => {
  if (!imagePath) return imagePath;
  if (imagePath.startsWith("http") || imagePath.startsWith("data:")) return imagePath;
  if (imagePath.startsWith("/")) return `${API_URL}${imagePath}`;
  return `${API_URL}/${imagePath}`;
};

// Image component with loading state
function TimelineImage({ 
  src, 
  alt, 
  isSelected,
  compareIndex,
  onClick 
}: { 
  src: string; 
  alt: string; 
  isSelected: boolean;
  compareIndex: number | null;
  onClick: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 group
        ${isSelected 
          ? "border-primary ring-2 ring-primary/30 scale-[1.02]" 
          : "border-black/10 hover:border-black/20 hover:shadow-md"
        }
      `}
    >
      <div className="w-24 h-24 bg-slate-100">
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        )}
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400">
            <ImageIcon className="w-6 h-6 mb-1" />
            <span className="text-[10px]">Failed</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => setIsLoading(false)}
            onError={() => { setIsLoading(false); setHasError(true); }}
          />
        )}
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
        <p className="text-[11px] text-white font-medium truncate">{alt}</p>
      </div>
      {compareIndex !== null && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-md">
          {compareIndex + 1}
        </div>
      )}
    </div>
  );
}

export function ResultsTimeline({ 
  originalImage, 
  phases, 
  styleVariations = [],
  onViewWeaveTrace 
}: ResultsTimelineProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareImages, setCompareImages] = useState<[string | null, string | null]>([null, null]);
  const [sliderPosition, setSliderPosition] = useState(50);

  const allImages = [
    { phase: "Original", imagePath: originalImage },
    ...phases,
    ...styleVariations.map(s => ({ ...s, phase: `Style: ${s.phase}` }))
  ];

  const handleImageClick = useCallback((imagePath: string) => {
    if (compareMode) {
      if (!compareImages[0]) {
        setCompareImages([imagePath, null]);
      } else if (!compareImages[1]) {
        setCompareImages([compareImages[0], imagePath]);
      } else {
        setCompareImages([imagePath, null]);
      }
    } else {
      setSelectedImage(imagePath);
    }
  }, [compareMode, compareImages]);

  const getPhaseName = (phase: string) => {
    const names: Record<string, string> = {
      cleanup: "Cleanup",
      structural: "Structural",
      fixture: "Fixtures",
      style: "Styled",
      Original: "Original",
    };
    return names[phase] || phase;
  };

  const getCompareIndex = useCallback((path: string): number | null => {
    const idx = compareImages.indexOf(path);
    return idx >= 0 ? idx : null;
  }, [compareImages]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Transformation Timeline</h3>
        <button
          onClick={() => {
            setCompareMode(!compareMode);
            setCompareImages([null, null]);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            compareMode 
              ? "bg-primary text-white shadow-md" 
              : "bg-black/5 text-foreground/70 hover:bg-black/10"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {compareMode ? "Exit Compare" : "Compare"}
        </button>
      </div>

      {/* Compare Mode Hint */}
      {compareMode && (
        <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/10 px-3 py-2 rounded-lg">
          Select two images to compare side by side
        </p>
      )}

      {/* Timeline - horizontal scroll */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {allImages.map((item, index) => {
          const resolvedPath = resolveImagePath(item.imagePath);
          return (
            <div key={index} className="flex items-center gap-2.5 flex-shrink-0">
              <TimelineImage
                src={resolvedPath}
                alt={getPhaseName(item.phase)}
                isSelected={compareImages.includes(resolvedPath)}
                compareIndex={getCompareIndex(resolvedPath)}
                onClick={() => handleImageClick(resolvedPath)}
              />
              {index < allImages.length - 1 && (
                <ArrowRight className="w-4 h-4 text-black/20 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison View */}
      {compareMode && compareImages[0] && compareImages[1] && (
        <div className="relative rounded-xl overflow-hidden border border-black/10 bg-slate-50 shadow-sm">
          <div className="aspect-video relative">
            {/* Left Image */}
            <div 
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={compareImages[0]} alt="Compare left" className="w-full h-full object-contain" />
            </div>
            
            {/* Right Image */}
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={compareImages[1]} alt="Compare right" className="w-full h-full object-contain" />
            </div>

            {/* Slider Handle */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize shadow-lg"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lg border border-black/10">
                <ChevronLeft className="w-3 h-3 text-slate-600" />
                <ChevronRight className="w-3 h-3 text-slate-600" />
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
            />
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && !compareMode && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Weave Trace Links */}
      {phases.some(p => p.weaveTraceId) && (
        <div className="flex items-center gap-2 text-xs pt-2 border-t border-black/5">
          <span className="text-muted-foreground">Traces:</span>
          {phases.filter(p => p.weaveTraceId).map((phase, i) => (
            <button
              key={i}
              onClick={() => onViewWeaveTrace?.(phase.weaveTraceId!)}
              className="text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              {getPhaseName(phase.phase)}
              <ExternalLink className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
