"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Eye, 
  Paintbrush, 
  ClipboardCheck,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw
} from "lucide-react";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

type PipelineStage = 
  | "requirements" 
  | "spatial" 
  | "generation" 
  | "qc" 
  | "complete";

type StageStatus = "pending" | "active" | "completed" | "error";

interface ProgressTimelineProps {
  currentStage: PipelineStage;
  className?: string;
}

const stages: { id: PipelineStage; label: string; icon: React.ElementType }[] = [
  { id: "requirements", label: "Requirements", icon: MessageSquare },
  { id: "spatial", label: "Analysis", icon: Eye },
  { id: "generation", label: "Generation", icon: Paintbrush },
  { id: "qc", label: "Quality Check", icon: ClipboardCheck },
  { id: "complete", label: "Complete", icon: CheckCircle2 },
];

function getStageStatus(stageId: PipelineStage, currentStage: PipelineStage): StageStatus {
  const stageOrder: PipelineStage[] = ["requirements", "spatial", "generation", "qc", "complete"];
  const currentIndex = stageOrder.indexOf(currentStage);
  const stageIndex = stageOrder.indexOf(stageId);
  
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "active";
  return "pending";
}

export function ProgressTimeline({ currentStage, className = "" }: ProgressTimelineProps) {
  const currentIndex = stages.findIndex(s => s.id === currentStage);
  const progressPercent = Math.round((currentIndex / (stages.length - 1)) * 100);
  
  return (
    <div 
      className={cn("w-full py-2", className)}
      role="progressbar"
      aria-valuenow={progressPercent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Pipeline progress: ${stages[currentIndex]?.label || 'Starting'}`}
    >
      <div className="flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-5 left-8 right-8 h-[2px] bg-gradient-to-r from-white/40 via-white/60 to-white/40 dark:from-white/10 dark:via-white/20 dark:to-white/10 rounded-full" />
        
        {/* Progress line with glow */}
        <motion.div 
          className="absolute top-5 left-8 h-[2px] bg-gradient-to-r from-primary via-accent to-primary rounded-full shadow-[0_0_10px_rgba(236,72,153,0.3)]"
          initial={{ width: 0 }}
          animate={{ 
            width: `${(stages.findIndex(s => s.id === currentStage) / (stages.length - 1)) * 100}%` 
          }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ maxWidth: "calc(100% - 4rem)" }}
        />
        
        {/* Stage indicators */}
        {stages.map((stage, index) => {
          const status = getStageStatus(stage.id, currentStage);
          const Icon = stage.icon;
          
          return (
            <div 
              key={stage.id}
              className="flex flex-col items-center relative z-10"
            >
              {/* Glow effect for active */}
              {status === "active" && (
                <motion.div
                  className="absolute top-0 w-10 h-10 rounded-full bg-primary/20 dark:bg-primary/30 blur-md"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.08, type: "spring", stiffness: 300 }}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative",
                  status === "completed" && "bg-gradient-to-br from-emerald-400 to-emerald-500 dark:from-emerald-500 dark:to-emerald-600 text-white shadow-md shadow-emerald-500/25 dark:shadow-emerald-500/40",
                  status === "active" && "bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30 dark:shadow-primary/50",
                  status === "pending" && "bg-white/70 dark:bg-zinc-900/60 border-2 border-white/40 dark:border-white/10 text-neutral-300 dark:text-zinc-600"
                )}
              >
                {status === "active" ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-4.5 h-4.5" />
                  </motion.div>
                ) : status === "completed" ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </motion.div>
              
              <motion.span
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 + 0.15 }}
                className={cn(
                  "text-[11px] font-medium mt-2.5 text-center whitespace-nowrap",
                  status === "completed" && "text-emerald-600 dark:text-emerald-400",
                  status === "active" && "text-primary dark:text-primary font-semibold",
                  status === "pending" && "text-neutral-400 dark:text-zinc-500"
                )}
              >
                {stage.label}
              </motion.span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Compact horizontal timeline for the header
interface CompactTimelineProps {
  currentStage: PipelineStage;
  className?: string;
}

export function CompactTimeline({ currentStage, className = "" }: CompactTimelineProps) {
  const stageIndex = stages.findIndex(s => s.id === currentStage);
  const progress = ((stageIndex + 1) / stages.length) * 100;
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Progress bar */}
      <div className="flex-1 h-1 bg-neutral-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>
      
      {/* Stage indicator */}
      <span className="text-[10px] font-medium text-neutral-500 dark:text-zinc-400 whitespace-nowrap">
        {stageIndex + 1}/{stages.length}
      </span>
    </div>
  );
}

// Stage pill badges
export function StageBadge({ stage, status }: { stage: PipelineStage; status: StageStatus }) {
  const stageInfo = stages.find(s => s.id === stage);
  if (!stageInfo) return null;
  
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium",
        status === "completed" && "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
        status === "active" && "bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 dark:border-primary/30",
        status === "pending" && "bg-neutral-100 dark:bg-zinc-800 text-neutral-400 dark:text-zinc-500 border border-neutral-200 dark:border-zinc-700"
      )}
    >
      {status === "active" ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : status === "completed" ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <Circle className="w-3 h-3" />
      )}
      {stageInfo.label}
    </motion.div>
  );
}
