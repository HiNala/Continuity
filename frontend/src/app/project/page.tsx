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
  Zap,
  Wind,
  Trash2,
} from "lucide-react";
import {
  createProject,
  analyzeGoal,
  submitAnswers,
  analyzeSpace,
  ClarifyingQuestion,
  RequirementsResponse,
  AnalysisSummaryResponse,
} from "@/lib/api";

// ============================================
// Types
// ============================================
type Step = "input" | "questions" | "complete" | "analyzing" | "constraints";

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
  const [step, setStep] = useState<Step>("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project data
  const [goal, setGoal] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [identified, setIdentified] = useState<Record<string, any>>({});
  const [answers, setAnswers] = useState<Answers>({});
  const [requirements, setRequirements] = useState<RequirementsResponse | null>(
    null
  );
  
  // Spatial Analysis (Mission 03)
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummaryResponse | null>(null);

  // ==========================================
  // Image URL handling
  // ==========================================
  const addImageUrl = () => {
    const url = imageUrlInput.trim();
    if (url && !imageUrls.includes(url)) {
      setImageUrls([...imageUrls, url]);
      setImageUrlInput("");
    }
  };

  const removeImageUrl = (urlToRemove: string) => {
    setImageUrls(imageUrls.filter((url) => url !== urlToRemove));
  };

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

  const getElementIcon = (elementType: string) => {
    if (elementType.includes("wall") || elementType.includes("column") || elementType.includes("beam")) {
      return <Building2 className="w-4 h-4" />;
    }
    if (elementType.includes("drain") || elementType.includes("plumbing") || elementType.includes("water")) {
      return <Droplets className="w-4 h-4" />;
    }
    if (elementType.includes("electric") || elementType.includes("outlet") || elementType.includes("switch")) {
      return <Zap className="w-4 h-4" />;
    }
    if (elementType.includes("vent") || elementType.includes("hvac") || elementType.includes("duct")) {
      return <Wind className="w-4 h-4" />;
    }
    if (elementType.includes("debris") || elementType.includes("temporary")) {
      return <Trash2 className="w-4 h-4" />;
    }
    return <Target className="w-4 h-4" />;
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
            </p>
          </div>
          {/* Step indicator */}
          <div className="hidden md:flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${step === "input" ? "bg-continuity-500" : "bg-emerald-500"}`} />
            <div className={`w-2 h-2 rounded-full ${step === "questions" ? "bg-continuity-500" : step === "input" ? "bg-slate-600" : "bg-emerald-500"}`} />
            <div className={`w-2 h-2 rounded-full ${step === "complete" ? "bg-continuity-500" : ["analyzing", "constraints"].includes(step) ? "bg-emerald-500" : "bg-slate-600"}`} />
            <div className={`w-2 h-2 rounded-full ${step === "analyzing" ? "bg-continuity-500 animate-pulse" : step === "constraints" ? "bg-emerald-500" : "bg-slate-600"}`} />
          </div>
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
                as general as you like — we'll ask clarifying questions if
                needed.
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div className="card">
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Example: Show me this bathroom in 3 different modern styles. I need it to be ADA compliant for a commercial building."
                  className="w-full h-32 bg-transparent border-0 resize-none focus:outline-none text-lg placeholder:text-slate-600"
                />
              </div>

              {/* Image URL Input */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-300">Add Image URLs</span>
                  <span className="text-xs text-slate-500">(optional)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addImageUrl()}
                    placeholder="https://example.com/room-photo.jpg"
                    className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-continuity-500/50 focus:border-continuity-500"
                  />
                  <button
                    type="button"
                    onClick={addImageUrl}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                  >
                    Add
                  </button>
                </div>
                {imageUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {imageUrls.map((url, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg text-sm"
                      >
                        <span className="text-slate-300 truncate max-w-[200px]">
                          {url.split("/").pop() || `Image ${index + 1}`}
                        </span>
                        <button
                          onClick={() => removeImageUrl(url)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Add URLs to images of your space for AI spatial analysis
                </p>
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
                Help us understand exactly what you're looking for.
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
                      {identified.space_type && (
                        <li>Space type: {identified.space_type}</li>
                      )}
                      {identified.styles?.length > 0 && (
                        <li>Styles: {identified.styles.join(", ")}</li>
                      )}
                      {identified.accessibility && (
                        <li>Accessibility required</li>
                      )}
                      {identified.budget && (
                        <li>Budget: {identified.budget}</li>
                      )}
                      {identified.intended_use && (
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
                We've captured everything we need. Here's a summary of your
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
                  setImageUrlInput("");
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
                We've identified the physical constraints in your space.
                Here's what we found.
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

            {/* Next Steps */}
            <div className="card bg-amber-500/5 border-amber-500/20">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-400 mb-1">Next Steps</p>
                  <p className="text-sm text-slate-300">
                    Image generation will be available in Mission 04. Your spatial 
                    constraints are saved and ready to guide the generation process!
                  </p>
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
                  setImageUrlInput("");
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
      </div>
    </main>
  );
}
