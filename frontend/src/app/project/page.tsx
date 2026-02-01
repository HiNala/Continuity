"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Loader2,
  CheckCircle2,
  Sparkles,
  Target,
  Palette,
  Accessibility,
  DollarSign,
  Briefcase,
  Eye,
  Lock,
  Star,
  Move,
  Building2,
  Droplets,
  Trash2,
  Play,
  Wand2,
  Layers,
  Clock,
  Shield,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  createProject,
  analyzeGoal,
  submitAnswers,
  analyzeSpace,
  generateImages,
  evaluateAndImprove,
  startOrchestration,
  getOrchestrationStatus,
  ClarifyingQuestion,
  RequirementsResponse,
  AnalysisSummaryResponse,
  GenerationResponse,
  EvaluateAndImproveResponse,
  OrchestrationStatusResponse,
} from "@/lib/api";
import { SettingsDropdown } from "@/components/SettingsDropdown";
import { useToastContext } from "@/components/Providers";
import { ImageUpload } from "@/components/ImageUpload";
import { ResultsTimeline } from "@/components/ResultsTimeline";
import { ImprovementStory } from "@/components/ImprovementStory";

// ============================================
// Types
// ============================================
type Step = "input" | "questions" | "complete" | "analyzing" | "constraints" | "generating" | "results";

interface Answers {
  [questionId: string]: string | string[];
}

// ============================================
// Icon mapping for question types
// ============================================
const questionIcons: Record<string, React.ReactNode> = {
  space_type: <Target className="w-5 h-5" />,
  styles: <Palette className="w-5 h-5" />,
  accessibility: <Accessibility className="w-5 h-5" />,
  budget: <DollarSign className="w-5 h-5" />,
  intended_use: <Briefcase className="w-5 h-5" />,
};

