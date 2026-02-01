"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, 
  Eye, 
  Paintbrush, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Sparkles,
  Search,
  Image as ImageIcon,
  Wand2,
  ClipboardCheck,
  Settings2,
  MessageSquare,
  Zap,
  ChevronDown
} from "lucide-react";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

// Simple markdown parser for bold text
function parseMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const boldPattern = /\*\*([^*]+)\*\*/;
  
  while (remaining) {
    const match = remaining.match(boldPattern);
    
    if (match && match.index !== undefined) {
      if (match.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, match.index)}</span>);
      }
      parts.push(
        <strong key={key++} className="font-semibold text-neutral-900 dark:text-zinc-100">
          {match[1]}
        </strong>
      );
      remaining = remaining.slice(match.index + match[0].length);
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }
  
  return parts;
}

// Smooth animation transitions
const smoothTransition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
};

export type AgentType = 
  | "requirements" 
  | "spatial" 
  | "generation" 
  | "qc" 
  | "orchestrator"
  | "system";

export type CardStatus = "pending" | "running" | "completed" | "error" | "warning";

export type ActionType = 
  | "thinking" 
  | "analyzing" 
  | "generating" 
  | "evaluating"
  | "searching"
  | "policy_update"
  | "question"
  | "success"
  | "error";

export interface AgentWorkCardProps {
  id: string;
  agent: AgentType;
  title: string;
  content: string;
  status: CardStatus;
  action: ActionType;
  timestamp?: string;
  details?: Record<string, unknown>;
  imageUrl?: string;
  children?: React.ReactNode;
  reasoning?: string;
  toolCall?: {
    name: string;
    input?: Record<string, unknown>;
    output?: string;
  };
  weaveTraceUrl?: string;
  browserbaseSessionId?: string;
}

const agentConfig: Record<AgentType, { label: string; icon: React.ElementType; gradient: string; accentColor: string }> = {
  requirements: { 
    label: "Requirements Agent", 
    icon: MessageSquare, 
    gradient: "from-blue-500 to-cyan-500",
    accentColor: "blue"
  },
  spatial: { 
    label: "Spatial Analysis", 
    icon: Eye, 
    gradient: "from-purple-500 to-pink-500",
    accentColor: "purple"
  },
  generation: { 
    label: "Generation Agent", 
    icon: Paintbrush, 
    gradient: "from-amber-500 to-orange-500",
    accentColor: "amber"
  },
  qc: { 
    label: "Quality Control", 
    icon: ClipboardCheck, 
    gradient: "from-emerald-500 to-teal-500",
    accentColor: "emerald"
  },
  orchestrator: { 
    label: "Orchestrator", 
    icon: Settings2, 
    gradient: "from-slate-500 to-zinc-600",
    accentColor: "slate"
  },
  system: { 
    label: "System", 
    icon: Zap, 
    gradient: "from-gray-500 to-gray-600",
    accentColor: "gray"
  },
};

const actionConfig: Record<ActionType, { icon: React.ElementType; label: string }> = {
  thinking: { icon: Brain, label: "Thinking" },
  analyzing: { icon: Search, label: "Analyzing" },
  generating: { icon: Sparkles, label: "Generating" },
  evaluating: { icon: ClipboardCheck, label: "Evaluating" },
  searching: { icon: Eye, label: "Searching" },
  policy_update: { icon: Wand2, label: "Self-Improving" },
  question: { icon: MessageSquare, label: "Awaiting Input" },
  success: { icon: CheckCircle2, label: "Complete" },
  error: { icon: AlertCircle, label: "Error" },
};

