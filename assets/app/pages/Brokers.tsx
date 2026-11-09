import { useCallback, useEffect, useMemo, useState } from "react";
import { Handshake, Ban, CircleDollarSign, Package, Plus, Trash2, Pencil, Star } from "lucide-react";
import {
  KpiCard, StatusPill, Btn, ActionsMenu, SlideDrawer, Switch,
  DrawerSection, DrawerField, DrawerSelect, DrawerTextarea, DrawerFieldRow,
} from "../lib/ui";
import {
  apiListBrokers, apiBrokerSummary, apiBrokerRecentLoads,
  apiCreateBroker, apiUpdateBroker, apiDeleteBroker,
  apiBrokerLanes,
  ApiError, type BrokerItem, type BrokerSummaryRow, type RecentBookedLoad, type LaneRollup,
} from "../lib/api";
import PreferredBrokerCards from "../components/brokers/PreferredBrokerCards";
import AddPreferredBrokerModal from "../components/brokers/AddPreferredBrokerModal";
import RecentLoadsBooked from "../components/brokers/RecentLoadsBooked";
import BrokerPerformance from "../components/brokers/BrokerPerformance";
import TopLanesByBroker from "../components/brokers/TopLanesByBroker";
import { useRefData } from "../lib/data";
import { useAuth } from "../lib/auth";
import { can } from "../lib/permissions";
import { money, num } from "../lib/expenses";
import {
  validateEmail, validatePhone, validateZip, validateRequired, formatDate,
} from "../lib/validators";

/**
 * The broker / customer directory.
 *
 * List plus SlideDrawer, the Trucks pattern — not the Expenses pattern. A
 * carrier deals with tens of brokers, so the set is fetched once and filtered
 * in the browser. Performance comes from a second call, `broker/summary`,
 * which rolls up every broker's loads in one query rather than one request
 * per row.
 */

/**
 * Which slice of the directory is on screen. One state, not a pair of
 * booleans: the tab strip and the KPI cards drive the same filter, and two
 * controls owning one concept is how they end up disagreeing.
 */
type Tab = "all" | "preferred" | "blocked";

const TYPE_LABELS: Record<string, string> = {
  broker:  "Broker",
  shipper: "Direct Shipper",
  "3pl":   "3PL",
};

function typeLabel(type?: string | null): string {
  return type ? (TYPE_LABELS[type] ?? type) : "—";
}

/** "Net 30 · QP 3%", or a dash when nothing is on file. */
function termsLabel(b: BrokerItem): string {
  const parts: string[] = [];
  if (b.payment_terms_days) parts.push(`Net ${b.payment_terms_days}`);
  if (b.quick_pay_available) {
    const fee = b.quick_pay_fee_percent ? Number(b.quick_pay_fee_percent) : 0;
    parts.push(fee > 0 ? `QP ${fee}%` : "QP");
  }
  return parts.length ? parts.join(" · ") : "—";
}

// ─── Form ─────────────────────────────────────────────────────────────────
// Every field is a string, as on every other drawer form here: an input's
// value is a string, and coercion happens once in handleSave().

interface BrokerForm {
  type: string;
  name: string;
  dba: string;
  mcNumber: string;
  dotNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  contactName: string;
  phone: string;
  email: string;
  billToName: string;
  billToAddress: string;
  billingEmail: string;
  paymentTermsDays: string;
  quickPayAvailable: boolean;
  quickPayFeePercent: string;
  creditLimit: string;
  daysToPay: string;
  carrierPacketSignedOn: string;
  insuranceCertOnFile: boolean;
  isPreferred: boolean;
  doNotLoad: boolean;
  doNotLoadReason: string;
  notes: string;
}

function emptyForm(): BrokerForm {
  return {
    type: "broker", name: "", dba: "", mcNumber: "", dotNumber: "",
    address: "", city: "", state: "", zip: "",
    contactName: "", phone: "", email: "",
    billToName: "", billToAddress: "", billingEmail: "",
    paymentTermsDays: "", quickPayAvailable: false, quickPayFeePercent: "",
    creditLimit: "", daysToPay: "", carrierPacketSignedOn: "",
    insuranceCertOnFile: false, isPreferred: false,
    doNotLoad: false, doNotLoadReason: "", notes: "",
  };
}

/**
 * The gated credit fields come back **absent**, not null, for a caller without
 * brokers.view_credit — so they land here as "" and the drawer never shows
 * them. handleSave() leaves those keys out of the payload for the same
 * caller, which is what stops an edit from blanking a figure it could not see.
 */
