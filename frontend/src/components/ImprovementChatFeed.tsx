"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Check,
  AlertTriangle,
  Wrench,
  ArrowRight,
  TrendingUp,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Target,
  Layers,
  Sofa,
} from "lucide-react";

// ============================================
// Types
// ============================================
export interface EvaluationCriterion {
  criterion: string;
  score: number;
  passed: boolean;
  reason?: string;
  details?: string;
}

export interface PolicyChange {
  field: string;
  from: string | number;
  to: string | number;
  reason?: string;
}

export interface ImprovementMessage {
  id: string;
  timestamp: string;
  type: 
    | "generation_start"
    | "generation_complete"
    | "evaluation_failed"
    | "evaluation_passed"
    | "policy_update"
    | "phase_complete"
    | "info";
  phase: string;
  attemptNumber: number;
  imageUrl?: string;
  score?: number;
  previousScore?: number;
  scoreDelta?: number;
  criteria?: EvaluationCriterion[];
  failureReasons?: string[];
  humanReadableReason?: string;
  policyChanges?: PolicyChange[];
  policyVersion?: number;
  message?: string;
}

interface ImprovementChatFeedProps {
  messages: ImprovementMessage[];
  isActive: boolean;
  onImageClick?: (imageUrl: string) => void;
}

// ============================================
// Phase Configuration
// ============================================
const phaseConfig: Record<string, { 
  icon: React.ElementType; 
  label: string; 
  bgClass: string;
  iconClass: string;
}> = {
  cleanup: { icon: Target, label: "Cleanup", bgClass: "bg-blue-500/20", iconClass: "text-blue-400" },
  structural: { icon: Layers, label: "Structural", bgClass: "bg-purple-500/20", iconClass: "text-purple-400" },
  fixture: { icon: Sofa, label: "Fixtures", bgClass: "bg-amber-500/20", iconClass: "text-amber-400" },
  style: { icon: Palette, label: "Style", bgClass: "bg-emerald-500/20", iconClass: "text-emerald-400" },
};

// ============================================
// Helper Functions
// ============================================
const formatTime = (timestamp: string) => {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return timestamp;
  }
};

const formatScore = (score: number | undefined): string => {
  if (score === undefined) return "N/A";
  return `${Math.round(score * 100)}%`;
};

const formatDelta = (delta: number | undefined): string | null => {
  if (delta === undefined) return null;
  const percent = Math.round(delta * 100);
  if (percent > 0) return `+${percent}%`;
  if (percent < 0) return `${percent}%`;
  return null;
};

// ============================================
// Message Components
// ============================================

