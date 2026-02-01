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
  storageKey = "clarity-theme",
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

// Theme toggle button component
import { Sun, Moon, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  
  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        relative flex items-center gap-2 px-2.5 py-2 rounded-lg
        transition-colors duration-200
        ${resolvedTheme === "dark" 
          ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100" 
          : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
        }
        ${className}
      `}
      aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {resolvedTheme === "dark" ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className="w-4 h-4" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
      {showLabel && (
        <span className="text-xs font-medium">
          {resolvedTheme === "dark" ? "Dark" : "Light"}
        </span>
      )}
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
