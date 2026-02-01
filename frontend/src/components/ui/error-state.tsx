"use client";

import React from "react";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, XCircle } from "lucide-react";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message to display */
  message: string;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Callback for dismiss action */
  onDismiss?: () => void;
  /** Size variant */
  variant?: "inline" | "card" | "banner";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable error state component for displaying errors inline,
 * as cards, or as dismissible banners.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  onDismiss,
  variant = "inline",
  className,
}: ErrorStateProps) {
  if (variant === "banner") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "flex items-center justify-between gap-4 px-4 py-3",
          "bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50",
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-100">
              {title}
            </p>
            <p className="text-xs text-red-700 dark:text-red-300">{message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900/70 text-red-700 dark:text-red-200 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label="Retry action"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label="Dismiss error"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  if (variant === "card") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "flex flex-col items-center justify-center p-6 rounded-xl",
          "border border-red-200 dark:border-red-900/50",
          "bg-red-50/50 dark:bg-red-950/20",
          className
        )}
        role="alert"
      >
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center mb-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <h4 className="text-base font-semibold text-red-900 dark:text-red-100 mb-1">
          {title}
        </h4>
        <p className="text-sm text-red-700 dark:text-red-300 text-center mb-4 max-w-sm">
          {message}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            aria-label="Retry action"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </motion.div>
    );
  }

  // Inline variant (default)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 rounded-lg",
        "bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30",
        className
      )}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
            aria-label="Retry action"
          >
            Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 dark:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label="Dismiss"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}

/**
 * Empty state component for when there's no data to display.
 */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center",
        className
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h4 className="text-base font-semibold text-neutral-900 dark:text-zinc-100 mb-1">
        {title}
      </h4>
      {message && (
        <p className="text-sm text-neutral-500 dark:text-zinc-400 max-w-sm mb-4">
          {message}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

export default ErrorState;
