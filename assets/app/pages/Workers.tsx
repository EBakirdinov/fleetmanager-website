import { useState, useEffect, useMemo } from "react";
import { Users, ShieldCheck, UserX, KeyRound, Pencil, Plus, Ban, Check } from "lucide-react";
import {
  KpiCard, StatusPill, Btn, SlideDrawer, DrawerSection, DrawerFieldRow,
  DrawerField as Field, DrawerSelect as Select, DrawerCell, ActionsMenu,
} from "../lib/ui";
import {
  apiListWorkers, apiCreateWorker, apiUpdateWorker, apiSetWorkerStatus,
  apiResetWorkerPassword, ApiError, type WorkerItem,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { ROLE_MAP, ASSIGNABLE_ROLES, DEFAULT_ROLE, isLegacyRole, primaryRole } from "../lib/roles";
import { validateRequired, validateEmail, validatePhone, combineValidators } from "../lib/validators";
import { maskPhone } from "../lib/masks";

// ─── Form state ──────────────────────────────────────────────────────────────

/** How a new worker gets their first password. */
type AccessMode = "password" | "invite";

interface WorkerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  mode: AccessMode;
  password: string;
  confirmPassword: string;
}

const emptyForm = (): WorkerForm => ({
  firstName: "", lastName: "", email: "", phone: "", address: "",
  role: DEFAULT_ROLE, mode: "invite", password: "", confirmPassword: "",
});

