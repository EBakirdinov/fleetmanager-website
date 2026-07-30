import { useEffect, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const STORAGE_KEY = "fleet.zoom";
const MIN = 0.6;
const MAX = 2.0;
const STEP = 0.1;
const DEFAULT = 1.0;

function readStored(): number {
  if (typeof window === "undefined") return DEFAULT;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT;
}

function applyZoom(z: number) {
  (document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom = String(z);
}

const clamp = (v: number) => Math.min(MAX, Math.max(MIN, Math.round(v * 100) / 100));

export default function ZoomControls() {
  const [zoom, setZoom] = useState<number>(() => readStored());

  useEffect(() => {
    applyZoom(zoom);
    window.localStorage.setItem(STORAGE_KEY, String(zoom));
  }, [zoom]);

  return (
    <div className="fixed bottom-4 right-4 z-30 flex items-center bg-card border border-border rounded-md shadow-lg p-1 font-mono">
      <button
        onClick={() => setZoom((z) => clamp(z - STEP))}
        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <ZoomOut size={14} />
      </button>
      <span className="text-xs text-muted-foreground px-2 tabular-nums w-12 text-center">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => setZoom((z) => clamp(z + STEP))}
        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <ZoomIn size={14} />
      </button>
      <button
        onClick={() => setZoom(DEFAULT)}
        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors border-l border-border ml-0.5"
        aria-label="Reset zoom"
        title={`Reset to ${Math.round(DEFAULT * 100)}%`}
      >
        <RotateCcw size={12} />
      </button>
    </div>
  );
}
