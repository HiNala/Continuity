"use client";

import React from "react";
import { motion } from "framer-motion";

interface AnimatedBackgroundProps {
  isActive?: boolean;
  intensity?: "subtle" | "normal" | "intense";
}

export function AnimatedBackground({ 
  isActive = false, 
  intensity = "normal" 
}: AnimatedBackgroundProps) {
  // Four-square clockwise dance positions (relative to center)
  const offset = intensity === "subtle" ? 80 : intensity === "intense" ? 160 : 120;
  const blurAmount = intensity === "subtle" ? "60px" : intensity === "intense" ? "100px" : "80px";
  const duration = isActive ? 8 : 16;
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base light layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-background to-slate-100" />
      
      {/* Cotton candy pink blob - starts top-left, moves clockwise */}
      <motion.div
        animate={{
          x: [-offset, offset, offset, -offset, -offset],
          y: [-offset, -offset, offset, offset, -offset],
          scale: [1, 1.1, 1, 1.1, 1],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-pink-300/60 via-rose-300/50 to-pink-400/40"
        style={{ filter: `blur(${blurAmount})` }}
      />
      
      {/* Sky blue blob - starts bottom-right, moves clockwise (opposite phase) */}
      <motion.div
        animate={{
          x: [offset, -offset, -offset, offset, offset],
          y: [offset, offset, -offset, -offset, offset],
          scale: [1, 1.1, 1, 1.1, 1],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-sky-300/60 via-cyan-300/50 to-blue-300/40"
        style={{ filter: `blur(${blurAmount})` }}
      />

      {/* Optional: Purple/violet accent blob for more visual interest */}
      {intensity === "intense" && (
        <motion.div
          animate={{
            x: [0, offset * 0.7, 0, -offset * 0.7, 0],
            y: [-offset * 0.5, 0, offset * 0.5, 0, -offset * 0.5],
            scale: [0.8, 1, 0.8, 1, 0.8],
          }}
          transition={{
            duration: duration * 1.3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-gradient-to-br from-violet-300/40 via-purple-300/30 to-fuchsia-300/20"
          style={{ filter: `blur(${blurAmount})` }}
        />
      )}

      {/* Frosted glass overlay */}
      <div className="absolute inset-0 backdrop-blur-[100px] bg-white/30" />
    </div>
  );
}

// Smaller, more subtle version for sidebar/panels
export function PanelBackground({ className }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className || ''}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/40" />
      <motion.div
        animate={{
          opacity: [0.3, 0.5, 0.3],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-pink-200/30 to-transparent blur-3xl"
      />
      <motion.div
        animate={{
          opacity: [0.3, 0.5, 0.3],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-cyan-200/30 to-transparent blur-3xl"
      />
    </div>
  );
}
