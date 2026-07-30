import { useState, useEffect, type ReactNode } from "react";
import { Navigate } from "react-router";
import { Building2, Phone, CreditCard, CheckCircle, Save } from "lucide-react";
import { Btn } from "../lib/ui";
import { useAuth } from "../lib/auth";
import { apiUpdateCompany, ApiError } from "../lib/api";
import { useRefData, type StateOption } from "../lib/data";
import {
  validateRequired, validateEmail, validatePhone, validateUrl, validateZip,
} from "../lib/validators";
import { maskPhone, maskZip } from "../lib/masks";

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

function StateSelect({ value, onChange, states }: { value: string; onChange: (v: string) => void; states: StateOption[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">State</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-input-background text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-colors appearance-none"
      >
        <option value="">— Select —</option>
        {states.map(s => (
          <option key={s.value} value={s.value}>{s.value} — {s.label}</option>
        ))}
      </select>
    </div>
  );
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

// ─── Validation ──────────────────────────────────────────────────────────────

const COMPANY_VALIDATORS: Record<string, (v: string) => string | null> = {
  name:  validateRequired,
  url:   validateUrl,
  email: validateEmail,
  phone: validatePhone,
  zip:   validateZip,
};

function validateFields(values: Record<string, string>, keys: string[]): Record<string, string | null> {
  const errs: Record<string, string | null> = {};
  for (const k of keys) {
    const fn = COMPANY_VALIDATORS[k];
    if (fn) {
      const e = fn(values[k] ?? "");
      if (e) errs[k] = e;
    }
  }
  return errs;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Company() {
  const { user, refresh } = useAuth();
  const co = user?.company;
  const { data: refData } = useRefData();

  // General fields
  const [name, setName] = useState(co?.name ?? "");
  const [url,  setUrl]  = useState(co?.url  ?? "");

  // Contact fields
  const [email,    setEmail]    = useState(co?.email    ?? "");
  const [phone,    setPhone]    = useState(maskPhone(co?.phone ?? ""));
  const [address,  setAddress]  = useState(co?.address  ?? "");
  const [address2, setAddress2] = useState(co?.address2 ?? "");
  const [city,     setCity]     = useState(co?.city     ?? "");
  const [compState, setCompState] = useState(co?.state  ?? "");
  const [zip,      setZip]      = useState(maskZip(co?.zip ?? ""));

  const [generalSaving, setGeneralSaving] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Sync when company data loads
  useEffect(() => {
    if (!co) return;
    setName(co.name     ?? "");
    setUrl(co.url       ?? "");
    setEmail(co.email   ?? "");
    setPhone(maskPhone(co.phone ?? ""));
    setAddress(co.address  ?? "");
    setAddress2(co.address2 ?? "");
    setCity(co.city     ?? "");
    setCompState(co.state ?? "");
    setZip(maskZip(co.zip ?? ""));
    setErrors({});
  }, [co?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Owner guard — placed after all hooks
  if (user && !user.roles?.includes("ROLE_OWNER")) {
    return <Navigate to="/account" replace />;
  }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  // Wrap a setter so editing a field clears its stale error.
  function bind(k: string, setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setErrors(p => (p[k] ? { ...p, [k]: null } : p));
    };
  }

  function handleBlur(k: string, value: string) {
    const fn = COMPANY_VALIDATORS[k];
    if (!fn) return;
    setErrors(p => ({ ...p, [k]: fn(value) }));
  }

  async function saveGeneral() {
    if (!co?.id) return;
    const errs = validateFields({ name, url }, ["name", "url"]);
    if (Object.keys(errs).length > 0) {
      setErrors(p => ({ ...p, ...errs }));
      showToast(false, `Please fix ${Object.keys(errs).length} validation error(s)`);
      return;
    }
    setGeneralSaving(true);
    try {
      await apiUpdateCompany(co.id, { name, url });
      await refresh();
      showToast(true, "General settings saved");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Save failed. Please try again.");
    } finally {
      setGeneralSaving(false);
    }
  }

  function resetGeneral() {
    setName(co?.name ?? "");
    setUrl(co?.url   ?? "");
    setErrors(p => ({ ...p, name: null, url: null }));
  }

  async function saveContact() {
    if (!co?.id) return;
    const errs = validateFields({ email, phone, zip }, ["email", "phone", "zip"]);
    if (Object.keys(errs).length > 0) {
      setErrors(p => ({ ...p, ...errs }));
      showToast(false, `Please fix ${Object.keys(errs).length} validation error(s)`);
      return;
    }
    setContactSaving(true);
    try {
      await apiUpdateCompany(co.id, {
        email, phone, address, address2, city, state: compState, zip,
      });
      await refresh();
      showToast(true, "Contact information saved");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Save failed. Please try again.");
    } finally {
      setContactSaving(false);
    }
  }

  function resetContact() {
    setEmail(co?.email    ?? "");
    setPhone(maskPhone(co?.phone ?? ""));
    setAddress(co?.address  ?? "");
    setAddress2(co?.address2 ?? "");
    setCity(co?.city     ?? "");
    setCompState(co?.state ?? "");
    setZip(maskZip(co?.zip ?? ""));
    setErrors(p => ({ ...p, email: null, phone: null, zip: null }));
  }

  const initials = (co?.name ?? "")
    .split(/\s+/)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CO";

  const navItems = [
    { id: "cs-general", label: "General", icon: Building2  },
    { id: "cs-contact", label: "Contact", icon: Phone      },
    ...(co?.plan ? [{ id: "cs-plan", label: "Plan", icon: CreditCard }] : []),
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Company identity strip */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <span className="text-base font-bold text-primary">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{co?.name ?? "—"}</p>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
            {[co?.url, [co?.city, co?.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "No details added yet"}
          </p>
        </div>
        {co?.plan && (
          <div className="text-center flex-shrink-0 pr-1">
            <p className="text-xs font-semibold text-foreground font-mono capitalize">{co.plan}</p>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Plan</p>
          </div>
        )}
      </div>

      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono ${toast.ok ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400" : "bg-red-500/10 border border-red-500/25 text-red-400"}`}>
          <CheckCircle size={13} />{toast.msg}
        </div>
      )}

      <SettingsNav items={navItems} />

      {/* General */}
      <SettingsCard id="cs-general" icon={Building2} title="General" description="Company name and website">
        <TwoColRow label="Company Info" description="Used on invoices, documents, and the app header" last>
          <Field label="Name" value={name} onChange={bind("name", setName)} onBlur={() => handleBlur("name", name)} error={errors.name} />
          <Field label="Website" value={url} type="url" onChange={bind("url", setUrl)} onBlur={() => handleBlur("url", url)} error={errors.url} />
        </TwoColRow>
        <div className="py-4 flex justify-end border-t border-border">
          <SaveBar onSave={saveGeneral} onReset={resetGeneral} saving={generalSaving} />
        </div>
      </SettingsCard>

      {/* Contact */}
      <SettingsCard id="cs-contact" icon={Phone} title="Contact" description="Primary email, phone and registered business address">
        <TwoColRow label="Contact Details" description="Primary email and phone for account notifications">
          <FieldRow>
            <Field label="Email" value={email} type="email" onChange={bind("email", setEmail)} onBlur={() => handleBlur("email", email)} error={errors.email} />
            <Field label="Phone" value={phone} type="tel"   onChange={v => bind("phone", setPhone)(maskPhone(v))} onBlur={() => handleBlur("phone", phone)} error={errors.phone} />
          </FieldRow>
        </TwoColRow>
        <TwoColRow label="Business Address" description="Physical or registered address used on documents" last>
          <Field label="Address Line 1" value={address}   onChange={setAddress}   />
          <Field label="Address Line 2" value={address2}  onChange={setAddress2}  hint="Apartment, suite, unit, building, floor, etc." />
          <div className="grid grid-cols-3 gap-3">
            <Field label="City" value={city} onChange={setCity} />
            <StateSelect value={compState} onChange={setCompState} states={refData?.states ?? []} />
            <Field label="ZIP" value={zip} onChange={v => bind("zip", setZip)(maskZip(v))} onBlur={() => handleBlur("zip", zip)} error={errors.zip} mono />
          </div>
        </TwoColRow>
        <div className="py-4 flex justify-end border-t border-border">
          <SaveBar onSave={saveContact} onReset={resetContact} saving={contactSaving} />
        </div>
      </SettingsCard>

      {/* Plan — read-only */}
      {co?.plan && (
        <SettingsCard id="cs-plan" icon={CreditCard} title="Subscription" description="Current plan and billing information">
          <TwoColRow label="Plan Details" description="Contact support to change your subscription" last>
            <div className="flex gap-3">
              <div className="flex-1 p-3 rounded-lg border border-border bg-muted/30">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Current Plan</p>
                <p className="text-sm font-semibold text-foreground capitalize">{co.plan}</p>
              </div>
              {co.validUntil && (
                <div className="flex-1 p-3 rounded-lg border border-border bg-muted/30">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Valid Until</p>
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(co.validUntil).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          </TwoColRow>
        </SettingsCard>
      )}
    </div>
  );
}
