"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedBackgroundProps {
  isActive?: boolean;
  intensity?: "subtle" | "normal" | "intense";
}

export function AnimatedBackground({ 
  isActive = false, 
  intensity = "normal" 
}: AnimatedBackgroundProps) {
  // Memoize config to prevent recalculation
  const config = useMemo(() => ({
    subtle: { offset: 80, blur: 60, duration: 20 },
    normal: { offset: 120, blur: 80, duration: 16 },
    intense: { offset: 160, blur: 100, duration: 10 },
  }), []);
  
  const { offset, blur, duration: baseDuration } = config[intensity];
  const duration = isActive ? baseDuration * 0.6 : baseDuration;
  
  // Smooth transition for state changes
  const blobTransition = {
    duration,
    repeat: Infinity,
    ease: "easeInOut" as const,
  };

  // Transition for property changes (when switching modes)
  const propertyTransition = {
    duration: 1.5,
    ease: [0.25, 0.1, 0.25, 1] as const,
  };
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient layer with smooth transition */}
      <motion.div
        initial={false}
        animate={{
          opacity: 1,
        }}
        transition={propertyTransition}
        className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100"
      />
      
      {/* Subtle grid pattern */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.015 }}
        transition={{ duration: 1 }}
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Primary pink blob with smooth property transitions */}
      <motion.div
        key={`pink-${intensity}`}
        initial={false}
        animate={{
          x: [-offset, offset, offset, -offset, -offset],
          y: [-offset * 0.8, -offset * 0.5, offset * 0.8, offset * 0.5, -offset * 0.8],
          scale: [1, 1.15, 1, 1.1, 1],
        }}
        transition={blobTransition}
        className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2"
      >
        <motion.div
          initial={false}
          animate={{
            width: intensity === "intense" ? 550 : intensity === "normal" ? 500 : 450,
            height: intensity === "intense" ? 550 : intensity === "normal" ? 500 : 450,
            filter: `blur(${blur}px)`,
          }}
          transition={propertyTransition}
          className="rounded-full bg-gradient-to-br from-pink-300/50 via-rose-300/40 to-pink-400/30"
        />
      </motion.div>
      
      {/* Secondary cyan blob */}
      <motion.div
        key={`cyan-${intensity}`}
        initial={false}
        animate={{
          x: [offset, -offset * 0.7, -offset, offset * 0.7, offset],
          y: [offset * 0.6, offset, -offset * 0.6, -offset, offset * 0.6],
          scale: [1, 1.1, 1, 1.15, 1],
        }}
        transition={{
          ...blobTransition,
          duration: duration * 1.1,
        }}
        className="absolute top-2/3 left-2/3 -translate-x-1/2 -translate-y-1/2"
      >
        <motion.div
          initial={false}
          animate={{
            width: intensity === "intense" ? 500 : intensity === "normal" ? 450 : 400,
            height: intensity === "intense" ? 500 : intensity === "normal" ? 450 : 400,
            filter: `blur(${blur}px)`,
          }}
          transition={propertyTransition}
          className="rounded-full bg-gradient-to-br from-sky-300/50 via-cyan-300/40 to-blue-300/30"
        />
      </motion.div>

      {/* Tertiary violet blob - smooth fade in/out for intense mode */}
      <AnimatePresence>
        {intensity === "intense" && (
          <motion.div
            key="violet-blob"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: [0, offset * 0.5, 0, -offset * 0.5, 0],
              y: [-offset * 0.3, 0, offset * 0.3, 0, -offset * 0.3],
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              opacity: { duration: 0.8, ease: "easeOut" },
              scale: { duration: 0.8, ease: "easeOut" },
              x: { duration: duration * 1.3, repeat: Infinity, ease: "easeInOut" },
              y: { duration: duration * 1.3, repeat: Infinity, ease: "easeInOut" },
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div 
              className="w-[350px] h-[350px] rounded-full bg-gradient-to-br from-violet-300/40 via-purple-300/30 to-fuchsia-300/20"
              style={{ filter: `blur(${blur * 1.2}px)` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient particles - smooth appearance when active */}
      <AnimatePresence>
        {isActive && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={`particle-${i}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0.2, 0.5, 0.2],
                  scale: 1,
                  y: [0, -30, 0],
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{
                  opacity: { duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4 },
                  scale: { duration: 0.5, delay: i * 0.1 },
                  y: { duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" },
                }}
                className="absolute w-1.5 h-1.5 rounded-full bg-primary/40"
                style={{
                  left: `${15 + i * 15}%`,
                  top: `${20 + (i % 3) * 25}%`,
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Frosted glass overlay with smooth transition */}
      <motion.div
        initial={false}
        animate={{
          backdropFilter: `blur(${intensity === "intense" ? 130 : intensity === "normal" ? 120 : 100}px)`,
          backgroundColor: intensity === "intense" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.25)",
        }}
        transition={propertyTransition}
        className="absolute inset-0"
      />
      
      {/* Subtle vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 60%, rgba(0,0,0,0.02) 100%)'
        }}
      />
    </div>
  );
}

// Panel background for sidebar/panels
export function PanelBackground({ className }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className || ''}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/30" />
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
        className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-pink-200/20 to-transparent blur-3xl"
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
        className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-cyan-200/20 to-transparent blur-3xl"
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
      <div className="relative rounded-2xl bg-white/80 backdrop-blur-xl">
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