// ============================================
// Main Component
// ============================================
export default function ProjectPage() {
  const router = useRouter();
  const toast = useToastContext();
  const [step, setStep] = useState<Step>("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project data
  const [goal, setGoal] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [identified, setIdentified] = useState<Record<string, string | boolean | number | string[]>>({});
  const [answers, setAnswers] = useState<Answers>({});
  const [requirements, setRequirements] = useState<RequirementsResponse | null>(
    null
  );
  
  // Spatial Analysis (Mission 03)
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummaryResponse | null>(null);
  
  // Generation (Mission 04)
  const [generationResult, setGenerationResult] = useState<GenerationResponse | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  
  // Quality Control (Mission 05)
  const [qcResult, setQcResult] = useState<EvaluateAndImproveResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // Orchestration (Mission 06)
  const [orchestrationStatus, setOrchestrationStatus] = useState<OrchestrationStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // ==========================================
  // ==========================================
  // Step 1: Create project and analyze goal
  // ==========================================
  const handleSubmitGoal = async () => {
    if (!goal.trim()) {
      setError("Please enter a goal for your visualization");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create the project with goal and images
      const project = await createProject({ 
        goal: goal.trim(),
        images: imageUrls,
      });
      setProjectId(project.project_id);

      // Analyze the goal
      const analysis = await analyzeGoal(project.project_id);
      setIdentified(analysis.identified);
      setQuestions(analysis.questions);

      if (analysis.questions_needed) {
        setStep("questions");
      } else {
        // No questions needed, submit empty answers
        const result = await submitAnswers(project.project_id, {
          responses: {},
        });
        setRequirements(result);
        setStep("complete");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // Step 2: Handle answer selection
  // ==========================================
  const handleSelectAnswer = (
    questionId: string,
    answerId: string,
    multiSelect: boolean
  ) => {
    setAnswers((prev) => {
      if (multiSelect) {
        const current = (prev[questionId] as string[]) || [];
        if (current.includes(answerId)) {
          return {
            ...prev,
            [questionId]: current.filter((id) => id !== answerId),
          };
        } else if (current.length < 3) {
          return { ...prev, [questionId]: [...current, answerId] };
        }
        return prev;
      } else {
        return { ...prev, [questionId]: answerId };
      }
    });
  };

  const isAnswerSelected = (questionId: string, answerId: string): boolean => {
    const answer = answers[questionId];
    if (Array.isArray(answer)) {
      return answer.includes(answerId);
    }
    return answer === answerId;
  };

  const allQuestionsAnswered = (): boolean => {
    return questions.every((q) => {
      const answer = answers[q.question_id];
      if (q.multi_select) {
        return Array.isArray(answer) && answer.length > 0;
      }
      return !!answer;
    });
  };

  // ==========================================
  // Step 3: Submit answers
  // ==========================================
  const handleSubmitAnswers = async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await submitAnswers(projectId, { responses: answers });
      setRequirements(result);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // Step 4: Analyze Space (Mission 03)
  // ==========================================
  const handleAnalyzeSpace = async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);
    setStep("analyzing");

    try {
      // Analyze with provided image URLs (if any)
      const result = await analyzeSpace(projectId, imageUrls.length > 0 ? imageUrls : undefined);
      setAnalysisSummary(result);
      setStep("constraints");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Spatial analysis failed");
      setStep("complete"); // Go back to complete step on error
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // Helpers for display
  // ==========================================
  const getConstructionStateLabel = (state: string | null) => {
    const labels: Record<string, string> = {
      unfinished: "Unfinished Construction",
      partially_complete: "Partially Complete",
      existing_finish: "Existing Finish",
    };
    return state ? labels[state] || state : "Unknown";
  };


  // ==========================================
  // Step 5: Generate Images (Mission 04)
  // ==========================================
  const handleGenerate = async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);
    setStep("generating");
    setCurrentPhase("cleanup");

    try {
      // Use the first image URL if available
      const inputImage = imageUrls.length > 0 ? imageUrls[0] : undefined;
      const result = await generateImages(projectId, inputImage);
      setGenerationResult(result);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStep("constraints"); // Go back to constraints on error
    } finally {
      setLoading(false);
      setCurrentPhase(null);
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case "cleanup":
        return <Trash2 className="w-5 h-5" />;
      case "structural":
        return <Building2 className="w-5 h-5" />;
      case "fixture":
        return <Droplets className="w-5 h-5" />;
      case "style":
        return <Palette className="w-5 h-5" />;
      default:
        return <Layers className="w-5 h-5" />;
    }
  };

  const getPhaseName = (phase: string) => {
    return phase.charAt(0).toUpperCase() + phase.slice(1);
  };

  // ==========================================
  // Orchestration Helpers (Mission 06)
  // ==========================================
  const formatOrchestrationState = (state: string): string => {
    const stateLabels: Record<string, string> = {
      created: "Ready to Start",
      gathering_requirements: "Gathering Requirements...",
      awaiting_clarification: "Awaiting Your Input",
      analyzing_space: "Analyzing Your Space...",
      generating_cleanup: "Generating Cleanup Phase...",
      evaluating_cleanup: "Evaluating Cleanup...",
      retrying_cleanup: "Retrying Cleanup...",
      generating_structural: "Generating Structural Phase...",
      evaluating_structural: "Evaluating Structural...",
      retrying_structural: "Retrying Structural...",
      generating_fixture: "Generating Fixture Phase...",
      evaluating_fixture: "Evaluating Fixtures...",
      retrying_fixture: "Retrying Fixtures...",
      generating_style: "Generating Style Variations...",
      evaluating_style: "Evaluating Styles...",
      retrying_style: "Retrying Styles...",
      completed: "Complete!",
      completed_with_warnings: "Complete (with warnings)",
      failed: "Failed",
    };
    return stateLabels[state] || state;
  };

  const isTerminalState = (state: string): boolean => {
    return ["completed", "completed_with_warnings", "failed"].includes(state);
  };

  const pollOrchestrationStatus = async (projectId: string) => {
    setIsPolling(true);
    
    const poll = async () => {
      try {
        const status = await getOrchestrationStatus(projectId);
        setOrchestrationStatus(status);
        
        // Update step based on state
        if (status.state.startsWith("generating_") || 
            status.state.startsWith("evaluating_") || 
            status.state.startsWith("retrying_")) {
          setStep("generating");
        } else if (status.state === "completed" || status.state === "completed_with_warnings") {
          setStep("results");
          setIsPolling(false);
          return;
        } else if (status.state === "failed") {
          setError("Orchestration failed");
          setStep("constraints");
          setIsPolling(false);
          return;
        }
        
        // Continue polling if not terminal
        if (!isTerminalState(status.state)) {
          setTimeout(poll, 2500); // Poll every 2.5 seconds
        } else {
          setIsPolling(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get status");
        setIsPolling(false);
      }
    };
    
    poll();
  };

  const handleStartOrchestration = async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);
    setStep("generating");

    try {
      // Start orchestration (non-blocking)
      await startOrchestration(projectId);
      
      // Begin polling for status
      pollOrchestrationStatus(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start orchestration");
      setStep("constraints");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // Step 6: Quality Control Evaluation (Mission 05)
  // ==========================================
  const handleEvaluate = async (iterationId: string) => {
    if (!projectId) return;

    setIsEvaluating(true);
    setError(null);

    try {
      const result = await evaluateAndImprove(projectId, iterationId);
      setQcResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setIsEvaluating(false);
    }
  };


  // ==========================================
  // Render
  // ==========================================
  return (
    <main className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">New Project</h1>
            <p className="text-sm text-slate-400">
              {step === "input" && "Describe your visualization goal"}
              {step === "questions" && "Answer a few questions"}
              {step === "complete" && "Requirements complete"}
              {step === "analyzing" && "Analyzing your space..."}
              {step === "constraints" && "Spatial analysis complete"}
              {step === "generating" && "Generating visualizations..."}
              {step === "results" && "Generation complete"}
            </p>
          </div>
          {/* Step indicator */}
          <div className="hidden md:flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${step === "input" ? "bg-continuity-500" : "bg-emerald-500"}`} />
            <div className={`w-2 h-2 rounded-full ${step === "questions" ? "bg-continuity-500" : step === "input" ? "bg-slate-600" : "bg-emerald-500"}`} />
            <div className={`w-2 h-2 rounded-full ${step === "complete" ? "bg-continuity-500" : ["analyzing", "constraints", "generating", "results"].includes(step) ? "bg-emerald-500" : "bg-slate-600"}`} />
            <div className={`w-2 h-2 rounded-full ${step === "analyzing" ? "bg-continuity-500 animate-pulse" : ["constraints", "generating", "results"].includes(step) ? "bg-emerald-500" : "bg-slate-600"}`} />
            <div className={`w-2 h-2 rounded-full ${step === "generating" ? "bg-continuity-500 animate-pulse" : step === "results" ? "bg-emerald-500" : "bg-slate-600"}`} />
          </div>
          {/* Settings Dropdown */}
          <SettingsDropdown
            onTestResult={(type, title, message) => {
              if (type === "success") {
                toast.success(title, message);
              } else {
                toast.error(title, message);
              }
            }}
          />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Step 1: Goal Input */}
        {step === "input" && (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-continuity-900/50 border border-continuity-500/30 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-continuity-400" />
              </div>
              <h2 className="text-2xl font-bold">
                What would you like to visualize?
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Describe your space and what you want to see. Be as specific or
                as general as you like — we&apos;ll ask clarifying questions if
                needed.
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div className="card">
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Example: Reimagine this space in 3 modern styles for a client presentation, with accessible design in mind."
                  className="w-full h-32 bg-transparent border-0 resize-none focus:outline-none text-lg placeholder:text-slate-600"
                />
              </div>

              {/* Image Upload */}
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-300">Add Images</span>
                  <span className="text-xs text-slate-500">(optional)</span>
                </div>
                <ImageUpload
                  images={imageUrls}
                  onImagesChange={setImageUrls}
                  maxImages={5}
                />
              </div>

              <button
                onClick={handleSubmitGoal}
                disabled={loading || !goal.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Clarifying Questions */}
        {step === "questions" && (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold">
                Just a few quick questions
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Help us understand exactly what you&apos;re looking for.
              </p>
            </div>

            {/* Already identified info */}
            {Object.keys(identified).length > 0 && (
              <div className="card bg-emerald-500/5 border-emerald-500/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-emerald-400 mb-1">
                      We detected from your goal:
                    </p>
                    <ul className="text-sm text-slate-300 space-y-1">
                      {identified.space_type && typeof identified.space_type === "string" && (
                        <li>Space type: {identified.space_type}</li>
                      )}
                      {Array.isArray(identified.styles) && identified.styles.length > 0 && (
                        <li>Styles: {identified.styles.join(", ")}</li>
                      )}
                      {identified.accessibility && (
                        <li>Accessibility required</li>
                      )}
                      {identified.budget && typeof identified.budget === "string" && (
                        <li>Budget: {identified.budget}</li>
                      )}
                      {identified.intended_use && typeof identified.intended_use === "string" && (
                        <li>Use: {identified.intended_use}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Questions */}
            <div className="space-y-6">
              {questions.map((question) => (
                <div key={question.question_id} className="card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-continuity-900/50 border border-continuity-500/30 flex items-center justify-center text-continuity-400">
                      {questionIcons[question.question_id] || (
                        <Target className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{question.question_text}</h3>
                      {question.multi_select && (
                        <p className="text-sm text-slate-500">
                          Select up to 3 options
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {question.possible_answers.map((option) => {
                      const selected = isAnswerSelected(
                        question.question_id,
                        option.answer_id
                      );
                      return (
                        <button
                          key={option.answer_id}
                          onClick={() =>
                            handleSelectAnswer(
                              question.question_id,
                              option.answer_id,
                              question.multi_select
                            )
                          }
                          className={`p-3 rounded-lg border text-left transition-all ${
                            selected
                              ? "bg-continuity-500/20 border-continuity-500 text-continuity-300"
                              : "bg-slate-800/50 border-slate-700 hover:border-slate-600 text-slate-300"
                          }`}
                        >
                          <span className="text-sm font-medium">
                            {option.answer_text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep("input");
                  setAnswers({});
                }}
                className="btn-secondary flex-1"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </button>
              <button
                onClick={handleSubmitAnswers}
                disabled={loading || !allQuestionsAnswered()}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === "complete" && requirements && (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold">Requirements Complete!</h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                We&apos;ve captured everything we need. Here&apos;s a summary of your
                project requirements.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold mb-4 text-lg">Project Summary</h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-slate-500">Original Goal</dt>
                  <dd className="text-slate-200">{requirements.original_goal}</dd>
                </div>
                {requirements.space_type && (
                  <div>
                    <dt className="text-sm text-slate-500">Space Type</dt>
                    <dd className="text-slate-200 capitalize">
                      {requirements.space_type.replace("_", " ")}
                    </dd>
                  </div>
                )}
                {requirements.style_targets.length > 0 && (
                  <div>
                    <dt className="text-sm text-slate-500">Target Styles</dt>
                    <dd className="flex flex-wrap gap-2 mt-1">
                      {requirements.style_targets.map((style) => (
                        <span
                          key={style}
                          className="px-3 py-1 bg-continuity-500/20 border border-continuity-500/30 rounded-full text-sm text-continuity-300 capitalize"
                        >
                          {style.replace("_", " ")}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-slate-500">Accessibility</dt>
                  <dd className="text-slate-200">
                    {requirements.accessibility_required
                      ? "Required"
                      : "Not required"}
                  </dd>
                </div>
                {requirements.budget_tier && (
                  <div>
                    <dt className="text-sm text-slate-500">Budget Tier</dt>
                    <dd className="text-slate-200 capitalize">
                      {requirements.budget_tier.replace("_", " ")}
                    </dd>
                  </div>
                )}
                {requirements.intended_use && (
                  <div>
                    <dt className="text-sm text-slate-500">Intended Use</dt>
                    <dd className="text-slate-200 capitalize">
                      {requirements.intended_use.replace("_", " ")}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="card bg-continuity-500/5 border-continuity-500/20">
              <div className="flex items-start gap-3">
                <Eye className="w-5 h-5 text-continuity-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-continuity-400 mb-1">Ready for Spatial Analysis</p>
                  <p className="text-sm text-slate-300 mb-4">
                    Our AI will analyze your space images to identify physical constraints 
                    like floor drains, plumbing, structural elements, and what can be moved.
                  </p>
                  <button
                    onClick={handleAnalyzeSpace}
                    disabled={loading}
                    className="btn-primary flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Eye className="w-5 h-5" />
                        Analyze Space
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => router.push("/")}
                className="btn-secondary flex-1"
              >
                Back to Home
              </button>
              <button
                onClick={() => {
                  setStep("input");
                  setGoal("");
                  setImageUrls([]);
                  setProjectId(null);
                  setQuestions([]);
                  setIdentified({});
                  setAnswers({});
                  setRequirements(null);
                  setAnalysisSummary(null);
                }}
                className="btn-primary flex-1"
              >
                Create Another Project
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Analyzing (Loading State) */}
        {step === "analyzing" && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-continuity-500/20 border border-continuity-500/30 flex items-center justify-center mx-auto">
                <Eye className="w-10 h-10 text-continuity-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold">Analyzing Your Space</h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Our AI is examining the images to identify physical constraints,
                structural elements, and what can be modified.
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <div className="card">
                <div className="space-y-4">
                  {["Detecting structural elements...", "Identifying plumbing constraints...", "Classifying elements..."].map((text, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-continuity-400" />
                      <span className="text-slate-300 text-sm">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Constraints Display */}
        {step === "constraints" && analysisSummary && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold">Spatial Analysis Complete</h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                We&apos;ve identified the physical constraints in your space.
                Here&apos;s what we found.
              </p>
            </div>

            {/* Construction State */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Construction State</h3>
                <span className="badge-info">
                  {getConstructionStateLabel(analysisSummary.construction_state)}
                </span>
              </div>
              <p className="text-slate-400 text-sm">{analysisSummary.summary}</p>
              
              {/* Confidence indicator */}
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-slate-500">Confidence:</span>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-continuity-500 rounded-full transition-all"
                    style={{ width: `${analysisSummary.confidence_overall * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">
                  {Math.round(analysisSummary.confidence_overall * 100)}%
                </span>
              </div>
            </div>

            {/* Constraints Summary */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Locked */}
              <div className="card border-red-500/20 bg-red-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-5 h-5 text-red-400" />
                  <span className="font-semibold text-red-400">Locked</span>
                </div>
                <p className="text-3xl font-bold text-white">{analysisSummary.locked_count}</p>
                <p className="text-xs text-slate-400 mt-1">Cannot be changed</p>
              </div>

              {/* Preferred */}
              <div className="card border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-amber-400" />
                  <span className="font-semibold text-amber-400">Preferred</span>
                </div>
                <p className="text-3xl font-bold text-white">{analysisSummary.preferred_count}</p>
                <p className="text-xs text-slate-400 mt-1">Should be preserved</p>
              </div>

              {/* Flexible */}
              <div className="card border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Move className="w-5 h-5 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">Flexible</span>
                </div>
                <p className="text-3xl font-bold text-white">{analysisSummary.flexible_count}</p>
                <p className="text-xs text-slate-400 mt-1">Can be modified</p>
              </div>
            </div>

            {/* Recommended Phases */}
            {analysisSummary.recommended_phases.length > 0 && (
              <div className="card">
                <h3 className="font-semibold mb-4">Recommended Generation Phases</h3>
                <div className="flex flex-wrap gap-2">
                  {analysisSummary.recommended_phases.map((phase, i) => (
                    <div
                      key={phase}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700"
                    >
                      <span className="w-5 h-5 rounded-full bg-continuity-500/20 flex items-center justify-center text-xs text-continuity-400 font-bold">
                        {i + 1}
                      </span>
                      <span className="text-sm capitalize">{phase}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Button */}
            <div className="card bg-continuity-500/5 border-continuity-500/20">
              <div className="flex items-start gap-3">
                <Wand2 className="w-5 h-5 text-continuity-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-continuity-400 mb-1">Ready to Generate</p>
                  <p className="text-sm text-slate-300 mb-4">
                    All constraints are captured. Start the self-improving generation pipeline
                    with automatic quality control and policy optimization.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleStartOrchestration}
                      disabled={loading || isPolling}
                      className="btn-primary flex items-center gap-2"
                    >
                      {loading || isPolling ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {isPolling ? "Running..." : "Starting..."}
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Start Pipeline
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={loading || isPolling}
                      className="btn-secondary flex items-center gap-2 text-sm"
                    >
                      Quick Generate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => router.push("/")}
                className="btn-secondary flex-1"
              >
                Back to Home
              </button>
              <button
                onClick={() => {
                  setStep("input");
                  setGoal("");
                  setImageUrls([]);
                  setProjectId(null);
                  setQuestions([]);
                  setIdentified({});
                  setAnswers({});
                  setRequirements(null);
                  setAnalysisSummary(null);
                  setGenerationResult(null);
                }}
                className="btn-primary flex-1"
              >
                Create Another Project
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Generating (Loading State with Orchestration) */}
        {step === "generating" && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-continuity-500/20 border border-continuity-500/30 flex items-center justify-center mx-auto">
                <Wand2 className="w-10 h-10 text-continuity-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold">
                {orchestrationStatus 
                  ? formatOrchestrationState(orchestrationStatus.state)
                  : "Generating Visualizations"}
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                {orchestrationStatus && orchestrationStatus.retry_count > 0 
                  ? `Self-improving... Retry ${orchestrationStatus.retry_count}`
                  : "Creating your design visualizations through our 4-phase transformation process."}
              </p>
            </div>

            {/* Phase Progress */}
            <div className="max-w-md mx-auto">
              <div className="card">
                <div className="space-y-4">
                  {["cleanup", "structural", "fixture", "style"].map((phase, i) => {
                    // Determine phase state from orchestration status
                    const orchPhase = orchestrationStatus?.current_phase;
                    const orchState = orchestrationStatus?.state || "";
                    
                    const isGenerating = orchState === `generating_${phase}`;
                    const isEvaluating = orchState === `evaluating_${phase}`;
                    const isRetrying = orchState === `retrying_${phase}`;
                    const isActive = isGenerating || isEvaluating || isRetrying || currentPhase === phase;
                    
                    // Phase is complete if we're past it
                    const phaseOrder = ["cleanup", "structural", "fixture", "style"];
                    const currentIdx = orchPhase ? phaseOrder.indexOf(orchPhase) : (currentPhase ? phaseOrder.indexOf(currentPhase) : -1);
                    const isComplete = currentIdx > i;
                    
                    return (
                      <div key={phase} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isComplete ? "bg-emerald-500" : 
                          isRetrying ? "bg-amber-500" :
                          isActive ? "bg-continuity-500" : 
                          "bg-slate-800"
                        }`}>
                          {isComplete ? (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          ) : isActive ? (
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          ) : (
                            getPhaseIcon(phase)
                          )}
                        </div>
                        <div className="flex-1">
                          <span className={`font-medium ${
                            isActive ? "text-white" : "text-slate-400"
                          }`}>
                            {getPhaseName(phase)}
                            {isRetrying && " (Retrying)"}
                          </span>
                          <p className="text-xs text-slate-500">
                            {isGenerating && "Generating..."}
                            {isEvaluating && "Quality check in progress..."}
                            {isRetrying && "Applying improvements..."}
                            {!isActive && phase === "cleanup" && "Removing debris and distractions"}
                            {!isActive && phase === "structural" && "Completing walls and floors"}
                            {!isActive && phase === "fixture" && "Placing fixtures and features"}
                            {!isActive && phase === "style" && "Applying design styles"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Orchestration Info */}
            {orchestrationStatus && (
              <div className="max-w-md mx-auto text-center text-xs text-slate-500">
                {isPolling && <span className="animate-pulse">Live updating...</span>}
              </div>
            )}
          </div>
        )}

        {/* Step 7: Results Display */}
        {step === "results" && generationResult && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold">Generation Complete!</h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Your design visualizations have been generated through all 4 phases.
              </p>
            </div>

            {/* Summary Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="card text-center">
                <Clock className="w-6 h-6 text-continuity-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">
                  {(generationResult.total_latency_ms / 1000).toFixed(1)}s
                </p>
                <p className="text-xs text-slate-400">Total Time</p>
              </div>
              <div className="card text-center">
                <Layers className="w-6 h-6 text-continuity-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">
                  {generationResult.phases.length}
                </p>
                <p className="text-xs text-slate-400">Phases Completed</p>
              </div>
              <div className="card text-center">
                <Palette className="w-6 h-6 text-continuity-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">
                  {generationResult.style_variations.length}
                </p>
                <p className="text-xs text-slate-400">Style Variations</p>
              </div>
            </div>

            {/* Phase Results */}
            <div className="card">
              <h3 className="font-semibold mb-4">Generation Timeline</h3>
              <div className="space-y-4">
                {generationResult.phases.map((phase, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      phase.success ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    }`}>
                      {phase.success ? <CheckCircle2 className="w-5 h-5" /> : getPhaseIcon(phase.phase)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium capitalize">{phase.phase}</p>
                      <p className="text-xs text-slate-400">
                        {phase.latency_ms ? `${(phase.latency_ms / 1000).toFixed(1)}s` : "N/A"}
                        {phase.error && ` • Error: ${phase.error}`}
                      </p>
                    </div>
                    {phase.success && (
                      <span className="badge-success">Complete</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Timeline */}
            {imageUrls.length > 0 && (
              <div className="card">
                <ResultsTimeline
                  originalImage={imageUrls[0]}
                  phases={generationResult.phases
                    .filter(p => p.success)
                    .map(p => ({
                      phase: p.phase,
                      imagePath: p.output_path || imageUrls[0],
                      iterationId: p.iteration_id,
                    }))}
                  styleVariations={generationResult.style_variations
                    .filter(v => v.success)
                    .map(v => ({
                      phase: v.style || "styled",
                      imagePath: v.output_path || imageUrls[0],
                    }))}
                  onViewWeaveTrace={(traceId) => {
                    window.open(`https://wandb.ai/traces/${traceId}`, "_blank");
                  }}
                />
              </div>
            )}

            {/* Improvement Story (if retries occurred) */}
            {orchestrationStatus && orchestrationStatus.retry_count > 0 && (
              <ImprovementStory
                retries={[{
                  phase: orchestrationStatus.current_phase || "generation",
                  attemptNumber: orchestrationStatus.retry_count + 1,
                  failureReason: "Quality check detected improvement opportunities",
                  policyChanges: qcResult?.policy_update?.changes_applied?.map((change: Record<string, unknown>) => ({
                    field: String(change.field || "policy"),
                    oldValue: String(change.old_value || "default"),
                    newValue: String(change.new_value || "optimized"),
                    reason: String(change.reason || "AI-driven optimization"),
                  })) || [],
                  improved: true,
                }]}
                onViewWeaveTrace={(traceId) => {
                  window.open(`https://wandb.ai/traces/${traceId}`, "_blank");
                }}
              />
            )}

            {/* Quality Control Section (Mission 05) */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-continuity-400" />
                  <h3 className="font-semibold">Quality Control</h3>
                </div>
                {generationResult.phases.length > 0 && generationResult.phases[0].iteration_id && (
                  <button
                    onClick={() => handleEvaluate(generationResult.phases[generationResult.phases.length - 1].iteration_id)}
                    disabled={isEvaluating}
                    className="btn-secondary flex items-center gap-2 text-sm py-1.5 px-3"
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Run QC Check
                      </>
                    )}
                  </button>
                )}
              </div>

              {!qcResult ? (
                <p className="text-sm text-slate-400">
                  Click &quot;Run QC Check&quot; to evaluate the generation quality and trigger self-improvement.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Evaluation Result */}
                  <div className={`p-4 rounded-lg ${
                    qcResult.evaluation.passed 
                      ? "bg-emerald-500/10 border border-emerald-500/20" 
                      : "bg-amber-500/10 border border-amber-500/20"
                  }`}>
                    <div className="flex items-center gap-3">
                      {qcResult.evaluation.passed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-amber-400" />
                      )}
                      <div>
                        <p className={`font-semibold ${
                          qcResult.evaluation.passed ? "text-emerald-400" : "text-amber-400"
                        }`}>
                          {qcResult.evaluation.passed ? "Quality Check Passed" : "Quality Issues Detected"}
                        </p>
                        <p className="text-sm text-slate-300">
                          Score: {(qcResult.evaluation.score * 100).toFixed(0)}% • 
                          Status: {qcResult.evaluation.status}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Analysis Insights */}
                  {qcResult.analysis && qcResult.analysis.insights.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-300 mb-2">Insights:</p>
                      <ul className="space-y-1">
                        {qcResult.analysis.insights.map((insight, i) => (
                          <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                            <span className="text-amber-400">•</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Policy Update */}
                  {qcResult.policy_update && (
                    <div className="p-3 rounded-lg bg-continuity-500/10 border border-continuity-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-continuity-400" />
                        <span className="text-sm font-medium text-continuity-400">
                          Self-Improvement Applied
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Policy updated from v{qcResult.policy_update.old_version} to v{qcResult.policy_update.new_version}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {qcResult.policy_update.changes_applied.length} change(s) applied to improve future generations
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Success/Error Message */}
            {generationResult.success ? (
              <div className="card bg-emerald-500/5 border-emerald-500/20">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-emerald-400 mb-1">Generation Complete!</p>
                    <p className="text-sm text-slate-300">
                      All phases completed successfully. Run QC Check to evaluate quality and 
                      trigger the self-improvement loop.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card bg-red-500/5 border-red-500/20">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-400 mb-1">Generation Issue</p>
                    <p className="text-sm text-slate-300">
                      {generationResult.error || "Some phases may have failed. Check the details above."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => router.push("/")}
                className="btn-secondary flex-1"
              >
                Back to Home
              </button>
              <button
                onClick={() => {
                  setStep("input");
                  setGoal("");
                  setImageUrls([]);
                  setProjectId(null);
                  setQuestions([]);
                  setIdentified({});
                  setAnswers({});
                  setRequirements(null);
                  setAnalysisSummary(null);
                  setGenerationResult(null);
                  setQcResult(null);
                }}
                className="btn-primary flex-1"
              >
                Create Another Project
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
