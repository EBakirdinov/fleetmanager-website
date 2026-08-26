import { useState, type ReactNode } from "react";
import {
  Building2, User2, CheckCircle, AlertCircle,
  Lock, Save, ToggleLeft, ToggleRight, BadgeCheck,
} from "lucide-react";
import { Btn, RightPanelSection } from "../lib/ui";

// ─── Form primitives ──────────────────────────────────────────────────────

function Field({ label, value, type = "text", hint, readOnly, mono, onChange }: {
  label: string;
  value: string;
  type?: string;
  hint?: string;
  readOnly?: boolean;
  mono?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">{label}</label>
      <input
        type={type}
        defaultValue={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`bg-input-background text-foreground border border-border rounded px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors ${mono ? "font-mono" : ""} ${readOnly ? "opacity-50 cursor-not-allowed select-all" : ""}`}
      />
      {hint && <p className="text-xs font-mono text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function SettingsSection({ title, description, children }: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-xs font-mono text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function StatusToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-mono transition-colors ${active ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-border text-muted-foreground hover:border-white/20"}`}
    >
      {active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
      {active ? "Active" : "Inactive"}
    </button>
  );
}

function SaveBar({ onSave, onReset }: { onSave: () => void; onReset: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <Btn variant="outline" onClick={onReset}>Reset</Btn>
      <Btn variant="primary" onClick={onSave}>
        <Save size={11} className="inline mr-1.5" />Save Changes
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
    </div>
  );
}

function DayOffGrid() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [off, setOff] = useState<Record<string, boolean>>({
    Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: true, Sun: true,
  });
  return (
    <div>
      <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase block mb-2">Days Off</label>
      <div className="flex gap-2">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setOff((prev) => ({ ...prev, [d]: !prev[d] }))}
            className={`flex-1 py-2 rounded text-xs font-mono font-semibold transition-colors border ${off[d] ? "bg-red-500/15 border-red-500/40 text-red-400" : "bg-muted border-border text-muted-foreground hover:border-white/20"}`}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="text-xs font-mono text-muted-foreground mt-2">
        {Object.entries(off).filter(([, v]) => v).map(([k]) => k).join(", ") || "No days off set"}
      </p>
    </div>
  );
}

const ROLE_DEFS = [
  { id: "owner",      label: "Owner",       desc: "Full access — billing, team, all settings", color: "#f59e0b" },
  { id: "admin",      label: "Admin",       desc: "Manage fleet, drivers, trucks and reports", color: "#0ea5e9" },
  { id: "dispatcher", label: "Dispatcher",  desc: "Create and manage jobs and dispatches",     color: "#10b981" },
  { id: "driver",     label: "Driver",      desc: "Limited to own assignments and schedule",   color: "#8b5cf6" },
  { id: "mechanic",   label: "Mechanic",    desc: "View and update maintenance records",       color: "#6b7e96" },
  { id: "accountant", label: "Accountant",  desc: "Access to financial and fuel reports",      color: "#ef4444" },
];

function RoleSelector({ userRoles }: { userRoles: string[] }) {
  const [roles, setRoles] = useState<string[]>(userRoles);
  const toggle = (id: string) =>
    setRoles((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  return (
    <div>
      <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase block mb-3">Assigned Roles</label>
      <div className="grid grid-cols-2 gap-2">
        {ROLE_DEFS.map((r) => {
          const active = roles.includes(r.id);
          return (
            <button
              key={r.id}
              onClick={() => toggle(r.id)}
              className={`flex items-start gap-3 p-3 rounded border text-left transition-all ${active ? "border-opacity-60 bg-opacity-10" : "border-border bg-muted/30 hover:border-white/20"}`}
              style={active ? { borderColor: `${r.color}60`, backgroundColor: `${r.color}10` } : {}}
            >
              <div
                className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                style={active ? { borderColor: r.color, backgroundColor: r.color } : { borderColor: "rgba(255,255,255,0.15)" }}
              >
                {active && <CheckCircle size={12} className="text-white" />}
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{r.label}</p>
                <p className="text-xs font-mono text-muted-foreground mt-0.5 leading-snug">{r.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {roles.map((r) => {
          const def = ROLE_DEFS.find((d) => d.id === r);
          return def ? (
            <span
              key={r}
              className="text-xs font-mono px-2 py-0.5 rounded border"
              style={{ borderColor: `${def.color}50`, color: def.color, backgroundColor: `${def.color}15` }}
            >
              {def.label}
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}

const PLANS = [
  { id: "starter",      label: "Starter",      price: "$49",  trucks: 5,   users: 3,   features: ["Basic tracking", "Email support", "Standard reports"] },
  { id: "professional", label: "Professional", price: "$149", trucks: 25,  users: 10,  features: ["Live GPS tracking", "Priority support", "Advanced analytics", "IFTA reporting"] },
  { id: "enterprise",   label: "Enterprise",   price: "$399", trucks: 999, users: 999, features: ["Unlimited trucks", "Dedicated support", "Custom integrations", "API access", "White-label"] },
];

function PlanCard({ plan, current, onSelect }: { plan: typeof PLANS[0]; current: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex-1 rounded-md border p-4 text-left transition-all ${current ? "border-primary/60 bg-primary/5" : "border-border hover:border-white/20"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">{plan.label}</span>
        {current && <span className="text-xs font-mono text-primary bg-primary/15 px-1.5 py-0.5 rounded border border-primary/30">CURRENT</span>}
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-2xl font-bold text-foreground">{plan.price}</span>
        <span className="text-xs font-mono text-muted-foreground">/mo</span>
      </div>
      <ul className="space-y-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle size={11} className="text-emerald-400 flex-shrink-0" />{f}
          </li>
        ))}
      </ul>
      <div className="mt-3 pt-3 border-t border-border text-xs font-mono text-muted-foreground">
        Up to {plan.trucks === 999 ? "∞" : plan.trucks} trucks · {plan.users === 999 ? "∞" : plan.users} users
      </div>
    </button>
  );
}

// ─── Right panel ──────────────────────────────────────────────────────────

function SettingsRightPanel() {
  return (
    <aside className="w-64 flex-shrink-0 border border-border rounded-md bg-card h-fit">
      <RightPanelSection title="Account">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-primary">JR</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Jamie Rodriguez</p>
            <p className="text-xs font-mono text-muted-foreground">jamie.r@midwestfleet.com</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {[["Role", "Owner"], ["Company", "Midwest Fleet Ops"], ["Member since", "Jan 15, 2024"]].map(([l, v]) => (
            <div key={l} className="flex justify-between">
              <span className="text-xs font-mono text-muted-foreground">{l}</span>
              <span className="text-xs font-mono text-foreground">{v}</span>
            </div>
          ))}
        </div>
      </RightPanelSection>
      <RightPanelSection title="Subscription">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground">Plan</span>
            <span className="text-xs font-mono text-primary font-semibold bg-primary/15 px-1.5 py-0.5 rounded border border-primary/30">PROFESSIONAL</span>
          </div>
          {[["Valid Until", "Jan 15, 2027"], ["Trucks Used", "9 / 25"], ["Users", "6 / 10"]].map(([l, v]) => (
            <div key={l} className="flex justify-between">
              <span className="text-xs font-mono text-muted-foreground">{l}</span>
              <span className="text-xs font-mono text-foreground">{v}</span>
            </div>
          ))}
          <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1">
            <div className="h-full bg-primary rounded-full" style={{ width: "36%" }} />
          </div>
          <p className="text-xs font-mono text-muted-foreground">9 of 25 trucks used (36%)</p>
        </div>
      </RightPanelSection>
    </aside>
  );
}

// ─── Main Settings screen ─────────────────────────────────────────────────

type SettingsTab =
  | "company-general" | "company-contact" | "company-subscription" | "company-branding"
  | "user-profile"    | "user-security"   | "user-schedule"        | "user-roles";

export default function Settings() {
  const [tab, setTab] = useState<SettingsTab>("company-general");
  const [companyActive, setCompanyActive] = useState(true);
  const [currentPlan, setCurrentPlan] = useState("professional");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const tabGroups = [
    {
      label: "Company Settings",
      icon: Building2,
      role: "Owner only",
      tabs: [
        { id: "company-general"      as SettingsTab, label: "General"      },
        { id: "company-contact"      as SettingsTab, label: "Contact"      },
        { id: "company-subscription" as SettingsTab, label: "Subscription" },
        { id: "company-branding"     as SettingsTab, label: "Branding"     },
      ],
    },
    {
      label: "My Profile",
      icon: User2,
      role: null,
      tabs: [
        { id: "user-profile"  as SettingsTab, label: "Profile"  },
        { id: "user-security" as SettingsTab, label: "Security" },
        { id: "user-schedule" as SettingsTab, label: "Schedule" },
        { id: "user-roles"    as SettingsTab, label: "Roles"    },
      ],
    },
  ];

  return (
    <div className="flex gap-5 min-h-full">
      <div className="w-48 flex-shrink-0">
        <div className="space-y-5">
          {tabGroups.map((g) => (
            <div key={g.label}>
              <div className="flex items-center gap-1.5 mb-2 px-2">
                <g.icon size={12} className="text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground tracking-wider uppercase">{g.label}</span>
              </div>
              {g.role && (
                <div className="flex items-center gap-1 px-2 mb-2">
                  <BadgeCheck size={10} className="text-amber-400" />
                  <span className="text-xs font-mono text-amber-400">{g.role}</span>
                </div>
              )}
              <div className="space-y-0.5">
                {g.tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${tab === t.id ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-4">
        {saved && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-md text-xs font-mono text-emerald-400">
            <CheckCircle size={13} />Changes saved successfully
          </div>
        )}

        {tab === "company-general" && (
          <>
            <SettingsSection title="Company Information" description="Basic details shown on invoices and documents">
              <Field label="Company Name" value="Midwest Fleet Operations LLC" />
              <Field label="Website URL" value="https://midwestfleet.com" type="url" />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">Account Status</label>
                <div className="flex items-center gap-3">
                  <StatusToggle active={companyActive} onToggle={() => setCompanyActive((p) => !p)} />
                  <span className="text-xs font-mono text-muted-foreground">{companyActive ? "Company is active and operational" : "Company is deactivated"}</span>
                </div>
              </div>
            </SettingsSection>
            <SaveBar onSave={handleSave} onReset={() => {}} />
          </>
        )}

        {tab === "company-contact" && (
          <>
            <SettingsSection title="Contact Information" description="Primary contact details for this company">
              <FieldRow>
                <Field label="Email" value="ops@midwestfleet.com" type="email" />
                <Field label="Phone" value="+1 (312) 555-0100" type="tel" />
              </FieldRow>
            </SettingsSection>
            <SettingsSection title="Address" description="Physical or registered business address">
              <Field label="Address Line 1" value="1240 Industrial Pkwy" />
              <Field label="Address Line 2" value="Suite 400" hint="Apartment, suite, unit, building, floor, etc." />
              <div className="grid grid-cols-3 gap-4">
                <Field label="City" value="Chicago" />
                <Field label="State" value="IL" />
                <Field label="ZIP Code" value="60601" mono />
              </div>
            </SettingsSection>
            <SaveBar onSave={handleSave} onReset={() => {}} />
          </>
        )}

        {tab === "company-subscription" && (
          <>
            <SettingsSection title="Choose a Plan" description="Select the plan that fits your fleet size">
              <div className="flex gap-3">
                {PLANS.map((p) => (
                  <PlanCard key={p.id} plan={p} current={currentPlan === p.id} onSelect={() => setCurrentPlan(p.id)} />
                ))}
              </div>
            </SettingsSection>
            <SettingsSection title="Billing" description="Renewal and payment details">
              <FieldRow>
                <Field label="Current Plan" value="Professional" readOnly />
                <Field label="Renews On" value="January 15, 2027" readOnly />
              </FieldRow>
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/25 flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-400">Auto-renewal enabled</p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">Your plan will renew on Jan 15, 2027. To cancel, contact support 30 days before.</p>
                </div>
              </div>
            </SettingsSection>
          </>
        )}

        {tab === "company-branding" && (
          <>
            <SettingsSection title="Company Logo" description="Displayed in the app header and on exported documents">
              <AvatarUpload initials="MF" />
            </SettingsSection>
            <SettingsSection title="Regional Settings" description="Localization and display preferences">
              <FieldRow>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">Timezone</label>
                  <select className="bg-input-background text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none">
                    <option>America/Chicago (CST)</option>
                    <option>America/New_York (EST)</option>
                    <option>America/Denver (MST)</option>
                    <option>America/Los_Angeles (PST)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">Currency</label>
                  <select className="bg-input-background text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none">
                    <option>USD — US Dollar</option>
                    <option>CAD — Canadian Dollar</option>
                    <option>EUR — Euro</option>
                  </select>
                </div>
              </FieldRow>
              <FieldRow>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">Distance Unit</label>
                  <select className="bg-input-background text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none">
                    <option>Miles</option>
                    <option>Kilometers</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">Week Starts On</label>
                  <select className="bg-input-background text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none">
                    <option>Monday</option>
                    <option>Sunday</option>
                  </select>
                </div>
              </FieldRow>
            </SettingsSection>
            <SaveBar onSave={handleSave} onReset={() => {}} />
          </>
        )}

        {tab === "user-profile" && (
          <>
            <SettingsSection title="Profile Photo" description="Shown in the app header and on driver records">
              <AvatarUpload initials="JR" />
            </SettingsSection>
            <SettingsSection title="Personal Information" description="Your name and contact details">
              <FieldRow>
                <Field label="First Name" value="Jamie" />
                <Field label="Last Name" value="Rodriguez" />
              </FieldRow>
              <FieldRow>
                <Field label="Email" value="jamie.r@midwestfleet.com" type="email" hint="Changing your email sends a verification link" />
                <Field label="Phone" value="+1 (312) 555-0199" type="tel" />
              </FieldRow>
              <Field label="Address" value="842 W Monroe St, Chicago, IL 60661" />
            </SettingsSection>
            <SaveBar onSave={handleSave} onReset={() => {}} />
          </>
        )}

        {tab === "user-security" && (
          <>
            <SettingsSection title="Change Password" description="Choose a strong password you don't use elsewhere">
              <Field label="Current Password" value="" type="password" hint="Required to confirm your identity" />
              <FieldRow>
                <Field label="New Password" value="" type="password" hint="Minimum 10 characters" />
                <Field label="Confirm New Password" value="" type="password" />
              </FieldRow>
              <Btn variant="primary" onClick={handleSave}>
                <Lock size={11} className="inline mr-1.5" />Update Password
              </Btn>
            </SettingsSection>
            <SettingsSection title="Active Sessions" description="Devices currently signed in to your account">
              <div className="space-y-2">
                {[
                  { device: "Chrome on macOS",         location: "Chicago, IL",       time: "Now (current session)", current: true  },
                  { device: "Fleet Pro Mobile · iOS",  location: "Chicago, IL",       time: "2 hours ago",           current: false },
                  { device: "Chrome on Windows",       location: "Indianapolis, IN",  time: "3 days ago",            current: false },
                ].map((s) => (
                  <div key={s.device} className="flex items-center justify-between p-3 rounded border border-border bg-muted/20">
                    <div>
                      <p className="text-xs font-medium text-foreground">{s.device}</p>
                      <p className="text-xs font-mono text-muted-foreground">{s.location} · {s.time}</p>
                    </div>
                    {s.current && (
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">Current</span>
                    )}
                  </div>
                ))}
              </div>
            </SettingsSection>
          </>
        )}

        {tab === "user-schedule" && (
          <>
            <SettingsSection title="Days Off" description="Select the days you're regularly unavailable for dispatch">
              <DayOffGrid />
            </SettingsSection>
            <SaveBar onSave={handleSave} onReset={() => {}} />
          </>
        )}

        {tab === "user-roles" && (
          <>
            <SettingsSection title="Roles & Permissions" description="Roles control what this user can see and do across the platform">
              <RoleSelector userRoles={["owner", "admin"]} />
            </SettingsSection>
            <SaveBar onSave={handleSave} onReset={() => {}} />
          </>
        )}
      </div>

      <SettingsRightPanel />
    </div>
  );
}
