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
  const config = {
    subtle: { offset: 80, blur: 60, duration: 20 },
    normal: { offset: 120, blur: 80, duration: 16 },
    intense: { offset: 160, blur: 100, duration: 10 },
  };
  
  const { offset, blur, duration: baseDuration } = config[intensity];
  const duration = isActive ? baseDuration * 0.6 : baseDuration;
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Primary pink blob */}
      <motion.div
        animate={{
          x: [-offset, offset, offset, -offset, -offset],
          y: [-offset * 0.8, -offset * 0.5, offset * 0.8, offset * 0.5, -offset * 0.8],
          scale: [1, 1.15, 1, 1.1, 1],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2"
      >
        <div 
          className="w-[500px] h-[500px] rounded-full bg-gradient-to-br from-pink-300/50 via-rose-300/40 to-pink-400/30"
          style={{ filter: `blur(${blur}px)` }}
        />
      </motion.div>
      
      {/* Secondary cyan blob */}
      <motion.div
        animate={{
          x: [offset, -offset * 0.7, -offset, offset * 0.7, offset],
          y: [offset * 0.6, offset, -offset * 0.6, -offset, offset * 0.6],
          scale: [1, 1.1, 1, 1.15, 1],
        }}
        transition={{
          duration: duration * 1.1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-2/3 left-2/3 -translate-x-1/2 -translate-y-1/2"
      >
        <div 
          className="w-[450px] h-[450px] rounded-full bg-gradient-to-br from-sky-300/50 via-cyan-300/40 to-blue-300/30"
          style={{ filter: `blur(${blur}px)` }}
        />
      </motion.div>

      {/* Tertiary violet blob (only in intense mode) */}
      {intensity === "intense" && (
        <motion.div
          animate={{
            x: [0, offset * 0.5, 0, -offset * 0.5, 0],
            y: [-offset * 0.3, 0, offset * 0.3, 0, -offset * 0.3],
            scale: [0.9, 1.05, 0.9, 1, 0.9],
            opacity: [0.4, 0.6, 0.4, 0.5, 0.4],
          }}
          transition={{
            duration: duration * 1.3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div 
            className="w-[350px] h-[350px] rounded-full bg-gradient-to-br from-violet-300/40 via-purple-300/30 to-fuchsia-300/20"
            style={{ filter: `blur(${blur * 1.2}px)` }}
          />
        </motion.div>
      )}

      {/* Ambient particles (only when active) */}
      {isActive && (
        <>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeInOut",
              }}
              className="absolute w-1 h-1 rounded-full bg-primary/30"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
              }}
            />
          ))}
        </>
      )}

      {/* Frosted glass overlay */}
      <div className="absolute inset-0 backdrop-blur-[120px] bg-white/25" />
      
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
  gradient = "from-pink-500 via-purple-500 to-cyan-500" 
}: { 
  children: React.ReactNode;
  className?: string;
  gradient?: string;
}) {
  return (
    <div className={`relative p-[1px] rounded-2xl bg-gradient-to-r ${gradient} ${className || ''}`}>
      <div className="relative rounded-2xl bg-white/80 backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}
