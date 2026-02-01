"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Zap,
  Code2,
  Globe,
  Eye,
  ChevronDown,
  ChevronUp,
  Terminal,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Activity,
  MessageSquare,
  Image as ImageIcon,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface ToolCall {
  id: string;
  timestamp: string;
  toolName: string;
  toolType: "weave" | "browserbase" | "gemini" | "database" | "internal";
  input?: Record<string, unknown>;
  output?: string;
  status: "running" | "success" | "error";
  duration_ms?: number;
}

interface ReasoningStep {
  id: string;
  timestamp: string;
  agent: string;
  thought: string;
  action?: string;
  observation?: string;
  toolCalls?: ToolCall[];
}

interface LiveReasoningPanelProps {
  steps: ReasoningStep[];
  isActive: boolean;
  weaveTraceUrl?: string;
  browserbaseSessionUrl?: string;
}

const toolTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  weave: { icon: Eye, color: "purple", label: "Weave Trace" },
  browserbase: { icon: Globe, color: "blue", label: "Browserbase" },
  gemini: { icon: Sparkles, color: "amber", label: "Gemini AI" },
  database: { icon: Terminal, color: "slate", label: "Database" },
  internal: { icon: Zap, color: "emerald", label: "Internal" },
};

const agentColors: Record<string, string> = {
  requirements: "from-blue-500 to-cyan-500",
  spatial: "from-purple-500 to-pink-500",
  generation: "from-amber-500 to-orange-500",
  qc: "from-emerald-500 to-teal-500",
  orchestrator: "from-slate-500 to-zinc-500",
};

