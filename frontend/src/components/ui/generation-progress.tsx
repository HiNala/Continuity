"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Paintbrush,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Timer,
  Sparkles,
  ClipboardCheck,
  Wand2,
  ArrowRight,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

// Phase configuration with human-readable names and descriptions
const PHASE_CONFIG = {
  cleanup: {
    name: "Cleanup",
    description: "Removing debris and normalizing the space",
    icon: "🧹",
    steps: [
      "Analyzing image for debris and clutter",
      "Constructing cleanup prompt with constraints",
      "Generating cleaned base image",
      "Validating output quality",
    ],
  },
  structural: {
    name: "Structural Completion",
    description: "Completing walls, ceiling, and flooring",
    icon: "🏗️",
    steps: [
      "Analyzing structural requirements",
      "Identifying incomplete elements",
      "Generating structural completion",
      "Verifying geometry preservation",
    ],
  },
  fixture: {
    name: "Fixture Placement",
    description: "Placing fixtures and appliances according to constraints",
    icon: "🚿",
    steps: [
      "Loading spatial constraints",
      "Planning fixture placement",
      "Generating fixture installation",
      "Checking constraint compliance",
    ],
  },
  style: {
    name: "Style Application",
    description: "Applying final aesthetic styling and finishing touches",
    icon: "🎨",
    steps: [
      "Analyzing target style requirements",
      "Constructing style prompt",
      "Generating styled output",
      "Final quality assessment",
    ],
  },
};

type Phase = keyof typeof PHASE_CONFIG;
type StepStatus = "pending" | "running" | "completed" | "error";

export interface PhaseProgress {
  phase: Phase;
  status: "pending" | "running" | "completed" | "error" | "evaluating" | "retrying";
  currentStep?: number;
  totalSteps?: number;
  stepMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  evaluationScore?: number;
  evaluationPassed?: boolean;
  retryNumber?: number;
  outputPath?: string;
}

export interface GenerationProgressProps {
  phases: PhaseProgress[];
  currentPhaseIndex: number;
  isRunning: boolean;
  onViewTrace?: () => void;
  className?: string;
}

