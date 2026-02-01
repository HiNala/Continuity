/**
 * Continuity - API Client
 * Handles all communication with the backend.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============================================
// Types
// ============================================
export interface CreateProjectRequest {
  goal: string;
  images?: string[];
  user_id?: string;
}

export interface CreateProjectResponse {
  project_id: string;
  status: string;
  created_at: string;
  message: string;
}

export interface QuestionOption {
  answer_id: string;
  answer_text: string;
}

export interface ClarifyingQuestion {
  question_id: string;
  question_text: string;
  possible_answers: QuestionOption[];
  multi_select: boolean;
}

export interface ImageAnalysisResult {
  analyzed: boolean;
  space_type: string | null;
  space_type_confidence: number | null;
  space_type_reasoning: string | null;
  construction_state: string | null;
  existing_styles: string[];
  accessibility_features: string[];
}

export interface AnalyzeGoalResponse {
  project_id: string;
  original_goal: string;
  identified: Record<string, string | boolean | number | string[]>;
  questions: ClarifyingQuestion[];
  questions_needed: boolean;
  image_analysis: ImageAnalysisResult | null;
}

export interface SubmitAnswersRequest {
  responses: Record<string, string | string[]>;
}

export interface RequirementsResponse {
  project_id: string;
  original_goal: string;
  space_type: string | null;
  style_targets: string[];
  accessibility_required: boolean;
  budget_tier: string | null;
  intended_use: string | null;
  questions_asked: number;
  created_at: string;
}

export interface ProjectResponse {
  project_id: string;
  status: string;
  goal: string | null;
  images: string[];
  created_at: string;
  updated_at: string;
  has_requirements: boolean;
}

// ============================================
// API Functions
// ============================================

/**
 * Create a new visualization project.
 */
export async function createProject(
  data: CreateProjectRequest
): Promise<CreateProjectResponse> {
  const response = await fetch(`${API_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to create project");
  }

  return response.json();
}

/**
 * Analyze the project's goal and get clarifying questions.
 */
export async function analyzeGoal(
  projectId: string
): Promise<AnalyzeGoalResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/analyze-goal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to analyze goal");
  }

  return response.json();
}

/**
 * Submit answers to clarifying questions.
 */
export async function submitAnswers(
  projectId: string,
  data: SubmitAnswersRequest
): Promise<RequirementsResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/submit-answers`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to submit answers");
  }

  return response.json();
}

/**
 * Get requirements for a project.
 */
export async function getRequirements(
  projectId: string
): Promise<RequirementsResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/requirements`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get requirements");
  }

  return response.json();
}

/**
 * Get project details.
 */
export async function getProject(projectId: string): Promise<ProjectResponse> {
  const response = await fetch(`${API_URL}/api/projects/${projectId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get project");
  }

  return response.json();
}

/**
 * List all projects.
 */
export async function listProjects(
  limit = 20,
  offset = 0
): Promise<ProjectResponse[]> {
  const response = await fetch(
    `${API_URL}/api/projects?limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to list projects");
  }

  return response.json();
}

/**
 * Test backend health.
 */
export async function checkHealth(): Promise<{
  status: string;
  timestamp: string;
  version: string;
  environment: string;
}> {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error("Backend health check failed");
  }

  return response.json();
}

// ============================================
// Spatial Analysis Types (Mission 03)
// ============================================
export interface ConstraintItem {
  id: string;
  element_type: string;
  location: string | null;
  classification: string;
  confidence: number;
  notes: string | null;
}

export interface AnalysisSummaryResponse {
  project_id: string;
  construction_state: string | null;
  image_quality: string | null;
  confidence_overall: number;
  locked_count: number;
  preferred_count: number;
  flexible_count: number;
  summary: string;
  recommended_phases: string[];
  analyzed_at: string;
}

export interface ConstraintsResponse {
  project_id: string;
  total_constraints: number;
  locked: ConstraintItem[];
  preferred: ConstraintItem[];
  flexible: ConstraintItem[];
}

// ============================================
// Spatial Analysis Functions (Mission 03)
// ============================================

/**
 * Trigger spatial analysis on project images.
 */
export async function analyzeSpace(
  projectId: string,
  imageUrls?: string[]
): Promise<AnalysisSummaryResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/analyze-space`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(imageUrls ? { image_urls: imageUrls } : {}),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to analyze space");
  }

  return response.json();
}

