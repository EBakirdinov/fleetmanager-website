import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Btn, Modal } from "../../lib/ui";
import { ROLE_MAP } from "../../lib/roles";
import {
  apiGetMemberPermissions,
  apiPermissionCatalog,
  apiSetMemberPermissions,
  ApiError,
  type CatalogEntry,
  type CatalogModule,
  type PermissionCatalog,
  type PermissionOverrides,
} from "../../lib/api";

/**
 * Per-user permission editor.
 *
 * This is the spec's "one important development rule" made literal: each
 * module shows its access level, and underneath it the individual actions as
 * checkboxes. Picking a level ticks the boxes that level implies; ticking a
 * box individually is what turns the level into "Custom".
 *
 * Only the diff against the role's preset is stored. The role stays whatever
 * it was, so customising one employee never means inventing a new role.
 *
 * The module and action lists come from GET /api/permissions/catalog rather
 * than being duplicated here, so a permission added server-side appears
 * without a frontend change.
 */

const LEVEL_RANK: Record<string, number> = { none: 0, view: 1, manage: 2, full: 3 };

function rank(level: string): number {
  return LEVEL_RANK[level] ?? 0;
}

/** The keys a level grants for one module, as "{module}.{action}". */
function expand(module: CatalogModule, level: string): string[] {
  if (level === "none") return [];
  const ceiling = rank(level);
  return [...module.actions, ...module.fields]
    .filter((entry: CatalogEntry) => rank(entry.min_level) <= ceiling)
    .map(entry => `${module.key}.${entry.key}`);
}

