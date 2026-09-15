import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Truck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, companyName);
      navigate("/dashboard", { replace: true });
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
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="w-full max-w-sm bg-card border border-border rounded-md p-6 shadow-lg">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center flex-shrink-0">
            <Truck size={15} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">FLEET PRO</h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">Start a free 14-day trial</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="companyName" className="text-xs font-mono text-muted-foreground tracking-widest uppercase">Company name</label>
            <input
              id="companyName"
              type="text"
              required
              autoComplete="organization"
              autoFocus
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-input-background border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Acme Trucking LLC"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-mono text-muted-foreground tracking-widest uppercase">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
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
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-input-background border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <div className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password || !companyName}
            className="w-full bg-primary text-primary-foreground font-medium text-sm rounded py-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>

          <p className="text-xs font-mono text-muted-foreground text-center pt-1">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
