import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { apiLogin, apiLogout, apiMe, apiRegister, type User } from "./api";
import { atLeast, hasPermissions, isHidden, type Level } from "./permissions";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, companyName: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const refresh = useCallback(async () => {
    try {
      const me = await apiMe();
      setUser(me);
      setStatus(me ? "authenticated" : "unauthenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (email: string, password: string, companyName: string) => {
    const u = await apiRegister(email, password, companyName);
    setUser(u);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* still clear local state */ }
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, refresh }),
    [user, status, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** True when the user holds any of `roles`. Super admins pass everything. */
export function hasRole(user: User | null, roles: string[]): boolean {
  const held = user?.roles ?? [];
  if (held.includes("ROLE_SUPER_ADMIN")) return true;
  return roles.some(r => held.includes(r));
}

/**
 * Gate a route on role. Wraps RequireAuth's job of waiting for the session to
 * resolve, then bounces to the dashboard rather than the login page — the user
 * is signed in, they just can't be here.
 */
export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user, status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full w-full text-muted-foreground text-sm font-mono">
        Loading…
      </div>
    );
  }

  if (!hasRole(user, roles)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

/**
 * Gate a route on a permission module, which is what the four access levels
 * actually describe. Prefer this over RequireRole for anything in the
 * permission catalog; RequireRole remains for the few genuinely role-shaped
 * checks (and for ROLE_SUPER_ADMIN).
 *
 * `level` defaults to requiring only that the module is not hidden, matching
 * the sidebar: if you can see the link you can open the page. Pass a level to
 * demand more — e.g. level="manage" for an editor route.
 *
 * Bounces to the dashboard rather than the login page: the user is signed in,
 * they just cannot be here. The API refuses it independently; this only keeps
 * people from walking into a page that would fail.
 */
export function RequirePermission({
  module,
  level,
  children,
}: {
  module: string;
  level?: Level;
  children: ReactNode;
}) {
  const { user, status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full w-full text-muted-foreground text-sm font-mono">
        Loading…
      </div>
    );
  }

  // Wait for the permission payload before deciding, so a slow session does
  // not bounce someone off a page they are allowed to open.
  if (!hasPermissions(user)) {
    return (
      <div className="flex items-center justify-center h-full w-full text-muted-foreground text-sm font-mono">
        Loading…
      </div>
    );
  }

  const allowed = level ? atLeast(user, module, level) : !isHidden(user, module);
  if (!allowed) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full w-full text-muted-foreground text-sm font-mono">
        Loading…
      </div>
    );
  }

  if (status === "unauthenticated") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
