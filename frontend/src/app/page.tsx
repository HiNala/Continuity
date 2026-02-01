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
import { StreamingChatMessage, ThinkingIndicator, LiveBadge } from "@/components/ui/streaming-text";
import { ProgressTimeline, CompactTimeline } from "@/components/ui/progress-timeline";
import { ToastProvider } from "@/components/ui/toast";
import { AgentCardSkeleton } from "@/components/ui/skeleton";
import { ThemeToggle, useTheme } from "@/components/ThemeProvider";
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
  type AnalyzeGoalResponse,
  type OrchestrationStatusResponse,
  type StreamEvent,
  type AgentReasoningResponse,
  type IterationResponse,
} from "@/lib/api";
import { APP_CONFIG, getHeaderText, getFooterText } from "@/lib/config";

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

export default function ContinuityApp() {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [agentCards, setAgentCards] = useState<AgentCard[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [questions, setQuestions] = useState<AnalyzeGoalResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [orchestrationStatus, setOrchestrationStatus] = useState<OrchestrationStatusResponse | null>(null);
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
  
  const cardsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const messageCounterRef = useRef(0);

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

  // Handle streaming events from SSE
  const handleStreamEvent = useCallback((event: StreamEvent) => {
    setIsConnected(true);
    
    switch (event.event) {
      case "agent":
      case "thinking":
        // Update current thinking state
        if (event.agent && event.action) {
          setCurrentThinking({ agent: event.agent, action: event.action });
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
              imagePath: event.details?.output_path as string | undefined,
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
        // If output path is provided, add to generated phases (with deduplication)
        if (event.details?.output_path) {
          setGeneratedPhases(prev => {
            const exists = prev.some(p => p.imagePath === event.details?.output_path);
            if (exists) return prev;
            return [...prev, {
              phase: `Scene ${(event.details?.scene_index || 0) + 1}`,
              imagePath: event.details?.output_path || "",
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
        setOrchestrationStatus(prev => ({
          ...prev!,
          completed_scenes: event.details?.completed,
          total_scenes: event.details?.total,
        }));
        break;
        
      case "progress":
        // Add assistant message for progress updates
        if (event.message && !event.message.includes("heartbeat")) {
          addChatMessage({
            type: "assistant",
            content: event.message,
          });
        }
        // Capture generated images from progress events
        if (event.details?.output_path && event.details?.phase) {
          setGeneratedPhases(prev => {
            // Avoid duplicates
            const exists = prev.some(p => p.imagePath === event.details?.output_path);
            if (exists) return prev;
            return [...prev, {
              phase: event.details?.phase || "Generation",
              imagePath: event.details?.output_path || "",
              iterationId: event.details?.iteration_id,
              evaluationPassed: event.details?.evaluation_passed,
              evaluationScore: event.details?.evaluation_score,
              iterationNumber: event.details?.iteration_number || 1,
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
        // Fetch all iterations to display in timeline
        if (projectId) {
          fetchIterations(projectId);
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
  const fetchIterations = useCallback(async (pId: string) => {
    try {
      const iterations = await getIterations(pId);
      const phases: typeof generatedPhases = [];
      const seenPaths = new Set<string>(); // Deduplication for successful iterations
      
      // Group by phase and show all attempts (including failures)
      for (const iter of iterations) {
        const imagePath = iter.output_image_url || iter.output_image_path || "";
        const isFailed = iter.status === "failed" || iter.status === "error";
        
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
      
      setGeneratedPhases(phases);
      
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
    
    // Process images
    const imageUrls: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onload = (e) => {
            imageUrls.push(e.target?.result as string);
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      setUploadedImages(imageUrls);
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
      await startOrchestration(pId);
      
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
  };

  const allQuestionsAnswered = questions 
    ? questions.questions.every(q => answers[q.question_id] !== undefined)
    : false;

  // Derive pipeline stage from orchestration status
  const getPipelineStage = (): "requirements" | "spatial" | "generation" | "qc" | "complete" => {
    if (!orchestrationStatus) return "requirements";
    const state = orchestrationStatus.state;
    const phase = orchestrationStatus.current_phase;
    
    if (state === "completed") return "complete";
    if (state === "failed") return "requirements";
    if (phase?.includes("qc") || phase?.includes("quality")) return "qc";
    if (phase?.includes("generat") || phase?.includes("render")) return "generation";
    if (phase?.includes("spatial") || phase?.includes("analy")) return "spatial";
    return "requirements";
  };

  const pipelineStage = getPipelineStage();

  return (
    <ToastProvider>
    <LayoutGroup>
      <div className="h-screen overflow-hidden text-foreground bg-background transition-colors duration-300">
            <AnimatedBackground 
              isActive={appState === "active"} 
              intensity={appState === "active" ? "intense" : "normal"} 
              isLoading={isLoading}
            />

        <div className="relative z-10 h-full flex flex-col">
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
                  <span className="font-semibold text-sm text-neutral-900 dark:text-zinc-100">Continuity</span>
                  
                  {/* Status in header when active */}
                  <AnimatePresence>
                    {appState !== "welcome" && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="hidden sm:flex items-center gap-3 ml-4 pl-4 border-l border-neutral-200 dark:border-zinc-700"
                      >
                        <CompactTimeline currentStage={pipelineStage} className="w-20" />
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
                  <SettingsDropdown />
                </motion.div>
              </motion.div>
            </div>
          </motion.header>

          {/* Main Content with smooth transitions */}
          <main className="flex-1 flex overflow-hidden">
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
                />
              )}
            </AnimatePresence>
          </main>

          {/* Footer - Minimal (welcome only) */}
          {appState === "welcome" && (
            <motion.footer
              layout
              transition={springTransition}
              className="relative z-10 shrink-0"
            >
              <div className="mx-4 mb-4">
                <motion.div
                  layout
                  transition={springTransition}
                  className={cn(
                    "mx-auto px-4 h-9 flex items-center justify-center rounded-lg text-[11px] text-neutral-400 dark:text-zinc-500",
                    "max-w-2xl"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    <span>{APP_CONFIG.event}</span>
                    <span className="text-neutral-300 dark:text-zinc-600">•</span>
                    <span>Self-improving AI agents</span>
                  </span>
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
      className="flex-1 flex items-center justify-center px-6 py-8 overflow-hidden"
    >
      <div className="w-full max-w-xl welcome-fit">
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
          
          {/* Badge */}
          <motion.div variants={itemVariants}>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-zinc-800 text-xs font-medium text-neutral-600 dark:text-zinc-300 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {getFooterText()}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-5xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-100"
          >
            Transform any space
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="text-neutral-500 dark:text-zinc-400 mt-3 text-lg"
          >
            Upload photos and describe your vision
          </motion.p>
        </div>

        {/* Prompt input */}
        <motion.div variants={itemVariants}>
          <PromptInputBox 
            onSend={onSend} 
            isLoading={isLoading}
            placeholder={APP_CONFIG.demo.placeholderPrompt}
          />
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
          className="mt-10 hidden sm:grid grid-cols-3 gap-3"
        >
          {[
            { label: "Spatial Analysis", desc: "Constraint detection", lightColor: "bg-pink-50 border-pink-100", darkColor: "dark:bg-pink-950/30 dark:border-pink-900/30" },
            { label: "Self-Improving", desc: "Quality feedback loop", lightColor: "bg-violet-50 border-violet-100", darkColor: "dark:bg-violet-950/30 dark:border-violet-900/30" },
            { label: "Photorealistic", desc: "High-fidelity output", lightColor: "bg-cyan-50 border-cyan-100", darkColor: "dark:bg-cyan-950/30 dark:border-cyan-900/30" },
          ].map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ y: -2 }}
              className={cn(
                "p-4 rounded-xl border transition-all",
                item.lightColor,
                item.darkColor
              )}
            >
              <p className="text-sm font-medium text-neutral-900 dark:text-zinc-100">{item.label}</p>
              <p className="text-xs text-neutral-500 dark:text-zinc-400 mt-0.5">{item.desc}</p>
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
}: SplitViewProps) {
  const [splitPosition, setSplitPosition] = useState(50); // Default 50%
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        className="flex flex-col border-r border-white/40 dark:border-white/10 min-w-[280px] bg-white/70 dark:bg-zinc-950/80 backdrop-blur-xl"
      >
        {/* Minimal header */}
        <div className="shrink-0 h-11 flex items-center justify-between px-4 border-b border-white/30 dark:border-white/10 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
          <span className="text-[13px] font-medium text-neutral-600 dark:text-zinc-300">Conversation</span>
          <span className={`text-[10px] ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400 dark:text-zinc-500'}`}>
            {isConnected ? '● Connected' : '○ Offline'}
          </span>
        </div>

        {/* Messages area - clean, document-like */}
        <div className="flex-1 overflow-y-auto scrollbar-on-hover">
          <div className="max-w-2xl mx-auto px-6 py-4">
            {/* Uploaded Images - Compact at top */}
            {uploadedImages.length > 0 && (
              <div className="pb-4 mb-4 border-b border-neutral-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-neutral-400 dark:text-zinc-500">Uploaded</span>
                  <div className="flex gap-2">
                    {uploadedImages.map((img, i) => (
                      <div key={i} className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 dark:bg-zinc-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Chat messages - Clean conversation thread */}
            <div className="divide-y divide-neutral-100 dark:divide-zinc-800/50">
              {chatMessages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} index={0} />
              ))}
            </div>

            {/* Thinking indicator - Simple and clean */}
            <AnimatePresence>
              {currentThinking && !questions && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-4 border-t border-neutral-100 dark:border-zinc-800/50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-medium text-neutral-400 dark:text-zinc-500">Continuity</span>
                  </div>
                  <ThinkingIndicator 
                    agent={currentThinking.agent} 
                    action={currentThinking.action} 
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Questions - Clean, inline */}
            {questions && (
              <div className="py-4 border-t border-neutral-100 dark:border-zinc-800/50 space-y-4">
                {questions.questions.map((q) => (
                  <QuestionCard
                    key={q.question_id}
                    question={q}
                    onAnswer={onQuestionAnswer}
                    selectedAnswer={answers[q.question_id]}
                    disabled={isLoading}
                  />
                ))}
                
                <button
                  onClick={onSubmitAnswers}
                  disabled={!allQuestionsAnswered || isLoading}
                  className={cn(
                    "w-full py-2.5 rounded-lg text-[13px] font-medium transition-colors",
                    allQuestionsAnswered && !isLoading
                      ? "bg-neutral-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-neutral-800 dark:hover:bg-zinc-200"
                      : "bg-neutral-100 dark:bg-zinc-800 text-neutral-400 dark:text-zinc-500 cursor-not-allowed"
                  )}
                >
                  {isLoading ? "Processing..." : "Continue →"}
                </button>
              </div>
            )}

            {/* Results - Clean completion state */}
            {transformationComplete && generatedPhases.length > 0 && uploadedImages.length > 0 && (
              <div className="py-4 border-t border-neutral-100 dark:border-zinc-800/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">✓ Complete</span>
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

            {/* Error - Simple text */}
            {error && (
              <div className="py-4 border-t border-neutral-100 dark:border-zinc-800/50">
                <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div ref={chatEndRef} className="h-4" />
          </div>
        </div>

        {/* Input - Minimal */}
        <div className="shrink-0 px-6 py-3 border-t border-white/30 dark:border-white/10 bg-white/60 dark:bg-zinc-950/70 backdrop-blur-xl shadow-[0_-6px_20px_rgba(0,0,0,0.08)]">
          <PromptInputBox
            onSend={onSend}
            isLoading={isLoading}
            placeholder="Ask a follow-up..."
            compact
          />
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
        className="flex-1 overflow-y-auto bg-gradient-to-br from-neutral-50/60 to-white/80 dark:from-zinc-900/60 dark:to-zinc-950/80 backdrop-blur-xl scrollbar-thin min-w-[300px]"
      >
        <div className="p-5 space-y-5">
          {/* Progress Timeline - Clean header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-white/50 dark:border-white/10 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          >
            <ProgressTimeline currentStage={pipelineStage} />
          </motion.div>

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

          {/* Agent Activity Section - Compact cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-medium text-neutral-600 dark:text-zinc-400">Activity Log</span>
              {agentCards.length > 0 && (
                <span className="text-[10px] text-neutral-400 dark:text-zinc-500">
                  {agentCards.length} events
                </span>
              )}
            </div>

            {/* Agent cards */}
            <div className="space-y-2">
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
                <div className="space-y-2">
                  <AgentCardSkeleton />
                  <AgentCardSkeleton />
                </div>
              )}
              
              {/* Empty state */}
              {agentCards.length === 0 && !isLoading && pipelineSteps.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-neutral-400 dark:text-zinc-500">Waiting for activity...</p>
                </div>
              )}
              
              <div ref={cardsEndRef} className="h-2" />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Chat Bubble - Clean, minimal, Anthropic-inspired
function ChatBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.type === "user";
  const isAssistant = message.type === "assistant";
  const shouldStream = isAssistant && message.isNew;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="py-3"
    >
      {/* Simple role label */}
      <div className="flex items-center gap-2 mb-1.5">
        {isUser ? (
          <span className="text-[11px] font-medium text-neutral-500 dark:text-zinc-400">You</span>
        ) : (
          <span className="text-[11px] font-medium text-neutral-500 dark:text-zinc-400">Continuity</span>
        )}
        {message.timestamp && (
          <span className="text-[10px] text-neutral-300 dark:text-zinc-600">{message.timestamp}</span>
        )}
      </div>
      
      {/* Message content - just text, no bubble */}
      <div className={cn(
        "text-[14px] leading-[1.7] text-neutral-800 dark:text-zinc-200",
        isUser && "text-neutral-600 dark:text-zinc-300"
      )}>
        {shouldStream ? (
          <StreamingChatMessage 
            content={message.content}
            isNew={true}
            speed={40}
          />
        ) : (
          <span className="whitespace-pre-wrap">{message.content}</span>
        )}
      </div>
      
      {/* Images - clean thumbnails */}
      {message.images && message.images.length > 0 && (
        <div className="mt-3 flex gap-2">
          {message.images.map((img, i) => (
            <div
              key={i}
              className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-100 dark:bg-zinc-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
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
