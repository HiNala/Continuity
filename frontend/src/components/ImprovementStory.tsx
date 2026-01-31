"use client";

import { useState } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  TrendingUp, 
  ExternalLink,
  CheckCircle2,
  XCircle,
  Sparkles
} from "lucide-react";

interface PolicyChange {
  field: string;
  oldValue: string | number;
  newValue: string | number;
  reason: string;
}

interface RetryInfo {
  phase: string;
  attemptNumber: number;
  failureReason: string;
  policyChanges: PolicyChange[];
  improved: boolean;
  weaveTraceId?: string;
}

interface ImprovementStoryProps {
  retries: RetryInfo[];
  onViewWeaveTrace?: (traceId: string) => void;
}

export function ImprovementStory({ retries, onViewWeaveTrace }: ImprovementStoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (retries.length === 0) {
    return null;
  }

  const totalRetries = retries.reduce((sum, r) => sum + r.attemptNumber - 1, 0);
  const successfulImprovements = retries.filter(r => r.improved).length;

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-continuity-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-continuity-400" />
          </div>
          <div className="text-left">
            <p className="font-medium text-white">Self-Improvement Active</p>
            <p className="text-sm text-slate-400">
              {totalRetries} {totalRetries === 1 ? "retry" : "retries"} with {successfulImprovements} successful improvements
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-slate-900/50">
          <p className="text-sm text-slate-400">
            The system analyzed its own outputs and adjusted its approach to improve results.
          </p>

          {retries.map((retry, index) => (
            <div key={index} className="border border-slate-700 rounded-lg overflow-hidden">
              {/* Retry Header */}
              <div className="flex items-center justify-between p-3 bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-white capitalize">{retry.phase} Phase</span>
                  <span className="text-sm text-slate-500">
                    Attempt {retry.attemptNumber}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {retry.improved ? (
                    <span className="flex items-center gap-1 text-sm text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                      Improved
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500">In progress</span>
                  )}
                </div>
              </div>

              {/* Retry Details */}
              <div className="p-3 space-y-3">
                {/* Failure Reason */}
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-300">Issue Detected</p>
                    <p className="text-sm text-slate-400">{retry.failureReason}</p>
                  </div>
                </div>

                {/* Policy Changes */}
                {retry.policyChanges.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-300 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Adjustments Made
                    </p>
                    <div className="space-y-1 pl-5">
                      {retry.policyChanges.map((change, i) => (
                        <div key={i} className="text-sm">
                          <span className="text-slate-400">{change.field}:</span>{" "}
                          <span className="text-red-400 line-through">{String(change.oldValue)}</span>
                          {" → "}
                          <span className="text-emerald-400">{String(change.newValue)}</span>
                          {change.reason && (
                            <span className="text-slate-500 ml-2">({change.reason})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weave Link */}
                {retry.weaveTraceId && (
                  <button
                    onClick={() => onViewWeaveTrace?.(retry.weaveTraceId!)}
                    className="text-sm text-continuity-400 hover:text-continuity-300 flex items-center gap-1"
                  >
                    View technical details in Weave
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
