import { useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { Row, SectionCard, TextCell, formMetrics } from "../../lib/cells";
import { Btn } from "../../lib/ui";
import { useAuth } from "../../lib/auth";
import { ApiError, apiChangeOwnPassword } from "../../lib/api";

/** Matches the API, which rejects anything shorter. */
const MIN_LENGTH = 8;

/**
 * Security.
 *
 * Just the password: the API has no sessions, devices, MFA or sign-out-
 * everywhere endpoints, and a card that cannot do anything is how the old
 * Account page ended up two-thirds commented out.
 */
export default function SecuritySettings() {
  const { user } = useAuth();

  const [current, setCurrent] = useState("");
  const [next,    setNext]    = useState("");
  const [confirm, setConfirm] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function problem(): string | null {
    if (!current)                 return "Enter your current password.";
    if (next.length < MIN_LENGTH) return `New password must be at least ${MIN_LENGTH} characters.`;
    if (next === current)         return "The new password matches the current one.";
    if (next !== confirm)         return "The two new passwords do not match.";
    return null;
  }

  async function submit() {
    if (!user?.id) return;

    const found = problem();
    if (found) {
      setError(found);
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiChangeOwnPassword(user.id, current, next);
      // Leaving the old values in the boxes invites a second submit that would
      // now fail, and they are the one thing on screen worth not keeping.
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not change your password. Please try again.");
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={Lock}
      title="Password"
      style={formMetrics}
      meta={
        <div className="flex items-center gap-2 flex-shrink-0">
          {saved && (
            <span className="text-[length:var(--cell-hint-fs)] font-mono text-emerald-500 flex items-center gap-1">
              <Check size={11} /> Changed
            </span>
          )}
          {error && (
            <span className="text-[length:var(--cell-hint-fs)] font-mono text-red-400 truncate max-w-[16rem]" title={error}>
              {error}
            </span>
          )}
          <Btn variant="primary" onClick={submit} disabled={saving}>
            {saving
              ? <><Loader2 size={11} className="inline mr-1.5 animate-spin" />Updating…</>
              : "Update password"}
          </Btn>
        </div>
      }
    >
      <Row cols={1}>
        <TextCell
          label="Current password"
          type="password"
          value={current}
          placeholder="••••••••"
          required
          onChange={v => { setCurrent(v); setError(null); }}
        />
      </Row>
      <Row>
        <TextCell
          label="New password"
          type="password"
          value={next}
          placeholder="••••••••"
          required
          hint={`At least ${MIN_LENGTH} characters.`}
          onChange={v => { setNext(v); setError(null); }}
        />
        <TextCell
          label="Confirm new password"
          type="password"
          value={confirm}
          placeholder="••••••••"
          required
          onChange={v => { setConfirm(v); setError(null); }}
        />
      </Row>
    </SectionCard>
  );
}
