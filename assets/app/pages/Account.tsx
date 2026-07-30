import { useState, useEffect, type ReactNode } from "react";
import { User2, Calendar, Shield, CheckCircle, Save, Upload } from "lucide-react";
import { Btn } from "../lib/ui";
import { useAuth } from "../lib/auth";
import { apiUpdateProfile, ApiError } from "../lib/api";
import { validateRequired, validateEmail, validatePhone } from "../lib/validators";
import { maskPhone } from "../lib/masks";

// ─── Shared page primitives ──────────────────────────────────────────────────

function Field({ label, value, type = "text", hint, readOnly, mono, onChange, onBlur, error }: {
  label: string; value: string; type?: string; hint?: string;
  readOnly?: boolean; mono?: boolean;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
}) {
  const borderClass = error
    ? "border-red-500/60 focus:ring-red-500/50"
    : "border-border focus:ring-ring";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        onBlur={onBlur}
        className={`bg-input-background text-foreground border ${borderClass} rounded px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors ${mono ? "font-mono" : ""} ${readOnly ? "opacity-50 cursor-not-allowed select-all" : ""}`}
      />
      {error
        ? <p className="text-xs font-mono text-red-400">{error}</p>
        : hint && <p className="text-xs font-mono text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function TwoColRow({ label, description, children, last }: {
  label: string; description?: string; children: ReactNode; last?: boolean;
}) {
  return (
    <div className={`flex gap-8 py-5 ${last ? "" : "border-b border-border"}`}>
      <div className="w-52 flex-shrink-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description && <p className="text-xs font-mono text-muted-foreground mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-1 min-w-0 space-y-3">{children}</div>
    </div>
  );
}

function SettingsCard({ id, icon: Icon, title, description, children }: {
  id?: string; icon: React.ElementType; title: string; description: string; children: ReactNode;
}) {
  return (
    <div id={id} className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Icon size={13} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-none">{title}</p>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-6 pb-2">{children}</div>
    </div>
  );
}

