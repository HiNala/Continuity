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
  evaluationPassed?: boolean | null;
  evaluationScore?: number | null;
  iterationNumber?: number;
}

interface ResultsTimelineProps {
  originalImage: string;
  originalImages?: string[]; // Support multiple original images
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

import { CheckCircle2, XCircle } from "lucide-react";

// Image component with loading state and evaluation status
function TimelineImage({ 
  src, 
  alt, 
  isSelected,
  compareIndex,
  onClick,
  evaluationPassed,
  evaluationScore,
  iterationNumber,
}: { 
  src: string; 
  alt: string; 
  isSelected: boolean;
  compareIndex: number | null;
  onClick: () => void;
  evaluationPassed?: boolean | null;
  evaluationScore?: number | null;
  iterationNumber?: number;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`
        relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900
        ${isSelected 
          ? "border-primary ring-2 ring-primary/30 scale-[1.02]" 
          : evaluationPassed === false 
            ? "border-red-400/50 bg-red-50/30 dark:bg-red-900/20"
            : evaluationPassed === true
              ? "border-emerald-400/50 dark:border-emerald-500/50"
              : "border-neutral-200 dark:border-zinc-700 hover:border-neutral-300 dark:hover:border-zinc-600 hover:shadow-md"
        }
      `}
    >
      <div className="w-24 h-24 bg-neutral-100 dark:bg-zinc-800">
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-zinc-800">
            <Loader2 className="w-5 h-5 text-neutral-400 dark:text-zinc-500 animate-spin" />
          </div>
        )}
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-100 dark:bg-zinc-800 text-neutral-400 dark:text-zinc-500">
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
        {evaluationScore !== undefined && evaluationScore !== null && (
          <p className="text-[9px] text-white/70">
            Score: {(evaluationScore * 100).toFixed(0)}%
          </p>
        )}
      </div>
      
      {/* Pass/Fail Badge */}
      {evaluationPassed !== null && evaluationPassed !== undefined && (
        <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-md ${
          evaluationPassed ? "bg-emerald-500" : "bg-red-500"
        }`}>
          {evaluationPassed ? (
            <CheckCircle2 className="w-3 h-3 text-white" />
          ) : (
            <XCircle className="w-3 h-3 text-white" />
          )}
        </div>
      )}
      
      {/* Iteration Number Badge */}
      {iterationNumber !== undefined && iterationNumber > 1 && (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-amber-500 rounded text-[9px] text-white font-bold shadow-md">
          #{iterationNumber}
        </div>
      )}
      
      {compareIndex !== null && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-md">
          {compareIndex + 1}
        </div>
      )}
    </button>
  );
}

export function ResultsTimeline({ 
  originalImage, 
  originalImages = [],
  phases, 
  styleVariations = [],
  onViewWeaveTrace 
}: ResultsTimelineProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareImages, setCompareImages] = useState<[string | null, string | null]>([null, null]);
  const [sliderPosition, setSliderPosition] = useState(50);

  // Build list of original images - use array if provided, otherwise use single image
  const originals = originalImages.length > 0 
    ? originalImages 
    : originalImage ? [originalImage] : [];

  const allImages = [
    ...originals.map((img, idx) => ({ 
      phase: originals.length > 1 ? `Original ${idx + 1}` : "Original", 
      imagePath: img, 
      evaluationPassed: null, 
      evaluationScore: null, 
      iterationNumber: 0 
    })),
    ...phases.map(p => ({ ...p, phase: p.phase })),
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
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-zinc-100">Transformation Timeline</h3>
        <button
          onClick={() => {
            setCompareMode(!compareMode);
            setCompareImages([null, null]);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900 ${
            compareMode 
              ? "bg-primary text-white shadow-md" 
              : "bg-white/70 dark:bg-zinc-900/60 text-neutral-700 dark:text-zinc-300 border border-white/40 dark:border-white/10 hover:bg-white/90 dark:hover:bg-zinc-900/80"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {compareMode ? "Exit Compare" : "Compare"}
        </button>
      </div>

      {/* Compare Mode Hint */}
      {compareMode && (
        <p className="text-xs text-neutral-600 dark:text-zinc-400 bg-white/70 dark:bg-zinc-900/60 border border-white/40 dark:border-white/10 backdrop-blur-xl px-3 py-2 rounded-lg shadow-[0_8px_18px_rgba(0,0,0,0.08)]">
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
                evaluationPassed={item.evaluationPassed}
                evaluationScore={item.evaluationScore}
                iterationNumber={item.iterationNumber}
              />
              {index < allImages.length - 1 && (
                <ArrowRight className="w-4 h-4 text-neutral-300 dark:text-zinc-600 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison View */}
      {compareMode && compareImages[0] && compareImages[1] && (
        <div className="relative rounded-xl overflow-hidden border border-neutral-200 dark:border-zinc-700 bg-neutral-50 dark:bg-zinc-900 shadow-sm">
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
              className="absolute top-0 bottom-0 w-0.5 bg-white dark:bg-zinc-100 cursor-ew-resize shadow-lg"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-white dark:bg-zinc-100 rounded-full flex items-center justify-center shadow-lg border border-neutral-200 dark:border-zinc-300">
                <ChevronLeft className="w-3 h-3 text-neutral-600 dark:text-zinc-700" />
                <ChevronRight className="w-3 h-3 text-neutral-600 dark:text-zinc-700" />
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
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
        <div className="flex items-center gap-2 text-xs pt-2 border-t border-neutral-100 dark:border-zinc-800">
          <span className="text-neutral-500 dark:text-zinc-400">Traces:</span>
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
