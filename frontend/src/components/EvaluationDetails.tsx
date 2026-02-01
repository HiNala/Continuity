"use client";

/**
 * EvaluationDetails - Display detailed evaluation results for each iteration
 * Shows all 5 evaluation criteria with pass/fail, scores, and evidence
 */

import React, { useState } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  Eye,
  AlertTriangle,
  Layers,
  Paintbrush,
  Target,
  Shield,
  Box,
  ClipboardList
} from "lucide-react";

interface CriterionResult {
  criterion: string;
  passed: boolean;
  score: number;
  details: string;
  evidence?: Record<string, unknown>;
}

export interface EvaluationResult {
  iterationId: string;
  phase: string;
  iterationNumber: number;
  overallPassed: boolean;
  overallScore: number;
  criteria: CriterionResult[];
  failureReasons?: string[];
  evaluatedAt: string;
}

interface EvaluationDetailsProps {
  evaluations: EvaluationResult[];
  className?: string;
}

// Criterion icons and display names
const criterionConfig: Record<string, { icon: React.ElementType; label: string; description: string }> = {
  constraint_compliance: {
    icon: Shield,
    label: "Constraint Compliance",
    description: "Adherence to spatial and structural constraints"
  },
  geometry_preservation: {
    icon: Box,
    label: "Geometry Preservation", 
    description: "Original room structure and proportions maintained"
  },
  hallucination_detection: {
    icon: Eye,
    label: "Hallucination Check",
    description: "No AI artifacts or unrealistic elements"
  },
  style_execution: {
    icon: Paintbrush,
    label: "Style Execution",
    description: "Design style applied correctly"
  },
  phase_completion: {
    icon: Layers,
    label: "Phase Completion",
    description: "All required elements for this phase present"
  },
  goal_alignment: {
    icon: Target,
    label: "Goal Alignment",
    description: "Output matches user's original requirements"
  }
};

function CriterionRow({ criterion }: { criterion: CriterionResult }) {
  const [expanded, setExpanded] = useState(false);
  const config = criterionConfig[criterion.criterion] || {
    icon: AlertTriangle,
    label: criterion.criterion.replace(/_/g, " "),
    description: ""
  };
  const Icon = config.icon;

  return (
    <div className="border-b border-white/30 dark:border-white/10 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/60 dark:hover:bg-zinc-900/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-6 h-6 rounded-md flex items-center justify-center
            ${criterion.passed 
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
              : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
            }
          `}>
            {criterion.passed ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-neutral-400 dark:text-zinc-500" />
              <span className="text-[13px] font-medium text-neutral-800 dark:text-zinc-200">
                {config.label}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`
            text-xs font-medium px-2 py-0.5 rounded
            ${criterion.score >= 0.7 
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              : criterion.score >= 0.4
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
            }
          `}>
            {Math.round(criterion.score * 100)}%
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-400 dark:text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-400 dark:text-zinc-500" />
          )}
        </div>
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <p className="text-xs text-neutral-500 dark:text-zinc-400 italic">{config.description}</p>
          <p className="text-[13px] text-neutral-700 dark:text-zinc-300 leading-relaxed">{criterion.details}</p>
          {criterion.evidence && Object.keys(criterion.evidence).length > 0 && (
            <div className="mt-2 p-2 rounded bg-white/70 dark:bg-zinc-800/50 border border-white/40 dark:border-white/10 text-xs">
              <p className="text-neutral-500 dark:text-zinc-400 mb-1">Evidence:</p>
              <pre className="text-neutral-600 dark:text-zinc-400 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(criterion.evidence, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvaluationCard({ evaluation }: { evaluation: EvaluationResult }) {
  const [expanded, setExpanded] = useState(false);
  const passedCount = evaluation.criteria.filter(c => c.passed).length;
  const totalCount = evaluation.criteria.length;

  return (
    <div className="rounded-xl border border-white/50 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/60 dark:hover:bg-zinc-900/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center
            ${evaluation.overallPassed 
              ? "bg-emerald-100 dark:bg-emerald-900/40"
              : "bg-red-100 dark:bg-red-900/40"
            }
          `}>
            {evaluation.overallPassed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-900 dark:text-zinc-100">
                {evaluation.phase.charAt(0).toUpperCase() + evaluation.phase.slice(1)}
              </span>
              {evaluation.iterationNumber > 1 && (
                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                  Retry #{evaluation.iterationNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-zinc-400">
              {passedCount}/{totalCount} criteria passed
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`
            text-sm font-semibold px-2.5 py-1 rounded-md
            ${evaluation.overallScore >= 0.7 
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
            }
          `}>
            {Math.round(evaluation.overallScore * 100)}%
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-400 dark:text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-400 dark:text-zinc-500" />
          )}
        </div>
      </button>
      
      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/30 dark:border-white/10">
          {/* Failure reasons if any */}
          {evaluation.failureReasons && evaluation.failureReasons.length > 0 && (
            <div className="px-4 py-3 bg-red-50/80 dark:bg-red-900/20 border-b border-red-100/60 dark:border-red-800/40">
              <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1.5">Issues:</p>
              <ul className="space-y-1">
                {evaluation.failureReasons.map((reason, i) => (
                  <li key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Criteria list */}
          <div className="divide-y divide-white/30 dark:divide-white/10">
            {evaluation.criteria.map((criterion) => (
              <CriterionRow key={criterion.criterion} criterion={criterion} />
            ))}
          </div>
          
          {/* Timestamp */}
          <div className="px-4 py-2 bg-white/60 dark:bg-zinc-800/50 text-[10px] text-neutral-400 dark:text-zinc-500">
            Evaluated at {new Date(evaluation.evaluatedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

export function EvaluationDetails({ evaluations, className = "" }: EvaluationDetailsProps) {
  if (evaluations.length === 0) {
    return (
      <div className={`p-4 rounded-lg border border-white/50 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl ${className}`}>
        <div className="text-center">
          <ClipboardList className="w-8 h-8 text-neutral-300 dark:text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-neutral-500 dark:text-zinc-500">No evaluations yet</p>
          <p className="text-xs text-neutral-400 dark:text-zinc-600">Evaluation results will appear here after processing</p>
        </div>
      </div>
    );
  }

  const passedEvals = evaluations.filter(e => e.overallPassed).length;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-neutral-700 dark:text-zinc-300">Evaluation Results</h3>
          <span className="text-xs text-neutral-400 dark:text-zinc-500">
            {passedEvals}/{evaluations.length} passed
          </span>
        </div>
      </div>
      
      {/* Evaluation cards */}
      <div className="space-y-2">
        {evaluations.map((evaluation) => (
          <EvaluationCard key={evaluation.iterationId} evaluation={evaluation} />
        ))}
      </div>
    </div>
  );
}

// Compact inline badge for showing evaluation status
export function EvaluationBadge({ 
  passed, 
  score,
  onClick 
}: { 
  passed: boolean; 
  score: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors
        ${passed 
          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
        }
      `}
    >
      {passed ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {Math.round(score * 100)}%
    </button>
  );
}
