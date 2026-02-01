"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { RotateCcw, ChevronRight, Sparkles, WifiOff, Zap } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { ContinuityLogo, ContinuityIcon } from "@/components/ui/continuity-logo";
import { AgentWorkCard, QuestionCard, ImageDisplayCard, type AgentWorkCardProps } from "@/components/ui/agent-work-card";
import { ResultsTimeline } from "@/components/ResultsTimeline";
import { IntelligencePanel, SelfImprovingBadge } from "@/components/IntelligencePanel";
import { SettingsDropdown } from "@/components/SettingsDropdown";
import { EvaluationDetails, type EvaluationResult } from "@/components/EvaluationDetails";
import { StepTimeline, StepSummary, type Step } from "@/components/StepTimeline";
import { StreamingChatMessage, ThinkingIndicator, LiveBadge, parseMarkdown } from "@/components/ui/streaming-text";
import { CompactTimeline } from "@/components/ui/progress-timeline";
import { ToastProvider } from "@/components/ui/toast";
import { AgentCardSkeleton } from "@/components/ui/skeleton";
import { ThemeToggle, useTheme } from "@/components/ThemeProvider";
import { GenerationProgress, PHASE_CONFIG, type PhaseProgress, type Phase } from "@/components/ui/generation-progress";
import { 
  createProject, 
  analyzeGoal, 
  submitAnswers,
  startOrchestration,
  getOrchestrationStatus,
  subscribeToOrchestration,
  submitOrchestrationClarification,
  getAgentReasoning,
  getIterations,
  getIterationEvaluation,
  uploadImages,
  getProjectGallery,
  type GalleryResponse,
  type GalleryAttempt,
  getBatchReport,
  type AnalyzeGoalResponse,
  type OrchestrationStatusResponse,
  type StreamEvent,
  type AgentReasoningResponse,
  type IterationResponse,
  type BatchReport,
} from "@/lib/api";
import { APP_CONFIG } from "@/lib/config";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

// Animation variants for consistent timing
const slideInLeft = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const slideInRight = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

// Spring transition for natural feel
const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

const smoothTransition = {
  duration: 0.4,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const resolveImagePath = (imagePath?: string | null) => {
  if (!imagePath) return "";
  if (imagePath.startsWith("http") || imagePath.startsWith("data:")) return imagePath;
  if (imagePath.startsWith("/")) return `${API_URL}${imagePath}`;
  return `${API_URL}/${imagePath}`;
};

const phaseLabelMap: Record<string, string> = {
  cleanup: "Cleanup",
  structural: "Structural",
  fixture: "Fixtures",
  style: "Style",
};

const criterionLabelMap: Record<string, string> = {
  constraint_compliance: "Constraint compliance",
  geometry_preservation: "Geometry preservation",
  hallucination_detection: "Hallucination check",
  style_execution: "Style execution",
  phase_completion: "Phase completion",
  goal_alignment: "Goal alignment",
};

const formatPolicyChange = (change: Record<string, unknown>) => {
  const type = String(change.type || "update");
  const oldValue = change.current || change.old;
  const newValue = change.proposed || change.new;
  if (type === "constraint_emphasis") {
    return `Constraint emphasis: ${oldValue || "medium"} → ${newValue || "high"}`;
  }
  if (type === "creativity_reduction") {
    return `Creativity: ${oldValue || "standard"} → ${newValue || "lower"}`;
  }
  if (type === "prompt_addition") {
    return `Added instruction: ${(change.addition as string) || (newValue as string) || "Extra guidance"}`;
  }
  if (type === "max_retries_increase") {
    return `Max retries: ${oldValue || "default"} → ${newValue || "higher"}`;
  }
  return `${type.replace(/_/g, " ")}: ${oldValue ?? "before"} → ${newValue ?? "after"}`;
};

const buildScoreChartPoints = (scores: number[]): string => {
  if (scores.length === 0) return "";
  const width = 100;
  const height = 40;
  const step = scores.length > 1 ? width / (scores.length - 1) : width;
  return scores
    .map((score, index) => {
      const x = index * step;
      const y = height - Math.max(0, Math.min(score, 1)) * height;
      return `${x},${y}`;
    })
    .join(" ");
};

type AppState = "welcome" | "active";

interface AgentCard extends Omit<AgentWorkCardProps, 'id'> {
  id: string;
  reasoning?: string;
}

interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  images?: string[];
  isStreaming?: boolean;
  isNew?: boolean;
}

interface GallerySelection {
  phase: string;
  phaseLabel: string;
  attempt: GalleryAttempt;
}