/**
 * Get spatial constraints for a project.
 */
export async function getConstraints(
  projectId: string
): Promise<ConstraintsResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/constraints`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get constraints");
  }

  return response.json();
}

/**
 * Get analysis summary for a project.
 */
export async function getAnalysisSummary(
  projectId: string
): Promise<AnalysisSummaryResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/analysis-summary`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get analysis summary");
  }

  return response.json();
}

// ============================================
// Generation Types (Mission 04)
// ============================================
export interface PhaseResult {
  phase: string;
  iteration_id: string;
  input_path: string | null;
  output_path: string | null;
  success: boolean;
  error: string | null;
  latency_ms: number | null;
  style?: string;
}

export interface GenerationResponse {
  project_id: string;
  input_image: string;
  policy_version: number;
  construction_state: string | null;
  phases: PhaseResult[];
  style_variations: PhaseResult[];
  total_latency_ms: number;
  success: boolean;
  error: string | null;
}

export interface IterationResponse {
  id: string;
  phase: string;
  iteration_number: number;
  input_image_path: string | null;
  output_image_path: string | null;
  output_image_url: string | null;  // Full URL for displaying
  prompt_used: string | null;
  generation_latency_ms: number | null;
  policy_version: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  // Evaluation fields
  evaluation_status: string | null;
  evaluation_score: number | null;
  evaluation_passed: boolean | null;
  // Weave trace ID
  weave_run_id: string | null;
}

export interface PolicyResponse {
  id: number | null;
  version: number;
  cleanup_config: Record<string, unknown>;
  structural_config: Record<string, unknown>;
  fixture_config: Record<string, unknown>;
  style_config: Record<string, unknown>;
}

// ============================================
// Generation Functions (Mission 04)
// ============================================

/**
 * Trigger full generation pipeline.
 */
export async function generateImages(
  projectId: string,
  inputImageUrl?: string
): Promise<GenerationResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputImageUrl ? { input_image_url: inputImageUrl } : {}),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Generation failed");
  }

  return response.json();
}

/**
 * Trigger a single generation phase.
 */
export async function generatePhase(
  projectId: string,
  phase: "cleanup" | "structural" | "fixture" | "style",
  inputImageUrl?: string
): Promise<PhaseResult> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/generate/${phase}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputImageUrl ? { input_image_url: inputImageUrl } : {}),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `${phase} generation failed`);
  }

  return response.json();
}

/**
 * Get all iterations for a project.
 */
export async function getIterations(
  projectId: string
): Promise<IterationResponse[]> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/iterations`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get iterations");
  }

  return response.json();
}

/**
 * Get policy for a project.
 */
export async function getPolicy(
  projectId: string
): Promise<PolicyResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/policy`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get policy");
  }

  return response.json();
}

// ============================================
// QC & Evaluation Types (Mission 05)
// ============================================
export interface CriterionResult {
  criterion: string;
  passed: boolean;
  score: number;
  details: string;
  evidence: Record<string, unknown>;
}

export interface EvaluationResponse {
  success: boolean;
  iteration_id: string;
  overall_score: number | null;
  passed: boolean | null;
  status: string | null;
  evaluations: CriterionResult[] | null;
  threshold: number;
  error: string | null;
}

export interface FailureAnalysisResponse {
  iteration_id: string;
  phase: string;
  overall_score: number | null;
  failed_criteria: Array<{
    criterion: string;
    score: number;
    details: string;
    evidence: Record<string, unknown>;
  }>;
  insights: string[];
  recommended_changes: Array<{
    type: string;
    rationale: string;
    [key: string]: unknown;
  }>;
}

export interface PolicyChangeRecord {
  id: string;
  old_policy_id: number;
  new_policy_id: number;
  trigger_iteration_id: string | null;
  trigger_reason: string | null;
  changes_made: Array<Record<string, unknown>>;
  rationale: string | null;
  created_at: string;
}