function SettingsNav({ items }: { items: { id: string; label: string; icon: React.ElementType }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="flex items-center gap-1 mb-5 p-1 bg-card border border-border rounded-lg w-fit">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => scrollTo(item.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            active === item.id
              ? "bg-primary/15 text-primary border border-primary/25"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <item.icon size={11} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SaveBar({ onSave, onReset, saving }: { onSave: () => void; onReset: () => void; saving?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <Btn variant="outline" onClick={onReset} disabled={saving}>Reset</Btn>
      <Btn variant="primary" onClick={onSave} disabled={saving}>
        <Save size={11} className="inline mr-1.5" />{saving ? "Saving…" : "Save Changes"}
      </Btn>
    </div>
  );
}

function AvatarUpload({ initials }: { initials: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
        <span className="text-lg font-semibold text-primary">{initials}</span>
      </div>
      <div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 text-xs font-mono border border-border rounded px-3 py-1.5 text-foreground hover:border-white/20 transition-colors">
            <Upload size={11} />Upload photo
          </button>
          <button className="text-xs font-mono text-muted-foreground hover:text-red-400 transition-colors px-2">Remove</button>
        </div>
        <p className="text-xs font-mono text-muted-foreground mt-1.5">JPG, PNG or GIF · max 2 MB</p>
      </div>
    </div>
  );
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function DayOffGrid({ value, onChange }: { value: string[]; onChange: (days: string[]) => void }) {
  const toggle = (day: string) =>
    onChange(value.includes(day) ? value.filter(d => d !== day) : [...value, day]);
  return (
    <div>
      <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase block mb-2">Days Off</label>
      <div className="flex gap-2">
        {ALL_DAYS.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            className={`flex-1 py-2 rounded text-xs font-mono font-semibold transition-colors border ${value.includes(d) ? "bg-red-500/15 border-red-500/40 text-red-400" : "bg-muted border-border text-muted-foreground hover:border-white/20"}`}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="text-xs font-mono text-muted-foreground mt-2">
        {value.length ? value.join(", ") : "No days off set"}
      </p>
    </div>
  );
}

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  ROLE_OWNER:   { label: "Owner",   color: "#f59e0b" },
  ROLE_MANAGER: { label: "Manager", color: "#0ea5e9" },
  ROLE_PARTNER: { label: "Partner", color: "#10b981" },
  ROLE_USER:    { label: "User",    color: "#8b5cf6" },
};

function RolesDisplay({ roles }: { roles: string[] }) {
  const known = roles.filter(r => r in ROLE_MAP);
  const unknown = roles.filter(r => !(r in ROLE_MAP) && r !== "ROLE_SUPER_ADMIN");
  const all = [...known, ...unknown];
  if (all.length === 0) {
    return <p className="text-xs font-mono text-muted-foreground">No roles assigned.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {all.map(r => {
        const def = ROLE_MAP[r];
        return def ? (
          <span key={r} className="text-xs font-mono px-2.5 py-1 rounded border"
            style={{ borderColor: `${def.color}50`, color: def.color, backgroundColor: `${def.color}15` }}>
            {def.label}
          </span>
        ) : (
          <span key={r} className="text-xs font-mono px-2.5 py-1 rounded border border-border text-muted-foreground">
            {r}
          </span>
        );
      })}
    </div>
  );
}

function initialsOf(firstName?: string | null, lastName?: string | null, email?: string): string {
  const f = (firstName ?? "").trim();
  const l = (lastName ?? "").trim();
  if (f || l) return (f.slice(0, 1) + l.slice(0, 1)).toUpperCase() || "?";
  return email ? email.slice(0, 2).toUpperCase() : "?";
}

// ─── Validation ──────────────────────────────────────────────────────────────

const ACCOUNT_VALIDATORS: Record<string, (v: string) => string | null> = {
  firstName: validateRequired,
  lastName:  validateRequired,
  email:     validateEmail,
  phone:     validatePhone,
};

function validateAccount(values: Record<string, string>): Record<string, string | null> {
  const errs: Record<string, string | null> = {};
  for (const k in ACCOUNT_VALIDATORS) {
    const fn = ACCOUNT_VALIDATORS[k];
    const e = fn(values[k] ?? "");
    if (e) errs[k] = e;
  }
  return errs;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Account() {
  const { user, refresh } = useAuth();

  // Profile fields
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName,  setLastName]  = useState(user?.lastName  ?? "");
  const [email,     setEmail]     = useState(user?.email     ?? "");
  const [phone,     setPhone]     = useState(maskPhone(user?.phone ?? ""));
  const [address,   setAddress]   = useState(user?.address   ?? "");

  // Schedule
  const [dayOff, setDayOff] = useState<string[]>(user?.dayOff ?? []);

  const [profileSaving,  setProfileSaving]  = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Sync if user data loads after mount
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName   ?? "");
    setEmail(user.email         ?? "");
    setPhone(maskPhone(user.phone ?? ""));
    setAddress(user.address     ?? "");
    setDayOff(user.dayOff       ?? []);
    setErrors({});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function bind(k: string, setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setErrors(p => (p[k] ? { ...p, [k]: null } : p));
    };
  }

  function handleBlur(k: string, value: string) {
    const fn = ACCOUNT_VALIDATORS[k];
    if (!fn) return;
    setErrors(p => ({ ...p, [k]: fn(value) }));
  }

  async function saveProfile() {
    const errs = validateAccount({ firstName, lastName, email, phone });
    if (Object.keys(errs).length > 0) {
      setErrors(p => ({ ...p, ...errs }));
      showToast(false, `Please fix ${Object.keys(errs).length} validation error(s)`);
      return;
    }
    setProfileSaving(true);
    try {
      await apiUpdateProfile({ firstName, lastName, email, phone, address });
      await refresh();
      showToast(true, "Profile saved successfully");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Save failed. Please try again.";
      showToast(false, msg);
    } finally {
      setProfileSaving(false);
    }
  }

  function resetProfile() {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName   ?? "");
    setEmail(user?.email         ?? "");
    setPhone(maskPhone(user?.phone ?? ""));
    setAddress(user?.address     ?? "");
    setErrors({});
  }

  async function saveSchedule() {
    setScheduleSaving(true);
    try {
      await apiUpdateProfile({ dayOff });
      await refresh();
      showToast(true, "Schedule saved successfully");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Save failed. Please try again.";
      showToast(false, msg);
    } finally {
      setScheduleSaving(false);
    }
  }

  const initials = initialsOf(user?.firstName, user?.lastName, user?.email);
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "—";

  const navItems = [
    { id: "ac-profile",  label: "Profile",  icon: User2    },
    // { id: "ac-schedule", label: "Schedule", icon: Calendar },
    // { id: "ac-roles",    label: "Roles",    icon: Shield   },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* User identity strip */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
        <div className="w-12 h-12 rounded-full bg-primary/15 border-2 border-primary/25 flex items-center justify-center flex-shrink-0">
          <span className="text-base font-bold text-primary">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{displayName}</p>
            {(user?.roles ?? []).filter(r => r in ROLE_MAP).map(r => (
              <span key={r} className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                style={{ color: ROLE_MAP[r].color, backgroundColor: `${ROLE_MAP[r].color}15`, borderColor: `${ROLE_MAP[r].color}40` }}>
                {ROLE_MAP[r].label.toUpperCase()}
              </span>
            ))}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
            {user?.email ?? "—"}{user?.company?.name ? ` · ${user.company.name}` : ""}
          </p>
        </div>
        {user?.company?.name && (
          <div className="text-center flex-shrink-0 pr-1">
            <p className="text-xs font-semibold text-foreground font-mono">{user.company.name}</p>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Company</p>
          </div>
        )}
      </div>

      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono ${toast.ok ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400" : "bg-red-500/10 border border-red-500/25 text-red-400"}`}>
          <CheckCircle size={13} />{toast.msg}
        </div>
      )}

      {/* <SettingsNav items={navItems} /> */}

      {/* Profile */}
      <SettingsCard id="ac-profile" icon={User2} title="Profile" description="Your public identity and primary contact information">
        <TwoColRow label="Profile Photo" description="Shown in the app header and on your driver record">
          <AvatarUpload initials={initials} />
        </TwoColRow>
        <TwoColRow label="Personal Info" description="Your display name and primary contact details">
          <FieldRow>
            <Field label="First Name" value={firstName} onChange={bind("firstName", setFirstName)} onBlur={() => handleBlur("firstName", firstName)} error={errors.firstName} />
            <Field label="Last Name"  value={lastName}  onChange={bind("lastName", setLastName)}   onBlur={() => handleBlur("lastName", lastName)}   error={errors.lastName} />
          </FieldRow>
          <FieldRow>
            <Field label="Email" value={email} type="email" onChange={bind("email", setEmail)} onBlur={() => handleBlur("email", email)} error={errors.email} hint="A verification link will be sent on change" />
            <Field label="Phone" value={phone} type="tel"   onChange={v => bind("phone", setPhone)(maskPhone(v))} onBlur={() => handleBlur("phone", phone)} error={errors.phone} />
          </FieldRow>
        </TwoColRow>
        {/* <TwoColRow label="Location" description="Home or base address used for scheduling" last>
          <Field label="Address" value={address} onChange={setAddress} />
        </TwoColRow> */}
        <div className="py-4 flex justify-end border-t border-border">
          <SaveBar onSave={saveProfile} onReset={resetProfile} saving={profileSaving} />
        </div>
      </SettingsCard>

      {/* Schedule */}
      {/* <SettingsCard id="ac-schedule" icon={Calendar} title="Schedule" description="Your regular availability and days off">
        <TwoColRow label="Days Off" description="Days you're regularly unavailable — dispatchers will see this when scheduling" last>
          <DayOffGrid value={dayOff} onChange={setDayOff} />
        </TwoColRow>
        <div className="py-4 flex justify-end border-t border-border">
          <SaveBar onSave={saveSchedule} onReset={() => setDayOff(user?.dayOff ?? [])} saving={scheduleSaving} />
        </div>
      </SettingsCard> */}

      {/* Roles — read-only; roles are managed by administrators */}
      {/* <SettingsCard id="ac-roles" icon={Shield} title="Roles & Permissions" description="Roles determine what you can view and do across the platform">
        <TwoColRow label="Assigned Roles" description="Contact an administrator to change your role assignments" last>
          <RolesDisplay roles={user?.roles ?? []} />
        </TwoColRow>
      </SettingsCard> */}
    </div>
  );
}
