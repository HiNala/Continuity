"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  AlertCircle,
  Zap,
} from "lucide-react";
import {
  getProjectGallery,
  GalleryResponse,
  GalleryPhase,
  GalleryAttempt,
} from "@/lib/api";

interface GalleryModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Helper to resolve image URLs
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function resolveImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http") || imageUrl.startsWith("data:")) return imageUrl;
  if (imageUrl.startsWith("/")) return `${API_URL}${imageUrl}`;
  return `${API_URL}/${imageUrl}`;
}

// Phase icons and colors
const PHASE_CONFIG: Record<string, { label: string; color: string }> = {
  cleanup: { label: "Cleanup", color: "bg-blue-500" },
  structural: { label: "Structural", color: "bg-purple-500" },
  fixture: { label: "Fixtures", color: "bg-amber-500" },
  style: { label: "Style", color: "bg-emerald-500" },
};

function formatScore(score: number | null): string {
  if (score === null) return "N/A";
  return `${Math.round(score * 100)}%`;
}

function formatDelta(current: number | null, previous: number | null): string | null {
  if (current === null || previous === null) return null;
  const delta = Math.round((current - previous) * 100);
  if (delta > 0) return `+${delta}%`;
  if (delta < 0) return `${delta}%`;
  return null;
}

