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