export interface EvaluateAndImproveResponse {
  evaluation: {
    passed: boolean;
    score: number;
    status: string;
  };
  analysis: {
    insights: string[];
    recommended_changes: Array<Record<string, unknown>>;
  } | null;
  policy_update: {
    old_version: number;
    new_version: number;
    changes_applied: Array<Record<string, unknown>>;
  } | null;
}

// ============================================
// QC & Evaluation Functions (Mission 05)
// ============================================

/**
 * Evaluate an iteration against all quality criteria.
 */
export async function evaluateIteration(
  projectId: string,
  iterationId: string,
  targetStyle?: string
): Promise<EvaluationResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/iterations/${iterationId}/evaluate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(targetStyle ? { target_style: targetStyle } : {}),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Evaluation failed");
  }

  return response.json();
}

/**
 * Analyze a failed iteration to understand what went wrong.
 */
export async function analyzeFailure(
  projectId: string,
  iterationId: string
): Promise<FailureAnalysisResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/analyze-failure?iteration_id=${iterationId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failure analysis failed");
  }

  return response.json();
}

/**
 * Apply policy changes to create a new policy version.
 */
export async function applyPolicyChanges(
  projectId: string,
  changes: Array<Record<string, unknown>>,
  triggerIterationId?: string
): Promise<{
  success: boolean;
  old_version: number;
  new_version: number;
  new_policy_id: number;
  changes_applied: Array<Record<string, unknown>>;
}> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/apply-policy-change`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changes,
        trigger_iteration_id: triggerIterationId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to apply policy changes");
  }

  return response.json();
}

/**
 * Get policy change history for a project.
 */
export async function getPolicyHistory(
  projectId: string
): Promise<PolicyChangeRecord[]> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/policy-history`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get policy history");
  }

  return response.json();
}

/**
 * Full QC pipeline: evaluate, analyze, and improve.
 */
export async function evaluateAndImprove(
  projectId: string,
  iterationId: string
): Promise<EvaluateAndImproveResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/evaluate-and-improve?iteration_id=${iterationId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Evaluate and improve failed");
  }

  return response.json();
}

// ============================================
// Orchestration Types (Mission 06)
// ============================================
export interface OrchestrationStatusResponse {
  project_id: string;
  state: string;
  status: string;
  current_phase: string | null;
  retry_count: number;
  has_warnings: boolean;
  warning_details: Array<Record<string, unknown>> | null;
  started_at: string | null;
  completed_at: string | null;
  recent_transitions: Array<{
    from: string;
    to: string;
    trigger: string;
    at: string;
  }>;
  // Batch processing fields
  total_scenes?: number;
  completed_scenes?: number;
  is_batch?: boolean;
}

export interface OrchestrationLogEntry {
  id: string;
  from_state: string;
  to_state: string;
  trigger: string;
  details: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

export interface OrchestrationResult {
  project_id: string;
  state: string;
  status: string;
  has_warnings: boolean;
  started_at: string | null;
  completed_at: string | null;
}

// ============================================
// Orchestration Functions (Mission 06)
// ============================================

/**
 * Start orchestration for a project.
 */
export async function startOrchestration(
  projectId: string,
  skipRequirements: boolean = false
): Promise<OrchestrationResult> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skip_requirements: skipRequirements }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to start orchestration");
  }

  return response.json();
}

/**
 * Submit clarification answers during orchestration.
 */
export async function submitOrchestrationClarification(
  projectId: string,
  answers: Record<string, string>
): Promise<OrchestrationResult> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/submit-clarification`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to submit clarification");
  }

  return response.json();
}

/**
 * Get orchestration status (use for polling).
 */
export async function getOrchestrationStatus(
  projectId: string
): Promise<OrchestrationStatusResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/status`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get status");
  }

  return response.json();
}

/**
 * Retry orchestration from a specific phase or beginning.
 */
export async function retryOrchestration(
  projectId: string,
  fromPhase?: string
): Promise<OrchestrationResult> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/retry`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fromPhase ? { from_phase: fromPhase } : {}),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to retry");
  }

  return response.json();
}

/**
 * Get complete orchestration log.
 */
export async function getOrchestrationLog(
  projectId: string
): Promise<OrchestrationLogEntry[]> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/log`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get log");
  }

  return response.json();
}

