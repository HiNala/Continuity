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

export interface AnalyzeGoalResponse {
  project_id: string;
  original_goal: string;
  identified: Record<string, any>;
  questions: ClarifyingQuestion[];
  questions_needed: boolean;
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
  prompt_used: string | null;
  generation_latency_ms: number | null;
  policy_version: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
}

export interface PolicyResponse {
  id: number | null;
  version: number;
  cleanup_config: Record<string, any>;
  structural_config: Record<string, any>;
  fixture_config: Record<string, any>;
  style_config: Record<string, any>;
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
