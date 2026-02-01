"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  TrendingUp, 
  ExternalLink,
  CheckCircle2,
  XCircle,
  Sparkles,
  Brain,
  Zap
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
  variant?: "dark" | "light";
}

export function ImprovementStory({ retries, onViewWeaveTrace, variant = "dark" }: ImprovementStoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (retries.length === 0) {
    return null;
  }

  const totalRetries = retries.reduce((sum, r) => sum + r.attemptNumber - 1, 0);
  const successfulImprovements = retries.filter(r => r.improved).length;

  const isDark = variant === "dark";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl overflow-hidden ${
        isDark 
          ? "border border-slate-700 bg-slate-800/30" 
          : "border border-amber-200/50 bg-gradient-to-r from-amber-50 to-yellow-50"
      }`}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-4 transition-colors ${
          isDark 
            ? "bg-slate-800/50 hover:bg-slate-800" 
            : "hover:bg-amber-100/50"
        }`}
      >
        <div className="flex items-center gap-3">
          <motion.div 
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDark 
                ? "bg-gradient-to-br from-amber-500/20 to-yellow-500/20" 
                : "bg-gradient-to-br from-amber-400 to-yellow-400"
            }`}
          >
            <Brain className={`w-5 h-5 ${isDark ? "text-amber-400" : "text-white"}`} />
          </motion.div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className={`font-semibold ${isDark ? "text-white" : "text-amber-900"}`}>
                Self-Improvement Active
              </p>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isDark 
                  ? "bg-amber-500/20 text-amber-400" 
                  : "bg-amber-200 text-amber-700"
              }`}>
                {totalRetries} {totalRetries === 1 ? "retry" : "retries"}
              </span>
            </div>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-amber-700/70"}`}>
              {successfulImprovements} successful improvement{successfulImprovements !== 1 ? "s" : ""} applied
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className={`w-5 h-5 ${isDark ? "text-slate-400" : "text-amber-600"}`} />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className={`p-4 space-y-4 ${isDark ? "bg-slate-900/50" : "bg-white/50"}`}>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-amber-700/70"}`}>
                The system analyzed its own outputs and adjusted its approach to improve results.
              </p>

              {retries.map((retry, index) => (
                <motion.div 
                  key={index} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`rounded-lg overflow-hidden ${
                    isDark 
                      ? "border border-slate-700 bg-slate-800/30" 
                      : "border border-amber-200/50 bg-white"
                  }`}
                >
                  {/* Retry Header */}
                  <div className={`flex items-center justify-between p-3 ${
                    isDark ? "bg-slate-800/50" : "bg-amber-50/50"
                  }`}>
                    <div className="flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 ${isDark ? "text-slate-400" : "text-amber-500"}`} />
                      <span className={`font-medium capitalize ${isDark ? "text-white" : "text-amber-900"}`}>
                        {retry.phase} Phase
                      </span>
                      <span className={`text-sm ${isDark ? "text-slate-500" : "text-amber-600/70"}`}>
                        Attempt {retry.attemptNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {retry.improved ? (
                        <span className="flex items-center gap-1 text-sm text-emerald-500 font-medium">
                          <TrendingUp className="w-4 h-4" />
                          Improved
                        </span>
                      ) : (
                        <span className={`text-sm ${isDark ? "text-slate-500" : "text-amber-600/50"}`}>
                          In progress
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Retry Details */}
                  <div className="p-3 space-y-3">
                    {/* Failure Reason */}
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-red-700"}`}>
                          Issue Detected
                        </p>
                        <p className={`text-sm ${isDark ? "text-slate-400" : "text-red-600/70"}`}>
                          {retry.failureReason}
                        </p>
                      </div>
                    </div>

                    {/* Policy Changes */}
                    {retry.policyChanges.length > 0 && (
                      <div className="space-y-2">
                        <p className={`text-sm font-medium flex items-center gap-1 ${
                          isDark ? "text-slate-300" : "text-emerald-700"
                        }`}>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Adjustments Made
                        </p>
                        <div className="space-y-1.5 pl-5">
                          {retry.policyChanges.map((change, i) => (
                            <motion.div 
                              key={i} 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.05 }}
                              className={`text-sm rounded-md p-2 ${
                                isDark ? "bg-slate-800/50" : "bg-slate-50"
                              }`}
                            >
                              <span className={isDark ? "text-slate-400" : "text-slate-600"}>
                                {change.field}:
                              </span>{" "}
                              <span className="text-red-400 line-through">{String(change.oldValue)}</span>
                              <span className={isDark ? "text-slate-500" : "text-slate-400"}> → </span>
                              <span className="text-emerald-500 font-medium">{String(change.newValue)}</span>
                              {change.reason && (
                                <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                  {change.reason}
                                </p>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weave Link */}
                    {retry.weaveTraceId && (
                      <button
                        onClick={() => onViewWeaveTrace?.(retry.weaveTraceId!)}
                        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                      >
                        <Zap className="w-3 h-3" />
                        View technical details in Weave
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
