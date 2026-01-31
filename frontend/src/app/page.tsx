"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, ChevronRight, Sparkles } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { ContinuityLogo, ContinuityIcon } from "@/components/ui/continuity-logo";
import { AgentWorkCard, QuestionCard, ImageDisplayCard, type AgentWorkCardProps } from "@/components/ui/agent-work-card";
import { SettingsDropdown } from "@/components/SettingsDropdown";
import { 
  createProject, 
  analyzeGoal, 
  submitAnswers,
  startOrchestration,
  getOrchestrationStatus,
  type AnalyzeGoalResponse,
  type OrchestrationStatusResponse,
} from "@/lib/api";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

type AppState = "welcome" | "active";

interface AgentCard extends Omit<AgentWorkCardProps, 'id'> {
  id: string;
}

interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  images?: string[];
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
  
  const cardsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to latest card
  useEffect(() => {
    if (cardsEndRef.current) {
      cardsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentCards]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
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
      id: `msg-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
    };
    setChatMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  }, []);

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
      await submitAnswers(projectId, { responses: answers });
      
      updateAgentCard(submitCardId, {
        status: "completed",
        content: "All requirements captured successfully!",
      });

      addChatMessage({
        type: "assistant",
        content: "Perfect! Starting the transformation pipeline now...",
      });

      setQuestions(null);
      await startPipeline(projectId);

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
        content: "Pipeline active. Monitoring progress...",
      });

      startStatusPolling(pId);

    } catch (err) {
      updateAgentCard(orchestrateCardId, {
        status: "error",
        content: `Error: ${err instanceof Error ? err.message : "Failed to start pipeline"}`,
        action: "error",
      });
    }
  };

  const startStatusPolling = (pId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    let lastState = "";

    const poll = async () => {
      try {
        const status = await getOrchestrationStatus(pId);
        setOrchestrationStatus(status);

        // Only add cards on state changes
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

        // Check for terminal states
        if (status.state === "completed" || status.state === "completed_with_warnings" || status.state === "failed") {
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
    setAppState("welcome");
    setProjectId(null);
    setAgentCards([]);
    setUploadedImages([]);
    setQuestions(null);
    setAnswers({});
    setOrchestrationStatus(null);
    setError(null);
    setChatMessages([]);
  };

  const allQuestionsAnswered = questions 
    ? questions.questions.every(q => answers[q.question_id] !== undefined)
    : false;

  return (
    <div className="min-h-screen text-foreground dark">
      <AnimatedBackground isActive={appState === "active"} intensity={appState === "active" ? "intense" : "normal"} />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <Header appState={appState} onReset={resetAll} />

        {/* Main Content */}
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
              />
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <Footer appState={appState} />
      </div>
    </div>
  );
}

// Header Component
interface HeaderProps {
  appState: AppState;
  onReset: () => void;
}

function Header({ appState, onReset }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 shrink-0">
      <div className="mx-4 mt-4">
        <div className={cn(
          "mx-auto px-5 h-14 flex items-center justify-between rounded-2xl border border-white/60 bg-white/40 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-500",
          appState === "welcome" ? "max-w-3xl" : "max-w-7xl"
        )}>
          <div className="flex items-center gap-2.5">
            <ContinuityLogo size={26} />
            <span className="font-medium text-[15px] tracking-tight text-foreground/90">Continuity</span>
          </div>
          <div className="flex items-center gap-2">
            {appState !== "welcome" && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={onReset}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New project
              </motion.button>
            )}
            <SettingsDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}

// Footer Component
function Footer({ appState }: { appState: AppState }) {
  return (
    <footer className="relative z-10 shrink-0">
      <div className="mx-4 mb-4">
        <div className={cn(
          "mx-auto px-5 h-11 flex items-center justify-between rounded-2xl border border-white/40 bg-white/25 backdrop-blur-xl text-xs text-muted-foreground transition-all duration-500",
          appState === "welcome" ? "max-w-3xl" : "max-w-7xl"
        )}>
          <span className="flex items-center gap-2">
            <Sparkles className="w-3 h-3" />
            WeaveHacks 3
          </span>
          <span>Self-improving AI agents</span>
        </div>
      </div>
    </footer>
  );
}

// Welcome View Component
interface WelcomeViewProps {
  onSend: (message: string, files?: File[]) => void;
  isLoading: boolean;
}

function WelcomeView({ onSend, isLoading }: WelcomeViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/60 bg-white/50 backdrop-blur-xl text-xs font-medium text-primary mb-5 shadow-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            WeaveHacks 3
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-semibold tracking-tight text-balance bg-gradient-to-b from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent"
          >
            Transform any space
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-4 text-base"
          >
            Upload photos and describe your ideal renovation
          </motion.p>
        </div>

        {/* Prompt input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <PromptInputBox 
            onSend={onSend} 
            isLoading={isLoading}
            placeholder="A bright, modern kitchen with white oak cabinets..." 
          />
        </motion.div>

        {/* Hints */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
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

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-14 grid grid-cols-3 gap-3"
        >
          {[
            { label: "Spatial analysis", desc: "Constraint detection", gradient: "from-pink-500/20 to-rose-500/10" },
            { label: "Multi-agent", desc: "Progressive refinement", gradient: "from-cyan-500/20 to-sky-500/10" },
            { label: "Photorealistic", desc: "High-fidelity renders", gradient: "from-violet-500/20 to-purple-500/10" },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              className="group relative p-4 rounded-2xl border border-white/50 bg-white/30 backdrop-blur-xl hover:bg-white/40 hover:border-white/70 transition-all duration-300 cursor-default overflow-hidden shadow-sm"
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", item.gradient)} />
              <div className="relative">
                <p className="text-sm font-medium text-foreground/90">{item.label}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Split View Component
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
}: SplitViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex overflow-hidden"
    >
      {/* Left Panel - Chat Interface */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="w-[420px] min-w-[380px] border-r border-white/20 flex flex-col bg-gradient-to-b from-white/5 to-white/10 backdrop-blur-sm"
      >
        {/* Chat header */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <ContinuityIcon size={16} />
            </div>
            <div>
              <h2 className="text-sm font-medium text-foreground/90">Design Assistant</h2>
              <p className="text-xs text-muted-foreground/60">Interactive workspace</p>
            </div>
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Uploaded Images */}
          {uploadedImages.length > 0 && (
            <ImageDisplayCard images={uploadedImages} title="Your space" />
          )}

          {/* Chat messages */}
          {chatMessages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}

          {/* Questions */}
          {questions && (
            <div className="space-y-3">
              {questions.questions.map((q) => (
                <QuestionCard
                  key={q.question_id}
                  question={q}
                  onAnswer={onQuestionAnswer}
                  selectedAnswer={answers[q.question_id]}
                  disabled={isLoading}
                />
              ))}
              
              {/* Submit button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={onSubmitAnswers}
                disabled={!allQuestionsAnswered || isLoading}
                className={cn(
                  "w-full py-3 rounded-xl font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2",
                  allQuestionsAnswered && !isLoading
                    ? "bg-gradient-to-br from-primary to-accent text-white shadow-lg hover:shadow-xl hover:scale-[1.02]"
                    : "bg-white/20 text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                    />
                    Processing...
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </div>
          )}

          {/* Status indicator */}
          {orchestrationStatus && !questions && (
            <StatusIndicator status={orchestrationStatus} />
          )}

          {/* Error display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4"
            >
              <p className="text-sm text-red-700">{error}</p>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Bottom input */}
        <div className="p-4 border-t border-white/10">
          <PromptInputBox 
            onSend={onSend}
            isLoading={isLoading}
            placeholder="Ask a follow-up question..."
            compact
          />
        </div>
      </motion.div>

      {/* Right Panel - Agent Work Cards */}
      <motion.div
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex-1 overflow-y-auto"
      >
        <div className="p-6">
          {/* Panel header */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground/90">Agent Activity</h2>
            <p className="text-sm text-muted-foreground/60">Real-time pipeline progress</p>
          </div>

          {/* Cards */}
          <div className="max-w-2xl space-y-4">
            <AnimatePresence mode="popLayout">
              {agentCards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <AgentWorkCard {...card} />
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={cardsEndRef} className="h-4" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Chat Bubble Component
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.type === "user";
  const isSystem = message.type === "system";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {!isUser && (
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
          isSystem ? "bg-amber-500/20" : "bg-gradient-to-br from-primary/20 to-accent/20"
        )}>
          {isSystem ? (
            <span className="text-amber-600 text-xs">!</span>
          ) : (
            <ContinuityIcon size={14} />
          )}
        </div>
      )}
      <div className={cn(
        "rounded-2xl px-4 py-3 max-w-[85%]",
        isUser 
          ? "bg-gradient-to-br from-primary to-accent text-white rounded-br-md"
          : isSystem
            ? "bg-amber-500/10 border border-amber-500/20 text-amber-800"
            : "bg-white/40 border border-white/50 text-foreground/80 rounded-bl-md"
      )}>
        <p className="text-sm leading-relaxed">{message.content}</p>
        {message.images && message.images.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {message.images.map((img, i) => (
              <div key={i} className="rounded-lg overflow-hidden aspect-video">
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

// Status Indicator Component
function StatusIndicator({ status }: { status: OrchestrationStatusResponse }) {
  const getStatusColor = () => {
    if (status.state === "completed") return "text-green-600 bg-green-500/10 border-green-500/20";
    if (status.state === "failed") return "text-red-600 bg-red-500/10 border-red-500/20";
    return "text-amber-600 bg-amber-500/10 border-amber-500/20";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border p-4",
        getStatusColor()
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Pipeline Status</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-current/10 capitalize">
          {status.state.replace(/_/g, ' ')}
        </span>
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
