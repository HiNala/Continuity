"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

// ============================================
// Markdown Parser - Renders bold text and other formatting
// ============================================
function parseMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Pattern for **bold** text
  const boldPattern = /\*\*([^*]+)\*\*/;
  
  while (remaining) {
    const match = remaining.match(boldPattern);
    
    if (match && match.index !== undefined) {
      // Add text before the match
      if (match.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, match.index)}</span>);
      }
      // Add the bold text
      parts.push(
        <strong key={key++} className="font-semibold text-neutral-900 dark:text-zinc-100">
          {match[1]}
        </strong>
      );
      // Continue with the rest
      remaining = remaining.slice(match.index + match[0].length);
    } else {
      // No more matches, add the rest
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }
  
  return parts;
}

// Export for use in other components
export { parseMarkdown };

// ============================================
// Streaming Text Hook - Core functionality
// ============================================
interface UseStreamingTextOptions {
  speed?: number;
  onComplete?: () => void;
}

export function useStreamingText(
  text: string,
  options: UseStreamingTextOptions = {}
) {
  const { speed = 40, onComplete } = options;
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
  }, [text, speed, onComplete, reset]);

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

  return { displayedText, isComplete, isStreaming, start, reset, skip };
}

// ============================================
// Streaming Chat Message - Clean and minimal
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
  speed = 40,
  className = "",
  onComplete,
}: StreamingChatMessageProps) {
  const { displayedText, isStreaming } = useStreamingText(
    isNew ? content : "",
    { speed, onComplete }
  );

  const textToShow = isNew ? displayedText : content;

  return (
    <span className={className}>
      {parseMarkdown(textToShow)}
      {isNew && isStreaming && (
        <span className="inline-block w-[3px] h-[1.1em] bg-primary/60 dark:bg-primary/70 ml-0.5 align-text-bottom animate-pulse rounded-sm" />
      )}
    </span>
  );
}

// ============================================
// Simple Streaming Text
// ============================================
interface StreamingTextProps {
  text: string;
  speed?: number;
  className?: string;
  showCursor?: boolean;
  onComplete?: () => void;
}

export function StreamingText({
  text,
  speed = 40,
  className = "",
  showCursor = true,
  onComplete,
}: StreamingTextProps) {
  const { displayedText, isStreaming } = useStreamingText(text, { speed, onComplete });

  return (
    <span className={className}>
      {displayedText}
      {showCursor && isStreaming && (
        <span className="inline-block w-[2px] h-[1em] bg-current opacity-60 ml-0.5 align-text-bottom animate-pulse" />
      )}
    </span>
  );
}

// ============================================
// Thinking Indicator - Minimal, Anthropic-style
// ============================================
interface ThinkingIndicatorProps {
  agent?: string;
  action?: string;
  className?: string;
}

export function ThinkingIndicator({
  agent,
  action = "thinking",
  className = "",
}: ThinkingIndicatorProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Map action to simple verb
  const getVerb = () => {
    switch (action) {
      case "analyzing": return "Analyzing";
      case "generating": return "Generating";
      case "evaluating": return "Evaluating";
      case "searching": return "Searching";
      case "policy_update": return "Improving";
      case "retrying": return "Retrying";
      case "learning": return "Learning";
      default: return "Thinking";
    }
  };

  return (
    <div className={`text-[13px] text-neutral-600 dark:text-zinc-300 ${className}`}>
      {agent ? (
        <span className="flex items-center gap-1">
          <span className="font-medium">{agent}</span>
          <span className="text-neutral-400 dark:text-zinc-500">is {getVerb().toLowerCase()}</span>
          <span className="inline-block w-6 text-left">{dots}</span>
        </span>
      ) : (
        <span>
          {getVerb()}
          <span className="inline-block w-6 text-left">{dots}</span>
        </span>
      )}
    </div>
  );
}

// ============================================
// Typewriter - Simple sequential text
// ============================================
interface TypewriterProps {
  messages: string[];
  speed?: number;
  pauseBetween?: number;
  loop?: boolean;
  className?: string;
}

export function Typewriter({
  messages,
  speed = 40,
  pauseBetween = 1500,
  loop = false,
  className = "",
}: TypewriterProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (currentIndex >= messages.length) {
      if (loop) setCurrentIndex(0);
      return;
    }

    const msg = messages[currentIndex];
    let charIndex = 0;
    setIsTyping(true);
    setDisplayedText("");

    const interval = setInterval(() => {
      if (charIndex < msg.length) {
        setDisplayedText(msg.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
        setTimeout(() => setCurrentIndex(prev => prev + 1), pauseBetween);
      }
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [currentIndex, messages, speed, pauseBetween, loop]);

  return (
    <span className={className}>
      {displayedText}
      {isTyping && (
        <span className="inline-block w-[2px] h-[1em] bg-current opacity-60 ml-0.5 align-text-bottom animate-pulse" />
      )}
    </span>
  );
}

// ============================================
// Live Badge - Simple dot
// ============================================
export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span>
    </span>
  );
}

// ============================================
// Connection Status - Minimal
// ============================================
interface ConnectionStatusProps {
  isConnected: boolean;
  className?: string;
}

export function ConnectionStatus({ isConnected, className = "" }: ConnectionStatusProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-zinc-600'}`} />
      <span className={`text-[10px] font-medium ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400 dark:text-zinc-500'}`}>
        {isConnected ? 'Connected' : 'Offline'}
      </span>
    </span>
  );
}
