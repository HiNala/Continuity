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
} from "lucide-react";
import {
  testWeaveAPI,
  testGeminiAPI,
  testBrowserbaseAPI,
  testRedisAPI,
  testDatabaseAPI,
  testAllAPIs,
  runSelfImprovementTests,
  APITestResult,
  SelfImprovementTestResult,
} from "@/lib/api";

interface SettingsDropdownProps {
  onTestResult?: (type: "success" | "error", title: string, message?: string) => void;
}

export function SettingsDropdown({ onTestResult }: SettingsDropdownProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, APITestResult>>({});
  const [selfImprovementResult, setSelfImprovementResult] = useState<SelfImprovementTestResult | null>(null);
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

  const handleSelfImprovementTest = async () => {
    setTesting("self-improvement");
    setSelfImprovementResult(null);
    try {
      const result = await runSelfImprovementTests();
      setSelfImprovementResult(result);
      
      const { passed, failed, total } = result.summary;
      if (failed === 0) {
        onTestResult?.("success", "Self-Improvement Tests Passed", `All ${total} tests passed`);
      } else {
        onTestResult?.("error", `${passed}/${total} Tests Passed`, `${failed} test(s) failed`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test failed";
      onTestResult?.("error", "Self-Improvement Test Failed", message);
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
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        aria-label="Settings"
        className="h-9 w-9 flex items-center justify-center text-neutral-600 dark:text-zinc-400 hover:text-neutral-900 dark:hover:text-zinc-100 bg-white/55 dark:bg-zinc-900/55 hover:bg-white/75 dark:hover:bg-zinc-800/70 backdrop-blur-md border border-white/40 dark:border-white/10 hover:border-white/60 dark:hover:border-white/20 rounded-full transition-all shadow-sm hover:shadow-md"
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Settings className="w-4 h-4" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 backdrop-blur-xl border border-neutral-200 dark:border-zinc-700 rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-neutral-100 dark:border-zinc-800 bg-gradient-to-r from-primary/5 to-accent/5 dark:from-primary/10 dark:to-accent/10">
              <h3 className="font-semibold text-neutral-900 dark:text-zinc-100">API Connections</h3>
              <p className="text-xs text-neutral-500 dark:text-zinc-400 mt-1">
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
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-neutral-700 dark:text-zinc-300 hover:text-neutral-900 dark:hover:text-zinc-100 hover:bg-neutral-50 dark:hover:bg-zinc-800 rounded-xl transition-all disabled:opacity-50 group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-zinc-800 group-hover:bg-neutral-200 dark:group-hover:bg-zinc-700 flex items-center justify-center transition-colors">
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

            <div className="p-3 border-t border-neutral-100 dark:border-zinc-800">
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

            {/* Self-Improvement Test Section */}
            <div className="p-3 border-t border-neutral-100 dark:border-zinc-800">
              <div className="text-[10px] font-semibold text-neutral-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Self-Improvement Tests
              </div>
              <motion.button
                onClick={handleSelfImprovementTest}
                disabled={testing !== null}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/50 dark:hover:to-teal-900/50 border border-emerald-200/50 dark:border-emerald-700/50 rounded-xl transition-all disabled:opacity-50"
              >
                {testing === "self-improvement" ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </motion.div>
                    <span className="text-emerald-700 dark:text-emerald-400">Running Tests...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-400">Test Self-Improvement</span>
                  </>
                )}
              </motion.button>
              
              {/* Self-Improvement Test Results */}
              <AnimatePresence>
                {selfImprovementResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 p-2 rounded-lg bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-zinc-100">Results</span>
                      <span className={`text-xs font-bold ${
                        selfImprovementResult.summary.failed === 0 
                          ? "text-emerald-600 dark:text-emerald-400" 
                          : "text-red-500 dark:text-red-400"
                      }`}>
                        {selfImprovementResult.summary.passed}/{selfImprovementResult.summary.total} Passed
                      </span>
                    </div>
                    <div className="space-y-1">
                      {Object.entries(selfImprovementResult.tests).map(([key, test]) => (
                        <div key={key} className="flex items-center justify-between text-[10px]">
                          <span className="text-neutral-500 dark:text-zinc-400">{test.test_name}</span>
                          {test.passed ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-500" />
                          )}
                        </div>
                      ))}
                    </div>
                    {selfImprovementResult.weave_url && (
                      <a
                        href={selfImprovementResult.weave_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block text-[10px] text-primary hover:underline"
                      >
                        View in Weave →
                      </a>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Results Summary */}
            <AnimatePresence>
              {Object.keys(results).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-2 border-t border-neutral-100 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-800/50"
                >
                  <div className="text-[10px] text-neutral-400 dark:text-zinc-500 font-medium">
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
