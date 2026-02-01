"use client";

import { useState } from "react";
import { 
  ArrowRight, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Layers,
  ExternalLink
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
  if (!imagePath) {
    return imagePath;
  }
  if (imagePath.startsWith("http") || imagePath.startsWith("data:")) {
    return imagePath;
  }
  if (imagePath.startsWith("/")) {
    return `${API_URL}${imagePath}`;
  }
  return `${API_URL}/${imagePath}`;
};

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

  // Combine all images for timeline
  const allImages = [
    { phase: "Original", imagePath: originalImage },
    ...phases,
    ...styleVariations.map(s => ({ ...s, phase: `Style: ${s.phase}` }))
  ];

  const handleImageClick = (imagePath: string) => {
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
  };

  const getPhaseName = (phase: string) => {
    const names: Record<string, string> = {
      cleanup: "Cleanup",
      structural: "Structural",
      fixture: "Fixtures",
      style: "Styled",
    };
    return names[phase] || phase;
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Transformation Timeline</h3>
        <button
          onClick={() => {
            setCompareMode(!compareMode);
            setCompareImages([null, null]);
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            compareMode 
              ? "bg-continuity-500 text-white" 
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Layers className="w-4 h-4" />
          {compareMode ? "Exit Compare" : "Compare"}
        </button>
      </div>

      {/* Compare Mode Instructions */}
      {compareMode && (
        <p className="text-sm text-slate-400 bg-slate-800/50 px-4 py-2 rounded-lg">
          Select two images to compare side by side
        </p>
      )}

      {/* Timeline */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4">
        {allImages.map((item, index) => (
          <div key={index} className="flex items-center gap-2 flex-shrink-0">
            {(() => {
              const resolvedPath = resolveImagePath(item.imagePath);
              return (
            <div
              onClick={() => handleImageClick(resolvedPath)}
              className={`
                relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                ${compareImages.includes(resolvedPath) 
                  ? "border-continuity-500 ring-2 ring-continuity-500/30" 
                  : "border-slate-700 hover:border-slate-600"
                }
              `}
            >
              <div className="w-28 h-28 bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedPath}
                  alt={item.phase}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                <p className="text-xs text-white font-medium truncate">
                  {getPhaseName(item.phase)}
                </p>
              </div>
              {compareImages.includes(resolvedPath) && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-continuity-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                  {compareImages.indexOf(resolvedPath) + 1}
                </div>
              )}
            </div>
              );
            })()}
            {index < allImages.length - 1 && (
              <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Comparison View */}
      {compareMode && compareImages[0] && compareImages[1] && (
        <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
          <div className="aspect-video relative">
            {/* Left Image */}
            <div 
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={compareImages[0]}
                alt="Compare left"
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Right Image */}
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={compareImages[1]}
                alt="Compare right"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Slider */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                <ChevronLeft className="w-3 h-3 text-slate-800" />
                <ChevronRight className="w-3 h-3 text-slate-800" />
              </div>
            </div>

            {/* Slider Input */}
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
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-full"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}

      {/* Weave Trace Links */}
      {phases.some(p => p.weaveTraceId) && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">View traces:</span>
          {phases.filter(p => p.weaveTraceId).map((phase, i) => (
            <button
              key={i}
              onClick={() => onViewWeaveTrace?.(phase.weaveTraceId!)}
              className="text-continuity-400 hover:text-continuity-300 flex items-center gap-1"
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
