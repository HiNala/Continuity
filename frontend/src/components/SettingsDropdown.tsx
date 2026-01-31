"use client";

import { useState, useRef, useEffect } from "react";
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
  testDatabaseAPI,
  testAllAPIs,
  APITestResult,
} from "@/lib/api";

interface SettingsDropdownProps {
  onTestResult: (type: "success" | "error", title: string, message?: string) => void;
}

export function SettingsDropdown({ onTestResult }: SettingsDropdownProps) {
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
        onTestResult("success", `${getServiceLabel(service)} Connected`, result.message);
      } else {
        onTestResult("error", `${getServiceLabel(service)} Failed`, result.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test failed";
      onTestResult("error", `${getServiceLabel(service)} Error`, message);
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
        database: allResults.database,
      });

      // Show summary toast
      const passed = [
        allResults.weave,
        allResults.gemini,
        allResults.browserbase,
        allResults.database,
      ].filter((r) => r.success).length;

      if (passed === 4) {
        onTestResult("success", "All APIs Connected", "All 4 services are working");
      } else {
        onTestResult(
          "error",
          `${passed}/4 APIs Connected`,
          `${4 - passed} service(s) failed`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test failed";
      onTestResult("error", "API Test Failed", message);
    } finally {
      setTesting(null);
    }
  };

  const getServiceLabel = (service: string): string => {
    const labels: Record<string, string> = {
      weave: "Weave/W&B",
      gemini: "Google Gemini",
      browserbase: "Browserbase",
      database: "Database",
    };
    return labels[service] || service;
  };

  const getServiceIcon = (service: string) => {
    const icons: Record<string, React.ReactNode> = {
      weave: <Activity className="w-4 h-4" />,
      gemini: <Sparkles className="w-4 h-4" />,
      browserbase: <Globe className="w-4 h-4" />,
      database: <Database className="w-4 h-4" />,
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
    { key: "database", testFn: testDatabaseAPI },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
      >
        <Settings className="w-4 h-4" />
        <span>Settings</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-700">
            <h3 className="font-medium text-white">API Key Testing</h3>
            <p className="text-xs text-slate-400 mt-1">
              Test your API keys before running the demo
            </p>
          </div>

          <div className="p-2">
            {services.map(({ key, testFn }) => (
              <button
                key={key}
                onClick={() => handleTest(key, testFn)}
                disabled={testing !== null}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  {getServiceIcon(key)}
                  <span>{getServiceLabel(key)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {testing === key ? (
                    <Loader2 className="w-4 h-4 animate-spin text-continuity-400" />
                  ) : (
                    getResultIcon(key)
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-slate-700">
            <button
              onClick={handleTestAll}
              disabled={testing !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-continuity-600 hover:bg-continuity-500 rounded-md transition-colors disabled:opacity-50"
            >
              {testing === "all" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testing All...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Test All APIs
                </>
              )}
            </button>
          </div>

          {/* Results Summary */}
          {Object.keys(results).length > 0 && (
            <div className="p-2 border-t border-slate-700 bg-slate-800/50">
              <div className="text-xs text-slate-400">
                Last tested:{" "}
                {new Date(
                  Object.values(results)[0]?.timestamp || ""
                ).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
