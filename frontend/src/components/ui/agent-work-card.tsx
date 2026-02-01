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
  policy_update: { icon: Wand2, label: "Updating Policy" },
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
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const agentInfo = agentConfig[agent];
  const actionInfo = actionConfig[action];
  const AgentIcon = agentInfo.icon;
  const ActionIcon = actionInfo.icon;

  const hasExpandableContent = (details && Object.keys(details).length > 0) || reasoning || toolCall;

  const getStatusStyles = () => {
    switch (status) {
      case "running":
        return "border-l-2 border-l-primary";
      case "completed":
        return "border-l-2 border-l-emerald-500";
      case "error":
        return "border-l-2 border-l-red-500";
      case "warning":
        return "border-l-2 border-l-amber-500";
      default:
        return "border-l-2 border-l-slate-200";
    }
  };

  return (
    <motion.div
      initial={false}
      className={cn(
        "relative rounded-lg border border-black/[0.06] bg-white overflow-hidden shadow-sm",
        "hover:shadow-md transition-shadow duration-200",
        getStatusStyles()
      )}
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
                <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
                  {agentInfo.label}
                </span>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5">
                  <ActionIcon className="w-2.5 h-2.5" />
                  {actionInfo.label}
                </span>
              </div>
              
              {/* Title */}
              <h3 className="text-[13px] font-semibold text-foreground truncate">
                {title}
              </h3>
            </div>
          </div>

          {/* Timestamp and status */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {timestamp && (
              <span className="text-[9px] text-muted-foreground/40 font-mono">
                {timestamp}
              </span>
            )}
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      {/* Content - cleaner */}
      <div className="px-4 pb-3">
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {content}
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
            className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors border-t border-white/20"
          >
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={smoothTransition}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.div>
            {isExpanded ? "Hide details" : `Show details (${details ? Object.keys(details).length : 0})`}
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
                            <span className="text-muted-foreground/50 capitalize text-[10px] uppercase tracking-wider">
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
                  
                  {/* Weave trace link */}
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
    </motion.div>
  );
};

// Status Badge Component with animations
function StatusBadge({ status }: { status: CardStatus }) {
  const getStyles = () => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "running":
        return "bg-primary/10 text-primary border-primary/20";
      case "error":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "warning":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={smoothTransition}
      className="rounded-lg border border-black/[0.06] bg-white/60 p-3"
    >
      <p className="text-[13px] font-medium text-foreground mb-2">{question.question_text}</p>
      {question.multi_select && (
        <p className="text-[10px] text-muted-foreground/60 mb-2">Select all that apply</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {question.possible_answers.map((answer, index) => (
          <motion.button
            key={answer.answer_id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            whileHover={!disabled ? { scale: 1.02 } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
            onClick={() => handleSelect(answer.answer_id)}
            disabled={disabled}
            className={cn(
              "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
              "border",
              selected.includes(answer.answer_id)
                ? "bg-foreground text-background border-foreground"
                : "bg-white border-black/[0.08] text-foreground/70 hover:bg-black/[0.02] hover:border-black/[0.12]",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {answer.answer_text}
          </motion.button>
        ))}
      </div>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={smoothTransition}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/40 bg-white/30 backdrop-blur-xl"
    >
      <div className="flex items-center gap-2">
        <ImageIcon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        <span className="text-xs font-medium text-foreground/70">{title}</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {images.map((img, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.05 }}
            className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/40 bg-white/20 group cursor-pointer shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={`Image ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
