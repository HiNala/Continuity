"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";

// ============================================
// Streaming Text Hook
// ============================================
interface UseStreamingTextOptions {
  speed?: number; // Characters per second (default: 50)
  startDelay?: number; // Delay before starting (ms)
  onComplete?: () => void;
}

export function useStreamingText(
  text: string,
  options: UseStreamingTextOptions = {}
) {
  const { speed = 50, startDelay = 0, onComplete } = options;
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const indexRef = useRef(0);

  const reset = useCallback(() => {
    setDisplayedText("");
    setIsComplete(false);
    setIsStreaming(false);
    indexRef.current = 0;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    reset();
    
    const startStreaming = () => {
      setIsStreaming(true);
      
      const msPerChar = 1000 / speed;
      
      intervalRef.current = setInterval(() => {
        if (indexRef.current < text.length) {
          setDisplayedText(text.slice(0, indexRef.current + 1));
          indexRef.current++;
        } else {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsStreaming(false);
          setIsComplete(true);
          onComplete?.();
        }
      }, msPerChar);
    };

    if (startDelay > 0) {
      setTimeout(startStreaming, startDelay);
    } else {
      startStreaming();
    }
  }, [text, speed, startDelay, onComplete, reset]);

  // Auto-start when text changes
  useEffect(() => {
    if (text) {
      start();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, start]);

  const skip = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplayedText(text);
    setIsStreaming(false);
    setIsComplete(true);
    onComplete?.();
  }, [text, onComplete]);

  return {
    displayedText,
    isComplete,
    isStreaming,
    start,
    reset,
    skip,
  };
}

// ============================================
// Streaming Text Component
// ============================================
interface StreamingTextProps {
  text: string;
  speed?: number;
  className?: string;
  showCursor?: boolean;
  cursorClassName?: string;
  onComplete?: () => void;
  autoStart?: boolean;
}

export function StreamingText({
  text,
  speed = 50,
  className = "",
  showCursor = true,
  cursorClassName = "",
  onComplete,
  autoStart = true,
}: StreamingTextProps) {
  const { displayedText, isStreaming, start } = useStreamingText(
    autoStart ? text : "",
    { speed, onComplete }
  );

  useEffect(() => {
    if (!autoStart && text) {
      start();
    }
  }, [autoStart, text, start]);

  return (
    <span className={className}>
      {displayedText}
      {showCursor && isStreaming && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className={`inline-block w-0.5 h-[1em] bg-current ml-0.5 align-middle ${cursorClassName}`}
        />
      )}
    </span>
  );
}

// ============================================
// Typewriter Effect Component
// ============================================
interface TypewriterProps {
  messages: string[];
  speed?: number;
  pauseBetween?: number;
  loop?: boolean;
  className?: string;
  onMessageComplete?: (index: number) => void;
}

export function Typewriter({
  messages,
  speed = 40,
  pauseBetween = 1000,
  loop = false,
  className = "",
  onMessageComplete,
}: TypewriterProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (currentMessageIndex >= messages.length) {
      if (loop) {
        setCurrentMessageIndex(0);
      }
      return;
    }

    const currentMessage = messages[currentMessageIndex];
    let charIndex = 0;

    setIsTyping(true);
    setDisplayedText("");

    const typeInterval = setInterval(() => {
      if (charIndex < currentMessage.length) {
        setDisplayedText(currentMessage.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        onMessageComplete?.(currentMessageIndex);

        // Wait before next message
        setTimeout(() => {
          setCurrentMessageIndex((prev) => prev + 1);
        }, pauseBetween);
      }
    }, 1000 / speed);

    return () => clearInterval(typeInterval);
  }, [currentMessageIndex, messages, speed, pauseBetween, loop, onMessageComplete]);

  return (
    <span className={className}>
      {displayedText}
      {isTyping && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-0.5 h-[1em] bg-current ml-0.5 align-middle"
        />
      )}
    </span>
  );
}

// ============================================
// Chat Message with Streaming
// ============================================
interface StreamingChatMessageProps {
  content: string;
  isNew?: boolean;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export function StreamingChatMessage({
  content,
  isNew = true,
  speed = 60,
  className = "",
  onComplete,
}: StreamingChatMessageProps) {
  const { displayedText, isStreaming } = useStreamingText(
    isNew ? content : "",
    { speed, onComplete }
  );

  // If not new, show full content immediately
  const textToShow = isNew ? displayedText : content;

  return (
    <div className={`relative ${className}`}>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {textToShow}
        {isNew && isStreaming && (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="inline-block w-1.5 h-4 bg-primary/60 rounded-sm ml-0.5 align-middle"
          />
        )}
      </p>
    </div>
  );
}

// ============================================
// Agent Thinking Indicator - Enhanced
// ============================================
interface ThinkingIndicatorProps {
  agent: string;
  action?: string;
  className?: string;
}

export function ThinkingIndicator({
  agent,
  action = "thinking",
  className = "",
}: ThinkingIndicatorProps) {
  const [dotIndex, setDotIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const dots = ["", ".", "..", "..."];

  const getActionConfig = () => {
    switch (action) {
      case "analyzing":
        return { text: "Analyzing", color: "from-purple-500 to-pink-500" };
      case "generating":
        return { text: "Generating", color: "from-amber-500 to-orange-500" };
      case "evaluating":
        return { text: "Evaluating", color: "from-emerald-500 to-teal-500" };
      case "searching":
        return { text: "Searching", color: "from-blue-500 to-cyan-500" };
      case "policy_update":
        return { text: "Updating policy", color: "from-violet-500 to-purple-500" };
      default:
        return { text: "Thinking", color: "from-primary to-accent" };
    }
  };

  const config = getActionConfig();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2.5 text-sm ${className}`}
    >
      {/* Animated spinner with gradient */}
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className={`w-4 h-4 rounded-full border-2 border-transparent bg-gradient-to-r ${config.color}`}
          style={{ 
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: "2px",
          }}
        />
        {/* Inner glow */}
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`absolute inset-0 rounded-full bg-gradient-to-r ${config.color} blur-sm opacity-30`}
        />
      </div>
      
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground/80">
          {agent.charAt(0).toUpperCase() + agent.slice(1)}
        </span>
        {" is "}
        <span className="text-foreground/70">{config.text.toLowerCase()}</span>
        <span className="text-primary/70 font-mono">{dots[dotIndex]}</span>
      </span>
    </motion.div>
  );
}

// ============================================
// Live Update Badge - Enhanced with pulse ring
// ============================================
export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="relative">
        {/* Pulse ring */}
        <motion.div
          animate={{ scale: [1, 2], opacity: [0.5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500"
        />
        {/* Core dot */}
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="relative w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"
        />
      </div>
      <span className="text-[11px] font-semibold text-emerald-600 tracking-wide">LIVE</span>
    </div>
  );
}

// ============================================
// Connection Status Badge
// ============================================
interface ConnectionStatusProps {
  isConnected: boolean;
  className?: string;
}

export function ConnectionStatus({ isConnected, className = "" }: ConnectionStatusProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${className}`}
    >
      <div className="relative">
        <motion.div
          animate={isConnected ? { scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          className={`absolute inset-0 w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}
        />
        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
      </div>
      <span className={`text-[10px] font-medium ${isConnected ? 'text-emerald-600' : 'text-red-500'}`}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </motion.div>
  );
}
