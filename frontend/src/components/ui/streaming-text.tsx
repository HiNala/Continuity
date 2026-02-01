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
// Agent Thinking Indicator
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
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const dots = ["", ".", "..", "..."];

  const getActionText = () => {
    switch (action) {
      case "analyzing":
        return "Analyzing";
      case "generating":
        return "Generating";
      case "evaluating":
        return "Evaluating";
      case "searching":
        return "Searching";
      case "policy_update":
        return "Updating policy";
      default:
        return "Thinking";
    }
  };

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full"
      />
      <span>
        {agent.charAt(0).toUpperCase() + agent.slice(1)} is {getActionText().toLowerCase()}
        {dots[dotIndex]}
      </span>
    </div>
  );
}

// ============================================
// Live Update Badge
// ============================================
export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="w-2 h-2 rounded-full bg-green-500"
      />
      <span className="text-xs font-medium text-green-600">Live</span>
    </div>
  );
}
