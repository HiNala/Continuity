"use client";

import { 
  CheckCircle2, 
  Loader2, 
  Circle,
  FileText,
  Eye,
  Trash2,
  Building2,
  Lamp,
  Palette
} from "lucide-react";

type PhaseStatus = "pending" | "active" | "completed" | "error";

interface Phase {
  id: string;
  name: string;
  status: PhaseStatus;
  description?: string;
}

interface PhaseProgressProps {
  currentPhase: string;
  currentStatus: string;
  retryCount?: number;
  elapsedTime?: number;
}

const PHASES: Omit<Phase, "status">[] = [
  { id: "requirements", name: "Requirements", description: "Gathering specifications" },
  { id: "analysis", name: "Analysis", description: "Extracting constraints" },
  { id: "cleanup", name: "Cleanup", description: "Removing debris" },
  { id: "structural", name: "Structural", description: "Completing structure" },
  { id: "fixture", name: "Fixtures", description: "Placing fixtures" },
  { id: "style", name: "Style", description: "Applying styles" },
];

export function PhaseProgress({ 
  currentPhase, 
  currentStatus,
  retryCount = 0,
  elapsedTime 
}: PhaseProgressProps) {
  const getPhaseIcon = (phase: string, status: PhaseStatus) => {
    const iconClass = status === "completed" 
      ? "text-emerald-400" 
      : status === "active" 
        ? "text-continuity-400" 
        : "text-slate-600";

    const icons: Record<string, React.ReactNode> = {
      requirements: <FileText className={`w-4 h-4 ${iconClass}`} />,
      analysis: <Eye className={`w-4 h-4 ${iconClass}`} />,
      cleanup: <Trash2 className={`w-4 h-4 ${iconClass}`} />,
      structural: <Building2 className={`w-4 h-4 ${iconClass}`} />,
      fixture: <Lamp className={`w-4 h-4 ${iconClass}`} />,
      style: <Palette className={`w-4 h-4 ${iconClass}`} />,
    };
    return icons[phase] || <Circle className={`w-4 h-4 ${iconClass}`} />;
  };

  const getPhaseStatus = (phaseId: string): PhaseStatus => {
    const phaseOrder = PHASES.map(p => p.id);
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const phaseIndex = phaseOrder.indexOf(phaseId);

    if (phaseIndex < currentIndex) return "completed";
    if (phaseIndex === currentIndex) return "active";
    return "pending";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Phase Steps */}
      <div className="flex items-center justify-between">
        {PHASES.map((phase, index) => {
          const status = getPhaseStatus(phase.id);
          
          return (
            <div key={phase.id} className="flex items-center">
              {/* Step */}
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  transition-all duration-300
                  ${status === "completed" 
                    ? "bg-emerald-500/20 border-2 border-emerald-500" 
                    : status === "active" 
                      ? "bg-continuity-500/20 border-2 border-continuity-500" 
                      : "bg-slate-800 border-2 border-slate-700"
                  }
                `}>
                  {status === "completed" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : status === "active" ? (
                    <Loader2 className="w-5 h-5 text-continuity-400 animate-spin" />
                  ) : (
                    getPhaseIcon(phase.id, status)
                  )}
                </div>
                <span className={`
                  text-xs mt-2 font-medium
                  ${status === "active" ? "text-white" : "text-slate-500"}
                `}>
                  {phase.name}
                </span>
              </div>

              {/* Connector */}
              {index < PHASES.length - 1 && (
                <div className={`
                  w-8 h-0.5 mx-1
                  ${getPhaseStatus(PHASES[index + 1].id) !== "pending" 
                    ? "bg-emerald-500" 
                    : "bg-slate-700"
                  }
                `} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Status */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Current Status</p>
            <p className="text-white font-medium">{currentStatus}</p>
          </div>
          <div className="text-right">
            {retryCount > 0 && (
              <p className="text-amber-400 text-sm">
                Retry {retryCount} - Self-improving...
              </p>
            )}
            {elapsedTime !== undefined && (
              <p className="text-slate-500 text-sm">
                Elapsed: {formatTime(elapsedTime)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
