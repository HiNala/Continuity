"use client";

import React from "react";
import { motion } from "framer-motion";
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
  ChevronDown,
  ChevronUp
} from "lucide-react";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

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
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const agentInfo = agentConfig[agent];
  const actionInfo = actionConfig[action];
  const AgentIcon = agentInfo.icon;
  const ActionIcon = actionInfo.icon;

  const hasExpandableContent = details && Object.keys(details).length > 0;

  const getStatusStyles = () => {
    switch (status) {
      case "running":
        return "border-l-4 border-l-primary/60";
      case "completed":
        return "border-l-4 border-l-emerald-500/60";
      case "error":
        return "border-l-4 border-l-red-500/60";
      case "warning":
        return "border-l-4 border-l-amber-500/60";
      default:
        return "border-l-4 border-l-slate-300/40";
    }
  };

  return (
    <motion.div
      layout
      className={cn(
        "relative rounded-2xl border border-white/40 bg-white/30 backdrop-blur-xl overflow-hidden shadow-sm transition-all duration-300",
        "hover:bg-white/40 hover:border-white/50 hover:shadow-md",
        getStatusStyles()
      )}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Agent icon with gradient background */}
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br shadow-sm",
              agentInfo.gradient
            )}>
              <AgentIcon className="w-5 h-5 text-white" />
            </div>
            
            <div className="min-w-0 flex-1">
              {/* Agent label and action */}
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                  {agentInfo.label}
                </span>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                  <ActionIcon className="w-3 h-3" />
                  {actionInfo.label}
                </span>
              </div>
              
              {/* Title */}
              <h3 className="text-sm font-semibold text-foreground/90 truncate">
                {title}
              </h3>
            </div>
          </div>

          {/* Timestamp and status */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {timestamp && (
              <span className="text-[10px] text-muted-foreground/40 font-mono">
                {timestamp}
              </span>
            )}
            {/* Status badge */}
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-sm text-muted-foreground/70 leading-relaxed">
          {content}
        </p>
      </div>

      {/* Image preview */}
      {imageUrl && (
        <div className="px-4 pb-3">
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
        </div>
      )}

      {/* Expandable details */}
      {hasExpandableContent && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors border-t border-white/20"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Show details ({Object.keys(details).length})
              </>
            )}
          </button>
          
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4"
            >
              <div className="rounded-xl bg-white/20 border border-white/30 p-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {Object.entries(details).map(([key, value]) => (
                    <div key={key} className="flex flex-col">
                      <span className="text-muted-foreground/50 capitalize text-[10px] uppercase tracking-wider">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-foreground/70 font-medium truncate">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Custom children */}
      {children && <div className="px-4 pb-4">{children}</div>}

      {/* Loading spinner overlay for running status */}
      {status === "running" && (
        <div className="absolute bottom-3 right-3">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Status Badge Component
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
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
      getStyles()
    )}>
      {getIcon()}
      <span className="capitalize">{status}</span>
    </span>
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/40 bg-white/30 backdrop-blur-xl p-4"
    >
      <p className="text-sm font-medium text-foreground/90 mb-1">{question.question_text}</p>
      {question.multi_select && (
        <p className="text-[11px] text-muted-foreground/50 mb-3">Select all that apply</p>
      )}
      <div className="flex flex-wrap gap-2">
        {question.possible_answers.map((answer) => (
          <button
            key={answer.answer_id}
            onClick={() => handleSelect(answer.answer_id)}
            disabled={disabled}
            className={cn(
              "px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              "border hover:scale-[1.02]",
              selected.includes(answer.answer_id)
                ? "bg-gradient-to-br from-primary/20 to-accent/20 border-primary/30 text-foreground shadow-sm"
                : "bg-white/30 border-white/40 text-muted-foreground/70 hover:bg-white/50 hover:border-white/60",
              disabled && "opacity-50 cursor-not-allowed hover:scale-100"
            )}
          >
            {answer.answer_text}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

// Image display card
interface ImageDisplayCardProps {
  images: string[];
  title?: string;
}

export const ImageDisplayCard: React.FC<ImageDisplayCardProps> = ({
  images,
  title = "Uploaded Images",
}) => {
  if (images.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/40 bg-white/30 backdrop-blur-xl p-4"
    >
      <p className="text-sm font-medium text-foreground/80 mb-3 flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-muted-foreground/60" />
        {title}
      </p>
      <div className={cn(
        "grid gap-2",
        images.length === 1 ? "grid-cols-1" : "grid-cols-2"
      )}>
        {images.map((img, index) => (
          <div
            key={index}
            className="relative rounded-xl overflow-hidden border border-white/30 aspect-video bg-white/10 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={`Image ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </motion.div>
  );
};