function formFromItem(w: WorkerItem): WorkerForm {
  return {
    firstName:       w.first_name ?? "",
    lastName:        w.last_name  ?? "",
    email:           w.email      ?? "",
    phone:           maskPhone(w.phone ?? ""),
    address:         w.address    ?? "",
    role:            primaryRole(w.roles) ?? DEFAULT_ROLE,
    mode:            "invite",
    password:        "",
    confirmPassword: "",
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

const WORKER_VALIDATORS: Partial<Record<string, (v: string) => string | null>> = {
  firstName: validateRequired,
  lastName:  validateRequired,
  email:     combineValidators(validateRequired, validateEmail),
  phone:     validatePhone,
};

/**
 * Password rules only apply when adding someone with a typed password — on edit,
 * and in invite mode, the fields aren't rendered at all.
 */
function validateAllWorker(form: WorkerForm, mode: "add" | "edit"): Record<string, string | null> {
  const errs: Record<string, string | null> = {};
  for (const k in WORKER_VALIDATORS) {
    const fn = WORKER_VALIDATORS[k];
    if (!fn) continue;
    const val = (form as unknown as Record<string, unknown>)[k];
    if (typeof val === "string") {
      const e = fn(val);
      if (e) errs[k] = e;
    }
  }

  if (mode === "add" && form.mode === "password") {
    if (form.password.length < 8) {
      errs.password = "At least 8 characters";
    } else if (form.password !== form.confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }
  }

  return errs;
}

type StringField = "firstName" | "lastName" | "email" | "phone" | "address" | "role" | "password" | "confirmPassword";

const STATUS_COLOR: Record<number, string> = { 1: "#10b981", 0: "#6b7e96" };
const STATUS_LABEL: Record<number, string> = { 1: "Active", 0: "Disabled" };

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Workers() {
  const { user: currentUser } = useAuth();
  const selfId = currentUser?.id != null ? Number(currentUser.id) : null;
  const isOwner = (currentUser?.roles ?? []).includes("ROLE_OWNER")
    || (currentUser?.roles ?? []).includes("ROLE_SUPER_ADMIN");

  const [items,      setItems]      = useState<WorkerItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filter,     setFilter]     = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add");
  const [selected,   setSelected]   = useState<WorkerItem | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [busyId,     setBusyId]     = useState<number | null>(null);
  const [toast,      setToast]      = useState<{ ok: boolean; msg: string } | null>(null);
  const [form,       setFormState]  = useState<WorkerForm>(emptyForm());
  const [errors,     setErrors]     = useState<Record<string, string | null>>({});

  // Password reset lives in its own drawer — it is a different action from
  // editing a profile and shouldn't share the save button.
  const [resetTarget,  setResetTarget]  = useState<WorkerItem | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError,   setResetError]   = useState<string | null>(null);
  const [resetting,    setResetting]    = useState(false);

  useEffect(() => {
    setFormState(selected ? formFromItem(selected) : emptyForm());
    setErrors({});
  }, [selected]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      setItems(await apiListWorkers());
    } catch {
      setError("Failed to load workers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function set(k: StringField, v: string) {
    setFormState(p => ({ ...p, [k]: v }));
    setErrors(p => (p[k] ? { ...p, [k]: null } : p));
  }

  function handleBlur(k: StringField) {
    const fn = WORKER_VALIDATORS[k];
    if (!fn) return;
    const val = (form as unknown as Record<string, unknown>)[k];
    if (typeof val !== "string") return;
    setErrors(p => ({ ...p, [k]: fn(val) }));
  }

  function openAdd() {
    setSelected(null);
    setDrawerMode("add");
    setDrawerOpen(true);
  }

  function openEdit(w: WorkerItem) {
    setSelected(w);
    setDrawerMode("edit");
    setDrawerOpen(true);
  }

  async function handleSave() {
    const errs = validateAllWorker(form, drawerMode);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast(false, `Please fix ${Object.keys(errs).length} validation error(s)`);
      return;
    }

    setSaving(true);
    try {
      // camelCase on the way in — these bind to Symfony's UserType. (Responses
      // come back snake_case; see the note on WorkerItem.)
      const payload: Record<string, unknown> = {
        firstName: form.firstName || null,
        lastName:  form.lastName  || null,
        email:     form.email     || null,
        phone:     form.phone     || null,
        address:   form.address   || null,
      };

      // The API rejects a self-role change with 409, so don't send one. A retired
      // role left untouched is also omitted — the API only accepts assignable
      // roles, and not sending it leaves the existing value alone.
      const editingSelf = drawerMode === "edit" && selected != null && selected.id === selfId;
      if (!editingSelf && ASSIGNABLE_ROLES.includes(form.role)) payload.role = form.role;

      if (drawerMode === "add") {
        payload.mode = form.mode;
        if (form.mode === "password") payload.password = form.password;
        await apiCreateWorker(payload);
      } else if (selected) {
        await apiUpdateWorker(selected.id, payload);
      }

      await loadData();
      setDrawerOpen(false);
      showToast(true, drawerMode === "add"
        ? (form.mode === "invite" ? "Worker added — invitation sent" : "Worker added")
        : "Worker updated");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(w: WorkerItem) {
    const next = w.status === 1 ? 0 : 1;
    const label = workerName(w);
    if (next === 0 && !window.confirm(`Disable ${label}? They will not be able to sign in.`)) return;

    setBusyId(w.id);
    try {
      await apiSetWorkerStatus(w.id, next);
      await loadData();
      showToast(true, next === 0 ? "Worker disabled" : "Worker enabled");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Could not change status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    if (resetPassword.length < 8) {
      setResetError("At least 8 characters");
      return;
    }

    setResetting(true);
    try {
      await apiResetWorkerPassword(resetTarget.id, resetPassword);
      setResetTarget(null);
      setResetPassword("");
      setResetError(null);
      showToast(true, "Password reset");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Reset failed. Please try again.");
    } finally {
      setResetting(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const kpiAll      = items.length;
  const kpiActive   = items.filter(w => w.status === 1).length;
  const kpiDisabled = items.filter(w => w.status === 0).length;
  const kpiAdmins   = items.filter(w =>
    (w.roles ?? []).some(r => r === "ROLE_OWNER" || r === "ROLE_MANAGER")).length;

  const filtered = useMemo(() => {
    switch (filter) {
      case "active":   return items.filter(w => w.status === 1);
      case "disabled": return items.filter(w => w.status === 0);
      case "admins":   return items.filter(w => (w.roles ?? []).some(r => r === "ROLE_OWNER" || r === "ROLE_MANAGER"));
      default:         return items;
    }
  }, [items, filter]);

  // An owner can grant any role; a manager can grant everything below owner.
  // A worker still on a retired role (User, Partner) keeps it as a visible option
  // so editing their profile doesn't silently reassign them.
  const roleOptions = useMemo(() => {
    const base = isOwner ? ASSIGNABLE_ROLES : ASSIGNABLE_ROLES.filter(r => r !== "ROLE_OWNER");
    return isLegacyRole(form.role) ? [form.role, ...base] : base;
  }, [isOwner, form.role]);

  const editingSelf = drawerMode === "edit" && selected != null && selected.id === selfId;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* KPIs */}
        <div className="flex gap-3 flex-wrap">
          <KpiCard label="All Workers" value={kpiAll}      icon={Users}       accent="#6b7e96" active={filter === "all"}      onClick={() => setFilter("all")} />
          <KpiCard label="Active"      value={kpiActive}   icon={Check}       accent="#10b981" active={filter === "active"}   onClick={() => setFilter("active")} />
          <KpiCard label="Disabled"    value={kpiDisabled} icon={UserX}       accent="#ef4444" active={filter === "disabled"} onClick={() => setFilter("disabled")} />
          <KpiCard label="Admins"      value={kpiAdmins}   icon={ShieldCheck} accent="#f59e0b" sub="Owners and managers" active={filter === "admins"} onClick={() => setFilter("admins")} />
        </div>

        {toast && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono ${toast.ok ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400" : "bg-red-500/10 border border-red-500/25 text-red-400"}`}>
            {toast.msg}
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">All Workers</span>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{filtered.length}</span>
            </div>
            <Btn variant="primary" onClick={openAdd}><Plus size={11} className="inline mr-1" />Add Worker</Btn>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs font-mono text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-xs font-mono text-red-400">{error}</p>
              <Btn variant="outline" onClick={loadData}>Retry</Btn>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Worker", "Contact", "Role", "Status", ""].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(w => {
                    const role = primaryRole(w.roles);
                    const def = role ? ROLE_MAP[role] : null;
                    const isSelf = w.id === selfId;
                    return (
                      <tr
                        key={w.id}
                        className={`border-b border-border/50 hover:bg-muted/40 transition-colors ${w.status === 0 ? "opacity-55" : ""}`}
                      >
                        {/* Worker: initials + name, email below */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-semibold flex-shrink-0"
                              style={{ backgroundColor: `${STATUS_COLOR[w.status] ?? "#6b7e96"}20`, color: STATUS_COLOR[w.status] ?? "#6b7e96" }}
                            >
                              {workerInitials(w)}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-foreground">{workerName(w)}</span>
                                {isSelf && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">You</span>
                                )}
                              </div>
                              {w.email && <div className="text-[11px] font-mono text-muted-foreground">{w.email}</div>}
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="text-xs font-mono text-foreground">{w.phone ?? "—"}</div>
                          {w.address && <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{w.address}</div>}
                        </td>

                        {/* Role */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {def ? (
                            <span
                              className="text-xs font-mono px-2 py-0.5 rounded border"
                              style={{ borderColor: `${def.color}50`, color: def.color, backgroundColor: `${def.color}15` }}
                            >
                              {def.label}
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <StatusPill
                            label={STATUS_LABEL[w.status] ?? "Unknown"}
                            color={STATUS_COLOR[w.status] ?? "#6b7e96"}
                          />
                        </td>

                        <td className="px-3 py-2.5">
                          <ActionsMenu items={[
                            { label: "Edit", onClick: () => openEdit(w), icon: Pencil },
                            { label: "Reset password", onClick: () => { setResetTarget(w); setResetPassword(""); setResetError(null); }, icon: KeyRound },
                            // The API refuses to disable your own account (409),
                            // so don't offer it.
                            ...(isSelf ? [] : [{
                              label: w.status === 1 ? "Disable" : "Enable",
                              onClick: () => handleToggleStatus(w),
                              icon: w.status === 1 ? Ban : Check,
                              variant: (w.status === 1 ? "danger" : "default") as "danger" | "default",
                              disabled: busyId === w.id,
                            }]),
                          ]} />
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">No workers found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
            <span className="text-xs font-mono text-muted-foreground">Showing {filtered.length} of {kpiAll} workers</span>
          </div>
        </div>
      </div>

      {/* Add / edit */}
      <SlideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerMode === "add" ? "Add New Worker" : "Edit Worker"}
        badge={drawerMode === "edit" ? `#${selected?.id}` : "NEW"}
        onSave={handleSave}
        saving={saving}
      >
        <DrawerSection title="Details">
          <DrawerFieldRow>
            <Field label="First Name" value={form.firstName} required
              onChange={v => set("firstName", v)} onBlur={() => handleBlur("firstName")} error={errors.firstName} />
            <Field label="Last Name" value={form.lastName} required
              onChange={v => set("lastName", v)} onBlur={() => handleBlur("lastName")} error={errors.lastName} />
          </DrawerFieldRow>
          <DrawerFieldRow>
            <Field label="Email" value={form.email} type="email" mono required
              hint={drawerMode === "add" ? "Used to sign in" : undefined}
              onChange={v => set("email", v)} onBlur={() => handleBlur("email")} error={errors.email} />
            <Field label="Phone" value={form.phone} mono
              onChange={v => set("phone", maskPhone(v))} onBlur={() => handleBlur("phone")} error={errors.phone} />
          </DrawerFieldRow>
          <DrawerFieldRow cols={1}>
            <Field label="Address" value={form.address} onChange={v => set("address", v)} />
          </DrawerFieldRow>
        </DrawerSection>

        <DrawerSection title="Role">
          <DrawerFieldRow cols={1}>
            {editingSelf ? (
              <Field label="Role" value={ROLE_MAP[form.role]?.label ?? form.role} readOnly
                hint="You cannot change your own role — ask another owner or manager." />
            ) : (
              <Select label="Role" value={form.role} onChange={v => set("role", v)} required>
                {roleOptions.map(r => (
                  <option key={r} value={r}>
                    {ROLE_MAP[r].label}{isLegacyRole(r) ? " (retired)" : ""}
                  </option>
                ))}
              </Select>
            )}
          </DrawerFieldRow>
        </DrawerSection>

        {drawerMode === "add" && (
          <DrawerSection title="Access">
            <DrawerFieldRow cols={1}>
              <DrawerCell label="How should they get their password?" as="div" cursor="pointer">
                <div className="flex gap-2 mt-1">
                  {([
                    ["invite",   "Send invitation"],
                    ["password", "Set a password"],
                  ] as [AccessMode, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFormState(p => ({ ...p, mode }))}
                      className={`flex-1 py-2 rounded text-xs font-mono font-semibold transition-colors border ${
                        form.mode === mode
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-muted border-border text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-2">
                  {form.mode === "invite"
                    ? "We'll email them a generated password and a sign-in link."
                    : "You set the password and share it with them yourself."}
                </p>
              </DrawerCell>
            </DrawerFieldRow>

            {form.mode === "password" && (
              <DrawerFieldRow>
                <Field label="Password" value={form.password} type="password" mono required
                  hint="At least 8 characters"
                  onChange={v => set("password", v)} error={errors.password} />
                <Field label="Confirm Password" value={form.confirmPassword} type="password" mono required
                  onChange={v => set("confirmPassword", v)} error={errors.confirmPassword} />
              </DrawerFieldRow>
            )}
          </DrawerSection>
        )}
      </SlideDrawer>

      {/* Reset password */}
      <SlideDrawer
        open={resetTarget !== null}
        onClose={() => setResetTarget(null)}
        title="Reset Password"
        badge={resetTarget ? workerName(resetTarget) : undefined}
        onSave={handleResetPassword}
        saving={resetting}
      >
        <DrawerSection title="New password">
          <DrawerFieldRow cols={1}>
            <Field
              label="Password" value={resetPassword} type="password" mono required
              hint="At least 8 characters. Share it with them directly — no email is sent."
              onChange={v => { setResetPassword(v); setResetError(null); }}
              error={resetError}
            />
          </DrawerFieldRow>
        </DrawerSection>
      </SlideDrawer>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function workerName(w: WorkerItem): string {
  return [w.first_name, w.last_name].filter(Boolean).join(" ") || w.email || `Worker #${w.id}`;
}

function workerInitials(w: WorkerItem): string {
  const initials = ((w.first_name?.[0] ?? "") + (w.last_name?.[0] ?? "")).toUpperCase();
  if (initials) return initials;
  return (w.email ?? "?").slice(0, 2).toUpperCase();
}
