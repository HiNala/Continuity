"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  Database,
  Sparkles,
  Globe,
  Activity,
  Play,
  ChevronDown,
} from "lucide-react";
import {
  testWeaveAPI,
  testGeminiAPI,
  testBrowserbaseAPI,
  testRedisAPI,
  testDatabaseAPI,
  testAllAPIs,
  APITestResult,
} from "@/lib/api";

interface SettingsDropdownProps {
  onTestResult?: (type: "success" | "error", title: string, message?: string) => void;
}

export function SettingsDropdown({ onTestResult }: SettingsDropdownProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, APITestResult>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTest = async (
    service: string,
    testFn: () => Promise<APITestResult>
  ) => {
    setTesting(service);
    try {
      const result = await testFn();
      setResults((prev) => ({ ...prev, [service]: result }));

      if (result.success) {
        onTestResult?.("success", `${getServiceLabel(service)} Connected`, result.message);
      } else {
        onTestResult?.("error", `${getServiceLabel(service)} Failed`, result.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test failed";
      onTestResult?.("error", `${getServiceLabel(service)} Error`, message);
      setResults((prev) => ({
        ...prev,
        [service]: {
          service,
          success: false,
          message,
          timestamp: new Date().toISOString(),
        },
      }));
    } finally {
      setTesting(null);
    }
  };

  const handleTestAll = async () => {
    setTesting("all");
    try {
      const allResults = await testAllAPIs();
      setResults({
        weave: allResults.weave,
        gemini: allResults.gemini,
        browserbase: allResults.browserbase,
        redis: allResults.redis,
        database: allResults.database,
      });

      // Show summary toast
      const passed = [
        allResults.weave,
        allResults.gemini,
        allResults.browserbase,
        allResults.redis,
        allResults.database,
      ].filter((r) => r.success).length;

      if (passed === 5) {
        onTestResult?.("success", "All APIs Connected", "All 5 services are working");
      } else {
        onTestResult?.(
          "error",
          `${passed}/5 APIs Connected`,
          `${5 - passed} service(s) failed`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test failed";
      onTestResult?.("error", "API Test Failed", message);
    } finally {
      setTesting(null);
    }
  };

  const getServiceLabel = (service: string): string => {
    const labels: Record<string, string> = {
      weave: "Weave/W&B",
      gemini: "Google Gemini",
      browserbase: "Browserbase",
      redis: "Redis",
      database: "Database",
    };
    return labels[service] || service;
  };

  const getServiceIcon = (service: string) => {
    const icons: Record<string, React.ReactNode> = {
      weave: <Activity className="w-4 h-4 text-amber-500" />,
      gemini: <Sparkles className="w-4 h-4 text-blue-500" />,
      browserbase: <Globe className="w-4 h-4 text-violet-500" />,
      redis: <Database className="w-4 h-4 text-red-500" />,
      database: <Database className="w-4 h-4 text-emerald-500" />,
    };
    return icons[service] || <Settings className="w-4 h-4" />;
  };

  const getResultIcon = (service: string) => {
    const result = results[service];
    if (!result) return null;
    if (result.success) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
    return <XCircle className="w-4 h-4 text-red-400" />;
  };

  const services = [
    { key: "weave", testFn: testWeaveAPI },
    { key: "gemini", testFn: testGeminiAPI },
    { key: "browserbase", testFn: testBrowserbaseAPI },
    { key: "redis", testFn: testRedisAPI },
    { key: "database", testFn: testDatabaseAPI },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground/70 hover:text-foreground bg-white/60 hover:bg-white/80 backdrop-blur-sm border border-black/[0.08] hover:border-black/[0.12] rounded-xl transition-all shadow-sm hover:shadow"
      >
        <Settings className="w-4 h-4" />
        <span className="font-medium">Settings</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute right-0 mt-2 w-72 bg-white/95 backdrop-blur-xl border border-black/[0.08] rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-black/[0.06] bg-gradient-to-r from-primary/5 to-accent/5">
              <h3 className="font-semibold text-foreground">API Connections</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Test your API keys before running the demo
              </p>
            </div>

            <div className="p-2">
              {services.map(({ key, testFn }, index) => (
                <motion.button
                  key={key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleTest(key, testFn)}
                  disabled={testing !== null}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-foreground/80 hover:text-foreground hover:bg-black/[0.03] rounded-xl transition-all disabled:opacity-50 group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-black/[0.04] group-hover:bg-black/[0.06] flex items-center justify-center transition-colors">
                      {getServiceIcon(key)}
                    </div>
                    <span className="font-medium">{getServiceLabel(key)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {testing === key ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Loader2 className="w-4 h-4 text-primary" />
                      </motion.div>
                    ) : (
                      getResultIcon(key)
                    )}
                  </div>
                </motion.button>
              ))}
            </div>

            <div className="p-3 border-t border-black/[0.06]">
              <motion.button
                onClick={handleTestAll}
                disabled={testing !== null}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-primary to-accent hover:opacity-90 rounded-xl transition-all disabled:opacity-50 shadow-md shadow-primary/20"
              >
                {testing === "all" ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="w-4 h-4" />
                    </motion.div>
                    Testing All...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Test All APIs
                  </>
                )}
              </motion.button>
            </div>

            {/* Results Summary */}
            <AnimatePresence>
              {Object.keys(results).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-2 border-t border-black/[0.06] bg-black/[0.02]"
                >
                  <div className="text-[10px] text-muted-foreground/60 font-medium">
                    Last tested:{" "}
                    {new Date(
                      Object.values(results)[0]?.timestamp || ""
                    ).toLocaleTimeString()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
