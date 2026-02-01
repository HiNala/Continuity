"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "continuity-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Get system preference
  const getSystemTheme = useCallback((): "light" | "dark" => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }, []);

  // Resolve theme (handle "system" option)
  const resolveTheme = useCallback((t: Theme): "light" | "dark" => {
    if (t === "system") {
      return getSystemTheme();
    }
    return t;
  }, [getSystemTheme]);

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setThemeState(stored);
      setResolvedTheme(resolveTheme(stored));
    } else {
      setResolvedTheme(resolveTheme(defaultTheme));
    }
    setMounted(true);
  }, [storageKey, defaultTheme, resolveTheme]);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    
    // Also set color-scheme for native elements
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme, mounted]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setResolvedTheme(getSystemTheme());
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, getSystemTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    setResolvedTheme(resolveTheme(newTheme));
    localStorage.setItem(storageKey, newTheme);
  }, [storageKey, resolveTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  const content = (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );

  // Prevent flash of wrong theme while still providing context
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{content}</div>;
  }

  return content;
}

// Theme toggle button component - Animated Day/Night Scene
import { Sun, Moon, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <motion.button
      type="button"
      className={`relative w-14 h-8 rounded-full cursor-pointer overflow-hidden border border-white/40 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900 ${className}`}
      onClick={toggleTheme}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
    >
      {/* Background Scene */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: isDark
            ? "linear-gradient(135deg, rgba(10,10,11,0.95) 0%, rgba(17,17,19,0.9) 50%, rgba(24,24,27,0.9) 100%)"
            : "linear-gradient(135deg, rgba(250,250,250,0.95) 0%, rgba(244,244,245,0.9) 50%, rgba(236,236,241,0.9) 100%)",
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />

      {/* Stars (Dark Mode) */}
      <AnimatePresence>
        {isDark && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="absolute inset-0"
          >
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-0.5 h-0.5 bg-white/80 rounded-full"
                style={{
                  left: `${28 + i * 12}%`,
                  top: `${22 + (i % 2) * 16}%`,
                }}
                animate={{
                  opacity: [0.2, 0.7, 0.2],
                  scale: [0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clouds (Light Mode) */}
      <AnimatePresence>
        {!isDark && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
          >
            <motion.div
              className="absolute top-1.5 left-7 w-2.5 h-1.5 bg-white/70 rounded-full"
              animate={{ x: [0, 6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute top-3 right-2.5 w-2 h-1 bg-white/50 rounded-full"
              animate={{ x: [0, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Circle with Sun/Moon */}
      <motion.div
        className="absolute top-0.5 w-7 h-7 rounded-full shadow-md flex items-center justify-center"
        animate={{
          x: isDark ? 26 : 2,
          backgroundColor: isDark ? "#0f1115" : "#ffffff",
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
      >
        <AnimatePresence mode="wait">
          {isDark ? (
            <motion.div
              key="moon"
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 180, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-yellow-200"
            >
              <Moon size={12} fill="currentColor" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ rotate: 180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -180, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-yellow-500"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <Sun size={12} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Glow Effect */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={{
          boxShadow: isDark
            ? "inset 0 0 10px rgba(59, 130, 246, 0.15), 0 0 10px rgba(59, 130, 246, 0.12)"
            : "inset 0 0 10px rgba(244, 114, 182, 0.12), 0 0 10px rgba(244, 114, 182, 0.12)",
        }}
        transition={{ duration: 0.8 }}
      />
    </motion.button>
  );
}

// Dropdown theme selector for more options
interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className = "" }: ThemeSelectorProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  
  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="w-4 h-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="w-4 h-4" /> },
    { value: "system", label: "System", icon: <Monitor className="w-4 h-4" /> },
  ];
  
  const currentIcon = theme === "system" 
    ? <Monitor className="w-4 h-4" />
    : resolvedTheme === "dark" 
      ? <Moon className="w-4 h-4" /> 
      : <Sun className="w-4 h-4" />;
  
  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
          transition-colors duration-200
          ${resolvedTheme === "dark"
            ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
            : "bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200"
          }
        `}
      >
        {currentIcon}
        <span className="hidden sm:inline">
          {theme === "system" ? "System" : resolvedTheme === "dark" ? "Dark" : "Light"}
        </span>
      </motion.button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={`
                absolute right-0 mt-2 w-36 py-1 rounded-xl shadow-lg z-50
                ${resolvedTheme === "dark"
                  ? "bg-zinc-800 border border-zinc-700"
                  : "bg-white border border-neutral-200"
                }
              `}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setTheme(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 text-sm
                    transition-colors duration-150
                    ${theme === option.value
                      ? resolvedTheme === "dark"
                        ? "bg-zinc-700 text-white"
                        : "bg-neutral-100 text-neutral-900"
                      : resolvedTheme === "dark"
                        ? "text-zinc-300 hover:bg-zinc-700/50"
                        : "text-neutral-600 hover:bg-neutral-50"
                    }
                  `}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
