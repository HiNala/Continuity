"use client";

/**
 * AgentCard - Minimal, elegant agent activity visualization
 * 
 * Design: Apple-inspired minimal aesthetic
 * - Clean lines, generous whitespace
 * - Subtle color coding
 * - Information hierarchy
 * - Purposeful animations only
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  Eye, 
  Paintbrush, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Sparkles,
  Brain,
  ExternalLink,
} from "lucide-react";

// Types
export type AgentType = "requirements" | "spatial" | "generation" | "qc" | "orchestrator" | "system";
export type CardStatus = "pending" | "running" | "completed" | "error" | "warning";

export interface AgentCardProps {
  id: string;
  agent: AgentType;
  title: string;
  content: string;
  status: CardStatus;
  timestamp?: string;
  details?: Record<string, unknown>;
  reasoning?: string;
  weaveTraceUrl?: string;
}

// Agent configuration - minimal color palette
const agents: Record<AgentType, { label: string; icon: React.ElementType; color: string }> = {
  requirements: { label: "Requirements", icon: MessageSquare, color: "#3B82F6" },
  spatial: { label: "Spatial", icon: Eye, color: "#8B5CF6" },
  generation: { label: "Generation", icon: Paintbrush, color: "#F59E0B" },
  qc: { label: "Quality", icon: CheckCircle2, color: "#10B981" },
  orchestrator: { label: "Orchestrator", icon: Brain, color: "#64748B" },
  system: { label: "System", icon: Sparkles, color: "#6B7280" },
};

// Subtle spring animation
const spring = { type: "spring", stiffness: 400, damping: 30 };

export function AgentCard({
  agent,
  title,
  content,
  status,
  timestamp,
  details,
  reasoning,
  weaveTraceUrl,
}: AgentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = agents[agent];
  const Icon = config.icon;
  const hasExpandable = (details && Object.keys(details).length > 0) || reasoning;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="group relative rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800 overflow-hidden hover:border-neutral-300/80 dark:hover:border-zinc-700 transition-colors"
    >
      {/* Status accent line */}
      <div 
        className={`absolute left-0 top-0 bottom-0 w-0.5 ${
          status === "running" ? "bg-blue-500" :
          status === "completed" ? "bg-emerald-500" :
          status === "error" ? "bg-red-500" :
          status === "warning" ? "bg-amber-500" :
          "bg-neutral-200 dark:bg-zinc-700"
        }`}
      />

      {/* Main content */}
      <div className="pl-4 pr-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Icon + Content */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Agent icon */}
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${config.color}10` }}
            >
              <Icon className="w-4 h-4" style={{ color: config.color }} />
            </div>

            <div className="min-w-0 flex-1">
              {/* Agent label */}
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-medium text-neutral-400 dark:text-zinc-500 uppercase tracking-wider">
                  {config.label}
                </span>
                {timestamp && (
                  <span className="text-[9px] text-neutral-300 dark:text-zinc-600 font-mono">
                    {timestamp}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-sm font-medium text-neutral-900 leading-tight">
                {title}
              </h3>

              {/* Content */}
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                {content}
              </p>
            </div>
          </div>

          {/* Right: Status */}
          <div className="shrink-0">
            <StatusBadge status={status} />
          </div>
        </div>

        {/* Expandable section */}
        {hasExpandable && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-3 w-full flex items-center justify-center gap-1 text-[10px] text-neutral-400 dark:text-zinc-500 hover:text-neutral-600 dark:hover:text-zinc-300 transition-colors py-1"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronDown className="w-3 h-3" />
              </motion.div>
              {isExpanded ? "Less" : "More"}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3 border-t border-neutral-100 dark:border-zinc-800 mt-2">
                    {/* Reasoning */}
                    {reasoning && (
                      <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100/50 dark:border-blue-900/50">
                        <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mb-1">Reasoning</p>
                        <p className="text-xs text-blue-700/80 dark:text-blue-300/80 leading-relaxed">{reasoning}</p>
                      </div>
                    )}

                    {/* Details */}
                    {details && Object.keys(details).length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(details).slice(0, 6).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-neutral-400 dark:text-zinc-500 text-[10px] uppercase tracking-wide">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <p className="text-neutral-700 dark:text-zinc-300 font-medium truncate">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Weave link */}
                    {weaveTraceUrl && (
                      <a
                        href={weaveTraceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] text-neutral-400 dark:text-zinc-500 hover:text-neutral-600 dark:hover:text-zinc-300 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        View in Weave
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Running indicator */}
      {status === "running" && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500 to-blue-500/0"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: CardStatus }) {
  const config = {
    pending: { label: "Pending", className: "bg-neutral-100 dark:bg-zinc-800 text-neutral-500 dark:text-zinc-400" },
    running: { label: "Running", className: "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400" },
    completed: { label: "Done", className: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400" },
    error: { label: "Error", className: "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400" },
    warning: { label: "Warning", className: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400" },
  }[status];

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium ${config.className}`}
    >
      {status === "running" && (
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
      )}
      {status === "completed" && (
        <CheckCircle2 className="w-2.5 h-2.5" />
      )}
      {status === "error" && (
        <AlertCircle className="w-2.5 h-2.5" />
      )}
      {config.label}
    </motion.span>
  );
}

// Question card - cleaner version
interface QuestionCardProps {
  question: {
    question_id: string;
    question_text: string;
    possible_answers: { answer_id: string; answer_text: string }[];
    multi_select?: boolean;
  };
  onAnswer: (questionId: string, answerId: string | string[]) => void;
  selectedAnswer?: string | string[];
  disabled?: boolean;
}

export function QuestionCard({
  question,
  onAnswer,
  selectedAnswer,
  disabled = false,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(selectedAnswer) ? selectedAnswer : selectedAnswer ? [selectedAnswer] : []
  );

  const handleSelect = (answerId: string) => {
    if (disabled) return;
    
    let newSelected: string[];
    if (question.multi_select) {
      newSelected = selected.includes(answerId)
        ? selected.filter(id => id !== answerId)
        : [...selected, answerId];
    } else {
      newSelected = [answerId];
    }
    
    setSelected(newSelected);
    onAnswer(question.question_id, question.multi_select ? newSelected : newSelected[0]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800"
    >
      <p className="text-sm font-medium text-neutral-900 dark:text-zinc-100 mb-3">{question.question_text}</p>
      
      {question.multi_select && (
        <p className="text-[10px] text-neutral-400 dark:text-zinc-500 mb-2">Select all that apply</p>
      )}
      
      <div className="flex flex-wrap gap-2">
        {question.possible_answers.map((answer) => (
          <motion.button
            key={answer.answer_id}
            whileHover={!disabled ? { scale: 1.02 } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
            onClick={() => handleSelect(answer.answer_id)}
            disabled={disabled}
            className={`
              px-3 py-2 rounded-lg text-xs font-medium transition-all border
              ${selected.includes(answer.answer_id)
                ? "bg-neutral-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-neutral-900 dark:border-zinc-100"
                : "bg-white dark:bg-zinc-800 text-neutral-600 dark:text-zinc-300 border-neutral-200 dark:border-zinc-700 hover:border-neutral-300 dark:hover:border-zinc-600"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {answer.answer_text}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// Skeleton loader
export function AgentCardSkeleton() {
  return (
    <div className="rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-2 w-16 bg-neutral-100 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-32 bg-neutral-100 dark:bg-zinc-800 rounded" />
          <div className="h-2 w-48 bg-neutral-100 dark:bg-zinc-800 rounded" />
        </div>
      </div>
    </div>
  );
}
