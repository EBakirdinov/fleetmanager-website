import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { navItems } from "../lib/nav";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../lib/auth";

function initialsOf(user: { firstName?: string | null; lastName?: string | null; email?: string } | null): string {
  if (!user) return "?";
  const f = (user.firstName ?? "").trim();
  const l = (user.lastName ?? "").trim();
  if (f || l) return (f.slice(0, 1) + l.slice(0, 1)).toUpperCase() || "?";
  const e = (user.email ?? "").trim();
  return e ? e.slice(0, 2).toUpperCase() : "?";
}

function displayName(user: { firstName?: string | null; lastName?: string | null; email?: string } | null): string {
  if (!user) return "Signed out";
  const name = [(user.firstName ?? "").trim(), (user.lastName ?? "").trim()].filter(Boolean).join(" ");
  return name || user.email || "Signed in";
}

function roleLabel(roles: string[] | undefined): string {
  if (!roles || roles.length === 0) return "Member";
  if (roles.includes("ROLE_OWNER")) return "Owner";
  if (roles.includes("ROLE_MANAGER")) return "Manager";
  if (roles.includes("ROLE_DISPATCHER")) return "Dispatcher";
  return "Member";
}

export default function TopBar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const entry = navItems.find((n) => pathname === n.path || pathname.startsWith(n.path + "/"));
  const title = entry?.title ?? "Fleet Manager";
  const sub = entry?.sub ?? "";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/90 backdrop-blur-sm flex-shrink-0">
      <div>
        <h1 className="text-base font-semibold text-foreground leading-none">{title}</h1>
        <p className="text-xs font-mono text-muted-foreground mt-0.5">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded px-1.5 py-1 cursor-pointer hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Open user menu"
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-mono text-primary font-semibold">{initialsOf(user)}</span>
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-medium text-foreground leading-none">{displayName(user)}</p>
              <p className="text-xs font-mono text-muted-foreground">{roleLabel(user?.roles)}</p>
            </div>
            <ChevronDown size={11} className={`text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-56 bg-popover text-popover-foreground border border-border rounded-md shadow-lg z-[1000] p-1"
            >
              <div className="px-2 py-2 border-b border-border">
                <p className="text-sm text-foreground truncate">{displayName(user)}</p>
                <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                  {user?.email ?? roleLabel(user?.roles)}
                </p>
              </div>

              <button
                type="button"
                disabled
                role="menuitem"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground rounded-sm cursor-not-allowed opacity-60"
              >
                <UserIcon size={14} />
                Profile
              </button>

              <div className="h-px bg-border my-1" />

              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); void logout(); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-sm cursor-pointer transition-colors"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