// Generation Start Message
function GenerationStartMessage({ message }: { message: ImprovementMessage }) {
  const config = phaseConfig[message.phase] || phaseConfig.cleanup;
  const Icon = config.icon;
  const attemptText = message.attemptNumber > 1 ? ` (Attempt ${message.attemptNumber})` : "";

  return (
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl ${config.bgClass} flex items-center justify-center shrink-0`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Icon className={`w-5 h-5 ${config.iconClass}`} />
        </motion.div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white">Clarity</span>
          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">
            Generating {config.label} phase{attemptText}...
          </span>
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        </div>
      </div>
    </div>
  );
}

// Generation Complete Message (with image thumbnail)
function GenerationCompleteMessage({ 
  message, 
  onImageClick 
}: { 
  message: ImprovementMessage; 
  onImageClick?: (url: string) => void;
}) {
  const config = phaseConfig[message.phase] || phaseConfig.cleanup;

  return (
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl ${config.bgClass} flex items-center justify-center shrink-0`}>
        <ImageIcon className={`w-5 h-5 ${config.iconClass}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-white">Clarity</span>
          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
        </div>
        
        {/* Image Thumbnail */}
        {message.imageUrl && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => onImageClick?.(message.imageUrl!)}
            className="relative rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-all group mb-2"
          >
            <img
              src={message.imageUrl}
              alt={`${config.label} Attempt ${message.attemptNumber}`}
              className="w-48 h-32 object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ExternalLink className="w-5 h-5 text-white" />
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-xs text-white">
              Attempt {message.attemptNumber}
            </div>
          </motion.button>
        )}
        
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Image generated, evaluating quality...
        </p>
      </div>
    </div>
  );
}

// Evaluation Failed Message
function EvaluationFailedMessage({ message }: { message: ImprovementMessage }) {
  const [showDetails, setShowDetails] = useState(false);
  const delta = formatDelta(message.scoreDelta);
  const isImproved = (message.scoreDelta || 0) > 0;

  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-white">Clarity</span>
          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
        </div>
        
        {/* Score Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-amber-400 font-medium">
            Quality Check Failed (Score: {formatScore(message.score)})
          </span>
          {delta && (
            <span className={`text-sm ${isImproved ? "text-emerald-400" : "text-red-400"}`}>
              {isImproved ? "↑" : "↓"} {delta}
            </span>
          )}
        </div>
        
        {/* Getting closer message */}
        {isImproved && (
          <p className="text-sm text-emerald-400 mb-2 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            Getting closer!
          </p>
        )}
        
        {/* Human readable reason */}
        {message.humanReadableReason && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-2">
            <p className="text-sm text-slate-300">{message.humanReadableReason}</p>
          </div>
        )}
        
        {/* Failure reasons list */}
        {message.failureReasons && message.failureReasons.length > 0 && (
          <ul className="space-y-1 mb-2">
            {message.failureReasons.map((reason, i) => (
              <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}
        
        {/* Expandable criteria details */}
        {message.criteria && message.criteria.length > 0 && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showDetails ? "Hide" : "Show"} evaluation details
          </button>
        )}
        
        <AnimatePresence>
          {showDetails && message.criteria && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-700">
                {message.criteria.map((criterion, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 capitalize">
                      {criterion.criterion.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={criterion.passed ? "text-emerald-400" : "text-red-400"}>
                        {formatScore(criterion.score)}
                      </span>
                      {criterion.passed ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
          <RefreshCw className="w-4 h-4" />
          Analyzing what went wrong...
        </p>
      </div>
    </div>
  );
}

// Evaluation Passed Message
function EvaluationPassedMessage({ message }: { message: ImprovementMessage }) {
  const config = phaseConfig[message.phase] || phaseConfig.cleanup;

  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
        <Check className="w-5 h-5 text-emerald-400" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-white">Clarity</span>
          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
        </div>
        
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-400 font-medium">
            Quality Check Passed (Score: {formatScore(message.score)})
          </span>
        </div>
        
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-1">
          <p className="text-sm text-slate-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            All constraints preserved
          </p>
          <p className="text-sm text-slate-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            Geometry maintained
          </p>
          <p className="text-sm text-slate-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            {config.label} phase complete
          </p>
        </div>
      </div>
    </div>
  );
}

// Policy Update Message
function PolicyUpdateMessage({ message }: { message: ImprovementMessage }) {
  const config = phaseConfig[message.phase] || phaseConfig.cleanup;

  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
        <Wrench className="w-5 h-5 text-purple-400" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-white">Clarity</span>
          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
        </div>
        
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="w-4 h-4 text-purple-400" />
          <span className="text-purple-400 font-medium">Improving Approach</span>
          {message.policyVersion && (
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
              Policy v{message.policyVersion}
            </span>
          )}
        </div>
        
        <p className="text-sm text-slate-400 mb-2">
          Based on the evaluation, I&apos;m adjusting my process:
        </p>
        
        {/* Policy changes */}
        {message.policyChanges && message.policyChanges.length > 0 && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 space-y-2 mb-2">
            {message.policyChanges.map((change, i) => (
              <div key={i} className="text-sm">
                <span className="text-slate-400 capitalize">
                  {change.field.replace(/_/g, " ")}:
                </span>
                <span className="text-slate-500 mx-1">{String(change.from)}</span>
                <ArrowRight className="w-3 h-3 inline text-slate-500" />
                <span className="text-purple-400 font-medium mx-1">{String(change.to)}</span>
              </div>
            ))}
          </div>
        )}
        
        <p className="text-sm text-slate-500 flex items-center gap-1">
          <RefreshCw className="w-4 h-4" />
          Retrying {config.label.toLowerCase()} phase...
        </p>
      </div>
    </div>
  );
}

// Phase Complete Message
function PhaseCompleteMessage({ message }: { message: ImprovementMessage }) {
  const config = phaseConfig[message.phase] || phaseConfig.cleanup;
  const nextPhase = getNextPhase(message.phase);
  const nextConfig = nextPhase ? phaseConfig[nextPhase] : null;

  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-white">Clarity</span>
          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
        </div>
        
        <p className="text-sm text-emerald-400 font-medium mb-1">
          {config.label} phase complete!
        </p>
        
        {nextConfig && (
          <p className="text-sm text-slate-400 flex items-center gap-1">
            <ArrowRight className="w-4 h-4" />
            Moving to {nextConfig.label} phase...
          </p>
        )}
      </div>
    </div>
  );
}

// Info Message
function InfoMessage({ message }: { message: ImprovementMessage }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center shrink-0">
        <Sparkles className="w-5 h-5 text-slate-400" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white">Clarity</span>
          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
        </div>
        <p className="text-sm text-slate-300">{message.message}</p>
      </div>
    </div>
  );
}

// Helper function to get next phase
function getNextPhase(currentPhase: string): string | null {
  const phases = ["cleanup", "structural", "fixture", "style"];
  const currentIndex = phases.indexOf(currentPhase);
  if (currentIndex >= 0 && currentIndex < phases.length - 1) {
    return phases[currentIndex + 1];
  }
  return null;
}

// ============================================
// Main Component
// ============================================
export function ImprovementChatFeed({ 
  messages, 
  isActive, 
  onImageClick 
}: ImprovementChatFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && isActive) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isActive]);

  if (messages.length === 0 && !isActive) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-primary/10 to-purple-500/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Improvement Journey
              {isActive && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold animate-pulse">
                  LIVE
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Watch the AI learn and improve in real-time
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="max-h-[600px] overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
          >
            {message.type === "generation_start" && (
              <GenerationStartMessage message={message} />
            )}
            {message.type === "generation_complete" && (
              <GenerationCompleteMessage message={message} onImageClick={onImageClick} />
            )}
            {message.type === "evaluation_failed" && (
              <EvaluationFailedMessage message={message} />
            )}
            {message.type === "evaluation_passed" && (
              <EvaluationPassedMessage message={message} />
            )}
            {message.type === "policy_update" && (
              <PolicyUpdateMessage message={message} />
            )}
            {message.type === "phase_complete" && (
              <PhaseCompleteMessage message={message} />
            )}
            {message.type === "info" && (
              <InfoMessage message={message} />
            )}
          </motion.div>
        ))}

        {/* Loading indicator */}
        {isActive && messages.length > 0 && (
          <div className="flex items-center gap-2 text-slate-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Processing...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ImprovementChatFeed;
