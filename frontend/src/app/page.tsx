"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { RotateCcw, ChevronRight, Sparkles, WifiOff, Zap } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { ContinuityLogo, ContinuityIcon } from "@/components/ui/continuity-logo";
import { AgentWorkCard, QuestionCard, ImageDisplayCard, type AgentWorkCardProps } from "@/components/ui/agent-work-card";
import { SettingsDropdown } from "@/components/SettingsDropdown";
import { StreamingChatMessage, ThinkingIndicator, LiveBadge } from "@/components/ui/streaming-text";
import { ProgressTimeline, CompactTimeline } from "@/components/ui/progress-timeline";
import { ToastProvider } from "@/components/ui/toast";
import { AgentCardSkeleton } from "@/components/ui/skeleton";
import { 
  createProject, 
  analyzeGoal, 
  submitAnswers,
  startOrchestration,
  getOrchestrationStatus,
  subscribeToOrchestration,
  submitOrchestrationClarification,
  getAgentReasoning,
  type AnalyzeGoalResponse,
  type OrchestrationStatusResponse,
  type StreamEvent,
  type AgentReasoningResponse,
} from "@/lib/api";

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
        
        // Add or update agent card based on state
        setAgentCards(prev => {
          const cardExists = prev.some(c => 
            c.details?.to_state === event.details?.to_state
          );
          
          if (!cardExists && event.agent) {
            return [...prev, {
              id: `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              agent: event.agent as AgentCard["agent"],
              title: event.message,
              content: getAgentDescription(event.agent, event.action || ""),
              status: "running" as const,
              action: mapActionToCardAction(event.action || ""),
              timestamp: new Date(event.timestamp).toLocaleTimeString(),
              details: event.details,
            }];
          }
          return prev;
        });
        break;
        
      case "progress":
        // Add assistant message for progress updates
        if (event.message && !event.message.includes("heartbeat")) {
          addChatMessage({
            type: "assistant",
            content: event.message,
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
        setCurrentThinking(null);
        setError(event.message);
        if (streamCleanupRef.current) {
          streamCleanupRef.current();
          streamCleanupRef.current = null;
        }
        addChatMessage({
          type: "system",
          content: `Error: ${event.message}`,
        });
        break;
        
      case "complete":
        setCurrentThinking(null);
        if (streamCleanupRef.current) {
          streamCleanupRef.current();
          streamCleanupRef.current = null;
        }
        // Mark last agent card as completed
        setAgentCards(prev => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              status: "completed",
            };
          }
          return updated;
        });
        addChatMessage({
          type: "assistant",
          content: event.details?.has_warnings 
            ? "Transformation complete with some minor adjustments. Check the results on the right."
            : "Your visualization is ready! Check the results on the right.",
        });
        break;
        
      case "heartbeat":
        // Just update connection status
        setIsConnected(true);
        break;
    }
  }, [addChatMessage]);

  // Helper functions for streaming
  const getAgentDescription = (agent: string, action: string): string => {
    const descriptions: Record<string, Record<string, string>> = {
      requirements: {
        analyzing: "Parsing your design goals and extracting structured requirements...",
        question: "Need additional information to understand your preferences...",
        default: "Processing requirements specification...",
      },
      spatial: {
        analyzing: "Examining images to identify physical constraints, fixtures, and boundaries...",
        default: "Analyzing spatial layout...",
      },
      generation: {
        generating_cleanup: "Removing visual noise and preparing the base image...",
        generating_structural: "Adding structural elements while respecting constraints...",
        generating_fixture: "Placing fixtures and furniture according to specifications...",
        generating_style: "Applying style and aesthetic transformations...",
        default: "Generating visualization...",
      },
      qc: {
        evaluating: "Checking output against quality criteria and constraints...",
        policy_update: "Analyzing results and adjusting generation parameters...",
        default: "Evaluating quality...",
      },
      orchestrator: {
        starting: "Initializing the multi-agent pipeline...",
        success: "All phases completed successfully!",
        error: "An error occurred during processing.",
        default: "Coordinating agent workflow...",
      },
    };
    
    return descriptions[agent]?.[action] || descriptions[agent]?.default || "Processing...";
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

  // Fetch reasoning when orchestration completes
  useEffect(() => {
    if (projectId && orchestrationStatus?.state && 
        (orchestrationStatus.state === "completed" || 
         orchestrationStatus.state === "completed_with_warnings")) {
      fetchAgentReasoning(projectId);
    }
  }, [projectId, orchestrationStatus?.state, fetchAgentReasoning]);

  const handleSend = async (message: string, files?: File[]) => {
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

      // Analyze goal
      const analysisCardId = addAgentCard({
        agent: "requirements",
        title: "Analyzing Requirements",
        content: "Understanding your design goals and extracting key details...",
        status: "running",
        action: "analyzing",
        timestamp: new Date().toLocaleTimeString(),
      });

      const analysis = await analyzeGoal(project.project_id);
      
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
          content: "I have a few questions to better understand your vision. Please answer them below.",
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
      setError(err instanceof Error ? err.message : "An error occurred");
      updateAgentCard(initCardId, {
        status: "error",
        content: `Error: ${err instanceof Error ? err.message : "An error occurred"}`,
        action: "error",
      });
      addChatMessage({
        type: "system",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
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
      setError(err instanceof Error ? err.message : "Failed to submit answers");
      updateAgentCard(submitCardId, {
        status: "error",
        content: `Error: ${err instanceof Error ? err.message : "Failed to submit answers"}`,
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
      updateAgentCard(orchestrateCardId, {
        status: "error",
        content: `Error: ${err instanceof Error ? err.message : "Failed to start pipeline"}`,
        action: "error",
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
    let hasReportedTerminal = false; // Prevent duplicate terminal state messages

    const poll = async () => {
      try {
        const status = await getOrchestrationStatus(pId);
        setOrchestrationStatus(status);

        if (status.state !== lastState) {
          lastState = status.state;

          if (status.state.includes("analyzing")) {
            addAgentCard({
              agent: "spatial",
              title: "Spatial Analysis",
              content: "Detecting physical constraints, fixtures, and spatial boundaries...",
              status: "running",
              action: "analyzing",
              timestamp: new Date().toLocaleTimeString(),
            });
          } else if (status.state.includes("generating")) {
            const phase = status.current_phase || "generation";
            addAgentCard({
              agent: "generation",
              title: `${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`,
              content: `Generating visualization for ${phase} transformation...`,
              status: "running",
              action: "generating",
              timestamp: new Date().toLocaleTimeString(),
            });
          } else if (status.state.includes("evaluating")) {
            addAgentCard({
              agent: "qc",
              title: "Quality Evaluation",
              content: "Assessing output quality and constraint compliance...",
              status: "running",
              action: "evaluating",
              timestamp: new Date().toLocaleTimeString(),
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
          
          addAgentCard({
            agent: "orchestrator",
            title: isSuccess ? "Transformation Complete" : "Pipeline Failed",
            content: isSuccess 
              ? status.has_warnings 
                ? "Visualization complete with minor warnings."
                : "Your space transformation is ready!"
              : "The generation pipeline encountered an error.",
            status: isSuccess ? "completed" : "error",
            action: isSuccess ? "success" : "error",
            timestamp: new Date().toLocaleTimeString(),
          });

          addChatMessage({
            type: "assistant",
            content: isSuccess 
              ? "Your visualization is complete! Check the results on the right." 
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
      <div className="min-h-screen text-foreground dark">
            <AnimatedBackground 
              isActive={appState === "active"} 
              intensity={appState === "active" ? "intense" : "normal"} 
              isLoading={isLoading}
            />

        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Animated Header - Enhanced */}
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
                  "mx-auto px-5 h-14 flex items-center justify-between rounded-2xl border bg-white/70 backdrop-blur-2xl shadow-lg transition-all duration-300",
                  appState === "welcome" 
                    ? "max-w-3xl border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)]" 
                    : "max-w-7xl border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                )}
              >
                {/* Logo and Branding */}
                <motion.div layout className="flex items-center gap-2.5">
                  <motion.div
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <ContinuityLogo size={26} />
                  </motion.div>
                  <span className="font-semibold text-[15px] tracking-tight text-foreground">Continuity</span>
                  
                  {/* Compact pipeline indicator in header when active */}
                  <AnimatePresence>
                    {appState !== "welcome" && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="hidden sm:flex items-center gap-2 ml-3 pl-3 border-l border-black/[0.06]"
                      >
                        <CompactTimeline currentStage={pipelineStage} className="w-24" />
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
                        transition={smoothTransition}
                        onClick={resetAll}
                        whileHover={{ scale: 1.02, backgroundColor: "rgba(0,0,0,0.02)" }}
                        whileTap={{ scale: 0.98 }}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-black/[0.06]"
                      >
                        <RotateCcw className="w-3 h-3" />
                        New project
                      </motion.button>
                    )}
                  </AnimatePresence>
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
                />
              )}
            </AnimatePresence>
          </main>

          {/* Animated Footer - Enhanced */}
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
                  "mx-auto px-4 h-10 flex items-center justify-between rounded-xl border bg-white/50 backdrop-blur-xl text-[11px]",
                  appState === "welcome" 
                    ? "max-w-3xl border-white/40" 
                    : "max-w-7xl border-black/[0.04]"
                )}
              >
                <motion.span 
                  className="flex items-center gap-1.5 text-muted-foreground/70"
                  whileHover={{ color: "var(--primary)" }}
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Sparkles className="w-3 h-3" />
                  </motion.div>
                  <span className="font-medium">WeaveHacks 3</span>
                </motion.span>
                <span className="text-muted-foreground/50 font-medium">Self-improving AI agents</span>
              </motion.div>
            </div>
          </motion.footer>
        </div>
      </div>
    </LayoutGroup>
    </ToastProvider>
  );
}

// Welcome View with staggered animations
function WelcomeView({ onSend, isLoading }: { onSend: (message: string, files?: File[]) => void; isLoading: boolean }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      transition: { duration: 0.3 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: smoothTransition,
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex-1 flex items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/60 bg-white/50 backdrop-blur-xl text-xs font-medium text-primary mb-5 shadow-sm"
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
            WeaveHacks 3
          </motion.div>
          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold tracking-tight text-balance text-foreground"
          >
            Transform any space
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="text-foreground/70 mt-4 text-base font-medium"
          >
            Upload photos and describe your ideal renovation
          </motion.p>
        </div>

        {/* Prompt input */}
        <motion.div variants={itemVariants}>
          <PromptInputBox 
            onSend={onSend} 
            isLoading={isLoading}
            placeholder="A warm, modern space with natural wood, soft lighting, and clean lines..." 
          />
        </motion.div>

        {/* Hints */}
        <motion.div
          variants={itemVariants}
          className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground/70"
        >
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-pink-400 to-rose-400" />
            Drop images or paste
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-sky-400" />
            Describe style in detail
          </span>
        </motion.div>

        {/* Features - more vibrant */}
        <motion.div
          variants={itemVariants}
          className="mt-12 grid grid-cols-3 gap-3"
        >
          {[
            { label: "Spatial analysis", desc: "Constraint detection", color: "bg-pink-50 border-pink-200/60 hover:border-pink-300", icon: "from-pink-400 to-rose-500" },
            { label: "Multi-agent", desc: "Progressive refinement", color: "bg-sky-50 border-sky-200/60 hover:border-sky-300", icon: "from-sky-400 to-cyan-500" },
            { label: "Photorealistic", desc: "High-fidelity renders", color: "bg-violet-50 border-violet-200/60 hover:border-violet-300", icon: "from-violet-400 to-purple-500" },
          ].map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ scale: 1.03, y: -3 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative p-4 rounded-xl border transition-all duration-200 cursor-default shadow-sm hover:shadow-md",
                item.color
              )}
            >
              <div className={cn("w-2 h-2 rounded-full bg-gradient-to-br mb-2", item.icon)} />
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5">{item.desc}</p>
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
        className="flex flex-col border-r border-black/[0.06] min-w-[280px]"
      >
        {/* Minimal header */}
        <div className="shrink-0 h-14 flex items-center justify-between px-4 border-b border-black/[0.04] bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center shadow-sm">
              <ContinuityIcon size={14} />
            </div>
            <span className="text-sm font-semibold text-foreground">Continuity</span>
          </div>
          {isConnected ? (
            <LiveBadge />
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </div>
          )}
        </div>

        {/* Messages area - clean, minimal */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-3">
          {/* Uploaded Images */}
          <AnimatePresence>
            {uploadedImages.length > 0 && (
              <ImageDisplayCard images={uploadedImages} title="Your space" />
            )}
          </AnimatePresence>

          {/* Chat messages */}
          <AnimatePresence mode="popLayout">
            {chatMessages.map((msg, index) => (
              <ChatBubble key={msg.id} message={msg} index={index} />
            ))}
          </AnimatePresence>

          {/* Questions */}
          <AnimatePresence>
            {questions && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {questions.questions.map((q, index) => (
                  <motion.div
                    key={q.question_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <QuestionCard
                      question={q}
                      onAnswer={onQuestionAnswer}
                      selectedAnswer={answers[q.question_id]}
                      disabled={isLoading}
                    />
                  </motion.div>
                ))}
                
                {/* Submit button - clean style */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={allQuestionsAnswered && !isLoading ? { scale: 1.01 } : {}}
                  whileTap={allQuestionsAnswered && !isLoading ? { scale: 0.99 } : {}}
                  onClick={onSubmitAnswers}
                  disabled={!allQuestionsAnswered || isLoading}
                  className={cn(
                    "w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2",
                    allQuestionsAnswered && !isLoading
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "bg-black/[0.04] text-muted-foreground/40 cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full"
                      />
                      Processing...
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status indicator */}
          <AnimatePresence>
            {orchestrationStatus && !questions && (
              <StatusIndicator status={orchestrationStatus} />
            )}
          </AnimatePresence>

          {/* Thinking indicator - cleaner */}
          <AnimatePresence>
            {currentThinking && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex gap-2.5"
              >
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center shrink-0">
                  <ContinuityIcon size={12} />
                </div>
                <div className="rounded-xl px-3 py-2 bg-black/[0.02] border border-black/[0.04] text-sm">
                  <ThinkingIndicator 
                    agent={currentThinking.agent} 
                    action={currentThinking.action} 
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error display - cleaner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-red-200 bg-red-50 p-3"
              >
                <p className="text-xs text-red-700">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input - Claude-style minimal */}
        <div className="shrink-0 p-3 border-t border-black/[0.04] bg-white/60 backdrop-blur-sm">
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
          "w-1 hover:w-1.5 bg-transparent hover:bg-primary/20 cursor-col-resize transition-all duration-150 flex-shrink-0 relative group",
          isDragging && "w-1.5 bg-primary/30"
        )}
      >
        {/* Drag handle indicator */}
        <div className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity",
          isDragging && "opacity-100 bg-primary/50"
        )} />
      </div>

      {/* Right Panel - Agent Activity */}
      <motion.div
        {...slideInRight}
        transition={{ ...smoothTransition, delay: 0.15 }}
        style={{ width: `${100 - splitPosition}%` }}
        className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50/30 to-white scrollbar-thin min-w-[280px]"
      >
        <div className="p-6 max-w-3xl mx-auto">
          {/* Progress Timeline */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6 p-4 rounded-xl bg-white/80 border border-black/[0.04] shadow-sm"
          >
            <ProgressTimeline currentStage={pipelineStage} />
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Agent Activity</h2>
              </div>
            </div>
            {weaveTraceUrl && (
              <a
                href={weaveTraceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1 px-2 py-1 rounded-md bg-primary/5 hover:bg-primary/10"
              >
                <Sparkles className="w-3 h-3" />
                View in Weave
              </a>
            )}
          </motion.div>

          {/* Agent cards */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {agentCards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{
                    ...smoothTransition,
                    delay: Math.min(index * 0.04, 0.2),
                  }}
                >
                  <AgentWorkCard {...card} weaveTraceUrl={weaveTraceUrl || undefined} />
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Loading skeleton when waiting for agents */}
            {agentCards.length === 0 && isLoading && (
              <div className="space-y-3">
                <AgentCardSkeleton />
                <AgentCardSkeleton />
              </div>
            )}
            
            {/* Empty state */}
            {agentCards.length === 0 && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 rounded-xl border border-dashed border-black/[0.08] bg-black/[0.01]"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-black/[0.03] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm text-muted-foreground/50">Agents will appear here as they work</p>
                <p className="text-xs text-muted-foreground/30 mt-1">Submit your design request to get started</p>
              </motion.div>
            )}
            
            <div ref={cardsEndRef} className="h-4" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Chat Bubble with clean design and streaming text
function ChatBubble({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.type === "user";
  const isSystem = message.type === "system";
  const isAssistant = message.type === "assistant";
  const shouldStream = isAssistant && message.isNew;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.25,
        delay: Math.min(index * 0.03, 0.15),
      }}
      className={cn(
        "flex gap-2.5",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {!isUser && (
        <div
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5",
            isSystem ? "bg-amber-100" : "bg-gradient-to-br from-primary/20 to-accent/20"
          )}
        >
          {isSystem ? (
            <span className="text-amber-600 text-[10px] font-bold">!</span>
          ) : (
            <ContinuityIcon size={12} />
          )}
        </div>
      )}
      <div
        className={cn(
          "rounded-xl px-3 py-2 max-w-[85%]",
          isUser 
            ? "bg-foreground text-background rounded-br-sm"
            : isSystem
              ? "bg-amber-50 border border-amber-200 text-amber-900"
              : "bg-black/[0.02] border border-black/[0.04] text-foreground rounded-bl-sm"
        )}
      >
        {shouldStream ? (
          <StreamingChatMessage 
            content={message.content}
            isNew={true}
            speed={60}
            className="text-[13px] leading-relaxed"
          />
        ) : (
          <p className="text-[13px] leading-relaxed">{message.content}</p>
        )}
        {/* Compact image thumbnails in messages */}
        {message.images && message.images.length > 0 && (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {message.images.map((img, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-md overflow-hidden border border-black/10"
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

// Status Indicator with animations
function StatusIndicator({ status }: { status: OrchestrationStatusResponse }) {
  const getStatusColor = () => {
    if (status.state === "completed") return "text-green-600 bg-green-500/10 border-green-500/20";
    if (status.state === "failed") return "text-red-600 bg-red-500/10 border-red-500/20";
    return "text-amber-600 bg-amber-500/10 border-amber-500/20";
  };

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
          Phase: {status.current_phase}
        </p>
      )}
      {status.retry_count > 0 && (
        <p className="text-xs opacity-80 mt-1">
          Retries: {status.retry_count}
        </p>
      )}
    </motion.div>
  );
}