export const AgentWorkCard: React.FC<AgentWorkCardProps> = ({
  agent,
  title,
  content,
  status,
  action,
  timestamp,
  details,
  imageUrl,
  children,
  reasoning,
  toolCall,
  weaveTraceUrl,
  browserbaseSessionId,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const agentInfo = agentConfig[agent];
  const actionInfo = actionConfig[action];
  const AgentIcon = agentInfo.icon;
  const ActionIcon = actionInfo.icon;

  const hasExpandableContent = (details && Object.keys(details).length > 0) || reasoning || toolCall;
  const detailsCount =
    (details ? Object.keys(details).length : 0) +
    (reasoning ? 1 : 0) +
    (toolCall ? 1 : 0);
  const detailsId = React.useId();

  const getStatusStyles = () => {
    // Special styling for self-improvement/policy update actions
    const isSelfImprovement = action === "policy_update";
    
    switch (status) {
      case "running":
        if (isSelfImprovement) {
          return "border-l-[3px] border-l-amber-500 bg-gradient-to-r from-amber-50/50 dark:from-amber-900/20 to-transparent";
        }
        return "border-l-[3px] border-l-primary";
      case "completed":
        if (isSelfImprovement) {
          return "border-l-[3px] border-l-emerald-500 bg-gradient-to-r from-emerald-50/30 dark:from-emerald-900/20 to-transparent";
        }
        return "border-l-[3px] border-l-emerald-500";
      case "error":
        return "border-l-[3px] border-l-red-500 bg-red-50/30 dark:bg-red-900/20";
      case "warning":
        return "border-l-[3px] border-l-amber-500 bg-gradient-to-r from-amber-50/50 dark:from-amber-900/20 to-transparent";
      default:
        return "border-l-[3px] border-l-slate-200 dark:border-l-zinc-700";
    }
  };

  return (
    <motion.article
      initial={false}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative rounded-xl border border-white/50 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl overflow-hidden",
        "shadow-[0_6px_18px_rgba(0,0,0,0.08)] hover:shadow-[0_10px_28px_rgba(0,0,0,0.12)] hover:border-white/70 dark:hover:border-white/20 transition-all duration-300",
        getStatusStyles()
      )}
      role="article"
      aria-label={`${agentInfo.label} - ${actionInfo.label}: ${title || content.substring(0, 50)}...`}
      aria-live={status === "running" ? "polite" : undefined}
    >
      {/* Header - cleaner design */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {/* Smaller, cleaner agent icon */}
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br",
                agentInfo.gradient
              )}
            >
              <AgentIcon className="w-4 h-4 text-white" />
            </div>
            
            <div className="min-w-0 flex-1">
              {/* Agent label and action - more compact */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold text-neutral-500 dark:text-zinc-400 uppercase tracking-wide">
                  {agentInfo.label}
                </span>
                <span className="text-neutral-300 dark:text-zinc-600">•</span>
                <span className="text-[10px] text-neutral-400 dark:text-zinc-500 flex items-center gap-0.5">
                  <ActionIcon className="w-2.5 h-2.5" />
                  {actionInfo.label}
                </span>
              </div>
              
              {/* Title */}
              <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-zinc-100 truncate">
                {title}
              </h3>
            </div>
          </div>

          {/* Timestamp and status */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {timestamp && (
              <span className="text-[9px] text-neutral-400 dark:text-zinc-500 font-mono">
                {timestamp}
              </span>
            )}
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      {/* Content - cleaner */}
      <div className="px-4 pb-3">
        <p className="text-xs text-neutral-500 dark:text-zinc-400 leading-relaxed">
          {parseMarkdown(content)}
        </p>
      </div>

      {/* Image preview */}
      <AnimatePresence>
        {imageUrl && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={smoothTransition}
            className="px-4 pb-3"
          >
            <div className="relative rounded-xl overflow-hidden border border-white/30 bg-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Generated"
                className="w-full h-auto max-h-48 object-cover"
              />
              <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm flex items-center gap-1">
                <ImageIcon className="w-3 h-3 text-white/80" />
                <span className="text-[10px] text-white/80">Preview</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expandable details - using AnimatePresence for smooth open/close */}
      {hasExpandableContent && (
        <>
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            whileTap={{ scale: 0.99 }}
            className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground/80 transition-colors border-t border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={smoothTransition}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.div>
            {isExpanded
              ? "Hide details"
              : detailsCount > 0
                ? `Show details (${detailsCount})`
                : "Show details"}
          </motion.button>
          
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ 
                  height: "auto", 
                  opacity: 1,
                  transition: {
                    height: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
                    opacity: { duration: 0.2, delay: 0.1 }
                  }
                }}
                exit={{ 
                  height: 0, 
                  opacity: 0,
                  transition: {
                    height: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
                    opacity: { duration: 0.15 }
                  }
                }}
                className="overflow-hidden"
                id={detailsId}
              >
                <div className="px-4 pb-4 space-y-3">
                  {/* Reasoning section */}
                  {reasoning && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/10 p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-3.5 h-3.5 text-blue-500/70" />
                        <span className="text-[10px] font-medium text-blue-600/70 uppercase tracking-wider">
                          Reasoning
                        </span>
                      </div>
                      <p className="text-xs text-foreground/70 leading-relaxed">
                        {reasoning}
                      </p>
                    </motion.div>
                  )}
                  
                  {/* Tool call section */}
                  {toolCall && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="rounded-xl bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/10 p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Wand2 className="w-3.5 h-3.5 text-purple-500/70" />
                        <span className="text-[10px] font-medium text-purple-600/70 uppercase tracking-wider">
                          Tool: {toolCall.name}
                        </span>
                      </div>
                      {toolCall.input && (
                        <div className="mb-2">
                          <span className="text-[10px] text-muted-foreground/50">Input:</span>
                          <pre className="text-[10px] text-foreground/60 bg-white/30 rounded-lg p-2 mt-1 overflow-x-auto">
                            {JSON.stringify(toolCall.input, null, 2)}
                          </pre>
                        </div>
                      )}
                      {toolCall.output && (
                        <div>
                          <span className="text-[10px] text-muted-foreground/50">Output:</span>
                          <p className="text-xs text-foreground/70 mt-1">{toolCall.output}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                  
                  {/* Details grid */}
                  {details && Object.keys(details).length > 0 && (
                    <div className="rounded-xl bg-white/20 border border-white/30 p-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        {Object.entries(details).map(([key, value], index) => (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex flex-col"
                          >
                            <span className="text-muted-foreground/50 text-[10px] uppercase tracking-wider">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <span className="text-foreground/70 font-medium truncate">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* External links */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {weaveTraceUrl && (
                      <a
                        href={weaveTraceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] text-primary/70 hover:text-primary transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        View in Weave
                      </a>
                    )}
                    {browserbaseSessionId && (
                      <a
                        href={`https://browserbase.com/sessions/${browserbaseSessionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        Browser Session
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Custom children */}
      {children && <div className="px-4 pb-4">{children}</div>}

      {/* Loading spinner overlay for running status */}
      <AnimatePresence>
        {status === "running" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={springTransition}
            className="absolute bottom-3 right-3"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-2 h-2 rounded-full bg-primary/60" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};

// Status Badge Component with animations
function StatusBadge({ status }: { status: CardStatus }) {
  const getStyles = () => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30";
      case "running":
        return "bg-primary/10 dark:bg-primary/20 text-primary border-primary/20 dark:border-primary/30";
      case "error":
        return "bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/20 dark:border-red-500/30";
      case "warning":
        return "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30";
      default:
        return "bg-slate-500/10 dark:bg-zinc-500/20 text-slate-500 dark:text-zinc-400 border-slate-500/20 dark:border-zinc-500/30";
    }
  };

  const getIcon = () => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-3 h-3" />;
      case "running":
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case "error":
        return <AlertCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springTransition}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
        getStyles()
      )}
    >
      {getIcon()}
      <span className="capitalize">{status}</span>
    </motion.span>
  );
}

// Question card component for clarifications
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

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onAnswer,
  selectedAnswer,
  disabled = false,
}) => {
  const [selected, setSelected] = React.useState<string[]>(
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
    <div className="space-y-3">
      <p className="text-[14px] text-neutral-800 dark:text-zinc-200 leading-relaxed">{parseMarkdown(question.question_text)}</p>
      {question.multi_select && (
        <p className="text-[10px] text-neutral-400 dark:text-zinc-500 uppercase tracking-wider font-medium">Select all that apply</p>
      )}
      <div className="flex flex-wrap gap-2">
        {question.possible_answers.map((answer) => {
          const isSelected = selected.includes(answer.answer_id);
          return (
            <motion.button
              key={answer.answer_id}
              onClick={() => handleSelect(answer.answer_id)}
              disabled={disabled}
              whileHover={!disabled ? { y: -1, scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              className={cn(
                "px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 border",
                isSelected
                  ? "bg-gradient-to-br from-neutral-900 to-neutral-800 dark:from-zinc-100 dark:to-zinc-200 text-white dark:text-zinc-900 border-transparent shadow-lg shadow-neutral-900/20 dark:shadow-zinc-100/20"
                  : "bg-white/80 dark:bg-zinc-800/80 text-neutral-600 dark:text-zinc-300 border-neutral-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 hover:border-neutral-300 dark:hover:border-zinc-600 hover:shadow-md",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="flex items-center gap-2">
                {isSelected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full bg-white/20 dark:bg-zinc-900/20 flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                  </motion.span>
                )}
                {answer.answer_text}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// Compact image display card - small thumbnails in a row
interface ImageDisplayCardProps {
  images: string[];
  title?: string;
}

export const ImageDisplayCard: React.FC<ImageDisplayCardProps> = ({
  images,
  title = "Your space",
}) => {
  if (images.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-medium text-neutral-400 dark:text-zinc-500">{title}</span>
      <div className="flex gap-2">
        {images.map((img, index) => (
          <div
            key={index}
            className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 dark:bg-zinc-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={`Image ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