// ============================================
// Settings & API Test Types
// ============================================
export interface APITestResult {
  service: string;
  success: boolean;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface AllAPITestsResult {
  weave: APITestResult;
  gemini: APITestResult;
  browserbase: APITestResult;
  redis: APITestResult;
  database: APITestResult;
}

export interface SettingsStatus {
  weave_configured: boolean;
  gemini_configured: boolean;
  browserbase_configured: boolean;
  redis_configured: boolean;
  database_configured: boolean;
  environment: string;
}

// ============================================
// Settings & API Test Functions
// ============================================

/**
 * Get current settings status (which keys are configured).
 */
export async function getSettingsStatus(): Promise<SettingsStatus> {
  const response = await fetch(`${API_URL}/api/settings/status`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get settings status");
  }

  return response.json();
}

/**
 * Test W&B/Weave API key.
 */
export async function testWeaveAPI(): Promise<APITestResult> {
  const response = await fetch(`${API_URL}/api/settings/test/weave`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to test Weave API");
  }

  return response.json();
}

/**
 * Test Google Gemini API key.
 */
export async function testGeminiAPI(): Promise<APITestResult> {
  const response = await fetch(`${API_URL}/api/settings/test/gemini`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to test Gemini API");
  }

  return response.json();
}

/**
 * Test Browserbase API key.
 */
export async function testBrowserbaseAPI(): Promise<APITestResult> {
  const response = await fetch(`${API_URL}/api/settings/test/browserbase`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to test Browserbase API");
  }

  return response.json();
}

/**
 * Test database connectivity.
 */
export async function testDatabaseAPI(): Promise<APITestResult> {
  const response = await fetch(`${API_URL}/api/settings/test/database`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to test database");
  }

  return response.json();
}

/**
 * Test Redis connectivity.
 */
export async function testRedisAPI(): Promise<APITestResult> {
  const response = await fetch(`${API_URL}/api/settings/test/redis`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to test Redis");
  }

  return response.json();
}

/**
 * Test all API keys at once.
 */
export async function testAllAPIs(): Promise<AllAPITestsResult> {
  const response = await fetch(`${API_URL}/api/settings/test/all`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to test APIs");
  }

  return response.json();
}

// ============================================
// Self-Improvement Test Types and Functions
// ============================================
export interface SelfImprovementTestSummary {
  total: number;
  passed: number;
  failed: number;
  rate: number;
  timestamp?: string;
  error?: string;
}

export interface SelfImprovementTestResult {
  summary: SelfImprovementTestSummary;
  tests: Record<string, {
    test_name: string;
    passed: boolean;
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
    steps?: Array<{
      name: string;
      status: string;
      timestamp: string;
    }>;
    errors?: string[];
    metrics?: Record<string, unknown>;
    weave_trace_url?: string;
  }>;
  weave_url?: string;
}

/**
 * Run the self-improvement test suite.
 * Tests verify that agents are truly self-improving.
 */
export async function runSelfImprovementTests(): Promise<SelfImprovementTestResult> {
  const response = await fetch(`${API_URL}/api/settings/test/self-improvement`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to run self-improvement tests");
  }

  return response.json();
}

// ============================================
// Streaming Types
// ============================================
export type StreamEventType = 
  | "agent" 
  | "thinking" 
  | "progress" 
  | "question" 
  | "error" 
  | "complete" 
  | "heartbeat"
  // Batch processing events
  | "scene_start"
  | "scene_complete"
  | "scene_error"
  | "batch_progress"
  // Self-improvement events
  | "learning"
  | "policy_update";

export type AgentName = 
  | "requirements" 
  | "spatial" 
  | "generation" 
  | "qc" 
  | "orchestrator"
  | "system";

export interface StreamEvent {
  event: StreamEventType;
  agent?: AgentName;
  action?: string;
  message: string;
  details?: {
    // Common fields
    from_state?: string;
    to_state?: string;
    trigger?: string;
    duration_ms?: number;
    // Retry/self-improvement fields
    retry_number?: number;
    phase?: string;
    score?: number;
    policy_version?: number;
    changes_applied?: Array<Record<string, unknown>>;
    // Batch processing fields
    scene_id?: string;
    scene_index?: number;
    total_scenes?: number;
    completed?: number;
    is_batch?: boolean;
    // Learning fields
    improvements_made?: number;
    benefiting_scenes?: number;
    learning_applied?: boolean;
    // Warning/error fields
    has_warnings?: boolean;
    warning_details?: Array<Record<string, unknown>>;
    error?: string;
    // Any other fields
    [key: string]: unknown;
  };
  timestamp: string;
}

export interface AgentReasoningStep {
  type: string;
  agent: string;
  reasoning?: string;
  from_state?: string;
  to_state?: string;
  trigger?: string;
  details?: Record<string, unknown>;
  duration_ms?: number;
  timestamp: string;
  phase?: string;
  iteration_number?: number;
  prompt_used?: string;
  status?: string;
  latency_ms?: number;
  evaluation_score?: number;
  evaluation_status?: string;
}

export interface AgentReasoningResponse {
  project_id: string;
  reasoning_steps: AgentReasoningStep[];
  weave_trace_url: string | null;
}

// ============================================
// Streaming Functions
// ============================================

/**
 * Subscribe to orchestration progress updates via SSE.
 */
export function subscribeToOrchestration(
  projectId: string,
  onEvent: (event: StreamEvent) => void,
  onError?: (error: Error) => void
): () => void {
  const eventSource = new EventSource(`${API_URL}/api/projects/${projectId}/stream`);
  let closedByClient = false;
  
  const handleEvent = (e: MessageEvent) => {
    if (!e.data || e.data === "undefined" || e.data === "null") {
      return;
    }

    try {
      const data = JSON.parse(e.data) as StreamEvent;
      onEvent(data);
    } catch (err) {
      console.warn("Failed to parse SSE event:", err, e.data);
    }
  };
  
  // Listen to all event types
  const eventTypes: StreamEventType[] = [
    "agent",
    "thinking", 
    "progress",
    "question",
    "error",
    "complete",
    "heartbeat",
    // Batch processing events
    "scene_start",
    "scene_complete", 
    "scene_error",
    "batch_progress",
    // Self-improvement events
    "learning",
    "policy_update",
  ];
  
  eventTypes.forEach(eventType => {
    eventSource.addEventListener(eventType, handleEvent);
  });
  
  eventSource.onerror = (err) => {
    if (closedByClient) {
      return;
    }

    const isClosed = eventSource.readyState === EventSource.CLOSED;
    if (isClosed) {
      console.error("SSE connection error:", err);
      onError?.(new Error("Connection lost"));
    } else {
      console.warn("SSE connection interrupted, retrying...", err);
    }
  };
  
  // Return cleanup function
  return () => {
    closedByClient = true;
    eventSource.close();
  };
}

/**
 * Get agent reasoning and tool call history.
 */
export async function getAgentReasoning(
  projectId: string
): Promise<AgentReasoningResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/reasoning`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get reasoning");
  }

  return response.json();
}

// ============================================
// Evaluation Detail Types
// ============================================
export interface EvaluationDetailResponse {
  iteration_id: string;
  phase: string;
  iteration_number: number;
  overall_passed: boolean;
  overall_score: number;
  criteria: CriterionResult[];
  failure_reasons: string[];
  evaluated_at: string;
}

// ============================================
// Evaluation Detail Function
// ============================================

/**
 * Get detailed evaluation results for a specific iteration.
 * Returns all criteria scores, pass/fail status, and evidence.
 */
export async function getIterationEvaluation(
  projectId: string,
  iterationId: string
): Promise<EvaluationDetailResponse> {
  const response = await fetch(
    `${API_URL}/api/projects/${projectId}/iterations/${iterationId}/evaluation`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to get evaluation details");
  }

  return response.json();
}

/**
 * Get all iterations with their images for a project.
 * Includes both successful and failed iterations.
 */
export async function getAllProjectImages(
  projectId: string
): Promise<{
  uploaded_images: string[];
  iterations: IterationResponse[];
}> {
  const [project, iterations] = await Promise.all([
    getProject(projectId),
    getIterations(projectId)
  ]);

  return {
    uploaded_images: project.images || [],
    iterations: iterations
  };
}
