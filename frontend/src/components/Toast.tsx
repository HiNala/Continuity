"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  };

  const bgColors = {
    success: "bg-emerald-950/90 border-emerald-500/30 dark:bg-emerald-900/90 dark:border-emerald-500/40",
    error: "bg-red-950/90 border-red-500/30 dark:bg-red-900/90 dark:border-red-500/40",
    warning: "bg-amber-950/90 border-amber-500/30 dark:bg-amber-900/90 dark:border-amber-500/40",
    info: "bg-blue-950/90 border-blue-500/30 dark:bg-blue-900/90 dark:border-blue-500/40",
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm shadow-lg ${bgColors[toast.type]} animate-slide-in`}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-slate-300 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// Hook for managing toasts
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (title: string, message?: string) =>
    addToast({ type: "success", title, message });

  const error = (title: string, message?: string) =>
    addToast({ type: "error", title, message });

  const warning = (title: string, message?: string) =>
    addToast({ type: "warning", title, message });

  const info = (title: string, message?: string) =>
    addToast({ type: "info", title, message });

  return {
    toasts,
    addToast,
    dismissToast,
    success,
    error,
    warning,
    info,
  };
}
