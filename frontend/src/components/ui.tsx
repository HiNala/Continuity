"use client";

/**
 * Continuity - Shared UI Components
 * Modern, minimal design system for consistent UI across the app.
 */

import { Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";

// ============================================
// Loading Spinner
// ============================================
interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <Loader2 className={`animate-spin text-continuity-400 ${sizes[size]} ${className}`} />
  );
}

// ============================================
// Alert / Notice Components
// ============================================
interface AlertProps {
  type: "info" | "success" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ type, title, children, className = "" }: AlertProps) {
  const styles = {
    info: "bg-continuity-500/10 border-continuity-500/20 text-continuity-400",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    error: "bg-red-500/10 border-red-500/20 text-red-400",
  };

  const icons = {
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle2 className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
  };

  return (
    <div className={`p-4 rounded-xl border ${styles[type]} ${className}`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
        <div className="flex-1">
          {title && <p className="font-semibold mb-1">{title}</p>}
          <div className="text-sm opacity-90">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Progress Bar
// ============================================
interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  label,
  showPercentage = true,
  className = "",
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex justify-between text-sm mb-1">
          {label && <span className="text-slate-400">{label}</span>}
          {showPercentage && (
            <span className="text-slate-300">{Math.round(clampedValue)}%</span>
          )}
        </div>
      )}
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-continuity-600 to-continuity-400 rounded-full transition-all duration-500"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// Step Indicator
// ============================================
interface Step {
  id: string;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: string;
  completedSteps?: string[];
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps = [],
  className = "",
}: StepIndicatorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;

        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                isCompleted
                  ? "bg-emerald-500 text-white"
                  : isCurrent
                  ? "bg-continuity-500 text-white ring-4 ring-continuity-500/20"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`text-sm hidden md:block ${
                isCurrent ? "text-white font-medium" : "text-slate-500"
              }`}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 ${
                  isCompleted ? "bg-emerald-500" : "bg-slate-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Empty State
// ============================================
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-500">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}

// ============================================
// Skeleton Loader
// ============================================
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-800 rounded ${className}`}
    />
  );
}

// ============================================
// Image Preview Card
// ============================================
interface ImagePreviewProps {
  src: string;
  alt?: string;
  onRemove?: () => void;
  className?: string;
}

export function ImagePreview({
  src,
  alt = "Preview",
  onRemove,
  className = "",
}: ImagePreviewProps) {
  return (
    <div
      className={`relative group rounded-lg overflow-hidden border border-slate-700 ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
      />
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  );
}
