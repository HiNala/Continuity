"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedBackgroundProps {
  isActive?: boolean;
  intensity?: "subtle" | "normal" | "intense";
  isLoading?: boolean;
}

export function AnimatedBackground({ 
  isActive = false, 
  intensity = "normal",
  isLoading = false,
}: AnimatedBackgroundProps) {
  // Simplified configuration - cleaner, more subtle
  const config = useMemo(() => ({
    subtle: { blur: 90, duration: 25, size: 300, opacity: 0.32 },
    normal: { blur: 100, duration: 20, size: 360, opacity: 0.42 },
    intense: { blur: 110, duration: 12, size: 420, opacity: 0.52 },
  }), []);
  
  const { blur, duration: baseDuration, size, opacity: baseOpacity } = config[intensity];
  const duration = isLoading ? baseDuration * 0.5 : baseDuration;
  const opacity = isLoading ? baseOpacity * 1.3 : baseOpacity;

  const propertyTransition = {
    duration: 1.5,
    ease: [0.25, 0.1, 0.25, 1] as const,
  };
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Clean gradient base - Light mode */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950" />
      
      {/* Primary Pink Orb - simplified movement */}
      <motion.div
        initial={false}
        animate={{
          x: isLoading ? [0, 30, -30, 0] : [0, 20, 0],
          y: isLoading ? [0, -30, 30, 0] : [0, -15, 0],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[30%] left-[35%] -translate-x-1/2 -translate-y-1/2"
      >
        <motion.div
          initial={false}
          animate={{
            width: size,
            height: size,
            opacity,
          }}
          transition={propertyTransition}
          className="rounded-full bg-gradient-to-br from-pink-300 via-rose-200 to-pink-400 dark:from-pink-600/50 dark:via-rose-500/40 dark:to-pink-700/50"
          style={{ filter: `blur(${blur}px) drop-shadow(0 0 16px rgba(236, 72, 153, 0.18))` }}
        />
      </motion.div>
      
      {/* Secondary Cyan Orb */}
      <motion.div
        initial={false}
        animate={{
          x: isLoading ? [0, -25, 25, 0] : [0, -15, 0],
          y: isLoading ? [0, 25, -25, 0] : [0, 10, 0],
        }}
        transition={{
          duration: duration * 1.1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[60%] left-[60%] -translate-x-1/2 -translate-y-1/2"
      >
        <motion.div
          initial={false}
          animate={{
            width: size * 0.9,
            height: size * 0.9,
            opacity: opacity * 0.9,
          }}
          transition={propertyTransition}
          className="rounded-full bg-gradient-to-br from-sky-300 via-cyan-200 to-blue-300 dark:from-cyan-600/50 dark:via-sky-500/40 dark:to-blue-600/50"
          style={{ filter: `blur(${blur}px) drop-shadow(0 0 16px rgba(34, 211, 238, 0.16))` }}
        />
      </motion.div>

      {/* Third orb - only when loading or intense */}
      <AnimatePresence>
        {(intensity === "intense" || isLoading) && (
          <motion.div
            key="accent-orb"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              x: [0, 20, -20, 0],
              y: [0, -20, 20, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.8 },
              x: { duration: duration * 0.8, repeat: Infinity, ease: "easeInOut" },
              y: { duration: duration * 0.8, repeat: Infinity, ease: "easeInOut" },
            }}
            className="absolute top-[45%] left-[50%] -translate-x-1/2 -translate-y-1/2"
          >
            <div 
              className="rounded-full bg-gradient-to-br from-violet-300 via-purple-200 to-fuchsia-300 dark:from-violet-600/50 dark:via-purple-500/40 dark:to-fuchsia-600/50"
              style={{ 
                width: size * 0.7,
                height: size * 0.7,
                filter: `blur(${blur * 1.05}px) drop-shadow(0 0 14px rgba(168, 85, 247, 0.16))`,
                opacity: opacity * 0.6,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frosted overlay - adapts to dark mode */}
      <div 
        className="absolute inset-0 bg-white/20 dark:bg-zinc-900/40"
        style={{
          backdropFilter: "blur(96px)",
        }}
      />
    </div>
  );
}

// Panel background for sidebar/panels
export function PanelBackground({ className }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className || ''}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/30 dark:from-zinc-900/60 dark:to-zinc-900/30" />
      <motion.div
        animate={{
          opacity: [0.2, 0.4, 0.2],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-pink-200/20 dark:from-pink-500/10 to-transparent blur-3xl"
      />
      <motion.div
        animate={{
          opacity: [0.2, 0.4, 0.2],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-cyan-200/20 dark:from-cyan-500/10 to-transparent blur-3xl"
      />
    </div>
  );
}

// Gradient border effect
export function GradientBorder({ 
  children, 
  className,
  gradient = "from-pink-500 via-purple-500 to-cyan-500",
  animate = false,
}: { 
  children: React.ReactNode;
  className?: string;
  gradient?: string;
  animate?: boolean;
}) {
  return (
    <motion.div
      initial={false}
      animate={animate ? {
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      } : {}}
      transition={animate ? {
        duration: 3,
        repeat: Infinity,
        ease: "linear",
      } : {}}
      style={animate ? { backgroundSize: "200% 200%" } : {}}
      className={`relative p-[1px] rounded-2xl bg-gradient-to-r ${gradient} ${className || ''}`}
    >
      <div className="relative rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
        {children}
      </div>
    </motion.div>
  );
}

// Shimmer effect component
export function Shimmer({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{
        x: ["-100%", "100%"],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
        repeatDelay: 0.5,
      }}
      className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent ${className || ''}`}
    />
  );
}