export default function PermissionEditor({
  memberId,
  memberName,
  open,
  onClose,
}: {
  memberId: number;
  memberName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<PermissionOverrides>({ grant: [], revoke: [] });
  const [effective, setEffective] = useState<string[]>([]);
  /** Desired state per key; the editor's working copy. */
  const [desired, setDesired] = useState<Record<string, boolean>>({});
  /**
   * Which modules are open. There are seventeen of them and a hundred and
   * sixty boxes between them, so showing every one at once made the dialog a
   * single long scroll with no shape. Collapsed, the whole list fits without
   * scrolling and you open the one page you came to change.
   */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([apiPermissionCatalog(), apiGetMemberPermissions(memberId)])
      .then(([cat, member]) => {
        if (cancelled) return;
        setCatalog(cat);
        setRole(member.role);
        setOverrides(member.overrides);
        setEffective(member.effective.keys);
        setDesired(Object.fromEntries(member.effective.keys.map(k => [k, true])));
        // Anything already customised is opened, so the adjustments are
        // visible on arrival rather than hidden behind a chevron.
        const touched = [...member.overrides.grant, ...member.overrides.revoke]
          .map(key => key.split(".")[0]);
        setExpanded(Object.fromEntries(touched.map(m => [m, true])));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load permissions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, memberId]);

  /**
   * What the role alone grants, recovered from the effective set by undoing
   * the stored overrides. Saving compares against this, so a box returned to
   * its role default stops being an override rather than being stored as one.
   */
  const baseline = useMemo(() => {
    const held = new Set(effective);
    const granted = new Set(overrides.grant);
    const revoked = new Set(overrides.revoke);

    return (key: string): boolean =>
      held.has(key) ? !granted.has(key) : revoked.has(key);
  }, [effective, overrides]);

  const isOn = (key: string) => desired[key] ?? false;

  function toggle(key: string) {
    setDesired(prev => ({ ...prev, [key]: !(prev[key] ?? false) }));
  }

  function applyLevel(module: CatalogModule, level: string) {
    const on = new Set(expand(module, level));
    setDesired(prev => {
      const next = { ...prev };
      for (const entry of [...module.actions, ...module.fields]) {
        const key = `${module.key}.${entry.key}`;
        next[key] = on.has(key);
      }
      return next;
    });
  }

  /** The level the current boxes match exactly, or "custom". */
  function levelOf(module: CatalogModule): string {
    const on = [...module.actions, ...module.fields]
      .map(e => `${module.key}.${e.key}`)
      .filter(isOn)
      .sort();

    // Most privileged first, so a module with no full-only actions reports
    // Full rather than Manage when everything is ticked.
    for (const level of ["full", "manage", "view", "none"]) {
      const atLevel = expand(module, level).sort();
      if (atLevel.length === on.length && atLevel.every((k, i) => k === on[i])) return level;
    }
    return "custom";
  }

  const diff = useMemo(() => {
    const grant: string[] = [];
    const revoke: string[] = [];
    for (const [key, want] of Object.entries(desired)) {
      const base = baseline(key);
      if (want && !base) grant.push(key);
      if (!want && base) revoke.push(key);
    }
    return { grant: grant.sort(), revoke: revoke.sort() };
  }, [desired, baseline]);

  const changed =
    diff.grant.join(",") !== [...overrides.grant].sort().join(",") ||
    diff.revoke.join(",") !== [...overrides.revoke].sort().join(",");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiSetMemberPermissions(memberId, diff);
      setOverrides(updated.overrides);
      setEffective(updated.effective.keys);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Could not save permissions.");
    } finally {
      setSaving(false);
    }
  }

  function resetToRole() {
    setDesired(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) next[key] = baseline(key);
      return next;
    });
  }

  const roleLabel = role ? (ROLE_MAP[role]?.label ?? role) : "No role";
  const adjustedCount = diff.grant.length + diff.revoke.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Permissions — ${memberName}`}
      subtitle={roleLabel}
      width={720}
      footer={
        <>
          {/*
            Only offered once there is something to reset. As a permanently
            present disabled ghost button it read as broken rather than
            unavailable.
          */}
          {adjustedCount > 0 && (
            <Btn variant="outline" onClick={resetToRole} disabled={saving || loading} className="mr-auto">
              Reset to role defaults
            </Btn>
          )}
          <Btn variant="outline" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving || loading || !changed}>
            {saving ? "Saving…" : "Save permissions"}
          </Btn>
        </>
      }
    >
      {error && (
        <p className="text-xs font-mono text-destructive mb-3" role="alert">{error}</p>
      )}

      {loading && <p className="text-xs font-mono text-muted-foreground">Loading…</p>}

      {!loading && catalog && (
        <div className="space-y-4">
          {catalog.modules.map(module => {
            const level = levelOf(module);
            const entries = [...module.actions, ...module.fields];
            const open = expanded[module.key] ?? false;

            return (
              <div key={module.key} className="border border-border rounded-lg bg-card">
                <div className={`flex items-center justify-between gap-3 px-3 py-2 ${open ? "border-b border-border" : ""}`}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded(prev => ({ ...prev, [module.key]: !open }))}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                  >
                    {open
                      ? <ChevronDown size={13} className="text-muted-foreground flex-shrink-0" />
                      : <ChevronRight size={13} className="text-muted-foreground flex-shrink-0" />}
                    <div className="w-1 h-4 bg-primary rounded-full flex-shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {module.label}
                    </span>
                    {level === "custom" && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-primary border border-primary/40 rounded px-1.5 py-0.5 flex-shrink-0">
                        Custom
                      </span>
                    )}
                  </button>
                  <select
                    aria-label={`${module.label} access level`}
                    value={level}
                    onChange={e => applyLevel(module, e.target.value)}
                    className="text-xs font-mono bg-background border border-border rounded px-2 py-1 text-foreground flex-shrink-0"
                  >
                    {catalog.levels.map(l => (
                      <option key={l} value={l}>
                        {l === "none" ? "No access" : l === "view" ? "View only" : l === "manage" ? "Manage" : "Full access"}
                      </option>
                    ))}
                    {/* Present only so the control can show a customised module. */}
                    {level === "custom" && <option value="custom" disabled>Custom</option>}
                  </select>
                </div>

                <div className={`px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 ${open ? "" : "hidden"}`}>
                  {entries.map(entry => {
                    const key = `${module.key}.${entry.key}`;
                    const on = isOn(key);
                    const adjusted = on !== baseline(key);
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-xs font-mono cursor-pointer py-0.5 group"
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(key)}
                          className="accent-primary w-3.5 h-3.5 flex-shrink-0"
                        />
                        <span className={`truncate ${on ? "text-foreground" : "text-muted-foreground"}`}>
                          {entry.label}
                        </span>
                        {adjusted && (
                          <span
                            className="text-primary flex-shrink-0"
                            title="Differs from the role default"
                            aria-label="Differs from the role default"
                          >
                            •
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
