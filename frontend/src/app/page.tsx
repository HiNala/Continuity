"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, ChevronRight } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { ContinuityLogo } from "@/components/ui/continuity-logo";
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
  
  const cardsEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to latest card
  useEffect(() => {
    if (cardsEndRef.current) {
      cardsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentCards]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const addAgentCard = (card: Omit<AgentCard, 'id'>) => {
    const newCard = { ...card, id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
    setAgentCards(prev => [...prev, newCard]);
    return newCard.id;
  };

  const updateAgentCard = (id: string, updates: Partial<AgentCard>) => {
    setAgentCards(prev => prev.map(card => 
      card.id === id ? { ...card, ...updates } : card
    ));
  };

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

    // Transition to active state
    setAppState("active");

    // Add initial card
    const initCardId = addAgentCard({
      agent: "orchestrator",
      title: "Starting Pipeline",
      content: `Processing your request: "${message.length > 100 ? message.slice(0, 100) + '...' : message}"`,
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
        content: `Project created successfully. ID: ${project.project_id.slice(0, 8)}...`
      });

      // Analyze goal
      const analysisCardId = addAgentCard({
        agent: "requirements",
        title: "Analyzing Your Goal",
        content: "Extracting requirements and identifying what information we need...",
        status: "running",
        action: "analyzing",
        timestamp: new Date().toLocaleTimeString(),
      });

      const analysis = await analyzeGoal(project.project_id);
      
      updateAgentCard(analysisCardId, {
        status: "completed",
        content: analysis.questions_needed 
          ? `Found ${Object.keys(analysis.identified).length} details in your request. Need ${analysis.questions.length} more pieces of information.`
          : "All requirements extracted from your description. Ready to proceed!",
        details: analysis.identified,
      });

      if (analysis.questions_needed) {
        setQuestions(analysis);
        addAgentCard({
          agent: "requirements",
          title: "Clarification Needed",
          content: "Please answer the following questions to help me understand your vision better.",
          status: "completed",
          action: "question",
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        // No questions needed, start orchestration
        await startPipeline(project.project_id);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      updateAgentCard(initCardId, {
        status: "error",
        content: `Error: ${err instanceof Error ? err.message : "An error occurred"}`,
        action: "error",
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
    
    const submitCardId = addAgentCard({
      agent: "requirements",
      title: "Processing Answers",
      content: "Saving your preferences...",
      status: "running",
      action: "thinking",
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      await submitAnswers(projectId, { responses: answers });
      
      updateAgentCard(submitCardId, {
        status: "completed",
        content: "Requirements captured successfully!",
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
      title: "Starting Generation Pipeline",
      content: "Initiating the multi-agent workflow...",
      status: "running",
      action: "thinking",
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      await startOrchestration(pId);
      
      updateAgentCard(orchestrateCardId, {
        status: "completed",
        content: "Pipeline started. Monitoring progress...",
      });

      // Start polling for status
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

    const poll = async () => {
      try {
        const status = await getOrchestrationStatus(pId);
        setOrchestrationStatus(status);

        // Add cards based on state changes
        if (status.state.includes("analyzing")) {
          addAgentCard({
            agent: "spatial",
            title: "Spatial Analysis",
            content: "Analyzing spatial constraints and identifying physical elements...",
            status: "running",
            action: "analyzing",
            timestamp: new Date().toLocaleTimeString(),
          });
        } else if (status.state.includes("generating")) {
          const phase = status.current_phase || "generation";
          addAgentCard({
            agent: "generation",
            title: `Generating: ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`,
            content: `Creating visualization for ${phase} phase...`,
            status: "running",
            action: "generating",
            timestamp: new Date().toLocaleTimeString(),
          });
        } else if (status.state.includes("evaluating")) {
          addAgentCard({
            agent: "qc",
            title: "Quality Control",
            content: "Evaluating output quality and constraint compliance...",
            status: "running",
            action: "evaluating",
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        // Check for terminal states
        if (status.state === "completed" || status.state === "completed_with_warnings" || status.state === "failed") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          addAgentCard({
            agent: "orchestrator",
            title: status.state === "failed" ? "Pipeline Failed" : "Pipeline Complete",
            content: status.state === "failed" 
              ? "The generation pipeline encountered an error."
              : status.has_warnings 
                ? "Visualization complete with some warnings."
                : "Visualization complete! Check the results below.",
            status: status.state === "failed" ? "error" : "completed",
            action: status.state === "failed" ? "error" : "success",
            timestamp: new Date().toLocaleTimeString(),
          });
        }

      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    // Initial poll
    poll();

    // Set up interval
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
  };

  const allQuestionsAnswered = questions 
    ? questions.questions.every(q => answers[q.question_id] !== undefined)
    : false;

  return (
    <div className="min-h-screen text-foreground dark">
      <AnimatedBackground isActive={appState === "active"} intensity={appState === "active" ? "intense" : "normal"} />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50">
          <div className="mx-4 mt-4">
            <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between rounded-2xl border border-white/60 bg-white/40 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div className="flex items-center gap-2.5">
                <ContinuityLogo size={26} />
                <span className="font-medium text-[15px] tracking-tight text-foreground/90">Continuity</span>
              </div>
              <div className="flex items-center gap-2">
                {appState !== "welcome" && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={resetAll}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Start over
                  </motion.button>
                )}
                <SettingsDropdown />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex">
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
                error={error}
                onSend={handleSend}
              />
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="relative z-10">
          <div className="mx-4 mb-4">
            <div className="max-w-7xl mx-auto px-5 h-11 flex items-center justify-between rounded-2xl border border-white/40 bg-white/25 backdrop-blur-xl text-xs text-muted-foreground">
              <span>WeaveHacks 3</span>
              <span>Self-improving AI agents</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
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
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
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
  error,
  onSend,
}: SplitViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex"
    >
      {/* Left Panel - Chat Interface */}
      <div className="w-[400px] min-w-[360px] border-r border-white/30 flex flex-col bg-white/10 backdrop-blur-sm">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Uploaded Images */}
          {uploadedImages.length > 0 && (
            <ImageDisplayCard images={uploadedImages} />
          )}

          {/* Questions */}
          {questions && questions.questions.map((q) => (
            <QuestionCard
              key={q.question_id}
              question={q}
              onAnswer={onQuestionAnswer}
              selectedAnswer={answers[q.question_id]}
              disabled={isLoading}
            />
          ))}

          {/* Submit button for questions */}
          {questions && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={onSubmitAnswers}
              disabled={!allQuestionsAnswered || isLoading}
              className={cn(
                "w-full py-3 rounded-xl font-medium text-sm transition-all duration-300",
                allQuestionsAnswered && !isLoading
                  ? "bg-gradient-to-br from-primary to-accent text-white shadow-lg hover:shadow-xl"
                  : "bg-white/30 text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              {isLoading ? "Processing..." : "Continue"}
              {allQuestionsAnswered && !isLoading && <ChevronRight className="inline-block ml-1 w-4 h-4" />}
            </motion.button>
          )}

          {/* Status display */}
          {orchestrationStatus && (
            <div className="rounded-2xl border border-white/50 bg-white/30 backdrop-blur-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground/80">Status</span>
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  orchestrationStatus.state === "completed" ? "bg-green-500/20 text-green-700" :
                  orchestrationStatus.state === "failed" ? "bg-red-500/20 text-red-700" :
                  "bg-amber-500/20 text-amber-700"
                )}>
                  {orchestrationStatus.state.replace(/_/g, ' ')}
                </span>
              </div>
              {orchestrationStatus.current_phase && (
                <p className="text-xs text-muted-foreground">
                  Current phase: {orchestrationStatus.current_phase}
                </p>
              )}
              {orchestrationStatus.retry_count > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Retry count: {orchestrationStatus.retry_count}
                </p>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Bottom input */}
        <div className="p-4 border-t border-white/20">
          <PromptInputBox 
            onSend={onSend}
            isLoading={isLoading}
            placeholder="Ask a follow-up question..."
            compact
          />
        </div>
      </div>

      {/* Right Panel - Agent Work Cards */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <AnimatePresence mode="popLayout">
            {agentCards.map((card) => (
              <AgentWorkCard key={card.id} {...card} />
            ))}
          </AnimatePresence>
          <div ref={cardsEndRef} />
        </div>
      </div>
    </motion.div>
  );
}
