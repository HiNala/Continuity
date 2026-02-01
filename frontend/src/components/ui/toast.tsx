"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from "lucide-react";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

type ToastType = "success" | "error" | "info" | "loading";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newToast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);
    
    // Auto-remove after duration (default 4s, loading toasts don't auto-remove)
    if (toast.type !== "loading") {
      const duration = toast.duration ?? 4000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    
    // If updating to a non-loading type, set auto-remove
    if (updates.type && updates.type !== "loading") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, updates.duration ?? 4000);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ 
  toasts, 
  removeToast 
}: { 
  toasts: Toast[]; 
  removeToast: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
    loading: Loader2,
  };
  
  const styles = {
    success: "bg-gradient-to-r from-emerald-50 to-emerald-100/80 border-emerald-200/60 text-emerald-900",
    error: "bg-gradient-to-r from-red-50 to-red-100/80 border-red-200/60 text-red-900",
    info: "bg-gradient-to-r from-blue-50 to-blue-100/80 border-blue-200/60 text-blue-900",
    loading: "bg-white/95 border-black/[0.08] text-foreground",
  };
  
  const iconStyles = {
    success: "text-emerald-500",
    error: "text-red-500",
    info: "text-blue-500",
    loading: "text-primary",
  };

  const iconBgStyles = {
    success: "bg-emerald-100",
    error: "bg-red-100",
    info: "bg-blue-100",
    loading: "bg-primary/10",
  };

  const progressBarStyles = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    info: "bg-blue-500",
    loading: "bg-primary",
  };
  
  const Icon = icons[toast.type];
  const duration = toast.duration ?? 4000;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95, x: 20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, x: 30, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-xl border shadow-xl backdrop-blur-xl min-w-[300px] max-w-[400px] relative overflow-hidden",
        styles[toast.type]
      )}
    >
      {/* Icon with background */}
      <div className={cn("shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", iconBgStyles[toast.type])}>
        {toast.type === "loading" ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Icon className={cn("w-4 h-4", iconStyles[toast.type])} />
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
          >
            <Icon className={cn("w-4 h-4", iconStyles[toast.type])} />
          </motion.div>
        )}
      </div>
      
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="text-xs mt-0.5 opacity-70">{toast.description}</p>
        )}
      </div>
      
      {toast.type !== "loading" && (
        <motion.button
          onClick={onClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="shrink-0 p-1.5 rounded-lg hover:bg-black/5 transition-colors"
        >
          <X className="w-3.5 h-3.5 opacity-40" />
        </motion.button>
      )}

      {/* Progress bar for non-loading toasts */}
      {toast.type !== "loading" && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: duration / 1000, ease: "linear" }}
          style={{ originX: 0 }}
          className={cn("absolute bottom-0 left-0 right-0 h-0.5", progressBarStyles[toast.type])}
        />
      )}
    </motion.div>
  );
}

// Convenience hooks for common toast types
export function useSuccessToast() {
  const { addToast } = useToast();
  return useCallback(
    (title: string, description?: string) =>
      addToast({ type: "success", title, description }),
    [addToast]
  );
}

export function useErrorToast() {
  const { addToast } = useToast();
  return useCallback(
    (title: string, description?: string) =>
      addToast({ type: "error", title, description }),
    [addToast]
  );
}

export function useLoadingToast() {
  const { addToast, updateToast, removeToast } = useToast();
  
  return useCallback(
    (title: string, description?: string) => {
      const id = addToast({ type: "loading", title, description });
      
      return {
        success: (newTitle: string, newDescription?: string) =>
          updateToast(id, { type: "success", title: newTitle, description: newDescription }),
        error: (newTitle: string, newDescription?: string) =>
          updateToast(id, { type: "error", title: newTitle, description: newDescription }),
        dismiss: () => removeToast(id),
      };
    },
    [addToast, updateToast, removeToast]
  );
}
