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
  Loader2
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
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-black/[0.06]" />
        
        {/* Progress line */}
        <motion.div 
          className="absolute top-4 left-6 h-0.5 bg-gradient-to-r from-primary to-accent"
          initial={{ width: 0 }}
          animate={{ 
            width: `${(stages.findIndex(s => s.id === currentStage) / (stages.length - 1)) * 100}%` 
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{ maxWidth: "calc(100% - 3rem)" }}
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
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                  status === "completed" && "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-sm",
                  status === "active" && "bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/25",
                  status === "pending" && "bg-white border-2 border-black/[0.08] text-muted-foreground/40"
                )}
              >
                {status === "active" ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-4 h-4" />
                  </motion.div>
                ) : status === "completed" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </motion.div>
              
              <motion.span
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.2 }}
                className={cn(
                  "text-[10px] font-medium mt-2 text-center whitespace-nowrap",
                  status === "completed" && "text-emerald-600",
                  status === "active" && "text-primary font-semibold",
                  status === "pending" && "text-muted-foreground/50"
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
      <div className="flex-1 h-1 bg-black/[0.06] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>
      
      {/* Stage indicator */}
      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
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
        status === "completed" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
        status === "active" && "bg-primary/10 text-primary border border-primary/20",
        status === "pending" && "bg-black/[0.02] text-muted-foreground/50 border border-black/[0.06]"
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