export function LiveReasoningPanel({
  steps,
  isActive,
  weaveTraceUrl,
  browserbaseSessionUrl,
}: LiveReasoningPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new steps arrive
  useEffect(() => {
    if (scrollRef.current && isActive) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps, isActive]);

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runningTools = steps.flatMap(s => s.toolCalls || []).filter(t => t.status === "running");

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-gradient-to-br from-slate-50 to-white dark:from-zinc-900 dark:to-zinc-950 overflow-hidden shadow-sm"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-slate-100/80 to-slate-50/80 dark:from-zinc-800/80 dark:to-zinc-900/80 hover:from-slate-100 hover:to-slate-50 dark:hover:from-zinc-800 dark:hover:to-zinc-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 dark:from-zinc-200 dark:to-zinc-400 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white dark:text-zinc-900" />
            </div>
            {isActive && (
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              Live Agent Reasoning
              {isActive && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold animate-pulse">
                  LIVE
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {steps.length} reasoning steps • {runningTools.length} tools active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick access links */}
          {weaveTraceUrl && (
            <a
              href={weaveTraceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[10px] font-medium hover:bg-purple-200 dark:hover:bg-purple-900/70 transition-colors"
            >
              <Eye className="w-3 h-3" />
              Weave
            </a>
          )}
          {browserbaseSessionUrl && (
            <a
              href={browserbaseSessionUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-medium hover:bg-blue-200 dark:hover:bg-blue-900/70 transition-colors"
            >
              <Globe className="w-3 h-3" />
              Browser
            </a>
          )}
          
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5 text-slate-400 dark:text-zinc-500" />
          </motion.div>
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Running Tools Banner */}
            {runningTools.length > 0 && (
              <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-b border-amber-200/50 dark:border-amber-800/50">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span className="font-medium">Active Tools:</span>
                  <div className="flex gap-1">
                    {runningTools.map(tool => (
                      <span
                        key={tool.id}
                        className="px-2 py-0.5 rounded-full bg-amber-200/50 dark:bg-amber-800/50 text-[10px] font-medium"
                      >
                        {tool.toolName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Reasoning Steps */}
            <div
              ref={scrollRef}
              className="max-h-[400px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800"
            >
              {steps.map((step, index) => {
                const isStepExpanded = expandedSteps.has(step.id);
                const gradientClass = agentColors[step.agent] || agentColors.orchestrator;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="relative"
                  >
                    {/* Step content */}
                    <div
                      className="px-4 py-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                      onClick={() => step.toolCalls?.length && toggleStep(step.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Agent indicator */}
                        <div
                          className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center shrink-0 shadow-sm`}
                        >
                          <Brain className="w-3.5 h-3.5 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Agent name and timestamp */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                              {step.agent}
                            </span>
                            <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">
                              {step.timestamp}
                            </span>
                          </div>

                          {/* Thought */}
                          <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                            <span className="text-slate-400 dark:text-zinc-500 mr-1">💭</span>
                            {step.thought}
                          </p>

                          {/* Action */}
                          {step.action && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              <span className="text-blue-400 dark:text-blue-500 mr-1">⚡</span>
                              {step.action}
                            </p>
                          )}

                          {/* Observation */}
                          {step.observation && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                              <span className="text-emerald-400 dark:text-emerald-500 mr-1">👁</span>
                              {step.observation}
                            </p>
                          )}

                          {/* Tool calls indicator */}
                          {step.toolCalls && step.toolCalls.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                                {step.toolCalls.length} tool call(s)
                              </span>
                              <div className="flex gap-1">
                                {step.toolCalls.map(tc => {
                                  const config = toolTypeConfig[tc.toolType];
                                  const Icon = config?.icon || Zap;
                                  return (
                                    <div
                                      key={tc.id}
                                      className={`
                                        w-5 h-5 rounded flex items-center justify-center
                                        ${tc.status === "running" ? "bg-amber-100 dark:bg-amber-900/50 animate-pulse" : 
                                          tc.status === "success" ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-red-100 dark:bg-red-900/50"}
                                      `}
                                    >
                                      <Icon className={`w-3 h-3 ${
                                        tc.status === "running" ? "text-amber-600 dark:text-amber-400" :
                                        tc.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                                      }`} />
                                    </div>
                                  );
                                })}
                              </div>
                              <motion.div
                                animate={{ rotate: isStepExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                              </motion.div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded tool calls */}
                    <AnimatePresence>
                      {isStepExpanded && step.toolCalls && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3 pl-14 space-y-2">
                            {step.toolCalls.map((tc, tcIndex) => {
                              const config = toolTypeConfig[tc.toolType];
                              const Icon = config?.icon || Zap;
                              
                              return (
                                <motion.div
                                  key={tc.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: tcIndex * 0.05 }}
                                  className={`
                                    rounded-lg border p-3
                                    ${tc.status === "running" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" :
                                      tc.status === "success" ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" :
                                      "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"}
                                  `}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Icon className={`w-4 h-4 ${
                                        tc.status === "running" ? "text-amber-600 dark:text-amber-400" :
                                        tc.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                                      }`} />
                                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                                        {tc.toolName}
                                      </span>
                                      <span className={`
                                        px-1.5 py-0.5 rounded text-[9px] font-medium
                                        ${tc.status === "running" ? "bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200" :
                                          tc.status === "success" ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200" :
                                          "bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-200"}
                                      `}>
                                        {tc.status.toUpperCase()}
                                      </span>
                                    </div>
                                    {tc.duration_ms && (
                                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {tc.duration_ms}ms
                                      </span>
                                    )}
                                  </div>
                                  
                                  {tc.input && (
                                    <div className="mb-2">
                                      <span className="text-[10px] text-slate-500 dark:text-zinc-400">Input:</span>
                                      <pre className="text-[10px] text-slate-600 dark:text-zinc-300 bg-white/50 dark:bg-zinc-900/50 rounded p-2 mt-1 overflow-x-auto">
                                        {JSON.stringify(tc.input, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  
                                  {tc.output && (
                                    <div>
                                      <span className="text-[10px] text-slate-500 dark:text-zinc-400">Output:</span>
                                      <p className="text-[10px] text-slate-600 dark:text-zinc-300 bg-white/50 dark:bg-zinc-900/50 rounded p-2 mt-1">
                                        {tc.output.length > 200 ? tc.output.slice(0, 200) + "..." : tc.output}
                                      </p>
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

              {/* Empty state */}
              {steps.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <Brain className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 dark:text-zinc-500">
                    Waiting for agent reasoning...
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

// Compact thinking indicator for inline use
export function ThinkingDots({ agent }: { agent: string }) {
  const gradientClass = agentColors[agent] || agentColors.orchestrator;
  
  return (
    <div className="inline-flex items-center gap-2">
      <div className={`w-5 h-5 rounded bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
        <Brain className="w-3 h-3 text-white" />
      </div>
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
      <span className="text-xs text-slate-500 dark:text-zinc-400">{agent} thinking...</span>
    </div>
  );
}
