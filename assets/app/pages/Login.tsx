import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Truck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

function nextTargetFromSearch(search: string): string {
  const q = new URLSearchParams(search).get("next");
  if (!q) return "/dashboard";
  try { return decodeURIComponent(q) || "/dashboard"; } catch { return "/dashboard"; }
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(nextTargetFromSearch(location.search), { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center h-full w-full bg-background text-foreground p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm bg-card border border-border rounded-md p-6 shadow-lg">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center flex-shrink-0">
            <Truck size={15} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">FLEET PRO</h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">Sign in to your account</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-mono text-muted-foreground tracking-widest uppercase">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-input-background border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="you@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-mono text-muted-foreground tracking-widest uppercase">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-input-background border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full bg-primary text-primary-foreground font-medium text-sm rounded py-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-xs font-mono text-muted-foreground text-center pt-1">
            No account yet?{" "}
            <Link to="/register" className="text-primary hover:underline">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
