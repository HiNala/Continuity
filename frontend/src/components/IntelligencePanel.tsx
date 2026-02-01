"use client";

/**
 * IntelligencePanel - A unified, elegant visualization of AI self-improvement
 * 
 * Design Philosophy (Apple/Anthropic inspired):
 * - Minimal visual noise
 * - Generous whitespace
 * - Subtle, purposeful animations
 * - Clear information hierarchy
 * - One focal point at a time
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Sparkles,
  Eye,
  TrendingUp,
  Activity,
} from "lucide-react";

// Types
interface PolicyChange {
  type: string;
  field?: string;
  oldValue?: string | number;
  newValue?: string | number;
  rationale: string;
}

interface ImprovementCycle {
  id: string;
  timestamp: string;
  phase: string;
  attemptNumber: number;
  evaluationScore?: number;
  passed: boolean;
  failureReasons?: string[];
  policyChanges: PolicyChange[];
  weaveTraceUrl?: string;
}

interface ReasoningStep {
  id: string;
  timestamp: string;
  agent: string;
  thought: string;
  action?: string;
}

interface IntelligencePanelProps {
  cycles: ImprovementCycle[];
  reasoningSteps: ReasoningStep[];
  weaveProjectUrl?: string;
  isActive: boolean;
  className?: string;
}

// Subtle spring animation
const spring = { type: "spring", stiffness: 500, damping: 30 };

// Agent colors - muted and elegant
const agentColors: Record<string, string> = {
  requirements: "#3B82F6",
  spatial: "#8B5CF6", 
  generation: "#F59E0B",
  qc: "#10B981",
  orchestrator: "#64748B",
};

export function IntelligencePanel({
  cycles,
  reasoningSteps,
  weaveProjectUrl,
  isActive,
  className = "",
}: IntelligencePanelProps) {
  const [expandedCycle, setExpandedCycle] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  const successfulCycles = cycles.filter(c => c.passed).length;
  const totalAttempts = cycles.length;
  const latestCycle = cycles[cycles.length - 1];

  // Show empty state if no data
  if (cycles.length === 0 && reasoningSteps.length === 0) {
    return (
      <div className={`p-4 rounded-lg border border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/50 ${className}`}>
        <div className="text-center">
          <Brain className="w-8 h-8 text-neutral-300 dark:text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-neutral-500 dark:text-zinc-500">Intelligence data pending</p>
          <p className="text-xs text-neutral-400 dark:text-zinc-600">Self-improvement cycles will appear here during processing</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className={`rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-white/50 dark:border-white/10 backdrop-blur-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${className}`}
    >
      {/* Header - Clean and minimal */}
      <div className="px-5 py-4 border-b border-white/30 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-700 dark:from-zinc-100 dark:to-zinc-300 flex items-center justify-center">
                <Brain className="w-4.5 h-4.5 text-white dark:text-zinc-900" />
              </div>
              {isActive && (
                <motion.div
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-zinc-100">Self-Improving AI</h3>
              <p className="text-xs text-neutral-500 dark:text-zinc-400">
                {totalAttempts > 0 
                  ? `${successfulCycles}/${totalAttempts} improvements successful`
                  : "Monitoring agent reasoning"
                }
              </p>
            </div>
          </div>

          {/* Weave link */}
          {weaveProjectUrl && (
            <a
              href={weaveProjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-zinc-400 hover:text-neutral-700 dark:hover:text-zinc-200 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Traces</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Improvement Cycles - The main content */}
      {cycles.length > 0 && (
        <div className="divide-y divide-neutral-100 dark:divide-zinc-800">
          {cycles.map((cycle, index) => (
            <CycleRow
              key={cycle.id}
              cycle={cycle}
              index={index}
              isExpanded={expandedCycle === cycle.id}
              onToggle={() => setExpandedCycle(expandedCycle === cycle.id ? null : cycle.id)}
              weaveProjectUrl={weaveProjectUrl}
            />
          ))}
        </div>
      )}

      {/* Live Reasoning Toggle - Only show when there's reasoning data */}
      {reasoningSteps.length > 0 && (
        <>
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="w-full px-5 py-3 flex items-center justify-between text-xs text-neutral-500 dark:text-zinc-400 hover:bg-neutral-50 dark:hover:bg-zinc-800/50 transition-colors border-t border-neutral-100 dark:border-zinc-800"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              <span>Live Reasoning ({reasoningSteps.length} steps)</span>
            </div>
            <motion.div
              animate={{ rotate: showReasoning ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showReasoning && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4 space-y-2 max-h-48 overflow-y-auto">
                  {reasoningSteps.slice(-10).map((step, i) => (
                    <ReasoningRow key={step.id} step={step} index={i} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

// Individual cycle row
function CycleRow({ 
  cycle, 
  index, 
  isExpanded, 
  onToggle,
  weaveProjectUrl,
}: { 
  cycle: ImprovementCycle; 
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  weaveProjectUrl?: string;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className={`
            w-7 h-7 rounded-lg flex items-center justify-center
            ${cycle.passed 
              ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" 
              : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
            }
          `}>
            {cycle.passed 
              ? <CheckCircle2 className="w-4 h-4" />
              : <TrendingUp className="w-4 h-4" />
            }
          </div>

          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-900 dark:text-zinc-100">
                {cycle.phase.charAt(0).toUpperCase() + cycle.phase.slice(1)}
              </span>
              {cycle.attemptNumber > 1 && (
                <span className="text-xs text-neutral-400 dark:text-zinc-500">
                  Attempt {cycle.attemptNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-zinc-400">
              {cycle.passed 
                ? "Quality check passed"
                : `${cycle.policyChanges.length} improvements applied`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Score badge */}
          {cycle.evaluationScore !== undefined && (
            <span className={`
              text-xs font-medium px-2 py-1 rounded-md
              ${cycle.evaluationScore >= 0.7 
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" 
                : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
              }
            `}>
              {Math.round(cycle.evaluationScore * 100)}%
            </span>
          )}
          
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="w-4 h-4 text-neutral-400 dark:text-zinc-500" />
          </motion.div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3">
              {/* Failure reasons */}
              {cycle.failureReasons && cycle.failureReasons.length > 0 && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1.5">Issues Detected</p>
                  <ul className="space-y-1">
                    {cycle.failureReasons.map((reason, i) => (
                      <li key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                        <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Policy changes */}
              {cycle.policyChanges.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-700 dark:text-zinc-300">Policy Adjustments</p>
                  {cycle.policyChanges.map((change, i) => (
                    <div 
                      key={i}
                      className="p-3 rounded-lg bg-neutral-50 dark:bg-zinc-800/50 border border-neutral-100 dark:border-zinc-700"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium text-neutral-600 dark:text-zinc-400 uppercase tracking-wide">
                          {change.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      
                      {change.oldValue !== undefined && change.newValue !== undefined && (
                        <div className="flex items-center gap-2 text-xs font-mono mb-1.5">
                          <span className="text-red-500 dark:text-red-400 line-through">{String(change.oldValue)}</span>
                          <ArrowRight className="w-3 h-3 text-neutral-400 dark:text-zinc-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{String(change.newValue)}</span>
                        </div>
                      )}
                      
                      <p className="text-xs text-neutral-500 dark:text-zinc-400 italic">{change.rationale}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Weave trace link */}
              {(cycle.weaveTraceUrl || weaveProjectUrl) && (
                <a
                  href={cycle.weaveTraceUrl || weaveProjectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-zinc-400 hover:text-neutral-700 dark:hover:text-zinc-200 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View trace in Weave
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Reasoning step row
function ReasoningRow({ step, index }: { step: ReasoningStep; index: number }) {
  const color = agentColors[step.agent] || agentColors.orchestrator;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="flex items-start gap-2.5"
    >
      <div 
        className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-medium text-neutral-400 dark:text-zinc-500 uppercase">
            {step.agent}
          </span>
          <span className="text-[9px] text-neutral-300 dark:text-zinc-600">{step.timestamp}</span>
        </div>
        <p className="text-xs text-neutral-600 dark:text-zinc-300 leading-relaxed">{step.thought}</p>
        {step.action && (
          <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">→ {step.action}</p>
        )}
      </div>
    </motion.div>
  );
}

// Compact badge for header
export function SelfImprovingBadge({ 
  cycleCount, 
  isActive 
}: { 
  cycleCount: number; 
  isActive: boolean;
}) {
  if (cycleCount === 0 && !isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${isActive 
          ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" 
          : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
        }
      `}
    >
      {isActive ? (
        <>
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-amber-500"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span>Improving</span>
        </>
      ) : (
        <>
          <Sparkles className="w-3 h-3" />
          <span>{cycleCount} improvement{cycleCount !== 1 ? 's' : ''}</span>
        </>
      )}
    </motion.div>
  );
}