function formFromItem(b: BrokerItem): BrokerForm {
  return {
    type:                  b.type ?? "broker",
    name:                  b.name ?? "",
    dba:                   b.dba ?? "",
    mcNumber:              b.mc_number ?? "",
    dotNumber:             b.dot_number ?? "",
    address:               b.address ?? "",
    city:                  b.city ?? "",
    state:                 b.state ?? "",
    zip:                   b.zip ?? "",
    contactName:           b.contact_name ?? "",
    phone:                 b.phone ?? "",
    email:                 b.email ?? "",
    billToName:            b.bill_to_name ?? "",
    billToAddress:         b.bill_to_address ?? "",
    billingEmail:          b.billing_email ?? "",
    paymentTermsDays:      b.payment_terms_days?.toString() ?? "",
    quickPayAvailable:     b.quick_pay_available ?? false,
    quickPayFeePercent:    b.quick_pay_fee_percent ?? "",
    creditLimit:           b.credit_limit ?? "",
    daysToPay:             b.days_to_pay?.toString() ?? "",
    carrierPacketSignedOn: b.carrier_packet_signed_on ?? "",
    insuranceCertOnFile:   b.insurance_cert_on_file ?? false,
    isPreferred:           b.is_preferred ?? false,
    doNotLoad:             b.do_not_load ?? false,
    doNotLoadReason:       b.do_not_load_reason ?? "",
    notes:                 b.notes ?? "",
  };
}

const VALIDATORS: Partial<Record<keyof BrokerForm, (v: string) => string | null>> = {
  name:         validateRequired,
  phone:        validatePhone,
  email:        validateEmail,
  billingEmail: validateEmail,
  zip:          validateZip,
};

function validateAll(form: BrokerForm): Partial<Record<keyof BrokerForm, string>> {
  const errs: Partial<Record<keyof BrokerForm, string>> = {};
  for (const [field, validate] of Object.entries(VALIDATORS)) {
    const key = field as keyof BrokerForm;
    const msg = validate?.(String(form[key] ?? ""));
    if (msg) errs[key] = msg;
  }
  return errs;
}

