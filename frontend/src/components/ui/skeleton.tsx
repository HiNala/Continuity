"use client";

import React from "react";
import { motion } from "framer-motion";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className={cn(
        "rounded-md bg-gradient-to-r from-neutral-200 via-neutral-300 to-neutral-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700 bg-[length:200%_100%]",
        className
      )}
    />
  );
}

// Agent card skeleton - enhanced with glassmorphism
export function AgentCardSkeleton() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/50 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-4 space-y-3 border-l-[3px] border-l-neutral-200 dark:border-l-zinc-700 shadow-[0_6px_18px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="h-2.5 w-12 rounded" />
          </div>
          <Skeleton className="h-4 w-36 rounded" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
      </div>
    </motion.div>
  );
}

// Chat message skeleton
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && <Skeleton className="w-6 h-6 rounded-md shrink-0" />}
      <div className={cn("space-y-1.5", isUser ? "items-end" : "items-start")}>
        <Skeleton className={cn("h-8 rounded-xl", isUser ? "w-32" : "w-48")} />
      </div>
    </div>
  );
}

// Full page loading skeleton
export function PageLoadingSkeleton() {
  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950">
      {/* Left panel skeleton */}
      <div className="w-[360px] border-r border-neutral-200 dark:border-zinc-800 flex flex-col bg-white/50 dark:bg-zinc-950/50">
        <div className="h-14 border-b border-neutral-100 dark:border-zinc-800 px-4 flex items-center gap-2.5">
          <Skeleton className="w-7 h-7 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex-1 p-4 space-y-3">
          <ChatMessageSkeleton />
          <ChatMessageSkeleton isUser />
          <ChatMessageSkeleton />
        </div>
        <div className="p-3 border-t border-neutral-100 dark:border-zinc-800">
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
      
      {/* Right panel skeleton */}
      <div className="flex-1 p-6 bg-neutral-50/50 dark:bg-zinc-900/50">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="space-y-1.5 mb-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <AgentCardSkeleton />
          <AgentCardSkeleton />
          <AgentCardSkeleton />
        </div>
      </div>
    </div>
  );
}

// Image placeholder skeleton
export function ImageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-neutral-100 dark:bg-zinc-800", className)}>
      <Skeleton className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-neutral-300 dark:text-zinc-600"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </motion.div>
      </div>
    </div>
  );
}

// Text line skeletons
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-3",
            i === lines - 1 ? "w-3/4" : "w-full"
          )} 
        />
      ))}
    </div>
  );
}

// Button skeleton
export function ButtonSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-9 w-24 rounded-lg", className)} />;
}

// Results panel skeleton for the right side
export function ResultsPanelSkeleton() {
  return (
    <div className="space-y-5">
      {/* Timeline header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40 rounded" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      
      {/* Timeline thumbnails */}
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="w-24 h-24 rounded-xl" />
            {i < 3 && <Skeleton className="w-4 h-4 rounded" />}
          </div>
        ))}
      </div>
      
      {/* Main image area */}
      <ImageSkeleton className="aspect-video w-full" />
    </div>
  );
}

// Progress timeline skeleton
export function ProgressTimelineSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
