"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  Eye,
  Code2,
  GitBranch,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

interface PolicyChange {
  type: string;
  field?: string;
  oldValue?: string | number;
  newValue?: string | number;
  rationale: string;
}

interface WeaveTrace {
  traceId: string;
  url: string;
  operation: string;
  duration_ms?: number;
  status: "success" | "error";
}

interface AgentUpgradeEvent {
  id: string;
  timestamp: string;
  sourceAgent: "qc" | "orchestrator";
  targetAgent: "generation" | "spatial" | "requirements";
  trigger: "evaluation_failure" | "cross_scene_learning" | "pattern_detection";
  evaluationScore?: number;
  failureReasons?: string[];
  policyChanges: PolicyChange[];
  weaveTraces?: WeaveTrace[];
  improved: boolean;
  retryNumber?: number;
}

interface AgentUpgradingAgentProps {
  events: AgentUpgradeEvent[];
  weaveProjectUrl?: string;
  onViewTrace?: (traceId: string) => void;
}

export function AgentUpgradingAgent({ 
  events, 
  weaveProjectUrl,
  onViewTrace 
}: AgentUpgradingAgentProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  if (events.length === 0) return null;

  const toggleExpanded = (id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const successCount = events.filter(e => e.improved).length;
  const totalRetries = events.reduce((sum, e) => sum + (e.retryNumber || 1), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-200/50 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/80 via-yellow-50/50 to-orange-50/30 dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-orange-950/10 overflow-hidden shadow-lg"
    >
      {/* Impressive Header */}
      <div className="relative px-5 py-4 border-b border-amber-200/30 dark:border-amber-800/30 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/5 via-yellow-400/10 to-orange-400/5 dark:from-amber-600/10 dark:via-yellow-600/5 dark:to-orange-600/10" />
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30"
            >
              <Brain className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                <span>Self-Improving AI</span>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </motion.div>
              </h3>
              <p className="text-sm text-amber-700/70 dark:text-amber-400/70">
                Agents learning and upgrading other agents in real-time
              </p>
            </div>
          </div>
          
          {/* Stats badges */}
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-md"
            >
              {totalRetries} iterations
            </motion.div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-md"
            >
              {successCount} improvements
            </motion.div>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="divide-y divide-amber-200/30 dark:divide-amber-800/30">
        {events.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            {/* Event Header */}
            <button
              onClick={() => toggleExpanded(event.id)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-amber-100/30 dark:hover:bg-amber-900/20 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Visual representation of agent upgrading agent */}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <motion.div
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight className="w-5 h-5 text-amber-500" />
                  </motion.div>
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      QC Agent → Generation Agent
                    </span>
                    {event.retryNumber && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-200/50 dark:bg-amber-800/50 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        Retry #{event.retryNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-700/60 dark:text-amber-400/60">
                    {event.trigger === "evaluation_failure" && "Evaluation below threshold - analyzing traces and upgrading policy"}
                    {event.trigger === "cross_scene_learning" && "Learning from previous scene to improve future generations"}
                    {event.trigger === "pattern_detection" && "Detected improvement pattern from historical data"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {event.evaluationScore !== undefined && (
                  <div className={`px-2 py-1 rounded-lg text-xs font-mono ${
                    event.evaluationScore >= 0.7 
                      ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" 
                      : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                  }`}>
                    Score: {(event.evaluationScore * 100).toFixed(0)}%
                  </div>
                )}
                
                {event.improved ? (
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-medium">Improved</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-medium">In Progress</span>
                  </div>
                )}

                <motion.div
                  animate={{ rotate: expandedEvents.has(event.id) ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                </motion.div>
              </div>
            </button>

            {/* Expanded Details */}
            <AnimatePresence>
              {expandedEvents.has(event.id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 space-y-4">
                    {/* Failure Reasons */}
                    {event.failureReasons && event.failureReasons.length > 0 && (
                      <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
                          <span className="text-sm font-semibold text-red-700 dark:text-red-300">Issues Detected</span>
                        </div>
                        <ul className="space-y-1">
                          {event.failureReasons.map((reason, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                              <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Policy Changes - The Core of Agent Upgrading Agent */}
                    {event.policyChanges.length > 0 && (
                      <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/50 dark:border-emerald-800/50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <GitBranch className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                            Policy Upgrades Applied
                          </span>
                        </div>
                        <div className="space-y-3">
                          {event.policyChanges.map((change, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="rounded-lg bg-white/70 dark:bg-zinc-900/50 border border-emerald-200/30 dark:border-emerald-800/30 p-3"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Code2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                                  {change.type.replace(/_/g, " ")}
                                </span>
                              </div>
                              
                              {change.oldValue !== undefined && change.newValue !== undefined && (
                                <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                                  <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 line-through">
                                    {String(change.oldValue)}
                                  </span>
                                  <ArrowRight className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                  <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-semibold">
                                    {String(change.newValue)}
                                  </span>
                                </div>
                              )}
                              
                              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 italic">
                                {change.rationale}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weave Traces */}
                    {event.weaveTraces && event.weaveTraces.length > 0 && (
                      <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Eye className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                            Weave Traces (click to inspect)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {event.weaveTraces.map((trace, i) => (
                            <motion.a
                              key={i}
                              href={trace.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05 }}
                              whileHover={{ scale: 1.05 }}
                              className={`
                                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                ${trace.status === "success" 
                                  ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/70" 
                                  : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/70"
                                }
                                transition-colors cursor-pointer
                              `}
                              onClick={(e) => {
                                if (onViewTrace) {
                                  e.preventDefault();
                                  onViewTrace(trace.traceId);
                                }
                              }}
                            >
                              <span>{trace.operation}</span>
                              {trace.duration_ms && (
                                <span className="text-[10px] opacity-60">
                                  {trace.duration_ms}ms
                                </span>
                              )}
                              <ExternalLink className="w-3 h-3" />
                            </motion.a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center justify-between text-[10px] text-amber-600/50 dark:text-amber-500/50">
                      <span>{event.timestamp}</span>
                      {weaveProjectUrl && (
                        <a
                          href={weaveProjectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                        >
                          View all traces in Weave
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Footer CTA */}
      {weaveProjectUrl && (
        <div className="px-5 py-3 bg-gradient-to-r from-amber-100/50 to-orange-100/50 dark:from-amber-900/20 dark:to-orange-900/20 border-t border-amber-200/30 dark:border-amber-800/30">
          <a
            href={weaveProjectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Open Weave Dashboard for Full Trace Analysis
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </motion.div>
  );
}

// Compact version for sidebar
export function AgentUpgradeBadge({ 
  upgradeCount, 
  isActive,
  onClick 
}: { 
  upgradeCount: number; 
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
        transition-all duration-300
        ${isActive 
          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30" 
          : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50"
        }
      `}
    >
      {isActive && (
        <motion.span
          className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
          animate={{ opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      <Brain className="w-3.5 h-3.5 relative z-10" />
      <span className="relative z-10">Self-Improving</span>
      {upgradeCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="relative z-10 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]"
        >
          {upgradeCount}
        </motion.span>
      )}
    </motion.button>
  );
}