// Format elapsed time nicely
function formatElapsedTime(startTime: Date): string {
  const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}m ${secs}s`;
}

// Elapsed time component with live updates
function ElapsedTime({ startTime, className }: { startTime: Date; className?: string }) {
  const [elapsed, setElapsed] = useState(formatElapsedTime(startTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsedTime(startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className={cn("font-mono text-[10px]", className)}>
      {elapsed}
    </span>
  );
}

// Phase card component
function PhaseCard({ 
  progress, 
  phaseIndex, 
  totalPhases, 
  isActive,
  isExpanded,
  onToggle,
}: { 
  progress: PhaseProgress; 
  phaseIndex: number;
  totalPhases: number;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = PHASE_CONFIG[progress.phase];
  const isComplete = progress.status === "completed";
  const isError = progress.status === "error";
  const isEvaluating = progress.status === "evaluating";
  const isRetrying = progress.status === "retrying";
  const isPending = progress.status === "pending";
  const isRunning = progress.status === "running";

  const getStatusColor = () => {
    if (isComplete) return "border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10";
    if (isError) return "border-l-red-500 bg-red-50/30 dark:bg-red-900/10";
    if (isEvaluating) return "border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10";
    if (isRetrying) return "border-l-amber-500 bg-amber-50/30 dark:bg-amber-900/10";
    if (isRunning) return "border-l-primary bg-primary/5";
    return "border-l-slate-200 dark:border-l-zinc-700 opacity-60";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border border-white/40 dark:border-white/10 overflow-hidden transition-all duration-300",
        "border-l-[3px]",
        getStatusColor()
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-white/30 dark:hover:bg-white/5 transition-colors"
      >
        {/* Phase indicator */}
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0",
          isComplete ? "bg-emerald-500 text-white" :
          isError ? "bg-red-500 text-white" :
          isRunning || isEvaluating ? "bg-primary text-white" :
          isRetrying ? "bg-amber-500 text-white" :
          "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
        )}>
          {isComplete ? <CheckCircle2 className="w-4 h-4" /> :
           isError ? <AlertCircle className="w-4 h-4" /> :
           isRunning || isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> :
           isRetrying ? <RefreshCw className="w-4 h-4 animate-spin" /> :
           <span>{config.icon}</span>}
        </div>

        {/* Phase info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
              Phase {phaseIndex + 1} of {totalPhases}
            </span>
            {isRetrying && progress.retryNumber && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                Retry #{progress.retryNumber}
              </span>
            )}
          </div>
          <h4 className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
            {config.name}
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
            {progress.stepMessage || config.description}
          </p>
        </div>

        {/* Status & time */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {(isRunning || isEvaluating || isRetrying) && progress.startedAt && (
            <div className="flex items-center gap-1 text-slate-400 dark:text-zinc-500">
              <Timer className="w-3 h-3" />
              <ElapsedTime startTime={progress.startedAt} />
            </div>
          )}
          {isComplete && progress.evaluationScore !== undefined && (
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded",
              progress.evaluationPassed 
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/20 text-red-600 dark:text-red-400"
            )}>
              {(progress.evaluationScore * 100).toFixed(0)}%
            </span>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
          </motion.div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2">
              {/* Steps */}
              <div className="space-y-1.5">
                {config.steps.map((step, idx) => {
                  const currentStep = progress.currentStep ?? -1;
                  const stepStatus: StepStatus = 
                    idx < currentStep ? "completed" :
                    idx === currentStep ? "running" :
                    "pending";
                  
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-2 text-[11px] pl-2",
                        stepStatus === "completed" ? "text-emerald-600 dark:text-emerald-400" :
                        stepStatus === "running" ? "text-primary font-medium" :
                        "text-slate-400 dark:text-zinc-500"
                      )}
                    >
                      {stepStatus === "completed" ? (
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                      ) : stepStatus === "running" ? (
                        <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                      ) : (
                        <div className="w-3 h-3 shrink-0 rounded-full border border-current" />
                      )}
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>

              {/* Evaluation result if available */}
              {(isEvaluating || isComplete || isRetrying) && progress.evaluationScore !== undefined && (
                <div className={cn(
                  "mt-2 p-2 rounded-lg text-[11px]",
                  progress.evaluationPassed 
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-500/10 text-red-700 dark:text-red-300"
                )}>
                  <div className="flex items-center gap-2 font-medium">
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    Quality Check: {(progress.evaluationScore * 100).toFixed(0)}%
                    {progress.evaluationPassed ? " ✓ Passed" : " ✗ Below threshold"}
                  </div>
                </div>
              )}

              {/* Retry info if retrying */}
              {isRetrying && (
                <div className="mt-2 p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px]">
                  <div className="flex items-center gap-2 font-medium">
                    <Wand2 className="w-3.5 h-3.5" />
                    Self-Improvement Active
                  </div>
                  <p className="mt-1 text-amber-600 dark:text-amber-400">
                    Analyzing failure and adjusting generation policy...
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Main generation progress component
export function GenerationProgress({
  phases,
  currentPhaseIndex,
  isRunning,
  onViewTrace,
  className,
}: GenerationProgressProps) {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(currentPhaseIndex);
  const totalPhases = phases.length;
  const completedPhases = phases.filter(p => p.status === "completed").length;
  const overallProgress = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;

  // Auto-expand current phase when it changes
  useEffect(() => {
    if (currentPhaseIndex >= 0) {
      setExpandedPhase(currentPhaseIndex);
    }
  }, [currentPhaseIndex]);

  return (
    <div className={cn("rounded-xl border border-white/50 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.08)]", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/30 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Paintbrush className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                Generation Pipeline
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                {isRunning ? `Phase ${currentPhaseIndex + 1} of ${totalPhases}` : 
                 completedPhases === totalPhases ? "All phases complete" :
                 "Waiting to start"}
              </p>
            </div>
          </div>
          
          {/* Overall progress */}
          <div className="flex items-center gap-3">
            {isRunning && (
              <span className="text-[10px] font-medium text-primary flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running
              </span>
            )}
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
                {completedPhases}/{totalPhases}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-1">
                phases
              </span>
            </div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-3 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Phases */}
      <div className="p-3 space-y-2">
        {phases.map((phase, idx) => (
          <PhaseCard
            key={phase.phase}
            progress={phase}
            phaseIndex={idx}
            totalPhases={totalPhases}
            isActive={idx === currentPhaseIndex && isRunning}
            isExpanded={expandedPhase === idx}
            onToggle={() => setExpandedPhase(expandedPhase === idx ? null : idx)}
          />
        ))}
      </div>

      {/* Footer with trace link */}
      {onViewTrace && (
        <div className="px-4 py-2 border-t border-white/30 dark:border-white/10">
          <button
            onClick={onViewTrace}
            className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          >
            <TrendingUp className="w-3 h-3" />
            View Weave Traces
          </button>
        </div>
      )}
    </div>
  );
}

// Export phase config for use elsewhere
export { PHASE_CONFIG };
export type { Phase };
