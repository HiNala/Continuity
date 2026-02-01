"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 text-center mb-4 max-w-md">
            An unexpected error occurred. Please try refreshing or click the button below.
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-4 w-full max-w-lg">
              <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">
                Error details (dev only)
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-xs text-red-800 dark:text-red-200 overflow-auto">
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook-based error boundary wrapper for functional components
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
