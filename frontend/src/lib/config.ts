/**
 * Clarity - Application Configuration
 * 
 * Centralized configuration for branding, feature flags, and app settings.
 */

export const APP_CONFIG = {
  // Branding
  name: "Clarity",
  tagline: "Self-Improving AI for Design Visualization",
  event: "WeaveHacks 3",
  version: "1.0.0",
  
  // API Configuration
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  
  // Feature Flags
  features: {
    darkMode: true,
    batchProcessing: true,
    selfImprovement: true,
    weaveTracing: true,
    browserbaseIntegration: true,
  },
  
  // Demo Configuration
  demo: {
    enabled: true,
    placeholderPrompt: "Transform this unfinished space into a cozy modern kitchen with warm wood tones...",
    maxUploadImages: 10,
  },
  
  // Evaluation Thresholds
  evaluation: {
    passingScore: 0.7,
    maxRetries: 3,
  },
} as const;

// Header text based on context
export function getHeaderText(isDemo?: boolean): string {
  if (isDemo) {
    return `${APP_CONFIG.name} — ${APP_CONFIG.event}`;
  }
  return APP_CONFIG.name;
}

// Footer text
export function getFooterText(): string {
  return `${APP_CONFIG.event} — ${APP_CONFIG.tagline}`;
}
