import type { ReactNode } from "react";
import { Radio } from "lucide-react";

interface IconEntry {
  bg: string;
  render: (size: number) => ReactNode;
}

// Fallback registry keyed by slug — used when the catalog entry has no iconUrl.
const REGISTRY: Record<string, IconEntry> = {
  google_maps: {
    bg: "#4285F4",
    render: (size) => (
      // Google Maps pin glyph (Simple Icons — CC0)
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.336-.236.79-.579.821-.378.035-.549-.408-.63-.749-.203-.708-.379-1.421-.626-2.115-.245-.687-.575-1.34-.977-1.948-.951-1.43-2.259-2.611-3.293-3.996-1.09-1.457-1.925-3.104-2.213-4.913-.278-1.737-.052-3.542.628-5.163.62-1.4 1.616-2.699 2.913-3.564 1.303-.87 2.85-1.283 4.325-1.288 1.474-.005 2.966.4 4.146 1.222 1.02.719 1.859 1.678 2.474 2.784.09.16.164.325.242.489.078.164.148.331.216.499.213.523.359 1.06.409 1.618zm-7.527 4.301c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z" />
      </svg>
    ),
  },
  quantum_eld: {
    bg: "#10b981",
    render: (size) => <Radio size={Math.round(size * 0.55)} color="white" strokeWidth={2} />,
  },
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

// Deterministic soft accent for the fallback bubble, based on slug hash.
function fallbackColor(slug: string): string {
  const palette = ["#6b7e96", "#8b5cf6", "#0ea5e9", "#f59e0b", "#ec4899", "#06b6d4"];
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

export function IntegrationIcon({ slug, name, iconUrl, size = 40 }: {
  slug: string;
  name: string;
  iconUrl?: string | null;
  size?: number;
}) {
  // Preferred: real logo from the catalog (rendered on a white surface so brand colors show).
  if (iconUrl) {
    return (
      <div
        className="rounded-lg bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10"
        style={{ width: size, height: size }}
      >
        <img
          src={iconUrl}
          alt={name}
          loading="lazy"
          className="max-w-full max-h-full object-contain"
          style={{ padding: Math.round(size * 0.15) }}
        />
      </div>
    );
  }

  // Fallback: hand-drawn glyph from the registry.
  const entry = REGISTRY[slug];
  if (entry) {
    return (
      <div
        className="rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: entry.bg }}
      >
        {entry.render(size)}
      </div>
    );
  }

  // Last resort: initials on a deterministic soft color.
  return (
    <div
      className="rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: fallbackColor(slug) }}
    >
      <span className="text-white font-semibold" style={{ fontSize: size * 0.4 }}>
        {initialsOf(name)}
      </span>
    </div>
  );
}
