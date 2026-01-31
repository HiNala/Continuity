"use client";

import { useState } from "react";
import { 
  Sparkles, 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  XCircle,
  Loader2,
  ExternalLink,
  Layers,
  Eye,
  Zap,
  RefreshCw
} from "lucide-react";

// API base URL from environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiStatus {
  health: "idle" | "loading" | "success" | "error";
  database: "idle" | "loading" | "success" | "error";
  weave: "idle" | "loading" | "success" | "error";
  healthMessage?: string;
  databaseMessage?: string;
  weaveMessage?: string;
}

export default function Home() {
  const [status, setStatus] = useState<ApiStatus>({
    health: "idle",
    database: "idle",
    weave: "idle",
  });

  // Test health endpoint
  const testHealth = async () => {
    setStatus((prev) => ({ ...prev, health: "loading" }));
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      setStatus((prev) => ({
        ...prev,
        health: "success",
        healthMessage: `Status: ${data.status} | Version: ${data.version}`,
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        health: "error",
        healthMessage: `Connection failed: ${error}`,
      }));
    }
  };

  // Test database endpoint
  const testDatabase = async () => {
    setStatus((prev) => ({ ...prev, database: "loading" }));
    try {
      const response = await fetch(`${API_URL}/db-test`);
      const data = await response.json();
      setStatus((prev) => ({
        ...prev,
        database: "success",
        databaseMessage: data.message,
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        database: "error",
        databaseMessage: `Database test failed: ${error}`,
      }));
    }
  };

  // Test Weave endpoint
  const testWeave = async () => {
    setStatus((prev) => ({ ...prev, weave: "loading" }));
    try {
      const response = await fetch(`${API_URL}/weave-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input_text: "Hello from Continuity!" }),
      });
      const data = await response.json();
      setStatus((prev) => ({
        ...prev,
        weave: "success",
        weaveMessage: `Traced: ${data.traced} | Output: ${data.output_text}`,
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        weave: "error",
        weaveMessage: `Weave test failed: ${error}`,
      }));
    }
  };

  // Status icon helper
  const StatusIcon = ({ state }: { state: "idle" | "loading" | "success" | "error" }) => {
    switch (state) {
      case "loading":
        return <Loader2 className="w-5 h-5 animate-spin text-continuity-400" />;
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-slate-600" />;
    }
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-continuity-950/50 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-continuity-900/20 via-transparent to-transparent" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-20">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="badge-info flex items-center gap-2 px-4 py-2">
              <Sparkles className="w-4 h-4" />
              <span>WeaveHacks 3 - Self-Improving Agents</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl font-bold text-center mb-6">
            <span className="text-gradient">Continuity</span>
          </h1>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-center text-slate-300 max-w-3xl mx-auto mb-12">
            Transform raw photographs into realistic, professionally staged 
            renovation visualizations — improving its own design process using{" "}
            <span className="text-continuity-400 font-semibold">Weave observability</span>.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
              <Eye className="w-4 h-4 text-continuity-400" />
              <span className="text-sm text-slate-300">Spatial Analysis</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-slate-300">Phased Generation</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-slate-300">Self-Improving</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-slate-300">Weave Traced</span>
            </div>
          </div>

          {/* Start New Project */}
          <div className="max-w-2xl mx-auto">
            <a href="/project" className="block">
              <div className="card border-2 border-slate-700 hover:border-continuity-500/50 transition-colors cursor-pointer group">
                <div className="flex flex-col items-center py-12">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:bg-continuity-900/50 transition-colors">
                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-continuity-400 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-2">
                    Start New Project
                  </h3>
                  <p className="text-slate-400 text-center text-sm max-w-md">
                    Describe your visualization goal and our AI will guide you through the process.
                  </p>
                  <div className="mt-4">
                    <span className="btn-primary">Get Started</span>
                  </div>
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* System Status Section */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">System Status</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          {/* Health Check */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Backend Health</h3>
              <StatusIcon state={status.health} />
            </div>
            <p className="text-sm text-slate-400 mb-4 min-h-[40px]">
              {status.healthMessage || "Test connection to the FastAPI backend"}
            </p>
            <button onClick={testHealth} className="btn-secondary w-full text-sm">
              Test Health
            </button>
          </div>

          {/* Database Check */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Database</h3>
              <StatusIcon state={status.database} />
            </div>
            <p className="text-sm text-slate-400 mb-4 min-h-[40px]">
              {status.databaseMessage || "Verify PostgreSQL connectivity"}
            </p>
            <button onClick={testDatabase} className="btn-secondary w-full text-sm">
              Test Database
            </button>
          </div>

          {/* Weave Check */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Weave Tracing</h3>
              <StatusIcon state={status.weave} />
            </div>
            <p className="text-sm text-slate-400 mb-4 min-h-[40px]">
              {status.weaveMessage || "Test Weave observability integration"}
            </p>
            <button onClick={testWeave} className="btn-primary w-full text-sm">
              Test Weave
            </button>
          </div>
        </div>

        {/* Weave Dashboard Link */}
        <div className="mt-8 text-center">
          <a
            href="https://wandb.ai/home"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-continuity-400 hover:text-continuity-300 transition-colors"
          >
            <span>View Weave Dashboard</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-2xl font-bold text-center mb-12">How Continuity Works</h2>
        
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: 1, title: "Upload", desc: "Provide photos of your space" },
            { step: 2, title: "Analyze", desc: "AI extracts spatial constraints" },
            { step: 3, title: "Generate", desc: "Phased transformation begins" },
            { step: 4, title: "Improve", desc: "Self-correction via Weave traces" },
          ].map((item, i) => (
            <div key={item.step} className="relative">
              <div className="card text-center">
                <div className="w-10 h-10 rounded-full bg-continuity-900/50 border border-continuity-500/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-continuity-400 font-bold">{item.step}</span>
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
              {i < 3 && (
                <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                  <ArrowRight className="w-6 h-6 text-slate-700" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-slate-500 text-sm">
          <p>
            Built for{" "}
            <span className="text-continuity-400">WeaveHacks 3</span> - Self-Improving Agents Hackathon
          </p>
          <p className="mt-2">January 31 - February 1, 2026</p>
        </div>
      </footer>
    </main>
  );
}