export default function ContinuityApp() {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [agentCards, setAgentCards] = useState<AgentCard[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [questions, setQuestions] = useState<AnalyzeGoalResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [orchestrationStatus, setOrchestrationStatus] = useState<OrchestrationStatusResponse | null>(null);
  const [batchReport, setBatchReport] = useState<BatchReport | null>(null);
  const [batchReportError, setBatchReportError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<{ agent: string; action: string } | null>(null);
  const [weaveTraceUrl, setWeaveTraceUrl] = useState<string | null>(null);
  const [generatedPhases, setGeneratedPhases] = useState<Array<{
    phase: string;
    imagePath: string;
    iterationId?: string;
    evaluationPassed?: boolean | null;
    evaluationScore?: number | null;
    iterationNumber?: number;
    weaveTraceId?: string;
  }>>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryData, setGalleryData] = useState<GalleryResponse | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [gallerySelected, setGallerySelected] = useState<GallerySelection | null>(null);
  const [transformationComplete, setTransformationComplete] = useState(false);
  const [selfImprovementRetries, setSelfImprovementRetries] = useState<Array<{
    phase: string;
    attemptNumber: number;
    failureReason: string;
    policyChanges: Array<{ field: string; oldValue: string | number; newValue: string | number; reason: string }>;
    improved: boolean;
    weaveTraceId?: string;
  }>>([]);
  
  // Agent upgrade events for the "Agent Upgrading Agent" visualization
  const [agentUpgradeEvents, setAgentUpgradeEvents] = useState<Array<{
    id: string;
    timestamp: string;
    sourceAgent: "qc" | "orchestrator";
    targetAgent: "generation" | "spatial" | "requirements";
    trigger: "evaluation_failure" | "cross_scene_learning" | "pattern_detection";
    evaluationScore?: number;
    failureReasons?: string[];
    policyChanges: Array<{ type: string; oldValue?: string | number; newValue?: string | number; rationale: string }>;
    weaveTraces?: Array<{ traceId: string; url: string; operation: string; duration_ms?: number; status: "success" | "error" }>;
    improved: boolean;
    retryNumber?: number;
  }>>([]);
  
  // Live reasoning steps
  const [reasoningSteps, setReasoningSteps] = useState<Array<{
    id: string;
    timestamp: string;
    agent: string;
    thought: string;
    action?: string;
    observation?: string;
    toolCalls?: Array<{
      id: string;
      timestamp: string;
      toolName: string;
      toolType: "weave" | "browserbase" | "gemini" | "database" | "internal";
      input?: Record<string, unknown>;
      output?: string;
      status: "running" | "success" | "error";
      duration_ms?: number;
    }>;
  }>>([]);

  // Pipeline steps for timeline visualization
  const [pipelineSteps, setPipelineSteps] = useState<Step[]>([]);
  
  // Evaluation results for all iterations
  const [evaluationResults, setEvaluationResults] = useState<EvaluationResult[]>([]);
  
  // Detailed generation phase progress for demo visibility
  const [generationPhaseProgress, setGenerationPhaseProgress] = useState<PhaseProgress[]>([
    { phase: "cleanup", status: "pending" },
    { phase: "structural", status: "pending" },
    { phase: "fixture", status: "pending" },
    { phase: "style", status: "pending" },
  ]);
  const [currentGenerationPhaseIndex, setCurrentGenerationPhaseIndex] = useState(-1);
  const [isGenerationRunning, setIsGenerationRunning] = useState(false);
  
  const cardsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const messageCounterRef = useRef(0);
  const projectIdRef = useRef<string | null>(null);  // Ref to avoid stale closures
  const lastScoreByPhaseRef = useRef<Record<string, number | null>>({});
  const lastAttemptByPhaseRef = useRef<Record<string, number>>({});
  
  // Keep ref in sync with state
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const getMessageId = useCallback(() => {
    messageCounterRef.current += 1;
    // Use a more unique ID combining timestamp, counter, and random string
    const randomPart = Math.random().toString(36).substring(2, 11);
    return `msg-${Date.now()}-${messageCounterRef.current}-${randomPart}`;
  }, []);

  // Auto-scroll to latest card with slight delay for animation
  useEffect(() => {
    const timer = setTimeout(() => {
      cardsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
    return () => clearTimeout(timer);
  }, [agentCards]);

  // Auto-scroll chat
  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
    return () => clearTimeout(timer);
  }, [chatMessages]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const addAgentCard = useCallback((card: Omit<AgentCard, 'id'>) => {
    const newCard = { ...card, id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
    setAgentCards(prev => [...prev, newCard]);
    return newCard.id;
  }, []);

  const updateAgentCard = useCallback((id: string, updates: Partial<AgentCard>) => {
    setAgentCards(prev => prev.map(card => 
      card.id === id ? { ...card, ...updates } : card
    ));
  }, []);

  const addChatMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage = {
      ...message,
      id: getMessageId(),
      timestamp: new Date().toLocaleTimeString(),
      isNew: true,
    };
    setChatMessages(prev => [...prev, newMessage]);
    // Mark as not new after animation
    setTimeout(() => {
      setChatMessages(prev => prev.map(m => 
        m.id === newMessage.id ? { ...m, isNew: false } : m
      ));
    }, 2000);
    return newMessage.id;
  }, [getMessageId]);

  const loadGalleryData = useCallback(async () => {
    if (!projectIdRef.current) {
      setGalleryError("No project found yet. Run a generation first.");
      setGalleryData(null);
      return;
    }
    setGalleryLoading(true);
    setGalleryError(null);
    try {
      const data = await getProjectGallery(projectIdRef.current);
      setGalleryData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load gallery";
      setGalleryError(message);
      setGalleryData(null);
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  const openGallery = useCallback(async () => {
    setIsGalleryOpen(true);
    setGallerySelected(null);
    await loadGalleryData();
  }, [loadGalleryData]);

  useEffect(() => {
    if (!isGalleryOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGalleryOpen(false);
        setGallerySelected(null);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isGalleryOpen]);

  // Handle streaming events from SSE
  const handleStreamEvent = useCallback((event: StreamEvent) => {
    setIsConnected(true);
    
    // Capture Weave trace URL from any event that includes it
    const eventWeaveUrl = event.details?.weave_trace_url || event.details?.weave_url;
    if (eventWeaveUrl && typeof eventWeaveUrl === "string") {
      setWeaveTraceUrl(eventWeaveUrl);
    }
    
    // CRITICAL FIX: Update orchestrationStatus from SSE events for stepper progression
    // Extract state/phase from event details to keep status in sync
    if (event.details) {
      const toState = event.details.to_state as string | undefined;
      const phase = event.details.phase as string | undefined;
      const currentState = event.details.state as string | undefined;
      
      if (toState || phase || currentState) {
        const currentProjectId = projectIdRef.current || projectId || "";
        setOrchestrationStatus(prev => {
          // Safe defaults for null prev
          const defaults: OrchestrationStatusResponse = {
            project_id: currentProjectId,
            state: "idle",
            status: "running",
            current_phase: null,
            retry_count: 0,
            has_warnings: false,
            warning_details: null,
            started_at: null,
            completed_at: null,
            recent_transitions: [],
          };
          const base = prev || defaults;
          return {
            ...base,
            project_id: base.project_id || currentProjectId,
            state: toState || currentState || base.state,
            status: base.status,
            current_phase: phase || (toState?.includes("generating_") ? toState.replace("generating_", "") : 
                           toState?.includes("evaluating_") ? toState.replace("evaluating_", "") :
                           toState?.includes("retrying_") ? toState.replace("retrying_", "") :
                           base.current_phase),
            retry_count: (event.details.retry_number as number) || base.retry_count,
            has_warnings: (event.details.has_warnings as boolean) || base.has_warnings,
            warning_details: base.warning_details,
            started_at: base.started_at,
            completed_at: base.completed_at,
            recent_transitions: base.recent_transitions,
          };
        });
      }
      
      // UPDATE DETAILED GENERATION PHASE PROGRESS
      // This powers the detailed generation progress component for demo visibility
      if (toState) {
        const phaseOrder: Phase[] = ["cleanup", "structural", "fixture", "style"];
        
        // Detect which phase and what status
        let detectedPhase: Phase | null = null;
        let phaseStatus: PhaseProgress["status"] = "pending";
        
        if (toState.includes("generating_")) {
          const phaseName = toState.replace("generating_", "") as Phase;
          if (phaseOrder.includes(phaseName)) {
            detectedPhase = phaseName;
            phaseStatus = "running";
            setIsGenerationRunning(true);
          }
        } else if (toState.includes("evaluating_")) {
          const phaseName = toState.replace("evaluating_", "") as Phase;
          if (phaseOrder.includes(phaseName)) {
            detectedPhase = phaseName;
            phaseStatus = "evaluating";
          }
        } else if (toState.includes("retrying_")) {
          const phaseName = toState.replace("retrying_", "") as Phase;
          if (phaseOrder.includes(phaseName)) {
            detectedPhase = phaseName;
            phaseStatus = "retrying";
          }
        } else if (toState === "completed" || toState === "completed_with_warnings") {
          // All phases complete
          setIsGenerationRunning(false);
          setGenerationPhaseProgress(prev => 
            prev.map(p => ({ ...p, status: "completed" as const }))
          );
        }
        
        // Update the phase progress
        if (detectedPhase) {
          const phaseIndex = phaseOrder.indexOf(detectedPhase);
          setCurrentGenerationPhaseIndex(phaseIndex);
          
          setGenerationPhaseProgress(prev => {
            const updated = [...prev];
            
            // Mark all previous phases as completed
            for (let i = 0; i < phaseIndex; i++) {
              if (updated[i].status !== "completed") {
                updated[i] = { 
                  ...updated[i], 
                  status: "completed",
                  completedAt: new Date(),
                };
              }
            }
            
            // Update current phase
            updated[phaseIndex] = {
              ...updated[phaseIndex],
              status: phaseStatus,
              startedAt: updated[phaseIndex].startedAt || new Date(),
              currentStep: phaseStatus === "running" ? 0 : 
                          phaseStatus === "evaluating" ? 3 :
                          updated[phaseIndex].currentStep,
              stepMessage: phaseStatus === "running" 
                ? `Constructing prompt with spatial constraints...`
                : phaseStatus === "evaluating"
                  ? `Checking quality criteria...`
                  : phaseStatus === "retrying"
                    ? `Analyzing failure and adjusting policy...`
                    : updated[phaseIndex].stepMessage,
              retryNumber: event.details?.retry_number as number | undefined,
              evaluationScore: event.details?.score as number | undefined,
              evaluationPassed: event.details?.evaluation_passed as boolean | undefined,
              outputPath: (event.details?.output_path || event.details?.output_image) as string | undefined,
            };
            
            return updated;
          });
        }
        
        // Handle evaluation results updating phase progress
        if (event.details?.evaluation_passed !== undefined && event.details?.phase) {
          const evalPhase = event.details.phase as Phase;
          if (phaseOrder.includes(evalPhase)) {
            setGenerationPhaseProgress(prev => {
              const updated = [...prev];
              const idx = phaseOrder.indexOf(evalPhase);
              if (idx >= 0) {
                const passed = event.details?.evaluation_passed as boolean;
                updated[idx] = {
                  ...updated[idx],
                  status: passed ? "completed" : "retrying",
                  evaluationScore: event.details?.score as number | undefined,
                  evaluationPassed: passed,
                  completedAt: passed ? new Date() : undefined,
                };
              }
              return updated;
            });
          }
        }
      }
    }
    
    switch (event.event) {
      case "agent":
      case "thinking":
        // Update current thinking state
        if (event.agent && event.action) {
          setCurrentThinking({ agent: event.agent, action: event.action });
        }
        
        // Improvement journey chat messages (attempts, evaluation, policy updates)
        const toState = event.details?.to_state as string | undefined;
        const derivedPhase = toState?.includes("generating_")
          ? toState.replace("generating_", "")
          : toState?.includes("evaluating_")
            ? toState.replace("evaluating_", "")
            : toState?.includes("retrying_")
              ? toState.replace("retrying_", "")
              : (event.details?.phase as string | undefined);
        const phaseKey = derivedPhase || "phase";
        const phaseLabel = phaseLabelMap[phaseKey] || phaseKey;

        if (toState && event.agent) {
          if (toState.includes("analyzing_space")) {
            addChatMessage({
              type: "assistant",
              content: "🔍 **Spatial Analysis Starting** — analyzing geometry, detecting fixtures, and locking constraints...",
            });
          }

          if (toState.includes("generating_") && !event.details?.evaluation_passed) {
            const retryNumber = event.details?.retry_number as number | undefined;
            const attemptFromEvent = event.details?.attempt as number | undefined;
            const attemptNumber = attemptFromEvent ?? (retryNumber ? retryNumber + 1 : (lastAttemptByPhaseRef.current[phaseKey] || 0) + 1);
            lastAttemptByPhaseRef.current[phaseKey] = attemptNumber;

            const changes = (event.details?.policy_changes || event.details?.changes_applied) as Array<Record<string, unknown>> | undefined;
            if (changes && changes.length > 0) {
              const changeLines = changes.map((change) => `• ${formatPolicyChange(change)}`).join("\n");
              addChatMessage({
                type: "assistant",
                content: `🔧 **Improving Approach**\n\nBased on the evaluation, I'm adjusting:\n${changeLines}\n\nRetrying ${phaseLabel} phase...`,
              });
            } else if (attemptNumber > 1) {
              addChatMessage({
                type: "assistant",
                content: `🔧 **Improving Approach**\n\nRefining strategy based on QC feedback.\n\nRetrying ${phaseLabel} phase...`,
              });
            }

            addChatMessage({
              type: "assistant",
              content: `🎨 **Generating ${phaseLabel}**${attemptNumber > 1 ? ` (Attempt ${attemptNumber})` : ""}...`,
            });
          }

          if (toState.includes("evaluating_")) {
            const outputPath = (event.details?.output_path || event.details?.output_image) as string | undefined;
            addChatMessage({
              type: "assistant",
              content: `🧪 **Evaluating ${phaseLabel}** — checking constraints, geometry, hallucinations, style, and completeness...`,
              images: outputPath ? [resolveImagePath(outputPath)] : undefined,
            });
          }

          if (toState.includes("retrying_")) {
            const score = event.details?.score as number | undefined;
            const prevScore = lastScoreByPhaseRef.current[phaseKey];
            const delta = score !== undefined && prevScore !== null && prevScore !== undefined ? score - prevScore : null;
            const deltaLabel = delta !== null ? `${delta >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(delta * 100))}%` : "";
            const momentum = delta !== null && delta > 0 ? "\n\nGetting closer!" : "";

            const failureDetails = event.details?.failure_details as Array<{ criterion?: string; details?: string }>;
            const failureReasons = event.details?.failure_reasons as string[] | undefined;
            const reasons = (failureDetails && failureDetails.length > 0)
              ? failureDetails.map((detail) => {
                  const label = detail.criterion ? (criterionLabelMap[detail.criterion] || detail.criterion) : "Issue";
                  return `• ${label}: ${detail.details || "Below threshold"}`;
                })
              : (failureReasons && failureReasons.length > 0)
                ? failureReasons.map((reason) => `• ${criterionLabelMap[reason] || reason}`)
                : [`• ${event.details?.human_readable_reason || "Quality check below threshold"}`];

            addChatMessage({
              type: "assistant",
              content: `⚠️ **Quality Check Failed**${score !== undefined ? ` (Score: ${Math.round(score * 100)}%${deltaLabel ? ` ${deltaLabel}` : ""})` : ""}\n\nThe ${phaseLabel} output has an issue:\n${reasons.join("\n")}\n\nAnalyzing what went wrong...${momentum}`,
              images: event.details?.output_path ? [resolveImagePath(event.details.output_path as string)] : undefined,
            });

            if (score !== undefined) {
              lastScoreByPhaseRef.current[phaseKey] = score;
            }
          }
        }

        if (event.details?.evaluation_passed === true) {
          const score = event.details?.score as number | undefined;
          const prevScore = lastScoreByPhaseRef.current[phaseKey];
          const delta = score !== undefined && prevScore !== null && prevScore !== undefined ? score - prevScore : null;
          const deltaLabel = delta !== null ? `${delta >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(delta * 100))}%` : "";
          const passedCriteria = event.details?.passed_criteria as number | undefined;
          const totalCriteria = event.details?.total_criteria as number | undefined;
          const criteriaSummary = passedCriteria !== undefined && totalCriteria !== undefined
            ? `• ${passedCriteria}/${totalCriteria} criteria passed`
            : "• All checks passed";
          const nextPhase = event.details?.to_phase as string | undefined;
          const nextPhaseLabel = nextPhase ? (phaseLabelMap[nextPhase] || nextPhase) : null;

          addChatMessage({
            type: "assistant",
            content: `✅ **Quality Check Passed**${score !== undefined ? ` (Score: ${Math.round(score * 100)}%${deltaLabel ? ` ${deltaLabel}` : ""})` : ""}\n\n${criteriaSummary}\n\n${nextPhaseLabel ? `Moving to ${nextPhaseLabel} phase...` : "Moving forward..."}`,
            images: event.details?.output_path ? [resolveImagePath(event.details.output_path as string)] : undefined,
          });

          if (score !== undefined) {
            lastScoreByPhaseRef.current[phaseKey] = score;
          }
        }
        
        // Add to pipeline steps timeline
        if (event.agent) {
          const stepAgent = event.agent as Step["agent"];
          const stepStatus: Step["status"] = event.details?.to_state?.includes("completed") 
            ? "completed" 
            : event.details?.to_state?.includes("failed") 
              ? "failed" 
              : "running";
          
          setPipelineSteps(prev => {
            // Check if step already exists
            const existingIdx = prev.findIndex(s => 
              s.details?.to_state === event.details?.to_state
            );
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = {
                ...updated[existingIdx],
                status: stepStatus,
                duration_ms: event.details?.duration_ms as number | undefined,
              };
              return updated;
            }
            
            return [...prev, {
              id: `step-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: event.details?.to_state?.includes("generat") ? "generation" 
                  : event.details?.to_state?.includes("evaluat") ? "evaluation"
                  : "transition",
              agent: stepAgent,
              status: stepStatus,
              title: event.message || getAgentTitle(event.agent, event.action || ""),
              description: getAgentDescription(event.agent, event.action || ""),
              timestamp: event.timestamp,
              duration_ms: event.details?.duration_ms as number | undefined,
              details: event.details,
              weaveTraceId: event.details?.weave_trace_id as string | undefined,
              phase: event.details?.phase as string | undefined,
              iterationNumber: event.details?.iteration_number as number | undefined,
              imagePath: (event.details?.output_path || event.details?.output_image) as string | undefined,
              evaluationScore: event.details?.score as number | undefined,
              evaluationPassed: event.details?.evaluation_passed as boolean | undefined,
              failureReasons: event.details?.failure_reasons as string[] | undefined,
            }];
          });
        }
        
        // Add to live reasoning steps for the reasoning panel
        if (event.agent && event.message) {
          setReasoningSteps(prev => [...prev.slice(-50), { // Keep last 50 steps
            id: `step-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp: new Date(event.timestamp).toLocaleTimeString(),
            agent: event.agent || "orchestrator",
            thought: event.message,
            action: event.action,
            observation: event.details?.observation as string | undefined,
            toolCalls: event.details?.tool_calls ? (event.details.tool_calls as Array<{
              id: string;
              timestamp: string;
              toolName: string;
              toolType: "weave" | "browserbase" | "gemini" | "database" | "internal";
              input?: Record<string, unknown>;
              output?: string;
              status: "running" | "success" | "error";
              duration_ms?: number;
            }>) : undefined,
          }]);
        }
        
        // Determine if this is a retry/self-improvement event
        const isRetry = event.details?.to_state?.includes("retrying") || 
                        event.action?.includes("retry") ||
                        event.details?.retry_number;
        const isPolicyUpdate = event.action?.includes("policy") || 
                               event.details?.policy_version;
        const isEvaluating = event.action?.includes("evaluating") ||
                             event.details?.to_state?.includes("evaluating");
        
        // Add or update agent card based on state
        setAgentCards(prev => {
          const cardExists = prev.some(c => 
            c.details?.to_state === event.details?.to_state
          );
          
          if (!cardExists && event.agent) {
            // Build detailed content based on event type
            let content = getAgentDescription(event.agent, event.action || "");
            let action = mapActionToCardAction(event.action || "");
            let status: "running" | "pending" | "completed" | "error" | "warning" = "running";
            
            // Handle retry events specially
            if (isRetry) {
              content = `Self-improvement triggered. Retry #${event.details?.retry_number || 1} - analyzing failure and adjusting approach...`;
              action = "policy_update";
              status = "warning";
              
              // Track retry for ImprovementStory
              const retryPhase = event.details?.phase || event.action?.split("_")[0] || "generation";
              const policyChanges = (event.details?.changes_applied || []).map((c: Record<string, unknown>) => ({
                field: String(c.type || "parameter"),
                oldValue: c.current || c.old || "default",
                newValue: c.proposed || c.new || "improved",
                reason: String(c.rationale || c.reason || "Optimization based on failure analysis"),
              }));
              
              setSelfImprovementRetries(prev => [...prev, {
                phase: retryPhase,
                attemptNumber: event.details?.retry_number || prev.length + 2,
                failureReason: event.details?.failure_reason || event.message || "Quality check did not meet threshold",
                policyChanges,
                improved: false,
              }]);
              
              // Also add to AgentUpgradingAgent events
              setAgentUpgradeEvents(prev => [...prev, {
                id: `upgrade-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: new Date(event.timestamp).toLocaleTimeString(),
                sourceAgent: "qc",
                targetAgent: "generation",
                trigger: "evaluation_failure",
                evaluationScore: event.details?.score as number | undefined,
                failureReasons: event.details?.failure_reasons as string[] || [event.details?.failure_reason as string || "Quality threshold not met"],
                policyChanges: policyChanges.map(pc => ({
                  type: pc.field,
                  oldValue: pc.oldValue,
                  newValue: pc.newValue,
                  rationale: pc.reason,
                })),
                weaveTraces: weaveTraceUrl ? [{
                  traceId: `trace-${Date.now()}`,
                  url: weaveTraceUrl,
                  operation: `${retryPhase}_evaluation`,
                  status: "success" as const,
                }] : undefined,
                improved: false,
                retryNumber: event.details?.retry_number as number || 1,
              }]);
            }
            
            // Handle policy update events
            if (isPolicyUpdate && event.details?.changes_applied) {
              content = `Applying ${event.details.changes_applied?.length || 0} policy changes to improve results...`;
            }
            
            // Handle evaluation events
            if (isEvaluating) {
              content = `Quality control checking output against 5 criteria: constraints, geometry, hallucinations, style, and completeness...`;
            }
            
            return [...prev, {
              id: `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              agent: event.agent as AgentCard["agent"],
              title: event.message || getAgentTitle(event.agent, event.action || ""),
              content,
              status,
              action,
              timestamp: new Date(event.timestamp).toLocaleTimeString(),
              details: {
                ...event.details,
                // Enhance details display
                ...(isRetry && { 
                  trigger: "QC failure",
                  retry_number: event.details?.retry_number || 1,
                }),
                ...(event.details?.score && {
                  score: `${(event.details.score * 100).toFixed(0)}%`,
                }),
              },
            }];
          }
          return prev;
        });
        break;
      
      // Handle scene events for batch processing
      case "scene_start":
        addAgentCard({
          agent: "orchestrator",
          title: `Scene ${event.details?.scene_index + 1} Started`,
          content: `Processing image ${event.details?.scene_index + 1} of ${event.details?.total_scenes}...`,
          status: "running",
          action: "analyzing",
          timestamp: new Date(event.timestamp).toLocaleTimeString(),
          details: event.details,
        });
        break;
        
      case "scene_complete":
        // Mark previous scene card as complete and add completion card
        setAgentCards(prev => {
          const updated = [...prev];
          // Find and update the scene start card
          const sceneCardIdx = updated.findIndex(c => 
            c.details?.scene_id === event.details?.scene_id && c.status === "running"
          );
          if (sceneCardIdx >= 0) {
            updated[sceneCardIdx] = {
              ...updated[sceneCardIdx],
              status: "completed",
              content: `Scene ${event.details?.scene_index + 1} completed successfully!`,
            };
          }
          return updated;
        });
        // FIX: Handle both output_path and output_image from backend
        const sceneOutputPath = event.details?.output_path || event.details?.output_image;
        if (sceneOutputPath) {
          setGeneratedPhases(prev => {
            const exists = prev.some(p => p.imagePath === sceneOutputPath);
            if (exists) return prev;
            return [...prev, {
              phase: `Scene ${(event.details?.scene_index || 0) + 1}`,
              imagePath: sceneOutputPath as string,
              evaluationPassed: true,
              iterationNumber: 1,
            }];
          });
        }
        break;
        
      // Handle learning/self-improvement events
      case "learning":
        addAgentCard({
          agent: "qc",
          title: "Self-Improvement Applied",
          content: event.message || "Policy improved - future generations will benefit from this learning.",
          status: "completed",
          action: "policy_update",
          timestamp: new Date(event.timestamp).toLocaleTimeString(),
          details: {
            ...event.details,
            learning_type: "cross_scene",
            benefiting_scenes: event.details?.benefiting_scenes,
          },
        });
        addChatMessage({
          type: "assistant",
          content: `🧠 Self-improvement: ${event.message}`,
        });
        // Mark the last retry as improved
        setSelfImprovementRetries(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], improved: true };
          return updated;
        });
        // Also mark last agent upgrade event as improved
        setAgentUpgradeEvents(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], improved: true };
          return updated;
        });
        break;
        
      case "batch_progress":
        // Update progress silently, don't add card
        setOrchestrationStatus(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            completed_scenes: event.details?.completed as number | undefined,
            total_scenes: event.details?.total as number | undefined,
          };
        });
        break;
        
      case "progress":
        // CRITICAL: Update orchestrationStatus from progress events (especially initial state)
        if (event.details?.state) {
          const progressState = event.details.state as string;
          const currentProjectId = projectIdRef.current || projectId || "";
          console.log("Progress event - updating orchestrationStatus state to:", progressState);
          setOrchestrationStatus(prev => {
            const defaults: OrchestrationStatusResponse = {
              project_id: currentProjectId,
              state: "idle",
              status: "running",
              current_phase: null,
              retry_count: 0,
              has_warnings: false,
              warning_details: null,
              started_at: null,
              completed_at: null,
              recent_transitions: [],
            };
            const base = prev || defaults;
            return {
              ...base,
              project_id: base.project_id || currentProjectId,
              state: progressState,
              status: progressState === "completed" || progressState === "completed_with_warnings" ? "completed" : base.status,
              current_phase: (event.details?.phase as string) || base.current_phase,
              retry_count: base.retry_count,
              has_warnings: (event.details?.has_warnings as boolean) || base.has_warnings,
              warning_details: base.warning_details,
              started_at: base.started_at,
              completed_at: progressState === "completed" || progressState === "completed_with_warnings" 
                ? new Date().toISOString() 
                : base.completed_at,
              recent_transitions: base.recent_transitions,
            };
          });
          
          // If already completed on initial connect, trigger iteration fetch and transformation complete
          if (progressState === "completed" || progressState === "completed_with_warnings") {
            setTransformationComplete(true);
            const currentProjectId = projectIdRef.current || projectId;
            if (currentProjectId) {
              console.log("Initial progress shows completed - fetching iterations for:", currentProjectId);
              fetchIterations(currentProjectId);
            }
          }
        }
        
        // Add assistant message for progress updates
        if (event.message && !event.message.includes("heartbeat")) {
          addChatMessage({
            type: "assistant",
            content: event.message,
          });
        }
        // FIX: Handle both output_path and output_image from backend
        const progressOutputPath = event.details?.output_path || event.details?.output_image;
        const progressPhase = event.details?.phase || event.details?.current_phase;
        if (progressOutputPath && progressPhase) {
          setGeneratedPhases(prev => {
            // Avoid duplicates
            const exists = prev.some(p => p.imagePath === progressOutputPath);
            if (exists) return prev;
            return [...prev, {
              phase: progressPhase as string,
              imagePath: progressOutputPath as string,
              iterationId: event.details?.iteration_id as string | undefined,
              evaluationPassed: event.details?.evaluation_passed as boolean | undefined,
              evaluationScore: event.details?.evaluation_score as number | undefined,
              iterationNumber: (event.details?.iteration_number as number) || 1,
            }];
          });
        }
        break;
        
      case "question":
        setCurrentThinking(null);
        if (streamCleanupRef.current) {
          streamCleanupRef.current();
          streamCleanupRef.current = null;
        }
        addChatMessage({
          type: "assistant",
          content: "I need some clarification to proceed. Please answer the questions below.",
        });
        break;
        
      case "error":
      case "scene_error":
        setCurrentThinking(null);
        setError(event.message);
        if (event.event === "error" && streamCleanupRef.current) {
          streamCleanupRef.current();
          streamCleanupRef.current = null;
        }
        addAgentCard({
          agent: event.agent as AgentCard["agent"] || "orchestrator",
          title: event.event === "scene_error" ? `Scene ${event.details?.scene_index + 1} Failed` : "Error",
          content: event.message,
          status: "error",
          action: "error",
          timestamp: new Date(event.timestamp).toLocaleTimeString(),
          details: event.details,
        });
        addChatMessage({
          type: "system",
          content: `Error: ${event.message}`,
        });
        break;
        
      case "complete":
        setCurrentThinking(null);
        setTransformationComplete(true);
        if (streamCleanupRef.current) {
          streamCleanupRef.current();
          streamCleanupRef.current = null;
        }
        // Stop any polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        
        // FIX: Update orchestrationStatus to completed state for stepper
        setOrchestrationStatus(prev => {
          const currentProjectId = projectIdRef.current || projectId || "";
          const defaults: OrchestrationStatusResponse = {
            project_id: currentProjectId,
            state: "idle",
            status: "running",
            current_phase: null,
            retry_count: 0,
            has_warnings: false,
            warning_details: null,
            started_at: null,
            completed_at: null,
            recent_transitions: [],
          };
          const base = prev || defaults;
          return {
            ...base,
            project_id: base.project_id || currentProjectId,
            state: event.details?.has_warnings ? "completed_with_warnings" : "completed",
            status: "completed",
            current_phase: "complete",
            retry_count: base.retry_count,
            has_warnings: (event.details?.has_warnings as boolean) || false,
            warning_details: (event.details?.warning_details as Array<Record<string, unknown>>) || null,
            started_at: base.started_at,
            completed_at: new Date().toISOString(),
            recent_transitions: base.recent_transitions,
          };
        });
        
        // Mark all running agent cards as completed
        setAgentCards(prev => {
          return prev.map(card => 
            card.status === "running" ? { ...card, status: "completed" as const } : card
          );
        });
        addChatMessage({
          type: "assistant",
          content: event.details?.has_warnings 
            ? "Transformation complete with some minor adjustments. Check the results below!"
            : "Your visualization is ready! Check out the transformation timeline below.",
        });
        // Fetch all iterations to display in timeline - this is critical for showing results
        // Use ref to avoid stale closure - projectId state may not be up to date
        const currentProjectId = projectIdRef.current || projectId;
        if (currentProjectId) {
          console.log("Fetching iterations for project:", currentProjectId);
          fetchIterations(currentProjectId);
        } else {
          console.warn("No projectId available to fetch iterations!");
        }
        break;
        
      case "heartbeat":
        // Just update connection status
        setIsConnected(true);
        break;
    }
  }, [addChatMessage, addAgentCard]);

  // Helper functions for streaming
  const getAgentDescription = (agent: string, action: string): string => {
    const descriptions: Record<string, Record<string, string>> = {
      requirements: {
        analyzing: "Parsing your design goals and extracting structured requirements...",
        question: "Need additional information to understand your preferences...",
        skip: "Requirements already available from previous analysis.",
        default: "Processing requirements specification...",
      },
      spatial: {
        analyzing: "Examining images to identify physical constraints, fixtures, and boundaries...",
        skip: "Skipping - spatial data already analyzed.",
        default: "Analyzing spatial layout...",
      },
      generation: {
        generating_cleanup: "Removing visual noise and preparing the base image...",
        generating_structural: "Adding structural elements while respecting constraints...",
        generating_fixture: "Placing fixtures and furniture according to specifications...",
        generating_style: "Applying style and aesthetic transformations...",
        retrying_cleanup: "Re-generating cleanup phase with improved policy settings...",
        retrying_structural: "Re-generating structural phase with adjusted constraints...",
        retrying_fixture: "Re-generating fixtures with enhanced constraint emphasis...",
        retrying_style: "Re-generating style with modified creative parameters...",
        default: "Generating visualization...",
      },
      qc: {
        evaluating: "Checking output against quality criteria and constraints...",
        evaluating_cleanup: "Evaluating cleanup phase: checking debris removal and image clarity...",
        evaluating_structural: "Evaluating structural phase: verifying wall/floor completion and geometry...",
        evaluating_fixture: "Evaluating fixtures: checking placement accuracy and constraint compliance...",
        evaluating_style: "Evaluating style: assessing aesthetic match and visual quality...",
        policy_update: "Analyzing failure patterns and adjusting generation policy...",
        cross_scene_improvement: "Learning from this scene to improve future generations...",
        failure_analysis: "Identifying what went wrong and recommending specific fixes...",
        default: "Evaluating quality...",
      },
      orchestrator: {
        starting: "Initializing the multi-agent pipeline...",
        scene_processing: "Coordinating agents for current scene...",
        batch_update: "Updating batch processing progress...",
        success: "All phases completed successfully!",
        error: "An error occurred during processing.",
        default: "Coordinating agent workflow...",
      },
    };
    
    return descriptions[agent]?.[action] || descriptions[agent]?.default || "Processing...";
  };

  const getAgentTitle = (agent: string, action: string): string => {
    const titles: Record<string, Record<string, string>> = {
      requirements: {
        analyzing: "Analyzing Requirements",
        question: "Awaiting Clarification",
        skip: "Requirements Ready",
        default: "Requirements Agent",
      },
      spatial: {
        analyzing: "Spatial Analysis",
        skip: "Spatial Data Ready",
        default: "Analyzing Space",
      },
      generation: {
        generating_cleanup: "Cleanup Phase",
        generating_structural: "Structural Phase",
        generating_fixture: "Fixture Phase",
        generating_style: "Style Phase",
        retrying_cleanup: "Retrying Cleanup",
        retrying_structural: "Retrying Structural",
        retrying_fixture: "Retrying Fixtures",
        retrying_style: "Retrying Style",
        default: "Generating",
      },
      qc: {
        evaluating: "Quality Check",
        evaluating_cleanup: "Evaluating Cleanup",
        evaluating_structural: "Evaluating Structure",
        evaluating_fixture: "Evaluating Fixtures",
        evaluating_style: "Evaluating Style",
        policy_update: "Self-Improvement",
        cross_scene_improvement: "Cross-Scene Learning",
        failure_analysis: "Analyzing Failure",
        default: "Quality Control",
      },
      orchestrator: {
        starting: "Initializing Pipeline",
        scene_processing: "Processing Scene",
        batch_update: "Batch Progress",
        success: "Complete",
        error: "Error",
        default: "Orchestrator",
      },
    };
    
    return titles[agent]?.[action] || titles[agent]?.default || "Processing";
  };

  const mapActionToCardAction = (action: string): AgentCard["action"] => {
    if (action.includes("generating")) return "generating";
    if (action.includes("analyzing")) return "analyzing";
    if (action.includes("evaluating")) return "evaluating";
    if (action.includes("policy")) return "policy_update";
    if (action.includes("question")) return "question";
    if (action.includes("success")) return "success";
    if (action.includes("error")) return "error";
    return "thinking";
  };

  // Fetch agent reasoning data including Weave trace URL
  const fetchAgentReasoning = useCallback(async (pId: string) => {
    try {
      const reasoning: AgentReasoningResponse = await getAgentReasoning(pId);
      if (reasoning.weave_trace_url) {
        setWeaveTraceUrl(reasoning.weave_trace_url);
      }
      // Update agent cards with reasoning details
      if (reasoning.reasoning_steps && reasoning.reasoning_steps.length > 0) {
        setAgentCards(prev => {
          const updated = [...prev];
          reasoning.reasoning_steps.forEach(step => {
            const matchingCard = updated.find(c => 
              c.agent === step.agent && 
              c.details?.to_state === step.to_state
            );
            if (matchingCard && step.reasoning) {
              matchingCard.reasoning = step.reasoning;
            }
          });
          return updated;
        });
      }
    } catch (err) {
      console.error("Failed to fetch agent reasoning:", err);
    }
  }, []);

  // Fetch all iterations to display in results timeline
  const fetchIterations = useCallback(async (pId: string, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second
    
    try {
      console.log(`Fetching iterations for project: ${pId} (attempt ${retryCount + 1})`);
      const iterations = await getIterations(pId);
      console.log("Got iterations:", iterations.length, iterations);
      
      const phases: typeof generatedPhases = [];
      const seenPaths = new Set<string>(); // Deduplication for successful iterations
      
      // Group by phase and show all attempts (including failures)
      for (const iter of iterations) {
        // FIX: Handle all possible image path fields from backend
        const imagePath = iter.output_image_url || iter.output_image_path || "";
        const isFailed = iter.status === "failed" || iter.status === "error";
        
        console.log(`Iteration ${iter.id}: phase=${iter.phase}, status=${iter.status}, imagePath=${imagePath}`);
        
        // Show successful iterations with images (deduped) or failed ones
        if (isFailed && !imagePath) {
          // Failed iteration without output - still show in timeline
          phases.push({
            phase: `${iter.phase}${iter.iteration_number > 1 ? ` #${iter.iteration_number}` : ""} (failed)`,
            imagePath: "", // Empty - will show error state
            iterationId: iter.id,
            evaluationPassed: false,
            evaluationScore: 0,
            iterationNumber: iter.iteration_number,
            weaveTraceId: iter.weave_run_id || undefined,
          });
        } else if (imagePath && !seenPaths.has(imagePath)) {
          seenPaths.add(imagePath);
          phases.push({
            phase: `${iter.phase}${iter.iteration_number > 1 ? ` #${iter.iteration_number}` : ""}`,
            imagePath,
            iterationId: iter.id,
            evaluationPassed: iter.evaluation_passed,
            evaluationScore: iter.evaluation_score,
            iterationNumber: iter.iteration_number,
            weaveTraceId: iter.weave_run_id || undefined,
          });
        }
      }
      
      console.log("Setting generatedPhases:", phases.length, phases);
      
      // Update phases if we have any, or retry if empty and retries remain
      if (phases.length > 0) {
        setGeneratedPhases(phases);
      } else if (iterations.length === 0 && retryCount < MAX_RETRIES) {
        // No iterations yet - retry after a delay (backend might still be writing)
        console.log(`No iterations yet, retrying in ${RETRY_DELAY}ms (${MAX_RETRIES - retryCount - 1} retries left)`);
        setTimeout(() => fetchIterations(pId, retryCount + 1), RETRY_DELAY);
        return;
      } else if (iterations.length === 0) {
        console.warn("No iterations returned from API after all retries - keeping existing generatedPhases");
      }
      
      // Fetch detailed evaluation results for evaluated iterations
      const evaluatedIterations = iterations.filter(
        (iter: IterationResponse) => iter.evaluation_status && iter.evaluation_status !== "pending"
      );
      
      if (evaluatedIterations.length > 0) {
        const evalPromises = evaluatedIterations.map(async (iter: IterationResponse) => {
          try {
            const evalDetail = await getIterationEvaluation(pId, iter.id);
            return {
              iterationId: iter.id,
              phase: iter.phase,
              iterationNumber: iter.iteration_number,
              overallPassed: evalDetail.overall_passed,
              overallScore: evalDetail.overall_score,
              criteria: evalDetail.criteria.map(c => ({
                criterion: c.criterion,
                passed: c.passed,
                score: c.score,
                details: c.details,
                evidence: c.evidence,
              })),
              failureReasons: evalDetail.failure_reasons || [],
              evaluatedAt: evalDetail.evaluated_at,
            };
          } catch {
            // Skip iterations where evaluation fetch fails
            return null;
          }
        });
        
        const evalResults = (await Promise.all(evalPromises)).filter(Boolean);
        setEvaluationResults(evalResults as EvaluationResult[]);
      }
    } catch (err) {
      console.error("Failed to fetch iterations:", err);
    }
  }, []);

  // Fetch reasoning when orchestration completes
  useEffect(() => {
    if (projectId && orchestrationStatus?.state && 
        (orchestrationStatus.state === "completed" || 
         orchestrationStatus.state === "completed_with_warnings")) {
      fetchAgentReasoning(projectId);
    }
  }, [projectId, orchestrationStatus?.state, fetchAgentReasoning]);

  // CRITICAL: Fetch iterations when orchestration completes - always fetch to ensure we have all images
  useEffect(() => {
    if (projectId && orchestrationStatus?.state && 
        (orchestrationStatus.state === "completed" || 
         orchestrationStatus.state === "completed_with_warnings")) {
      // Always fetch iterations on completion to ensure we have the latest data
      console.log("Completion detected via state change - fetching iterations now");
      fetchIterations(projectId);
      setTransformationComplete(true);
    }
  }, [projectId, orchestrationStatus?.state, fetchIterations]);

  useEffect(() => {
    const shouldFetch =
      projectId &&
      orchestrationStatus?.is_batch &&
      (orchestrationStatus.state === "completed" ||
        orchestrationStatus.state === "completed_with_warnings");
    if (!shouldFetch) return;

    if (batchReport || batchReportError) return;

    getBatchReport(projectId)
      .then(setBatchReport)
      .catch((err) => {
        setBatchReportError(getErrorMessage(err, "fetch batch report"));
      });
  }, [projectId, orchestrationStatus, batchReport, batchReportError]);

  // Helper for user-friendly error messages
  const getErrorMessage = useCallback((err: unknown, context: string): string => {
    if (err instanceof Error) {
      if (err.message.includes("network") || err.message.includes("fetch") || err.message.includes("Failed to fetch")) {
        return "Connection issue. Please check your internet and try again.";
      }
      if (err.message.includes("timeout")) {
        return "Request timed out. Please try again.";
      }
      if (err.message.includes("500")) {
        return "Server error. Please try again in a moment.";
      }
    }
    return `Unable to ${context}. Please try again.`;
  }, []);

  const handleSend = async (message: string, files?: File[]) => {
    // Validation
    if (!message.trim() && (!files || files.length === 0)) {
      setError("Please provide a message or upload images.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // Process images (upload to backend and use returned URLs)
    const imageUrls: string[] = [];
    if (files && files.length > 0) {
      try {
        const uploaded = await uploadImages(files);
        imageUrls.push(...uploaded);
        setUploadedImages(imageUrls);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Image upload failed");
        setIsLoading(false);
        return;
      }
    }

    // Add user message to chat
    addChatMessage({
      type: "user",
      content: message,
      images: imageUrls,
    });

    // Transition to active state
    setAppState("active");

    // Add initial card
    const initCardId = addAgentCard({
      agent: "orchestrator",
      title: "Initializing Pipeline",
      content: "Setting up the transformation workflow...",
      status: "running",
      action: "thinking",
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      // Create project
      const project = await createProject({
        goal: message,
        images: imageUrls,
      });
      setProjectId(project.project_id);
      lastScoreByPhaseRef.current = {};
      lastAttemptByPhaseRef.current = {};

      updateAgentCard(initCardId, { 
        status: "completed",
        content: `Project initialized. ID: ${project.project_id.slice(0, 8)}...`
      });

      addChatMessage({
        type: "assistant",
        content: "I've received your request. Let me analyze your requirements...",
      });

      // First, show image analysis step (if images were uploaded)
      let imageAnalysisCardId: string | null = null;
      if (imageUrls.length > 0) {
        imageAnalysisCardId = addAgentCard({
          agent: "spatial",
          title: "Analyzing Your Images",
          content: "Using AI vision to understand what's in your uploaded images...",
          status: "running",
          action: "analyzing",
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      // Analyze goal (includes image analysis)
      const analysisCardId = addAgentCard({
        agent: "requirements",
        title: "Analyzing Requirements",
        content: "Understanding your design goals and extracting key details...",
        status: "running",
        action: "analyzing",
        timestamp: new Date().toLocaleTimeString(),
      });

      const analysis = await analyzeGoal(project.project_id);
      
      // Show image analysis results if available
      if (analysis.image_analysis?.analyzed && imageAnalysisCardId) {
        const ia = analysis.image_analysis;
        const detectedInfo: string[] = [];
        
        if (ia.space_type) {
          const confidence = ia.space_type_confidence ? ` (${Math.round(ia.space_type_confidence * 100)}% confident)` : "";
          detectedInfo.push(`Space type: ${ia.space_type.replace(/_/g, " ")}${confidence}`);
        }
        if (ia.construction_state) {
          detectedInfo.push(`State: ${ia.construction_state.replace(/_/g, " ")}`);
        }
        if (ia.existing_styles?.length > 0) {
          detectedInfo.push(`Existing styles: ${ia.existing_styles.join(", ")}`);
        }
        
        updateAgentCard(imageAnalysisCardId, {
          status: "completed",
          title: "Image Analysis Complete",
          content: detectedInfo.length > 0 
            ? detectedInfo.join(" • ")
            : "Image analyzed successfully",
          details: {
            space_type: ia.space_type,
            construction_state: ia.construction_state,
            existing_styles: ia.existing_styles,
            reasoning: ia.space_type_reasoning,
          },
        });

        // Add chat message about what we detected
        if (ia.space_type || ia.construction_state) {
          const chatParts: string[] = [];
          if (ia.construction_state === "unfinished" || ia.construction_state === "under_renovation") {
            chatParts.push(`I can see this is a **${ia.construction_state.replace(/_/g, " ")}** space`);
          }
          if (ia.space_type) {
            chatParts.push(`that appears to be a **${ia.space_type.replace(/_/g, " ")}**`);
          }
          if (ia.space_type_reasoning) {
            chatParts.push(`(${ia.space_type_reasoning})`);
          }
          
          addChatMessage({
            type: "assistant",
            content: `🔍 ${chatParts.join(" ")}. I'll tailor my questions based on what I see in your image.`,
          });
        }
      } else if (imageAnalysisCardId) {
        updateAgentCard(imageAnalysisCardId, {
          status: "completed",
          content: "Image received - will analyze during processing",
        });
      }
      
      updateAgentCard(analysisCardId, {
        status: "completed",
        content: analysis.questions_needed 
          ? `Identified ${Object.keys(analysis.identified).length} requirements. Need ${analysis.questions.length} clarifications.`
          : "All requirements captured. Ready to proceed with generation!",
        details: analysis.identified,
      });

      if (analysis.questions_needed) {
        setQuestions(analysis);
        addChatMessage({
          type: "assistant",
          content: analysis.image_analysis?.analyzed 
            ? "Based on my image analysis, I have a few targeted questions to refine your vision:"
            : "I have a few questions to better understand your vision. Please answer them below.",
        });
        addAgentCard({
          agent: "requirements",
          title: "Awaiting Clarification",
          content: `${analysis.questions.length} questions need your input before we can proceed.`,
          status: "pending",
          action: "question",
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        addChatMessage({
          type: "assistant",
          content: "Great! I have everything I need. Starting the transformation pipeline...",
        });
        await startPipeline(project.project_id);
      }

    } catch (err) {
      const errorMsg = getErrorMessage(err, "start the transformation");
      setError(errorMsg);
      updateAgentCard(initCardId, {
        status: "error",
        content: errorMsg,
        action: "error",
      });
      addChatMessage({
        type: "system",
        content: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionAnswer = (questionId: string, answer: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitAnswers = async () => {
    if (!projectId || !questions) return;

    setIsLoading(true);
    
    addChatMessage({
      type: "user",
      content: "I've answered the questions.",
    });

    const submitCardId = addAgentCard({
      agent: "requirements",
      title: "Processing Responses",
      content: "Incorporating your preferences into the design brief...",
      status: "running",
      action: "thinking",
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      // Check if we're in orchestration clarification mode
      const isOrchestrationClarification = orchestrationStatus?.state === "awaiting_clarification";
      
      if (isOrchestrationClarification) {
        // Convert answers to string map for orchestration endpoint
        const stringAnswers: Record<string, string> = {};
        for (const [key, value] of Object.entries(answers)) {
          stringAnswers[key] = Array.isArray(value) ? value.join(", ") : String(value);
        }
        await submitOrchestrationClarification(projectId, stringAnswers);
      } else {
        // Initial requirements submission
        await submitAnswers(projectId, { responses: answers });
      }
      
      updateAgentCard(submitCardId, {
        status: "completed",
        content: "All requirements captured successfully!",
      });

      addChatMessage({
        type: "assistant",
        content: isOrchestrationClarification 
          ? "Thanks! Continuing with the transformation..."
          : "Perfect! Starting the transformation pipeline now...",
      });

      setQuestions(null);
      
      // Only start pipeline if not already in orchestration
      if (!isOrchestrationClarification) {
        await startPipeline(projectId);
      }

    } catch (err) {
      const errorMsg = getErrorMessage(err, "submit your answers");
      setError(errorMsg);
      updateAgentCard(submitCardId, {
        status: "error",
        content: errorMsg,
        action: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startPipeline = async (pId: string) => {
    const orchestrateCardId = addAgentCard({
      agent: "orchestrator",
      title: "Launching Generation Pipeline",
      content: "Coordinating multi-agent workflow...",
      status: "running",
      action: "thinking",
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      const isBatch = uploadedImages.length > 1;
      await startOrchestration(pId, false, isBatch);
      
      updateAgentCard(orchestrateCardId, {
        status: "completed",
        content: "Pipeline active. Streaming real-time updates...",
      });

      // Fetch Weave trace link early if available
      fetchAgentReasoning(pId);

      // Subscribe to SSE stream for real-time updates
      const cleanup = subscribeToOrchestration(
        pId,
        handleStreamEvent,
        (error) => {
          setIsConnected(false);
          console.error("Stream error:", error);
          // Fall back to polling if SSE fails
          if (streamCleanupRef.current) {
            streamCleanupRef.current();
            streamCleanupRef.current = null;
          }
          if (!pollingRef.current) {
            startStatusPolling(pId);
          }
        }
      );
      
      streamCleanupRef.current = cleanup;
      setIsConnected(true);

      // NOTE: Removed duplicate polling - SSE is now the primary source of truth
      // Polling only starts as fallback if SSE fails (see error handler above)

    } catch (err) {
      console.error("SSE connection failed, falling back to polling:", err);
      updateAgentCard(orchestrateCardId, {
        status: "running",
        content: "Connecting to pipeline (polling mode)...",
      });
      // Fall back to polling
      startStatusPolling(pId);
    }
  };

  // Lightweight status sync polling - ONLY used as fallback when SSE is disconnected
  // This is no longer called alongside SSE to prevent race conditions
  const startStatusSyncPolling = useCallback((pId: string) => {
    // Don't start if already have full polling running
    if (pollingRef.current) return;

    const syncInterval = setInterval(async () => {
      try {
        const status = await getOrchestrationStatus(pId);
        
        // Only update status-related fields, use safe update pattern
        setOrchestrationStatus(prev => {
          // If we have no previous state, use the fetched status directly
          if (!prev) return status;
          // Otherwise merge, preferring fetched data
          return {
            ...prev,
            ...status,
          };
        });

        // Check if pipeline is complete
        const isTerminal = ["completed", "completed_with_warnings", "failed"].includes(status.state);
        if (isTerminal) {
          clearInterval(syncInterval);
          // Fetch final iterations if complete
          if (status.state !== "failed") {
            setTransformationComplete(true);
            fetchIterations(pId);
          }
        }
      } catch (err) {
        console.warn("Status sync poll failed:", err);
      }
    }, 3000); // Poll every 3 seconds

    // Return cleanup function
    return () => clearInterval(syncInterval);
  }, [fetchIterations]);

  const startStatusPolling = (pId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    let lastState = "";
    let lastRetryCount = 0;
    let hasReportedTerminal = false; // Prevent duplicate terminal state messages

    const poll = async () => {
      try {
        const status = await getOrchestrationStatus(pId);
        setOrchestrationStatus(status);

        // Detect retry events (self-improvement)
        if (status.retry_count > lastRetryCount) {
          lastRetryCount = status.retry_count;
          const phase = status.current_phase || "generation";
          addAgentCard({
            agent: "qc",
            title: `Self-Improvement #${status.retry_count}`,
            content: `Quality check detected issues. Analyzing failure and adjusting ${phase} policy for better results...`,
            status: "warning",
            action: "policy_update",
            timestamp: new Date().toLocaleTimeString(),
            details: {
              retry_number: status.retry_count,
              phase: phase,
              trigger: "QC evaluation failed",
            },
          });
          addChatMessage({
            type: "assistant",
            content: `🔄 Self-improvement triggered: Retry #${status.retry_count} for ${phase} phase. Adjusting approach based on quality feedback...`,
          });
        }

        if (status.state !== lastState) {
          const previousState = lastState;
          lastState = status.state;

          // Handle state transitions with clear agent handoffs
          if (status.state.includes("gathering_requirements")) {
            addAgentCard({
              agent: "requirements",
              title: "Requirements Agent Active",
              content: "Analyzing your design goals and preparing clarifying questions...",
              status: "running",
              action: "analyzing",
              timestamp: new Date().toLocaleTimeString(),
            });
          } else if (status.state.includes("analyzing_space") || status.state.includes("analyzing")) {
            // Mark previous agent as complete
            setAgentCards(prev => prev.map(c => 
              c.agent === "requirements" && c.status === "running" 
                ? { ...c, status: "completed" as const }
                : c
            ));
            addAgentCard({
              agent: "spatial",
              title: "Spatial Analysis Agent Active",
              content: "Detecting physical constraints, fixtures, plumbing, and spatial boundaries...",
              status: "running",
              action: "analyzing",
              timestamp: new Date().toLocaleTimeString(),
            });
          } else if (status.state.includes("generating")) {
            // Mark spatial agent as complete if transitioning from analysis
            if (previousState.includes("analyzing")) {
              setAgentCards(prev => prev.map(c => 
                c.agent === "spatial" && c.status === "running" 
                  ? { ...c, status: "completed" as const }
                  : c
              ));
            }
            const phase = status.current_phase || "cleanup";
            const isRetrying = status.state.includes("retrying") || status.retry_count > 0;
            addAgentCard({
              agent: "generation",
              title: isRetrying ? `Retrying ${phase.charAt(0).toUpperCase() + phase.slice(1)}` : `${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`,
              content: isRetrying 
                ? `Re-generating ${phase} with improved policy settings (attempt ${status.retry_count + 1})...`
                : `Generating visualization for ${phase} transformation...`,
              status: "running",
              action: isRetrying ? "policy_update" : "generating",
              timestamp: new Date().toLocaleTimeString(),
              details: {
                phase: phase,
                retry_count: status.retry_count,
              },
            });
          } else if (status.state.includes("evaluating")) {
            const phase = status.current_phase || "generation";
            addAgentCard({
              agent: "qc",
              title: `Quality Control - ${phase.charAt(0).toUpperCase() + phase.slice(1)}`,
              content: `Evaluating ${phase} output against 5 quality criteria: constraint compliance, geometry preservation, hallucination check, style execution, and phase completion...`,
              status: "running",
              action: "evaluating",
              timestamp: new Date().toLocaleTimeString(),
              details: {
                phase: phase,
                criteria: ["constraints", "geometry", "hallucinations", "style", "completion"],
              },
            });
          } else if (status.state.includes("retrying")) {
            const phase = status.current_phase || "generation";
            addAgentCard({
              agent: "qc",
              title: "Analyzing Failure",
              content: `Quality check failed for ${phase}. Analyzing what went wrong and generating policy improvements...`,
              status: "warning",
              action: "policy_update",
              timestamp: new Date().toLocaleTimeString(),
              details: {
                phase: phase,
                action: "failure_analysis",
              },
            });
          }
        }

        // Only report terminal states once
        const isTerminal = status.state === "completed" || status.state === "completed_with_warnings" || status.state === "failed";
        if (isTerminal && !hasReportedTerminal) {
          hasReportedTerminal = true;
          
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          const isSuccess = status.state !== "failed";
          
          // Mark all running cards as complete
          setAgentCards(prev => prev.map(c => 
            c.status === "running" ? { ...c, status: isSuccess ? "completed" as const : "error" as const } : c
          ));
          
          addAgentCard({
            agent: "orchestrator",
            title: isSuccess ? "Transformation Complete" : "Pipeline Failed",
            content: isSuccess 
              ? status.has_warnings 
                ? `Visualization complete with minor warnings. ${status.retry_count > 0 ? `Self-improved ${status.retry_count} time(s).` : ""}`
                : `Your space transformation is ready! ${status.retry_count > 0 ? `Self-improved ${status.retry_count} time(s) for optimal quality.` : ""}`
              : "The generation pipeline encountered an error.",
            status: isSuccess ? "completed" : "error",
            action: isSuccess ? "success" : "error",
            timestamp: new Date().toLocaleTimeString(),
            details: {
              retry_count: status.retry_count,
              has_warnings: status.has_warnings,
            },
          });

          addChatMessage({
            type: "assistant",
            content: isSuccess 
              ? `Your visualization is complete! ${status.retry_count > 0 ? `The system self-improved ${status.retry_count} time(s) to ensure quality.` : ""} Check the results on the right.`
              : "I encountered an issue. Please try again or adjust your requirements.",
          });
        }

      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 3000);
  };

  const resetAll = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
      streamCleanupRef.current = null;
    }
    setAppState("welcome");
    setProjectId(null);
    setAgentCards([]);
    setUploadedImages([]);
    setQuestions(null);
    setAnswers({});
    setOrchestrationStatus(null);
    setError(null);
    setChatMessages([]);
    setIsConnected(false);
    setCurrentThinking(null);
    setWeaveTraceUrl(null);
    setGeneratedPhases([]);
    setTransformationComplete(false);
    setSelfImprovementRetries([]);
    setAgentUpgradeEvents([]);
    setReasoningSteps([]);
    setPipelineSteps([]);
    setEvaluationResults([]);
    // Reset generation phase progress
    setGenerationPhaseProgress([
      { phase: "cleanup", status: "pending" },
      { phase: "structural", status: "pending" },
      { phase: "fixture", status: "pending" },
      { phase: "style", status: "pending" },
    ]);
    setCurrentGenerationPhaseIndex(-1);
    setIsGenerationRunning(false);
  };

  const allQuestionsAnswered = questions 
    ? questions.questions.every(q => answers[q.question_id] !== undefined)
    : false;

  // Derive pipeline stage from orchestration status - ENHANCED for better stepper accuracy
  const getPipelineStage = (): "requirements" | "spatial" | "generation" | "qc" | "complete" => {
    if (!orchestrationStatus) return "requirements";
    const state = orchestrationStatus.state;
    const phase = orchestrationStatus.current_phase;
    
    // Check completed states first
    if (state === "completed" || state === "completed_with_warnings") return "complete";
    
    // Check state string for current activity
    if (state) {
      // QC/Evaluation states
      if (state.includes("evaluating") || state.includes("retrying")) return "qc";
      // Generation states
      if (state.includes("generating")) return "generation";
      // Spatial analysis states
      if (state.includes("analyzing_space") || state.includes("spatial")) return "spatial";
      // Requirements states
      if (state.includes("requirements") || state.includes("clarification") || state.includes("gathering")) return "requirements";
    }
    
    // Fallback to phase-based detection
    if (phase) {
      if (phase.includes("qc") || phase.includes("quality") || phase.includes("evaluat")) return "qc";
      if (phase.includes("generat") || phase.includes("render") || phase.includes("cleanup") || 
          phase.includes("structural") || phase.includes("fixture") || phase.includes("style")) return "generation";
      if (phase.includes("spatial") || phase.includes("analy")) return "spatial";
    }
    
    // Default to requirements if nothing else matches
    return "requirements";
  };

  const pipelineStage = getPipelineStage();
  const galleryEnabled =
    (galleryData?.summary.total_attempts ?? 0) > 0 ||
    generatedPhases.length > 0;

  return (
    <ToastProvider>
    <LayoutGroup>
      <div className="min-h-screen flex flex-col overflow-x-hidden text-foreground bg-background transition-colors duration-300">
            <AnimatedBackground 
              isActive={appState === "active"} 
              intensity={appState === "active" ? "intense" : "normal"} 
              isLoading={isLoading}
            />

        <div className="relative z-10 flex-1 flex flex-col min-h-0">
          {/* Header - Clean and minimal with dark mode support */}
          <motion.header
            layout
            transition={springTransition}
            className="sticky top-0 z-50 shrink-0"
          >
            <div className="mx-4 mt-4">
              <motion.div
                layout
                transition={springTransition}
                className={cn(
                  "mx-auto px-5 h-14 flex items-center justify-between rounded-2xl border backdrop-blur-3xl transition-all duration-300 ring-1 ring-white/30 dark:ring-white/10",
                  appState === "welcome" 
                    ? "max-w-2xl bg-gradient-to-b from-white/70 to-white/40 dark:from-zinc-900/70 dark:to-zinc-900/45 border-white/50 dark:border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.12)]" 
                    : "max-w-7xl bg-gradient-to-b from-white/80 to-white/50 dark:from-zinc-900/75 dark:to-zinc-900/50 border-white/60 dark:border-white/12 shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
                )}
              >
                {/* Logo */}
                <motion.div layout className="flex items-center gap-2.5">
                  <ContinuityLogo size={24} />
                  <span className="font-semibold text-sm text-neutral-900 dark:text-zinc-100">Clarity</span>
                  
                  {/* Status in header when active */}
                  <AnimatePresence>
                    {appState !== "welcome" && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="hidden sm:flex items-center gap-3 ml-4 pl-4 border-l border-neutral-200 dark:border-zinc-700"
                      >
                        <CompactTimeline 
                          currentStage={pipelineStage} 
                          className="w-24" 
                          subPhase={orchestrationStatus?.current_phase || undefined}
                        />
                        {orchestrationStatus && orchestrationStatus.retry_count > 0 && (
                          <SelfImprovingBadge 
                            cycleCount={orchestrationStatus.retry_count}
                            isActive={orchestrationStatus.state?.includes("evaluating") || orchestrationStatus.state?.includes("retrying") || false}
                          />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Actions */}
                <motion.div layout className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    {appState !== "welcome" && (
                      <motion.button
                        key="reset-btn"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        onClick={resetAll}
                        className="text-xs font-medium text-neutral-500 dark:text-zinc-400 hover:text-neutral-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span className="hidden sm:inline">New</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <ThemeToggle />
                  <SettingsDropdown
                    onOpenGallery={openGallery}
                    galleryEnabled={galleryEnabled}
                  />
                </motion.div>
              </motion.div>
            </div>
          </motion.header>

          {/* Main Content with smooth transitions */}
          <main className={cn(
            "flex-1 flex min-h-0",
            appState === "welcome" ? "overflow-y-auto" : "overflow-hidden"
          )}>
            <AnimatePresence mode="wait">
              {appState === "welcome" ? (
                <WelcomeView key="welcome" onSend={handleSend} isLoading={isLoading} />
              ) : (
                <SplitView
                  key="split"
                  agentCards={agentCards}
                  uploadedImages={uploadedImages}
                  questions={questions}
                  answers={answers}
                  onQuestionAnswer={handleQuestionAnswer}
                  onSubmitAnswers={handleSubmitAnswers}
                  allQuestionsAnswered={allQuestionsAnswered}
                  orchestrationStatus={orchestrationStatus}
                  isLoading={isLoading}
                  cardsEndRef={cardsEndRef}
                  chatEndRef={chatEndRef}
                  chatMessages={chatMessages}
                  error={error}
                  onSend={handleSend}
                  isConnected={isConnected}
                  currentThinking={currentThinking}
                  weaveTraceUrl={weaveTraceUrl}
                  pipelineStage={pipelineStage}
                  pipelineSteps={pipelineSteps}
                  evaluationResults={evaluationResults}
                  agentUpgradeEvents={agentUpgradeEvents}
                  reasoningSteps={reasoningSteps}
                  selfImprovementRetries={selfImprovementRetries}
                  generatedPhases={generatedPhases}
                  transformationComplete={transformationComplete}
                  generationPhaseProgress={generationPhaseProgress}
                  currentGenerationPhaseIndex={currentGenerationPhaseIndex}
                  isGenerationRunning={isGenerationRunning}
                />
              )}
            </AnimatePresence>
          </main>

        {/* Gallery Modal */}
        {isGalleryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div
              className="absolute inset-0"
              onClick={() => {
                setIsGalleryOpen(false);
                setGallerySelected(null);
              }}
            />
            <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-continuity-400" />
                    <h2 className="text-lg font-semibold">Generation Gallery</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {galleryData?.run_timestamp
                      ? `Run started ${new Date(galleryData.run_timestamp).toLocaleString()}`
                      : "All generated images with QC pass/fail and reasons"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsGalleryOpen(false);
                    setGallerySelected(null);
                  }}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Close gallery"
                >
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                {galleryLoading && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center py-6 text-slate-400">
                      <RotateCcw className="w-5 h-5 mr-2 animate-spin" />
                      Loading gallery...
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                          <div className="aspect-square bg-slate-800 animate-pulse" />
                          <div className="p-3 space-y-2">
                            <div className="h-3 w-24 bg-slate-800 rounded animate-pulse" />
                            <div className="h-3 w-32 bg-slate-800 rounded animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!galleryLoading && galleryError && (
                  <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300">
                    {galleryError}
                  </div>
                )}

                {!galleryLoading && !galleryError && (!galleryData || galleryData.summary.total_attempts === 0) && (
                  <div className="text-center text-slate-500 py-12">
                    No images generated yet. Run a transformation to see your gallery.
                  </div>
                )}

                {!galleryLoading && !galleryError && galleryData && galleryData.summary.total_attempts > 0 && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                        <div className="text-xs text-slate-500">Total Images</div>
                        <div className="text-2xl font-semibold text-white">{galleryData.summary.total_attempts}</div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Policy updates: {galleryData.summary.total_policy_updates}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                        <div className="text-xs text-slate-500">Passed / Failed</div>
                        <div className="text-2xl font-semibold text-white">
                          <span className="text-emerald-400">{galleryData.summary.passed}</span>
                          <span className="text-slate-500"> / </span>
                          <span className="text-red-400">{galleryData.summary.failed}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Success rate: {galleryData.summary.total_attempts > 0
                            ? Math.round((galleryData.summary.passed / galleryData.summary.total_attempts) * 100)
                            : 0}%
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                        <div className="text-xs text-slate-500">Improvement Journey</div>
                        <div className="text-2xl font-semibold text-white">
                          {galleryData.summary.improvement_demonstrated ? "Visible" : "Not yet"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Score progression across attempts
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="text-xs text-slate-500 mb-3">Score Progression</div>
                      {galleryData.summary.overall_score_progression.length > 0 ? (
                        <div className="w-full">
                          <svg viewBox="0 0 100 40" className="w-full h-24">
                            <polyline
                              fill="none"
                              stroke="currentColor"
                              className="text-continuity-400"
                              strokeWidth="2"
                              points={buildScoreChartPoints(galleryData.summary.overall_score_progression)}
                            />
                            {galleryData.summary.overall_score_progression.map((score, idx) => {
                              const x = galleryData.summary.overall_score_progression.length > 1
                                ? (idx * 100) / (galleryData.summary.overall_score_progression.length - 1)
                                : 50;
                              const y = 40 - Math.max(0, Math.min(score, 1)) * 40;
                              return (
                                <circle
                                  key={idx}
                                  cx={x}
                                  cy={y}
                                  r="1.6"
                                  className="text-continuity-400 fill-current"
                                />
                              );
                            })}
                          </svg>
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Attempt 1</span>
                            <span>Attempt {galleryData.summary.overall_score_progression.length}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">No scores yet.</div>
                      )}
                    </div>

                    {galleryData.phases.map((phase) => (
                      <div key={phase.phase} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-200">
                            {phase.phase_label}
                          </h3>
                          <span className="text-xs text-slate-500">
                            {phase.total_attempts} attempts → {phase.final_status === "passed" ? "✓" : phase.final_status === "failed" ? "✗" : "…"}
                          </span>
                        </div>
                        {phase.score_progression.length > 0 && (
                          <div className="text-xs text-slate-500">
                            Improvement: {phase.score_progression.map((score) => `${Math.round(score * 100)}%`).join(" → ")} • Policy updates: {phase.policy_updates_count}
                          </div>
                        )}
                        <div className="flex items-center gap-3 overflow-x-auto pb-2">
                          {phase.attempts.map((attempt, idx) => {
                            const status = attempt.status;
                            const resolvedUrl = resolveImagePath(attempt.image_url);
                            const delta = attempt.score_delta;
                            const deltaLabel = delta !== null && delta !== undefined
                              ? `${delta >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(delta * 100))}%`
                              : null;
                            return (
                              <div key={attempt.iteration_id} className="flex items-center gap-3 flex-shrink-0">
                                <button
                                  onClick={() => setGallerySelected({ phase: phase.phase, phaseLabel: phase.phase_label, attempt })}
                                  className={`text-left rounded-xl border overflow-hidden transition-colors w-64 ${
                                    status === "passed"
                                      ? "border-emerald-500/40 bg-emerald-500/5"
                                      : status === "failed" && (delta !== null && delta > 0)
                                      ? "border-amber-500/40 bg-amber-500/5"
                                      : status === "failed"
                                      ? "border-red-500/40 bg-red-500/5"
                                      : "border-slate-800 bg-slate-900/60"
                                  }`}
                                >
                                  <div className="relative aspect-[4/3] bg-slate-900">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={resolvedUrl}
                                      alt={`${phase.phase_label} attempt ${attempt.attempt_number}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                      status === "passed"
                                        ? "bg-emerald-500/80 text-white"
                                        : status === "failed"
                                        ? "bg-red-500/80 text-white"
                                        : "bg-slate-700/80 text-white"
                                    }`}>
                                      {status === "passed" ? "PASS" : status === "failed" ? "FAIL" : "PENDING"}
                                    </div>
                                  </div>
                                  <div className="p-3 space-y-2">
                                    <div className="text-xs text-slate-400">
                                      Attempt {attempt.attempt_number} of {phase.total_attempts}
                                    </div>
                                    {attempt.score !== null && attempt.score !== undefined && (
                                      <div className="text-xs text-slate-300">
                                        Score: {Math.round(attempt.score * 100)}%{" "}
                                        {deltaLabel && <span className="text-slate-500">({deltaLabel})</span>}
                                      </div>
                                    )}
                                    <div className="text-xs text-slate-300">
                                      Reason: <span className="text-slate-400">{attempt.human_readable_reason || attempt.failure_reason || "Not evaluated"}</span>
                                    </div>
                                    {attempt.policy_version !== null && attempt.policy_version !== undefined && (
                                      <div className="text-[11px] text-slate-500">
                                        Policy v{attempt.policy_version}
                                        {attempt.policy_changes_from_previous.length > 0 && (
                                          <span className="ml-2 text-amber-400">🔧 {attempt.policy_changes_from_previous.length} updates</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </button>
                                {idx < phase.attempts.length - 1 && (
                                  <div className="text-slate-500 text-lg">→</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {gallerySelected && (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                  onClick={() => setGallerySelected(null)}
                >
                  <div
                    className="relative w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          {gallerySelected.phaseLabel} • Attempt #{gallerySelected.attempt.attempt_number}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {new Date(gallerySelected.attempt.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setGallerySelected(null)}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        aria-label="Close details"
                      >
                        <ChevronRight className="w-5 h-5 rotate-90" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                      <div className="p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveImagePath(gallerySelected.attempt.image_url)}
                          alt="Gallery detail"
                          className="w-full max-h-[60vh] object-contain rounded-xl border border-slate-800"
                        />
                      </div>
                      <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            gallerySelected.attempt.status === "passed"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : gallerySelected.attempt.status === "failed"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-slate-700/40 text-slate-300"
                          }`}>
                            {gallerySelected.attempt.status === "passed"
                              ? "Passed QC"
                              : gallerySelected.attempt.status === "failed"
                              ? "Failed QC"
                              : "Pending QC"}
                          </span>
                          {gallerySelected.attempt.score !== null && gallerySelected.attempt.score !== undefined && (
                            <span className="text-xs text-slate-400">
                              Score: {(gallerySelected.attempt.score * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300">
                          Reason: <span className="text-slate-400">{gallerySelected.attempt.human_readable_reason || gallerySelected.attempt.failure_reason || "Not evaluated"}</span>
                        </div>
                        {gallerySelected.attempt.policy_version !== null && gallerySelected.attempt.policy_version !== undefined && (
                          <div className="text-xs text-slate-400">
                            Policy version: v{gallerySelected.attempt.policy_version}
                          </div>
                        )}
                        {gallerySelected.attempt.policy_changes_from_previous.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-slate-300">Policy adjustments</div>
                            <ul className="text-[11px] text-slate-400 space-y-1">
                              {gallerySelected.attempt.policy_changes_from_previous.map((change, index) => (
                                <li key={index}>• {formatPolicyChange(change)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {gallerySelected.attempt.weave_trace_id && (
                          <button
                            onClick={() => window.open(`https://wandb.ai/traces/${gallerySelected.attempt.weave_trace_id}`, "_blank")}
                            className="text-xs text-continuity-400 hover:text-continuity-300"
                          >
                            View Weave Trace →
                          </button>
                        )}
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-slate-300">Evaluation Breakdown</div>
                          {gallerySelected.attempt.evaluation.length === 0 ? (
                            <div className="text-xs text-slate-500">No evaluation details available yet.</div>
                          ) : (
                            <div className="space-y-2">
                              {gallerySelected.attempt.evaluation.map((criterion) => (
                                <div key={criterion.criterion} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs text-slate-300">
                                      {criterion.criterion.replace(/_/g, " ")}
                                    </div>
                                    <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                      criterion.passed ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                                    }`}>
                                      {Math.round(criterion.score * 100)}%
                                    </div>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-1">
                                    {criterion.details}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

          {/* Footer - Consolidated attribution (welcome only) */}
          {appState === "welcome" && (
            <motion.footer
              layout
              transition={springTransition}
              className="relative z-10 shrink-0 pb-6"
            >
              <div className="mx-4">
                <motion.div
                  layout
                  transition={springTransition}
                  className="mx-auto max-w-2xl text-center"
                >
                  <p className="text-[11px] text-neutral-400 dark:text-zinc-500">
                    <span className="font-medium">{APP_CONFIG.event}</span>
                    <span className="mx-2 text-neutral-300 dark:text-zinc-600">—</span>
                    <span>Powered by </span>
                    <span className="text-neutral-500 dark:text-zinc-400">Weave</span>
                    <span className="mx-1.5 text-neutral-300 dark:text-zinc-600">•</span>
                    <span className="text-neutral-500 dark:text-zinc-400">Browserbase</span>
                    <span className="mx-1.5 text-neutral-300 dark:text-zinc-600">•</span>
                    <span className="text-neutral-500 dark:text-zinc-400">Gemini</span>
                  </p>
                </motion.div>
              </div>
            </motion.footer>
          )}
        </div>
      </div>
    </LayoutGroup>
    </ToastProvider>
  );
}

// Welcome View - Clean, minimal, Apple-inspired with dark mode
function WelcomeView({ onSend, isLoading }: { onSend: (message: string, files?: File[]) => void; isLoading: boolean }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.15,
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: { duration: 0.25 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex-1 flex flex-col items-center justify-start md:justify-center px-6 py-8 min-h-0"
    >
      <div className="w-full max-w-xl">
        {/* Hero */}
        <div className="text-center mb-6">
          {/* Logo */}
          <motion.div variants={itemVariants} className="flex justify-center mb-6">
            <div className="relative">
              <motion.div
                animate={{ opacity: [0.4, 0.6, 0.4] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 blur-3xl bg-gradient-to-r from-pink-300/40 via-violet-300/40 to-cyan-300/40 dark:from-pink-500/20 dark:via-violet-500/20 dark:to-cyan-500/20 rounded-full scale-[2]"
              />
              <ContinuityLogo size={48} animate className="relative" />
            </div>
          </motion.div>
          
          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-5xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-100"
          >
            See your vision,{" "}
            <span className="bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-500 bg-clip-text text-transparent">
              realized
            </span>
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="text-neutral-500 dark:text-zinc-400 mt-3 text-lg max-w-md mx-auto"
          >
            Upload photos of any space. Describe your vision. Watch AI agents transform it — learning and improving with every step.
          </motion.p>
        </div>

        {/* Prompt input */}
        <motion.div variants={itemVariants} className="relative">
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <PromptInputBox 
              onSend={onSend} 
              isLoading={isLoading}
              placeholder={APP_CONFIG.demo.placeholderPrompt}
            />
          </motion.div>
        </motion.div>

        {/* Hints - Minimal */}
        <motion.div
          variants={itemVariants}
          className="mt-4 flex items-center justify-center gap-4 text-xs text-neutral-400 dark:text-zinc-500"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-pink-400" />
            Drop images
          </span>
          <span className="text-neutral-300 dark:text-zinc-600">•</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-cyan-400" />
            Paste from clipboard
          </span>
        </motion.div>

        {/* Features - Clean cards with dark mode */}
        <motion.div
          variants={itemVariants}
          className="mt-8 hidden sm:grid grid-cols-3 gap-3"
        >
          {[
            { 
              label: "Multi-Agent Pipeline", 
              desc: "Weave-traced orchestration", 
              icon: "🎯"
            },
            { 
              label: "Self-Improving AI", 
              desc: "Learns from each iteration", 
              icon: "🧠"
            },
            { 
              label: "Real-time Streaming", 
              desc: "Watch agents think & work", 
              icon: "⚡"
            },
          ].map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "p-4 rounded-xl border backdrop-blur-xl transition-all cursor-default",
                "bg-white/70 dark:bg-zinc-900/60",
                "shadow-sm",
                "ring-1 ring-neutral-200/50 dark:ring-white/10",
                "border-neutral-200/60 dark:border-white/10"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{item.icon}</span>
                <p className="text-sm font-medium text-neutral-900 dark:text-zinc-100">{item.label}</p>
              </div>
              <p className="text-xs text-neutral-500 dark:text-zinc-400">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Split View with coordinated panel animations
interface SplitViewProps {
  agentCards: AgentCard[];
  uploadedImages: string[];
  questions: AnalyzeGoalResponse | null;
  answers: Record<string, string | string[]>;
  onQuestionAnswer: (questionId: string, answer: string | string[]) => void;
  onSubmitAnswers: () => void;
  allQuestionsAnswered: boolean;
  orchestrationStatus: OrchestrationStatusResponse | null;
  isLoading: boolean;
  cardsEndRef: React.RefObject<HTMLDivElement | null>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  chatMessages: ChatMessage[];
  error: string | null;
  onSend: (message: string, files?: File[]) => void;
  isConnected: boolean;
  currentThinking: { agent: string; action: string } | null;
  weaveTraceUrl: string | null;
  pipelineStage: "requirements" | "spatial" | "generation" | "qc" | "complete";
  // Pipeline steps and evaluations
  pipelineSteps: Step[];
  evaluationResults: EvaluationResult[];
  // Self-improvement data
  agentUpgradeEvents: Array<{
    id: string;
    timestamp: string;
    sourceAgent: "qc" | "orchestrator";
    targetAgent: "generation" | "spatial" | "requirements";
    trigger: "evaluation_failure" | "cross_scene_learning" | "pattern_detection";
    evaluationScore?: number;
    failureReasons?: string[];
    policyChanges: Array<{ type: string; oldValue?: string | number; newValue?: string | number; rationale: string }>;
    weaveTraces?: Array<{ traceId: string; url: string; operation: string; duration_ms?: number; status: "success" | "error" }>;
    improved: boolean;
    retryNumber?: number;
  }>;
  reasoningSteps: Array<{
    id: string;
    timestamp: string;
    agent: string;
    thought: string;
    action?: string;
    observation?: string;
    toolCalls?: Array<{
      id: string;
      timestamp: string;
      toolName: string;
      toolType: "weave" | "browserbase" | "gemini" | "database" | "internal";
      input?: Record<string, unknown>;
      output?: string;
      status: "running" | "success" | "error";
      duration_ms?: number;
    }>;
  }>;
  selfImprovementRetries: Array<{
    phase: string;
    attemptNumber: number;
    failureReason: string;
    policyChanges: Array<{ field: string; oldValue: string | number; newValue: string | number; reason: string }>;
    improved: boolean;
    weaveTraceId?: string;
  }>;
  generatedPhases: Array<{
    phase: string;
    imagePath: string;
    iterationId?: string;
    evaluationPassed?: boolean | null;
    evaluationScore?: number | null;
    iterationNumber?: number;
  }>;
  transformationComplete: boolean;
  // Detailed generation progress for demo
  generationPhaseProgress: PhaseProgress[];
  currentGenerationPhaseIndex: number;
  isGenerationRunning: boolean;
}

function SplitView({
  agentCards,
  uploadedImages,
  questions,
  answers,
  onQuestionAnswer,
  onSubmitAnswers,
  allQuestionsAnswered,
  orchestrationStatus,
  isLoading,
  cardsEndRef,
  chatEndRef,
  chatMessages,
  error,
  onSend,
  isConnected,
  currentThinking,
  weaveTraceUrl,
  pipelineStage,
  pipelineSteps,
  evaluationResults,
  agentUpgradeEvents,
  reasoningSteps,
  selfImprovementRetries,
  generatedPhases,
  transformationComplete,
  generationPhaseProgress,
  currentGenerationPhaseIndex,
  isGenerationRunning,
}: SplitViewProps) {
  const [splitPosition, setSplitPosition] = useState(50); // Default 50%
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const activityScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatMessages, questions, currentThinking]);

  // Auto-scroll activity log to latest card
  useEffect(() => {
    if (activityScrollRef.current) {
      activityScrollRef.current.scrollTo({
        top: activityScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [agentCards, pipelineSteps]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
      // Clamp between 25% and 75%
      setSplitPosition(Math.min(75, Math.max(25, newPosition)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex-1 flex overflow-hidden", isDragging && "select-none cursor-col-resize")}
    >
      {/* Left Panel - Conversation */}
      <motion.div
        {...slideInLeft}
        transition={{ ...smoothTransition, delay: 0.1 }}
        style={{ width: `${splitPosition}%` }}
        className="relative flex flex-col border-r border-white/30 dark:border-white/10 min-w-[280px] bg-gradient-to-b from-white/60 to-white/40 dark:from-zinc-950/70 dark:to-zinc-950/50 backdrop-blur-2xl"
      >
        {/* Minimal header */}
        <div className="shrink-0 h-12 flex items-center justify-between px-5 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-xl">
          <span className="text-[13px] font-semibold text-neutral-700 dark:text-zinc-200">Conversation</span>
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1 transition-all duration-300",
            isConnected 
              ? 'text-emerald-600 dark:text-emerald-400' 
              : 'text-neutral-300 dark:text-zinc-600'
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full transition-all duration-300",
              isConnected 
                ? "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" 
                : "bg-neutral-300 dark:bg-zinc-600"
            )} />
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Messages area - modern chat feel */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto scrollbar-invisible pb-24 flex flex-col">
          <div className="max-w-xl mx-auto px-5 py-5 mt-auto w-full">
            {/* Uploaded Images - Elegant display */}
            {uploadedImages.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pb-4 mb-5"
              >
                <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50/80 dark:bg-zinc-900/50 border border-neutral-100 dark:border-zinc-800">
                  <span className="text-[9px] font-medium text-neutral-400 dark:text-zinc-500 uppercase tracking-wider">Your space</span>
                  <div className="flex gap-2">
                    {uploadedImages.map((img, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 dark:bg-zinc-800 ring-1 ring-black/5 dark:ring-white/10 shadow-sm hover:ring-2 hover:ring-violet-500/30 transition-all cursor-pointer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Chat messages - Modern conversation thread */}
            <div className="space-y-4">
              {chatMessages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} index={0} />
              ))}
            </div>

            {/* Thinking indicator - Elegant and clean */}
            <AnimatePresence>
              {currentThinking && !questions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.3 }}
                  className="pt-4"
                >
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-zinc-900/80 dark:to-zinc-800/50 border border-neutral-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-1.5">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-violet-500"
                      />
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-zinc-400">Clarity</span>
                    </div>
                    <ThinkingIndicator 
                      agent={currentThinking.agent} 
                      action={currentThinking.action} 
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Questions - Clean, inline */}
            {questions && (
              <div className="pt-6 space-y-4">
                {questions.questions.map((q) => (
                  <QuestionCard
                    key={q.question_id}
                    question={q}
                    onAnswer={onQuestionAnswer}
                    selectedAnswer={answers[q.question_id]}
                    disabled={isLoading}
                  />
                ))}
                
                <motion.button
                  onClick={onSubmitAnswers}
                  disabled={!allQuestionsAnswered || isLoading}
                  whileHover={allQuestionsAnswered && !isLoading ? { scale: 1.01, y: -1 } : {}}
                  whileTap={allQuestionsAnswered && !isLoading ? { scale: 0.99 } : {}}
                  className={cn(
                    "w-full py-3 rounded-xl text-[13px] font-semibold transition-all duration-200",
                    allQuestionsAnswered && !isLoading
                      ? "bg-gradient-to-r from-neutral-900 to-neutral-800 dark:from-zinc-100 dark:to-zinc-200 text-white dark:text-zinc-900 shadow-lg shadow-neutral-900/25 dark:shadow-zinc-200/25 hover:shadow-xl hover:shadow-neutral-900/30 dark:hover:shadow-zinc-200/30"
                      : "bg-neutral-100 dark:bg-zinc-800 text-neutral-400 dark:text-zinc-500 cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1">
                      Continue
                      <motion.span
                        animate={{ x: [0, 3, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        →
                      </motion.span>
                    </span>
                  )}
                </motion.button>
              </div>
            )}

            {/* Results - Clean completion state */}
            {/* Show results as soon as we have generated phases - not just on completion */}
            {generatedPhases.length > 0 && uploadedImages.length > 0 && (
              <div className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  {transformationComplete ? (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">✓ Complete</span>
                  ) : (
                    <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                      In Progress - {generatedPhases.length} phase{generatedPhases.length !== 1 ? 's' : ''} generated
                    </span>
                  )}
                </div>
                <ResultsTimeline
                  originalImage={uploadedImages[0] || ""}
                  originalImages={uploadedImages}
                  phases={generatedPhases}
                  onViewWeaveTrace={() => {
                    if (weaveTraceUrl) window.open(weaveTraceUrl, "_blank");
                  }}
                />
              </div>
            )}

            {/* Error - Styled alert */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-4"
              >
                <div className="rounded-xl p-3 bg-red-50/80 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30">
                  <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
                </div>
              </motion.div>
            )}

            <div ref={chatEndRef} className="h-4" />
          </div>
        </div>

        {/* Input - Truly floating with glassmorphism */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          {/* Fade gradient behind input */}
          <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/60 to-transparent dark:from-zinc-950/95 dark:via-zinc-950/70 dark:to-transparent" />
          
          {/* Floating input card */}
          <div className="relative pointer-events-auto">
            <div className="glass-card rounded-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.3),0_4px_20px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.05)]">
              <PromptInputBox
                onSend={onSend}
                isLoading={isLoading}
                placeholder="Ask a follow-up..."
                compact
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Resizable Divider */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "w-1 hover:w-1.5 bg-transparent hover:bg-primary/20 dark:hover:bg-primary/30 cursor-col-resize transition-all duration-150 flex-shrink-0 relative group",
          isDragging && "w-1.5 bg-primary/30 dark:bg-primary/40"
        )}
      >
        {/* Drag handle indicator */}
        <div className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-black/10 dark:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity",
          isDragging && "opacity-100 bg-primary/50"
        )} />
      </div>

      {/* Right Panel - Agent Activity & Intelligence */}
      <motion.div
        {...slideInRight}
        transition={{ ...smoothTransition, delay: 0.15 }}
        style={{ width: `${100 - splitPosition}%` }}
        className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-slate-50/80 via-white/60 to-slate-50/80 dark:from-zinc-900/80 dark:via-zinc-950/60 dark:to-zinc-900/80 backdrop-blur-2xl min-w-[300px]"
      >
        {/* Panel header */}
        <div className="shrink-0 h-12 flex items-center justify-between px-5 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-xl">
          <span className="text-[13px] font-semibold text-neutral-700 dark:text-zinc-200">Activity Log</span>
          <div className="flex items-center gap-2">
            {/* Weave Trace Link - prominently visible */}
            {weaveTraceUrl && (
              <a
                href={weaveTraceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 rounded-lg bg-gradient-to-r from-orange-500/10 to-amber-500/10 text-orange-600 dark:text-orange-400 font-medium hover:from-orange-500/20 hover:to-amber-500/20 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                View in Weave
              </a>
            )}
            {agentCards.length > 0 && (
              <motion.span 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500/10 to-pink-500/10 text-violet-600 dark:text-violet-400 font-medium"
              >
                {agentCards.length} {agentCards.length === 1 ? 'event' : 'events'}
              </motion.span>
            )}
          </div>
        </div>
        
        {/* Scrollable content */}
        <div ref={activityScrollRef} className="flex-1 overflow-y-auto scrollbar-invisible p-4 flex flex-col">
          <div className="mt-auto space-y-4">
          {/* Batch Demo Console */}
          {orchestrationStatus?.is_batch && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-white/50 dark:border-white/10 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-sm font-medium text-neutral-700 dark:text-zinc-300">Batch Demo Console</h2>
                </div>
                <span className="text-[11px] text-neutral-500 dark:text-zinc-400">
                  {orchestrationStatus.completed_scenes ?? 0}/{orchestrationStatus.total_scenes ?? 0} complete
                </span>
              </div>

              {orchestrationStatus.scene_progress && orchestrationStatus.scene_progress.length > 0 && (
                <div className="space-y-2 mb-3">
                  {orchestrationStatus.scene_progress.map((scene) => (
                    <div
                      key={scene.scene_id}
                      className="flex items-center justify-between text-xs text-neutral-600 dark:text-zinc-400"
                    >
                      <span>Scene {scene.scene_index + 1}</span>
                      <span className="text-[11px]">
                        {scene.current_phase || scene.orchestration_state || scene.status}
                        {scene.has_warnings ? " ⚠" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {batchReport && (
                <div className="rounded-lg border border-white/50 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 p-3 text-xs text-neutral-600 dark:text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span>Patterns identified</span>
                    <span className="font-medium">{batchReport.summary.patterns_identified}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Average QC score</span>
                    <span className="font-medium">
                      {batchReport.summary.average_qc_score?.toFixed(2) ?? "—"}
                    </span>
                  </div>
                  {batchReport.recommendations.length > 0 && (
                    <div className="mt-2 text-[11px] text-neutral-500 dark:text-zinc-400">
                      Top rec: {batchReport.recommendations[0].title}
                    </div>
                  )}
                </div>
              )}

              {batchReportError && (
                <div className="text-[11px] text-red-500 mt-2">{batchReportError}</div>
              )}
            </motion.div>
          )}

          {/* Self-Improvement Intelligence Panel - KEY FEATURE */}
          <AnimatePresence>
            {(selfImprovementRetries.length > 0 || reasoningSteps.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <IntelligencePanel
                  cycles={selfImprovementRetries.map((retry, idx) => ({
                    id: `cycle-${idx}`,
                    timestamp: new Date().toLocaleTimeString(),
                    phase: retry.phase,
                    attemptNumber: retry.attemptNumber,
                    evaluationScore: retry.improved ? 0.85 : 0.55,
                    passed: retry.improved,
                    failureReasons: [retry.failureReason],
                    policyChanges: retry.policyChanges.map(pc => ({
                      type: pc.field,
                      oldValue: pc.oldValue,
                      newValue: pc.newValue,
                      rationale: pc.reason,
                    })),
                    weaveTraceUrl: weaveTraceUrl || undefined,
                  }))}
                  reasoningSteps={reasoningSteps.map(step => ({
                    id: step.id,
                    timestamp: step.timestamp,
                    agent: step.agent,
                    thought: step.thought,
                    action: step.action,
                  }))}
                  weaveProjectUrl={weaveTraceUrl || undefined}
                  isActive={orchestrationStatus?.state?.includes("generating") || orchestrationStatus?.state?.includes("evaluating") || false}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* DETAILED GENERATION PROGRESS - Primary demo component */}
          {/* Show when generation has started or is running */}
          {(isGenerationRunning || generationPhaseProgress.some(p => p.status !== "pending")) && (
            <GenerationProgress
              phases={generationPhaseProgress}
              currentPhaseIndex={currentGenerationPhaseIndex}
              isRunning={isGenerationRunning}
              onViewTrace={weaveTraceUrl ? () => window.open(weaveTraceUrl, "_blank") : undefined}
            />
          )}

          {/* Step Timeline - Comprehensive view of all steps */}
          {pipelineSteps.length > 0 && (
            <div className="p-4 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-white/50 dark:border-white/10 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-neutral-700 dark:text-zinc-300">Pipeline Steps</h2>
                  <StepSummary steps={pipelineSteps} />
                </div>
                {weaveTraceUrl && (
                  <a
                    href={weaveTraceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-neutral-500 dark:text-zinc-400 hover:text-neutral-700 dark:hover:text-zinc-200 transition-colors"
                  >
                    All traces →
                  </a>
                )}
              </div>
              <StepTimeline 
                steps={pipelineSteps} 
                weaveProjectUrl={weaveTraceUrl || undefined}
              />
            </div>
          )}

          {/* Evaluation Results */}
          {evaluationResults.length > 0 && (
            <EvaluationDetails evaluations={evaluationResults} />
          )}

          {/* Agent cards */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {agentCards.map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <AgentWorkCard {...card} weaveTraceUrl={weaveTraceUrl || undefined} />
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Loading skeleton */}
            {agentCards.length === 0 && isLoading && (
              <div className="space-y-3">
                <AgentCardSkeleton />
                <AgentCardSkeleton />
              </div>
            )}
            
            {/* Empty state - Premium look */}
            {agentCards.length === 0 && !isLoading && pipelineSteps.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center py-16"
              >
                <motion.div 
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/10"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Zap className="w-7 h-7 text-violet-500 dark:text-violet-400" />
                </motion.div>
                <p className="text-sm font-medium text-neutral-600 dark:text-zinc-300">Ready to assist</p>
                <p className="text-xs text-neutral-400 dark:text-zinc-500 mt-1.5 max-w-[200px] mx-auto">Upload an image and describe your vision to begin</p>
              </motion.div>
            )}
            
            <div ref={cardsEndRef} className="h-2" />
          </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Chat Bubble - Modern, clean with subtle containers
function ChatBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.type === "user";
  const isAssistant = message.type === "assistant";
  const isSystem = message.type === "system";
  const shouldStream = isAssistant && message.isNew;
  const isInsight = message.content.includes("🔍") || message.content.includes("**");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className={cn(
        "rounded-2xl p-4 transition-all duration-200",
        isUser 
          ? "bg-neutral-900 dark:bg-zinc-100 text-white dark:text-zinc-900 ml-8 shadow-lg shadow-neutral-900/10 dark:shadow-zinc-100/10"
          : isInsight
            ? "bg-gradient-to-br from-violet-50/80 to-pink-50/80 dark:from-violet-950/50 dark:to-pink-950/50 border border-violet-100/80 dark:border-violet-800/30 shadow-sm"
            : isSystem
              ? "bg-red-50/80 dark:bg-red-950/40 border border-red-100 dark:border-red-900/30 shadow-sm"
              : "bg-white/70 dark:bg-zinc-900/70 border border-neutral-100 dark:border-zinc-800 shadow-sm"
      )}>
        {/* Header row with role and subtle timestamp */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn(
            "text-[11px] font-medium",
            isUser 
              ? "text-white/70 dark:text-zinc-900/70" 
              : isInsight
                ? "text-violet-600/80 dark:text-violet-400/80"
                : isSystem
                  ? "text-red-600/80 dark:text-red-400/80"
                  : "text-neutral-500 dark:text-zinc-400"
          )}>
            {isUser ? "You" : "Clarity"}
          </span>
          {message.timestamp && (
            <span className="text-[9px] text-neutral-300 dark:text-zinc-600">
              {message.timestamp}
            </span>
          )}
        </div>
        
        {/* Message content */}
        <div className={cn(
          "text-[14px] leading-relaxed whitespace-pre-wrap",
          isUser 
            ? "text-white/90 dark:text-zinc-900/90" 
            : "text-neutral-700 dark:text-zinc-200"
        )}>
          {shouldStream ? (
            <StreamingChatMessage 
              content={message.content}
              isNew={true}
              speed={50}
            />
          ) : (
            parseMarkdown(message.content)
          )}
        </div>
        
        {/* Images - clean thumbnails */}
        {message.images && message.images.length > 0 && (
          <div className="mt-3 flex gap-2">
            {message.images.map((img, i) => (
              <div
                key={i}
                className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 dark:bg-zinc-800 ring-1 ring-black/5 dark:ring-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Status Indicator with animations and self-improvement info
function StatusIndicator({ status }: { status: OrchestrationStatusResponse }) {
  const getStatusColor = () => {
    if (status.state === "completed") return "text-green-600 dark:text-green-400 bg-green-500/10 dark:bg-green-500/20 border-green-500/20 dark:border-green-500/30";
    if (status.state === "failed") return "text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-500/20 border-red-500/20 dark:border-red-500/30";
    if (status.retry_count > 0) return "text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20 dark:border-amber-500/30";
    return "text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/20 dark:border-blue-500/30";
  };

  const isRetrying = status.state.includes("retrying");
  const isEvaluating = status.state.includes("evaluating");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "rounded-2xl border p-4",
        getStatusColor()
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Pipeline Status</span>
        <motion.span
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="text-xs px-2 py-0.5 rounded-full bg-current/10 capitalize"
        >
          {status.state.replace(/_/g, ' ')}
        </motion.span>
      </div>
      
      {status.current_phase && (
        <p className="text-xs opacity-80">
          Phase: <span className="font-medium capitalize">{status.current_phase}</span>
        </p>
      )}
      
      {/* Self-Improvement Indicator */}
      {status.retry_count > 0 && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 pt-3 border-t border-current/20"
        >
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 rounded-full border-2 border-current border-t-transparent"
            />
            <span className="text-xs font-semibold">Self-Improving</span>
          </div>
          <p className="text-xs opacity-70 mt-1">
            {isRetrying 
              ? `Analyzing failure and updating policy (attempt ${status.retry_count + 1})...`
              : isEvaluating
                ? `Checking quality after ${status.retry_count} improvement${status.retry_count > 1 ? 's' : ''}...`
                : `Made ${status.retry_count} improvement${status.retry_count > 1 ? 's' : ''} to optimize results`
            }
          </p>
        </motion.div>
      )}
      
      {/* Batch Progress */}
      {status.total_scenes && status.total_scenes > 1 && (
        <div className="mt-2 text-xs opacity-70">
          Scene {(status.completed_scenes || 0) + 1} of {status.total_scenes}
        </div>
      )}
    </motion.div>
  );
}
