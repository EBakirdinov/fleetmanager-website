import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const ORDER = ["light", "dark", "system"] as const;
type ThemeChoice = (typeof ORDER)[number];

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <button className="w-8 h-8 rounded" aria-hidden />;
  }

  const current = (theme ?? "system") as ThemeChoice;
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;
  const label =
    current === "system"
      ? `System (${resolvedTheme})`
      : current === "dark"
        ? "Dark"
        : "Light";

  return (
    <button
      onClick={() => setTheme(next)}
      className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-white/5 dark:hover:bg-white/5 transition-colors"
      aria-label={`Theme: ${label}. Click to switch to ${next}.`}
      title={`Theme: ${label}`}
    >
      <Icon size={15} />
    </button>
  );
}