// Improvement Journey Chart Component
function ImprovementChart({ scores }: { scores: number[] }) {
  if (scores.length === 0) return null;

  const maxScore = 100;
  const chartHeight = 120;
  const chartWidth = Math.max(300, scores.length * 50);
  
  // Generate points for the line
  const points = scores.map((score, i) => {
    const x = (i / Math.max(scores.length - 1, 1)) * (chartWidth - 40) + 20;
    const y = chartHeight - 20 - ((score * 100) / maxScore) * (chartHeight - 40);
    return { x, y, score: score * 100 };
  });

  const pathData = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-5 h-5 text-emerald-400" />
        <span className="font-semibold text-white">Score Progression</span>
      </div>
      
      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight} className="min-w-full">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => {
            const y = chartHeight - 20 - (percent / maxScore) * (chartHeight - 40);
            return (
              <g key={percent}>
                <line
                  x1={20}
                  x2={chartWidth - 20}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="4 4"
                />
                <text
                  x={10}
                  y={y + 4}
                  fill="rgba(255,255,255,0.4)"
                  fontSize={10}
                >
                  {percent}
                </text>
              </g>
            );
          })}
          
          {/* 70% threshold line */}
          <line
            x1={20}
            x2={chartWidth - 20}
            y1={chartHeight - 20 - (70 / maxScore) * (chartHeight - 40)}
            y2={chartHeight - 20 - (70 / maxScore) * (chartHeight - 40)}
            stroke="rgba(239, 68, 68, 0.5)"
            strokeWidth={2}
            strokeDasharray="8 4"
          />
          <text
            x={chartWidth - 60}
            y={chartHeight - 20 - (70 / maxScore) * (chartHeight - 40) - 5}
            fill="rgba(239, 68, 68, 0.7)"
            fontSize={10}
          >
            Pass (70%)
          </text>

          {/* Line path */}
          <motion.path
            d={pathData}
            fill="none"
            stroke="url(#gradient)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          
          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Points */}
          {points.map((point, i) => (
            <g key={i}>
              <motion.circle
                cx={point.x}
                cy={point.y}
                r={6}
                fill={point.score >= 70 ? "#10b981" : point.score >= 50 ? "#f59e0b" : "#ef4444"}
                stroke="white"
                strokeWidth={2}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 + 0.5 }}
              />
              <text
                x={point.x}
                y={point.y - 12}
                textAnchor="middle"
                fill="white"
                fontSize={10}
                fontWeight="bold"
              >
                {Math.round(point.score)}%
              </text>
              <text
                x={point.x}
                y={chartHeight - 5}
                textAnchor="middle"
                fill="rgba(255,255,255,0.5)"
                fontSize={9}
              >
                #{i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// Summary Stats Component
function SummaryStats({ summary }: { summary: GalleryResponse["summary"] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
        <div className="text-2xl font-bold text-white">{summary.total_attempts}</div>
        <div className="text-sm text-slate-400">Images Generated</div>
      </div>
      <div className="bg-emerald-500/10 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/20">
        <div className="text-2xl font-bold text-emerald-400">{summary.passed}</div>
        <div className="text-sm text-emerald-300/70">Passed QC</div>
      </div>
      <div className="bg-amber-500/10 backdrop-blur-sm rounded-xl p-4 border border-amber-500/20">
        <div className="text-2xl font-bold text-amber-400">{summary.failed}</div>
        <div className="text-sm text-amber-300/70">Learned From</div>
      </div>
      <div className="bg-purple-500/10 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
        <div className="text-2xl font-bold text-purple-400">{summary.total_policy_updates}</div>
        <div className="text-sm text-purple-300/70">Policy Updates</div>
      </div>
    </div>
  );
}

// Attempt Card Component
function AttemptCard({ 
  attempt, 
  isLast,
  previousScore,
}: { 
  attempt: GalleryAttempt; 
  isLast: boolean;
  previousScore: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const passed = attempt.status === "passed";
  const score = attempt.score;
  const delta = formatDelta(score, previousScore);
  const imageUrl = resolveImageUrl(attempt.image_url);
  
  return (
    <div className="relative">
      {/* Connection arrow */}
      {!isLast && (
        <div className="absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
          <ArrowRight className="w-4 h-4 text-slate-500" />
        </div>
      )}
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative rounded-xl overflow-hidden border-2 transition-all ${
          passed 
            ? "border-emerald-500/50 bg-emerald-500/5" 
            : "border-amber-500/50 bg-amber-500/5"
        }`}
      >
        {/* Status Badge */}
        <div className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center ${
          passed ? "bg-emerald-500" : "bg-amber-500"
        }`}>
          {passed ? (
            <Check className="w-4 h-4 text-white" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-white" />
          )}
        </div>
        
        {/* Image */}
        <div className="aspect-video bg-slate-800 relative group cursor-pointer"
          onClick={() => imageUrl && window.open(imageUrl, '_blank')}
        >
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt={`Attempt ${attempt.attempt_number}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-white" />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-slate-600" />
            </div>
          )}
        </div>
        
        {/* Info Section */}
        <div className="p-3 space-y-2">
          {/* Attempt & Score */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              Attempt {attempt.attempt_number}
            </span>
            <div className="flex items-center gap-1">
              <span className={`font-bold ${passed ? "text-emerald-400" : "text-amber-400"}`}>
                {formatScore(score)}
              </span>
              {delta && (
                <span className={`text-xs ${delta.startsWith('+') ? "text-emerald-400" : "text-red-400"}`}>
                  ({delta})
                </span>
              )}
            </div>
          </div>
          
          {/* Failure Reason or Success */}
          {attempt.human_readable_reason ? (
            <div className="text-xs text-slate-400 line-clamp-2">
              {attempt.human_readable_reason}
            </div>
          ) : passed ? (
            <div className="text-xs text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              All checks passed
            </div>
          ) : null}
          
          {/* Policy Badge */}
          {attempt.policy_version && attempt.policy_version > 1 && (
            <div className="flex items-center gap-1 text-xs text-purple-400">
              <Zap className="w-3 h-3" />
              Policy v{attempt.policy_version}
            </div>
          )}
          
          {/* Expand for Details */}
          {attempt.evaluation && attempt.evaluation.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors pt-1"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show Details
                </>
              )}
            </button>
          )}
          
          {/* Expanded Details */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 border-t border-white/10 space-y-1">
                  {attempt.evaluation.map((criterion, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 capitalize">
                        {criterion.criterion.replace(/_/g, " ")}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={criterion.passed ? "text-emerald-400" : "text-red-400"}>
                          {Math.round(criterion.score * 100)}%
                        </span>
                        {criterion.passed ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <X className="w-3 h-3 text-red-400" />
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {attempt.weave_trace_id && (
                    <a
                      href={`https://wandb.ai/weave?traceId=${attempt.weave_trace_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 pt-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View in Weave
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// Phase Section Component
function PhaseSection({ phase, phaseIndex }: { phase: GalleryPhase; phaseIndex: number }) {
  const config = PHASE_CONFIG[phase.phase] || { label: phase.phase_label, color: "bg-slate-500" };
  const finalPassed = phase.final_status === "passed";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: phaseIndex * 0.1 }}
      className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10"
    >
      {/* Phase Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-8 rounded-full ${config.color}`} />
          <div>
            <h3 className="font-semibold text-white text-lg">
              Phase {phaseIndex + 1}: {config.label}
            </h3>
            <div className="text-sm text-slate-400">
              {phase.total_attempts} attempt{phase.total_attempts !== 1 ? "s" : ""}
              {phase.policy_updates_count > 0 && ` • ${phase.policy_updates_count} improvement${phase.policy_updates_count !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
        
        <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-sm font-medium ${
          finalPassed 
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
        }`}>
          {finalPassed ? (
            <>
              <Check className="w-4 h-4" />
              Passed
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              In Progress
            </>
          )}
        </div>
      </div>
      
      {/* Score Progression Mini */}
      {phase.score_progression.length > 1 && (
        <div className="mb-4 px-3 py-2 bg-black/20 rounded-lg flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-400">
            {phase.score_progression.map((s, i) => (
              <span key={i}>
                <span className={s >= 0.7 ? "text-emerald-400" : s >= 0.5 ? "text-amber-400" : "text-red-400"}>
                  {Math.round(s * 100)}%
                </span>
                {i < phase.score_progression.length - 1 && " → "}
              </span>
            ))}
          </span>
        </div>
      )}
      
      {/* Attempts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {phase.attempts.map((attempt, i) => (
          <AttemptCard
            key={attempt.iteration_id}
            attempt={attempt}
            isLast={i === phase.attempts.length - 1}
            previousScore={i > 0 ? phase.attempts[i - 1].score : null}
          />
        ))}
      </div>
    </motion.div>
  );
}

// Main Gallery Modal Component
export function GalleryModal({ projectId, isOpen, onClose }: GalleryModalProps) {
  const [gallery, setGallery] = useState<GalleryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGallery = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getProjectGallery(projectId);
      setGallery(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchGallery();
    }
  }, [isOpen, projectId, fetchGallery]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20">
              <div>
                <h2 className="text-xl font-bold text-white">Generation Gallery</h2>
                <p className="text-sm text-slate-400">
                  {gallery?.run_timestamp 
                    ? `Run: ${new Date(gallery.run_timestamp).toLocaleString()}`
                    : "View all generated images and their evaluations"
                  }
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                  <p className="text-slate-400">{error}</p>
                  <button
                    onClick={fetchGallery}
                    className="mt-4 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : !gallery || gallery.phases.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <ImageIcon className="w-12 h-12 text-slate-600 mb-4" />
                  <p className="text-slate-400">No images generated yet</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Run a transformation to see your gallery
                  </p>
                </div>
              ) : (
                <>
                  {/* Improvement Journey Header */}
                  <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl p-6 border border-primary/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Improvement Journey</h3>
                        <p className="text-sm text-slate-400">
                          {gallery.summary.improvement_demonstrated
                            ? "The system improved through self-evaluation and policy updates"
                            : "Generation completed successfully"
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Summary Stats */}
                    <SummaryStats summary={gallery.summary} />
                    
                    {/* Score Progression Chart */}
                    {gallery.summary.overall_score_progression.length > 1 && (
                      <div className="mt-4">
                        <ImprovementChart scores={gallery.summary.overall_score_progression} />
                      </div>
                    )}
                  </div>
                  
                  {/* Phase Sections */}
                  <div className="space-y-6">
                    {gallery.phases.map((phase, i) => (
                      <PhaseSection key={phase.phase} phase={phase} phaseIndex={i} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