function BrokerFormFields({ form, set, errors, types, canSeeCredit }: {
  form: BrokerForm;
  set: <K extends keyof BrokerForm>(key: K, value: BrokerForm[K]) => void;
  errors: Partial<Record<keyof BrokerForm, string>>;
  types: string[];
  canSeeCredit: boolean;
}) {
  return (
    <>
      <DrawerSection title="Identity">
        <DrawerFieldRow cols={2}>
          <DrawerField label="Legal Name" value={form.name} required error={errors.name}
                       onChange={v => set("name", v)} />
          <DrawerField label="DBA" value={form.dba} hint="If they trade under a different name"
                       onChange={v => set("dba", v)} />
        </DrawerFieldRow>
        <DrawerFieldRow cols={3}>
          <DrawerSelect label="Type" value={form.type} onChange={v => set("type", v)}>
            {types.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </DrawerSelect>
          <DrawerField label="MC Number" value={form.mcNumber} mono
                       hint="One broker per MC — a duplicate is rejected"
                       onChange={v => set("mcNumber", v)} />
          <DrawerField label="DOT Number" value={form.dotNumber} mono
                       onChange={v => set("dotNumber", v)} />
        </DrawerFieldRow>
      </DrawerSection>

      <DrawerSection title="Address">
        <DrawerFieldRow cols={1}>
          <DrawerField label="Street" value={form.address} onChange={v => set("address", v)} />
        </DrawerFieldRow>
        <DrawerFieldRow cols={3}>
          <DrawerField label="City" value={form.city} onChange={v => set("city", v)} />
          <DrawerField label="State" value={form.state} maxLength={2}
                       onChange={v => set("state", v.toUpperCase())} />
          <DrawerField label="ZIP" value={form.zip} error={errors.zip}
                       onChange={v => set("zip", v)} />
        </DrawerFieldRow>
      </DrawerSection>

      <DrawerSection title="Contact">
        <DrawerFieldRow cols={3}>
          <DrawerField label="Contact Name" value={form.contactName}
                       hint="Who you call about a load"
                       onChange={v => set("contactName", v)} />
          <DrawerField label="Phone" value={form.phone} error={errors.phone}
                       onChange={v => set("phone", v)} />
          <DrawerField label="Email" value={form.email} error={errors.email}
                       onChange={v => set("email", v)} />
        </DrawerFieldRow>
      </DrawerSection>

      <DrawerSection title="Billing & Payment">
        <DrawerFieldRow cols={2}>
          <DrawerField label="Bill To" value={form.billToName}
                       hint="Leave blank to bill the broker itself"
                       onChange={v => set("billToName", v)} />
          <DrawerField label="Billing Email" value={form.billingEmail} error={errors.billingEmail}
                       hint="Where the invoice goes"
                       onChange={v => set("billingEmail", v)} />
        </DrawerFieldRow>
        <DrawerFieldRow cols={1}>
          <DrawerTextarea label="Bill-To Address" value={form.billToAddress} rows={2}
                          onChange={v => set("billToAddress", v)} />
        </DrawerFieldRow>
        <DrawerFieldRow cols={2}>
          <DrawerField label="Payment Terms (days)" value={form.paymentTermsDays} type="number"
                       hint="Net 30, Net 45 — as agreed"
                       onChange={v => set("paymentTermsDays", v)} />
          <DrawerField label="Quick Pay Fee (%)" value={form.quickPayFeePercent} type="number"
                       readOnly={!form.quickPayAvailable}
                       onChange={v => set("quickPayFeePercent", v)} />
        </DrawerFieldRow>
        <div className="pt-1">
          <Switch checked={form.quickPayAvailable} label="Quick pay available"
                  onChange={next => set("quickPayAvailable", next)} />
          <span className="ml-2 text-xs font-mono text-muted-foreground">Quick pay available</span>
        </div>
      </DrawerSection>

      {/* Credit sits behind brokers.view_credit. Hidden rather than disabled:
          a field a caller cannot see must not be in a form they submit. */}
      {canSeeCredit && (
        <DrawerSection title="Credit">
          <DrawerFieldRow cols={2}>
            <DrawerField label="Credit Limit ($)" value={form.creditLimit} type="number"
                         onChange={v => set("creditLimit", v)} />
            <DrawerField label="Days To Pay" value={form.daysToPay} type="number"
                         hint="What they actually take, not what they promise"
                         onChange={v => set("daysToPay", v)} />
          </DrawerFieldRow>
        </DrawerSection>
      )}

      <DrawerSection title="Compliance">
        <DrawerFieldRow cols={2}>
          <DrawerField label="Carrier Packet Signed" value={form.carrierPacketSignedOn} type="date"
                       hint="Brokers re-paper about once a year"
                       onChange={v => set("carrierPacketSignedOn", v)} />
          <div className="flex items-end pb-2">
            <Switch checked={form.insuranceCertOnFile} label="Insurance certificate on file"
                    onChange={next => set("insuranceCertOnFile", next)} />
            <span className="ml-2 text-xs font-mono text-muted-foreground">Insurance cert on file</span>
          </div>
        </DrawerFieldRow>
        {/* The two poles of the same question, deliberately adjacent. They are
            independent flags, not one enum — a broker can have been preferred
            and still end up blocked over a single bad invoice. */}
        <div className="pt-1">
          <Switch checked={form.isPreferred} label="Preferred broker"
                  onChange={next => set("isPreferred", next)} />
          <span className="ml-2 text-xs font-mono text-amber-400">Preferred — call these first</span>
        </div>
        <div className="pt-1">
          <Switch checked={form.doNotLoad} label="Do not load"
                  onChange={next => set("doNotLoad", next)} />
          <span className="ml-2 text-xs font-mono text-red-400">Do not load</span>
        </div>
        {form.doNotLoad && (
          <DrawerFieldRow cols={1}>
            <DrawerField label="Reason" value={form.doNotLoadReason}
                         hint="A block nobody can explain is a block the next dispatcher lifts"
                         onChange={v => set("doNotLoadReason", v)} />
          </DrawerFieldRow>
        )}
      </DrawerSection>

      <DrawerSection title="Notes">
        <DrawerFieldRow cols={1}>
          <DrawerTextarea label="Notes" value={form.notes} rows={3}
                          onChange={v => set("notes", v)} />
        </DrawerFieldRow>
      </DrawerSection>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function Brokers() {
  const { user } = useAuth();
  const { data: ref } = useRefData();

  const canCreate    = can(user, "brokers.create");
  const canEdit      = can(user, "brokers.edit");
  const canDelete    = can(user, "brokers.delete");
  const canSeeCredit = can(user, "brokers.view_credit");

  const [items,   setItems]   = useState<BrokerItem[]>([]);
  const [summary, setSummary] = useState<Record<string, BrokerSummaryRow>>({});
  const [recent,  setRecent]  = useState<RecentBookedLoad[]>([]);
  const [lanes,   setLanes]   = useState<LaneRollup>({ lanes: [], mapped: 0, unmapped: 0 });
  const [laneBroker, setLaneBroker] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ ok: boolean; msg: string } | null>(null);

  const [typeFilter,  setTypeFilter]  = useState("");
  const [tab,         setTab]         = useState<Tab>("all");
  const [search,      setSearch]      = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add");
  const [selected,   setSelected]   = useState<BrokerItem | null>(null);
  const [form,       setForm]       = useState<BrokerForm>(emptyForm);
  const [errors,     setErrors]     = useState<Partial<Record<keyof BrokerForm, string>>>({});
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [promoting,  setPromoting]  = useState(false);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    window.setTimeout(() => setToast(null), 4000);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The rollup is best-effort: a caller who cannot read load rates still
      // gets the directory, just without the money columns.
      const [list, rollup, recentLoads] = await Promise.all([
        apiListBrokers(),
        apiBrokerSummary().catch(() => ({} as Record<string, BrokerSummaryRow>)),
        apiBrokerRecentLoads(undefined, 8).catch(() => [] as RecentBookedLoad[]),
      ]);
      setItems(list);
      setSummary(rollup);
      setRecent(recentLoads);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load brokers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Lanes reload on their own when the scope selector moves, rather than
  // refetching the whole page for one panel.
  useEffect(() => {
    let cancelled = false;
    void apiBrokerLanes(laneBroker ?? undefined, 5)
      .then(r => { if (!cancelled) setLanes(r); })
      .catch(() => { /* panel shows its empty state */ });
    return () => { cancelled = true; };
  }, [laneBroker]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(b => {
      if (typeFilter !== "" && (b.type ?? "broker") !== typeFilter) return false;
      if (tab === "blocked"   && !b.do_not_load) return false;
      if (tab === "preferred" && !b.is_preferred) return false;
      if (!q) return true;
      return [b.name, b.dba, b.mc_number, b.contact_name]
        .some(v => (v ?? "").toLowerCase().includes(q));
    });
  }, [items, typeFilter, tab, search]);

  const blockedCount   = useMemo(() => items.filter(b => b.do_not_load).length, [items]);
  const preferredCount = useMemo(() => items.filter(b => b.is_preferred).length, [items]);
  const preferred      = useMemo(() => items.filter(b => b.is_preferred), [items]);

  const totals = useMemo(() => {
    let revenue = 0, loads = 0, hasRevenue = false;
    for (const row of Object.values(summary)) {
      loads += row.loads ?? 0;
      if (row.revenue != null) { revenue += Number(row.revenue); hasRevenue = true; }
    }
    return { revenue, loads, hasRevenue };
  }, [summary]);

  // Whether the caller holds billing.view_invoices, read off the payload
  // rather than re-derived from their role: the API already decided, and the
  // A/R keys are absent rather than null when it decided no.
  const hasAr = useMemo(
    () => Object.values(summary).some(row => row.total_paid !== undefined),
    [summary],
  );

  function setField<K extends keyof BrokerForm>(key: K, value: BrokerForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function openAdd() {
    setDrawerMode("add");
    setSelected(null);
    setForm(emptyForm());
    setErrors({});
    setDrawerOpen(true);
  }

  function openEdit(b: BrokerItem) {
    setDrawerMode("edit");
    setSelected(b);
    setForm(formFromItem(b));
    setErrors({});
    setDrawerOpen(true);
  }

  async function handleSave() {
    const errs = validateAll(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast(false, `Please fix ${Object.keys(errs).length} validation error(s)`);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type:                  form.type || "broker",
        name:                  form.name,
        dba:                   form.dba                   || null,
        mcNumber:              form.mcNumber              || null,
        dotNumber:             form.dotNumber             || null,
        address:               form.address               || null,
        city:                  form.city                  || null,
        state:                 form.state                 || null,
        zip:                   form.zip                   || null,
        contactName:           form.contactName           || null,
        phone:                 form.phone                 || null,
        email:                 form.email                 || null,
        billToName:            form.billToName            || null,
        billToAddress:         form.billToAddress         || null,
        billingEmail:          form.billingEmail          || null,
        paymentTermsDays:      form.paymentTermsDays ? parseInt(form.paymentTermsDays) : null,
        quickPayAvailable:     form.quickPayAvailable,
        quickPayFeePercent:    form.quickPayAvailable && form.quickPayFeePercent
                                 ? Number(form.quickPayFeePercent) : null,
        carrierPacketSignedOn: form.carrierPacketSignedOn || null,
        insuranceCertOnFile:   form.insuranceCertOnFile,
        isPreferred:           form.isPreferred,
        doNotLoad:             form.doNotLoad,
        doNotLoadReason:       form.doNotLoad ? (form.doNotLoadReason || null) : null,
        notes:                 form.notes                 || null,
      };

      // Omitted entirely without the permission — PATCH is partial, so an
      // absent key leaves the stored figure alone. Sending null instead would
      // blank a credit limit the caller was never shown.
      if (canSeeCredit) {
        payload.creditLimit = form.creditLimit ? Number(form.creditLimit) : null;
        payload.daysToPay   = form.daysToPay   ? parseInt(form.daysToPay)  : null;
      }

      if (drawerMode === "add") {
        await apiCreateBroker(payload);
      } else if (selected) {
        await apiUpdateBroker(selected.id, payload);
      }

      await loadData();
      setDrawerOpen(false);
      showToast(true, drawerMode === "add" ? "Broker added" : "Broker updated");
    } catch (e) {
      // A 409 here is the duplicate-MC guard, and its message names the cause.
      showToast(false, e instanceof ApiError ? e.message : "Could not save the broker");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Promote a broker that is already on file. A one-key PATCH rather than the
   * drawer's whole payload: the shelf's Add Broker is a flag being set, not a
   * record being edited, and sending the rest would let a stale row from the
   * list overwrite a field someone changed in the meantime.
   */
  async function handleAddPreferred(b: BrokerItem) {
    setPromoting(true);
    try {
      await apiUpdateBroker(b.id, { isPreferred: true });
      await loadData();
      setPickerOpen(false);
      showToast(true, `${b.name ?? `#${b.id}`} added to preferred`);
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Could not add the broker to preferred");
    } finally {
      setPromoting(false);
    }
  }

  async function handleDelete(b: BrokerItem) {
    setDeleting(true);
    try {
      await apiDeleteBroker(b.id);
      await loadData();
      setDrawerOpen(false);
      showToast(true, "Broker removed");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Could not remove the broker");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <KpiCard label="Brokers" value={items.length} icon={Handshake} accent="#6b7e96"
                   active={tab === "all"} onClick={() => setTab("all")} />
          <KpiCard label="Preferred" value={preferredCount} icon={Star} accent="#f59e0b"
                   sub={items.length > 0 ? `${Math.round((preferredCount / items.length) * 100)}% of total` : undefined}
                   active={tab === "preferred"} onClick={() => setTab("preferred")} />
          <KpiCard label="Do Not Load" value={blockedCount} icon={Ban} accent="#ef4444"
                   active={tab === "blocked"} onClick={() => setTab("blocked")} />
          <KpiCard label="Loads Tendered" value={totals.loads} icon={Package} accent="#3b82f6" />
          {totals.hasRevenue && (
            <KpiCard label="Revenue" value={money(String(totals.revenue)) ?? "—"}
                     icon={CircleDollarSign} accent="#10b981" />
          )}
        </div>

        {/* Same underline strip as Expenses, Maintenance and Retention. The
            counts ride in the labels, as on Retention. */}
        <div className="flex items-center gap-1 border-b border-border">
          {([
            ["all",       `All Brokers (${items.length})`],
            ["preferred", `Preferred (${preferredCount})`],
            ["blocked",   `Blocked (${blockedCount})`],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-2 text-xs font-mono transition-colors border-b-2 -mb-px ${
                tab === key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {toast && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono ${toast.ok ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400" : "bg-red-500/10 border border-red-500/25 text-red-400"}`}>
            {toast.msg}
          </div>
        )}

        {/* Main column plus a narrow rail — the grid Retention already uses.
            `items-start` keeps the rail from stretching to the tables'
            height; `min-w-0` lets the wide tables scroll inside their own
            column instead of shoving the rail off-screen. */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
          <div className="flex flex-col gap-4 min-w-0">

        <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Brokers &amp; Customers</span>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, MC, contact…"
                className="h-7 px-2 bg-input border border-border rounded text-xs font-mono text-foreground placeholder:text-muted-foreground/60 w-56 focus:outline-none focus:border-ring"
              />
              {/* A bare select rather than FilterSelect: that one stacks a
                  caption above its control, which belongs in a filter bar
                  like the ledger's and stands a head taller than everything
                  else in a header strip. "All types" is its own caption. */}
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                aria-label="Filter by type"
                className={`h-7 px-2 bg-input border rounded text-xs font-mono focus:outline-none focus:border-ring ${typeFilter ? "border-primary/50 text-foreground" : "border-border text-muted-foreground"}`}
              >
                <option value="">All types</option>
                {(ref?.brokerTypes ?? ["broker", "shipper", "3pl"]).map(t => (
                  <option key={t} value={t}>{typeLabel(t)}</option>
                ))}
              </select>
              {canCreate && (
                <Btn variant="primary" onClick={openAdd}><Plus size={11} className="inline mr-1" />Add Broker</Btn>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs font-mono text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-xs font-mono text-red-400">{error}</p>
              <Btn variant="outline" onClick={() => void loadData()}>Retry</Btn>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Broker", "Type", "MC #", "Contact", "Terms", "Loads", "Revenue", "$/mi", "Status", ""].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => {
                    const row = summary[String(b.id)];
                    return (
                      <tr key={b.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                          onClick={() => openEdit(b)}>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-foreground">
                            {b.is_preferred && <Star size={11} className="text-amber-400 flex-shrink-0" />}
                            {b.name ?? `#${b.id}`}
                          </div>
                          {b.dba && <div className="text-xs font-mono text-muted-foreground">{b.dba}</div>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-muted-foreground">{typeLabel(b.type)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-muted-foreground">{b.mc_number ?? "—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="text-xs font-mono text-foreground">{b.phone ?? "—"}</div>
                          {b.contact_name && <div className="text-xs font-mono text-muted-foreground">{b.contact_name}</div>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-muted-foreground">{termsLabel(b)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-foreground">{row?.loads ?? 0}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-foreground">
                          {money(row?.revenue) ?? <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-foreground">
                          {row?.rate_per_mile ? `$${num(row.rate_per_mile, 2)}` : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {b.do_not_load
                            ? <StatusPill label="Do Not Load" color="#ef4444" />
                            : <StatusPill label="Active" color="#10b981" />}
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <ActionsMenu items={[
                            { label: canEdit ? "Edit" : "View", onClick: () => openEdit(b), icon: Pencil },
                            ...(canDelete ? [{
                              label: "Remove", onClick: () => void handleDelete(b),
                              icon: Trash2, variant: "danger" as const,
                            }] : []),
                          ]} />
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">No brokers found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* The shelf, below the directory it is drawn from. Hidden on the
            Blocked tab, where a list of brokers to call first would read as
            a contradiction. */}
        {tab !== "blocked" && (
          <PreferredBrokerCards
            brokers={preferred}
            onOpen={openEdit}
            onAdd={canEdit ? () => setPickerOpen(true) : undefined}
          />
        )}

        <RecentLoadsBooked loads={recent} />

          </div>

          <div className="flex flex-col gap-4 xl:sticky xl:top-4">
            <BrokerPerformance brokers={items} summary={summary} showAr={hasAr} />

            <TopLanesByBroker
              rollup={lanes}
              brokers={items}
              brokerId={laneBroker}
              onBrokerChange={setLaneBroker}
            />
          </div>
        </div>
      </div>

      <SlideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerMode === "add" ? "Add Broker" : (canEdit ? "Edit Broker" : "Broker")}
        badge={drawerMode === "edit" ? (selected?.mc_number ?? `#${selected?.id}`) : "NEW"}
        titleExtra={drawerMode === "edit" && selected?.carrier_packet_signed_on
          ? <span className="text-xs font-mono text-muted-foreground">Packet {formatDate(selected.carrier_packet_signed_on)}</span>
          : undefined}
        onSave={(drawerMode === "add" ? canCreate : canEdit) ? handleSave : undefined}
        saving={saving}
        onDelete={drawerMode === "edit" && selected && canDelete ? () => handleDelete(selected) : undefined}
        deleting={deleting}
      >
        <BrokerFormFields form={form} set={setField} errors={errors}
                          types={ref?.brokerTypes ?? ["broker", "shipper", "3pl"]}
                          canSeeCredit={canSeeCredit} />
      </SlideDrawer>

      <AddPreferredBrokerModal
        open={pickerOpen}
        brokers={items}
        saving={promoting}
        onClose={() => setPickerOpen(false)}
        onSubmit={b => void handleAddPreferred(b)}
      />
    </>
  );
}
