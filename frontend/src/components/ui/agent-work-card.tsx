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
  Zap
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

const agentConfig: Record<AgentType, { label: string; icon: React.ElementType; color: string }> = {
  requirements: { label: "Requirements", icon: MessageSquare, color: "from-blue-500 to-cyan-500" },
  spatial: { label: "Spatial Analysis", icon: Eye, color: "from-purple-500 to-pink-500" },
  generation: { label: "Generation", icon: Paintbrush, color: "from-amber-500 to-orange-500" },
  qc: { label: "Quality Control", icon: ClipboardCheck, color: "from-emerald-500 to-teal-500" },
  orchestrator: { label: "Orchestrator", icon: Settings2, color: "from-slate-500 to-zinc-600" },
  system: { label: "System", icon: Zap, color: "from-gray-500 to-gray-600" },
};

const actionConfig: Record<ActionType, { icon: React.ElementType; bgColor: string; borderColor: string }> = {
  thinking: { icon: Brain, bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30" },
  analyzing: { icon: Search, bgColor: "bg-purple-500/10", borderColor: "border-purple-500/30" },
  generating: { icon: Sparkles, bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30" },
  evaluating: { icon: ClipboardCheck, bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/30" },
  searching: { icon: Eye, bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/30" },
  policy_update: { icon: Wand2, bgColor: "bg-violet-500/10", borderColor: "border-violet-500/30" },
  question: { icon: MessageSquare, bgColor: "bg-sky-500/10", borderColor: "border-sky-500/30" },
  success: { icon: CheckCircle2, bgColor: "bg-green-500/10", borderColor: "border-green-500/30" },
  error: { icon: AlertCircle, bgColor: "bg-red-500/10", borderColor: "border-red-500/30" },
};

const statusColors: Record<CardStatus, string> = {
  pending: "opacity-50",
  running: "",
  completed: "",
  error: "border-red-500/40",
  warning: "border-amber-500/40",
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
  const agentInfo = agentConfig[agent];
  const actionInfo = actionConfig[action];
  const AgentIcon = agentInfo.icon;
  const ActionIcon = actionInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "relative rounded-2xl border border-white/50 bg-white/30 backdrop-blur-xl overflow-hidden shadow-sm transition-all duration-300",
        "hover:bg-white/40 hover:border-white/60",
        actionInfo.borderColor,
        statusColors[status]
      )}
    >
      {/* Gradient accent bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", agentInfo.color)} />

      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            actionInfo.bgColor
          )}>
            <ActionIcon className="w-4 h-4 text-foreground/80" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <AgentIcon className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-xs font-medium text-muted-foreground/70">{agentInfo.label}</span>
            </div>
            <h3 className="text-sm font-medium text-foreground/90 mt-0.5">{title}</h3>
          </div>
        </div>
        
        {timestamp && (
          <span className="text-[10px] text-muted-foreground/50 font-mono">{timestamp}</span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-sm text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      </div>

      {/* Image preview if available */}
      {imageUrl && (
        <div className="px-4 pb-3">
          <div className="relative rounded-xl overflow-hidden border border-white/40 bg-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Generated"
              className="w-full h-auto max-h-48 object-cover"
            />
            <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm">
              <ImageIcon className="w-3.5 h-3.5 text-white/80" />
            </div>
          </div>
        </div>
      )}

      {/* Details section */}
      {details && Object.keys(details).length > 0 && (
        <div className="px-4 pb-3">
          <div className="rounded-xl bg-white/20 border border-white/30 p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(details).slice(0, 6).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-muted-foreground/50 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-foreground/70 font-medium truncate">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom children */}
      {children && <div className="px-4 pb-3">{children}</div>}

      {/* Loading indicator */}
      {status === "running" && (
        <div className="absolute bottom-3 right-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary flex items-center justify-center"
          >
            <Loader2 className="w-3 h-3 text-primary animate-pulse" />
          </motion.div>
        </div>
      )}

      {/* Success/Error badge */}
      {status === "completed" && (
        <div className="absolute bottom-3 right-3">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-green-600" />
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute bottom-3 right-3">
          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-3 h-3 text-red-600" />
          </div>
        </div>
      )}
    </motion.div>
  );
};

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
      className="rounded-2xl border border-white/50 bg-white/30 backdrop-blur-xl p-4"
    >
      <p className="text-sm font-medium text-foreground/90 mb-3">{question.question_text}</p>
      {question.multi_select && (
        <p className="text-xs text-muted-foreground/60 mb-3">Select all that apply</p>
      )}
      <div className="flex flex-wrap gap-2">
        {question.possible_answers.map((answer) => (
          <button
            key={answer.answer_id}
            onClick={() => handleSelect(answer.answer_id)}
            disabled={disabled}
            className={cn(
              "px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              "border border-white/50 hover:border-white/70",
              selected.includes(answer.answer_id)
                ? "bg-gradient-to-br from-primary/20 to-accent/20 border-primary/40 text-foreground"
                : "bg-white/30 text-muted-foreground/80 hover:bg-white/50",
              disabled && "opacity-50 cursor-not-allowed"
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
      className="rounded-2xl border border-white/50 bg-white/30 backdrop-blur-xl p-4"
    >
      <p className="text-sm font-medium text-foreground/80 mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {images.map((img, index) => (
          <div
            key={index}
            className="relative rounded-xl overflow-hidden border border-white/40 aspect-video bg-white/20"
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
    </motion.div>
  );
};
