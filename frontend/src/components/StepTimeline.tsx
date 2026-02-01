"use client";

/**
 * StepTimeline - Comprehensive view of all agent steps and actions
 * Shows the complete workflow from requirements to final output
 */

import React, { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
  FileText,
  ImageIcon,
  Cpu,
  Eye,
  Zap,
  Globe,
  Settings
} from "lucide-react";

export interface Step {
  id: string;
  type: "transition" | "generation" | "evaluation" | "tool_call" | "browserbase";
  agent: "requirements" | "spatial" | "generation" | "qc" | "orchestrator";
  status: "pending" | "running" | "completed" | "failed";
  title: string;
  description?: string;
  timestamp: string;
  duration_ms?: number;
  details?: Record<string, unknown>;
  weaveTraceId?: string;
  browserbaseSessionId?: string;
  // For generation steps
  phase?: string;
  iterationNumber?: number;
  imagePath?: string;
  // For evaluation steps
  evaluationScore?: number;
  evaluationPassed?: boolean;
  failureReasons?: string[];
}

interface StepTimelineProps {
  steps: Step[];
  weaveProjectUrl?: string;
  className?: string;
}

const agentConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  requirements: { color: "#3B82F6", icon: FileText, label: "Requirements" },
  spatial: { color: "#8B5CF6", icon: Eye, label: "Spatial Analysis" },
  generation: { color: "#F59E0B", icon: ImageIcon, label: "Generation" },
  qc: { color: "#10B981", icon: CheckCircle2, label: "Quality Check" },
  orchestrator: { color: "#64748B", icon: Cpu, label: "Orchestrator" },
};

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  pending: { color: "text-neutral-400 dark:text-zinc-500", icon: Clock },
  running: { color: "text-blue-500 dark:text-blue-400", icon: Loader2 },
  completed: { color: "text-emerald-500 dark:text-emerald-400", icon: CheckCircle2 },
  failed: { color: "text-red-500 dark:text-red-400", icon: XCircle },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function StepRow({ 
  step, 
  isLast,
  weaveProjectUrl 
}: { 
  step: Step; 
  isLast: boolean;
  weaveProjectUrl?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const agent = agentConfig[step.agent] || agentConfig.orchestrator;
  const status = statusConfig[step.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const AgentIcon = agent.icon;

  return (
    <div className="relative">
      {/* Vertical connector line */}
      {!isLast && (
        <div 
          className="absolute left-[15px] top-9 bottom-0 w-[2px] bg-white/40 dark:bg-white/10"
        />
      )}
      
      <div className="flex gap-3">
        {/* Status indicator */}
        <div className="relative z-10 shrink-0">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center
            ${step.status === "running" 
              ? "bg-blue-100 dark:bg-blue-900/40" 
              : step.status === "completed"
                ? "bg-emerald-100 dark:bg-emerald-900/40"
                : step.status === "failed"
                  ? "bg-red-100 dark:bg-red-900/40"
                  : "bg-neutral-100 dark:bg-zinc-800"
            }
          `}>
            <StatusIcon className={`w-4 h-4 ${status.color} ${step.status === "running" ? "animate-spin" : ""}`} />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 pb-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left group rounded-xl px-2 py-2 -mx-2 transition-colors hover:bg-white/60 dark:hover:bg-zinc-900/50"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span 
                    className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ 
                      backgroundColor: `${agent.color}14`,
                      color: agent.color 
                    }}
                  >
                    {agent.label}
                  </span>
                  {step.phase && (
                    <span className="text-[10px] text-neutral-400 dark:text-zinc-500">
                      Phase: {step.phase}
                    </span>
                  )}
                  {step.iterationNumber && step.iterationNumber > 1 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 rounded">
                      Retry #{step.iterationNumber}
                    </span>
                  )}
                </div>
                <p className="text-[13px] font-medium text-neutral-800 dark:text-zinc-200 leading-snug">
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-neutral-500 dark:text-zinc-400 mt-0.5 truncate">
                    {step.description}
                  </p>
                )}
              </div>
              
              {/* Right side - time/score */}
              <div className="flex items-center gap-2 shrink-0">
                {step.evaluationScore !== undefined && (
                  <span className={`
                    text-xs font-medium px-1.5 py-0.5 rounded
                    ${step.evaluationPassed 
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    }
                  `}>
                    {Math.round(step.evaluationScore * 100)}%
                  </span>
                )}
                {step.duration_ms && (
                  <span className="text-[10px] text-neutral-400 dark:text-zinc-500">
                    {formatDuration(step.duration_ms)}
                  </span>
                )}
                <span className="text-[10px] text-neutral-300 dark:text-zinc-600">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </span>
                {(step.details || step.weaveTraceId || step.imagePath || step.failureReasons) && (
                  expanded ? (
                    <ChevronDown className="w-4 h-4 text-neutral-400 dark:text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400 dark:text-zinc-500" />
                  )
                )}
              </div>
            </div>
          </button>
          
          {/* Expanded details */}
          {expanded && (
            <div className="mt-2 space-y-2">
              {/* Failure reasons */}
              {step.failureReasons && step.failureReasons.length > 0 && (
                <div className="p-2 rounded-lg bg-red-50/80 dark:bg-red-900/20 border border-red-100/60 dark:border-red-800/40">
                  <p className="text-[10px] font-medium text-red-700 dark:text-red-400 mb-1">Issues:</p>
                  <ul className="space-y-0.5">
                    {step.failureReasons.map((reason, i) => (
                      <li key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                        <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Generated image preview */}
              {step.imagePath && (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-100 dark:bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={step.imagePath.startsWith("http") ? step.imagePath : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${step.imagePath}`}
                      alt="Generated"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-zinc-400">Output image</span>
                </div>
              )}
              
              {/* Details JSON */}
              {step.details && Object.keys(step.details).length > 0 && (
                <div className="p-2 rounded-lg bg-white/70 dark:bg-zinc-800/50 border border-white/40 dark:border-white/10 text-xs">
                  <pre className="text-neutral-600 dark:text-zinc-400 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
                    {JSON.stringify(step.details, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* External links */}
              <div className="flex items-center gap-3">
                {step.weaveTraceId && weaveProjectUrl && (
                  <a
                    href={`${weaveProjectUrl}/calls/${step.weaveTraceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-zinc-400 hover:text-neutral-700 dark:hover:text-zinc-200 transition-colors"
                  >
                    <Zap className="w-3 h-3" />
                    View in Weave
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {step.browserbaseSessionId && (
                  <a
                    href={`https://browserbase.com/sessions/${step.browserbaseSessionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-zinc-400 hover:text-neutral-700 dark:hover:text-zinc-200 transition-colors"
                  >
                    <Globe className="w-3 h-3" />
                    Browserbase Session
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StepTimeline({ steps, weaveProjectUrl, className = "" }: StepTimelineProps) {
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  
  const filteredSteps = filterAgent 
    ? steps.filter(s => s.agent === filterAgent)
    : steps;

  // Group counts by agent
  const agentCounts = steps.reduce((acc, step) => {
    acc[step.agent] = (acc[step.agent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (steps.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Settings className="w-8 h-8 text-neutral-300 dark:text-zinc-600 mx-auto mb-2" />
        <p className="text-sm text-neutral-500 dark:text-zinc-400">No steps recorded yet</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-on-hover">
        <button
          onClick={() => setFilterAgent(null)}
          className={`
            text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap
            ${filterAgent === null
              ? "bg-neutral-900/90 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
              : "bg-white/70 dark:bg-zinc-900/60 text-neutral-600 dark:text-zinc-400 border border-white/40 dark:border-white/10 hover:bg-white/90 dark:hover:bg-zinc-900/80"
            }
          `}
        >
          All ({steps.length})
        </button>
        {Object.entries(agentConfig).map(([key, config]) => {
          if (!agentCounts[key]) return null;
          return (
            <button
              key={key}
              onClick={() => setFilterAgent(filterAgent === key ? null : key)}
              className={`
                text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5
                ${filterAgent === key
                  ? "text-white shadow-sm"
                  : "bg-white/70 dark:bg-zinc-900/60 text-neutral-600 dark:text-zinc-400 border border-white/40 dark:border-white/10 hover:bg-white/90 dark:hover:bg-zinc-900/80"
                }
              `}
              style={filterAgent === key ? { backgroundColor: config.color } : {}}
            >
              <config.icon className="w-3 h-3" />
              {config.label} ({agentCounts[key]})
            </button>
          );
        })}
      </div>

      {/* Steps */}
      <div className="space-y-0">
        {filteredSteps.map((step, index) => (
          <StepRow 
            key={step.id} 
            step={step} 
            isLast={index === filteredSteps.length - 1}
            weaveProjectUrl={weaveProjectUrl}
          />
        ))}
      </div>
    </div>
  );
}

// Compact summary for header
export function StepSummary({ steps }: { steps: Step[] }) {
  const completed = steps.filter(s => s.status === "completed").length;
  const failed = steps.filter(s => s.status === "failed").length;
  const running = steps.filter(s => s.status === "running").length;

  return (
    <div className="flex items-center gap-2 text-xs">
      {running > 0 && (
        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          {running} running
        </span>
      )}
      {completed > 0 && (
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          {completed} done
        </span>
      )}
      {failed > 0 && (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <XCircle className="w-3 h-3" />
          {failed} failed
        </span>
      )}
    </div>
  );
}
