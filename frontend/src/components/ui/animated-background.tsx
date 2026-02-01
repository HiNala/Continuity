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
  // Configuration for different intensity levels
  // Orbs are positioned closer to center in a foursquare pattern
  const config = useMemo(() => ({
    subtle: { offset: 60, blur: 70, duration: 18, size: 380 },
    normal: { offset: 80, blur: 80, duration: 14, size: 420 },
    intense: { offset: 100, blur: 90, duration: 8, size: 460 },
  }), []);
  
  const { offset, blur, duration: baseDuration, size } = config[intensity];
  // Speed up significantly when loading
  const duration = isLoading ? baseDuration * 0.4 : isActive ? baseDuration * 0.7 : baseDuration;
  
  // Smooth transition for orbit movement
  const blobTransition = {
    duration,
    repeat: Infinity,
    ease: "easeInOut" as const,
  };

  // Transition for property changes
  const propertyTransition = {
    duration: isLoading ? 0.5 : 1.2,
    ease: [0.25, 0.1, 0.25, 1] as const,
  };
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient layer */}
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        transition={propertyTransition}
        className="absolute inset-0 bg-gradient-to-br from-slate-50/80 via-white to-slate-100/80"
      />
      
      {/* Subtle grid pattern - less visible */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.012 }}
        transition={{ duration: 1 }}
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />
      
      {/* Primary Pink Orb - Top Left Quadrant (closer to center) */}
      <motion.div
        key={`pink-${intensity}-${isLoading}`}
        initial={false}
        animate={{
          // Foursquare rotation pattern - smaller, tighter movement
          x: [-offset * 0.6, offset * 0.4, offset * 0.6, -offset * 0.4, -offset * 0.6],
          y: [-offset * 0.4, -offset * 0.6, offset * 0.4, offset * 0.6, -offset * 0.4],
          scale: isLoading ? [1, 1.2, 1, 1.2, 1] : [1, 1.08, 1, 1.05, 1],
        }}
        transition={blobTransition}
        className="absolute top-[35%] left-[38%] -translate-x-1/2 -translate-y-1/2"
      >
        <motion.div
          initial={false}
          animate={{
            width: isLoading ? size * 1.15 : size,
            height: isLoading ? size * 1.15 : size,
            filter: `blur(${blur}px)`,
            opacity: isLoading ? 0.7 : 0.55,
          }}
          transition={propertyTransition}
          className="rounded-full bg-gradient-to-br from-pink-400/60 via-rose-300/50 to-pink-500/40"
        />
      </motion.div>
      
      {/* Secondary Cyan Orb - Bottom Right Quadrant (closer to center) */}
      <motion.div
        key={`cyan-${intensity}-${isLoading}`}
        initial={false}
        animate={{
          // Counter-rotation for foursquare effect
          x: [offset * 0.6, -offset * 0.4, -offset * 0.6, offset * 0.4, offset * 0.6],
          y: [offset * 0.4, offset * 0.6, -offset * 0.4, -offset * 0.6, offset * 0.4],
          scale: isLoading ? [1.2, 1, 1.2, 1, 1.2] : [1.05, 1, 1.08, 1, 1.05],
        }}
        transition={{
          ...blobTransition,
          duration: duration * 1.05,
        }}
        className="absolute top-[55%] left-[58%] -translate-x-1/2 -translate-y-1/2"
      >
        <motion.div
          initial={false}
          animate={{
            width: isLoading ? size * 1.1 : size * 0.95,
            height: isLoading ? size * 1.1 : size * 0.95,
            filter: `blur(${blur}px)`,
            opacity: isLoading ? 0.65 : 0.5,
          }}
          transition={propertyTransition}
          className="rounded-full bg-gradient-to-br from-sky-400/60 via-cyan-300/50 to-blue-400/40"
        />
      </motion.div>

      {/* Third Violet Orb - appears in intense/loading modes - Top Right */}
      <AnimatePresence>
        {(intensity === "intense" || isLoading) && (
          <motion.div
            key="violet-blob"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: [offset * 0.3, -offset * 0.3, -offset * 0.5, offset * 0.5, offset * 0.3],
              y: [-offset * 0.5, offset * 0.3, offset * 0.5, -offset * 0.3, -offset * 0.5],
            }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{
              opacity: { duration: 0.6, ease: "easeOut" },
              scale: { duration: 0.6, ease: "easeOut" },
              x: { duration: duration * 0.9, repeat: Infinity, ease: "easeInOut" },
              y: { duration: duration * 0.9, repeat: Infinity, ease: "easeInOut" },
            }}
            className="absolute top-[40%] left-[55%] -translate-x-1/2 -translate-y-1/2"
          >
            <motion.div 
              animate={{
                width: isLoading ? size * 0.9 : size * 0.75,
                height: isLoading ? size * 0.9 : size * 0.75,
                opacity: isLoading ? 0.5 : 0.35,
              }}
              transition={propertyTransition}
              className="rounded-full bg-gradient-to-br from-violet-400/50 via-purple-300/40 to-fuchsia-400/30"
              style={{ filter: `blur(${blur * 1.1}px)` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fourth Amber Orb - appears when loading - Bottom Left */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="amber-blob"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: [-offset * 0.5, offset * 0.3, offset * 0.5, -offset * 0.3, -offset * 0.5],
              y: [offset * 0.3, offset * 0.5, -offset * 0.3, -offset * 0.5, offset * 0.3],
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{
              opacity: { duration: 0.4, ease: "easeOut" },
              scale: { duration: 0.4, ease: "easeOut" },
              x: { duration: duration * 0.85, repeat: Infinity, ease: "easeInOut" },
              y: { duration: duration * 0.85, repeat: Infinity, ease: "easeInOut" },
            }}
            className="absolute top-[58%] left-[42%] -translate-x-1/2 -translate-y-1/2"
          >
            <div 
              className="rounded-full bg-gradient-to-br from-amber-300/40 via-orange-300/30 to-yellow-300/25"
              style={{ 
                width: size * 0.7,
                height: size * 0.7,
                filter: `blur(${blur * 1.15}px)`,
                opacity: 0.4,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frosted glass overlay - lighter for better visibility */}
      <motion.div
        initial={false}
        animate={{
          backdropFilter: `blur(${isLoading ? 100 : intensity === "intense" ? 110 : 90}px)`,
          backgroundColor: isLoading 
            ? "rgba(255,255,255,0.15)" 
            : intensity === "intense" 
              ? "rgba(255,255,255,0.18)" 
              : "rgba(255,255,255,0.22)",
        }}
        transition={propertyTransition}
        className="absolute inset-0"
      />
      
      {/* Very subtle vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 70%, rgba(0,0,0,0.015) 100%)'
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
