import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleDollarSign, Plus, Trash2, Pencil, CheckCircle, Paperclip, RotateCcw,
} from "lucide-react";
import {
  KpiCard, StatusPill, Btn, ActionsMenu, SlideDrawer, Modal,
  DrawerSection, DrawerField, DrawerSelect, DrawerTextarea, DrawerFieldRow,
  FilterSelect, DateRangeFilter,
} from "../lib/ui";
import {
  apiListExpenses, apiExpenseSummary, apiCreateExpense, apiUpdateExpense,
  apiDeleteExpense, apiExpenseVendors, apiListTrucks, apiListDrivers, ApiError,
  type ExpenseItem, type ExpenseSummary, type ExpenseFilters,
  type VendorTotal, type TruckItem, type DriverItem,
} from "../lib/api";
import { useRefData } from "../lib/data";
import { formatDate } from "../lib/validators";
import {
  categoryLabel, categoryColor, categoryIcon, paymentLabel,
  reviewLabel, reviewColor, sourceLabel, money, num, monthRange,
} from "../lib/expenses";

type Tab = "ledger" | "by_truck" | "vendors";

const PAGE_SIZE = 25;

/**
 * The catalog resource an integration declares when it can produce expenses.
 * Same string ImportDropdown matches on, and the reason the Sources filter
 * does not have to know any provider's name.
 */
const EXPENSE_RESOURCE = "expenses";

/**
 * Sentinel for the Sources filter's "Manual entry" option.
 *
 * Not a slug, because a manual row's source column is NULL — "no provider"
 * cannot be expressed as a provider. The API has a separate `manual_only`
 * flag for exactly this, and the filter memo translates to it below.
 */
const MANUAL_SOURCE = "__manual";

/** Which KPI tiles the row shows, and in what order. */
const KPI_CATEGORIES = ["fuel", "maintenance", "tolls", "permits_fees"];

export default function Expenses() {
  const { data: ref } = useRefData();

  const [tab, setTab] = useState<Tab>("ledger");

  // ─── Filters ───────────────────────────────────────────────────────
  // Default to this month, which is what the reference screen opens on and
  // what somebody checking "how are we doing" means by "expenses".
  const thisMonth = useMemo(() => monthRange(), []);
  const [dateFrom,      setDateFrom]      = useState(thisMonth.from);
  const [dateTo,        setDateTo]        = useState(thisMonth.to);
  const [category,      setCategory]      = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reviewStatus,  setReviewStatus]  = useState("");
  const [source,        setSource]        = useState("");
  const [search,        setSearch]        = useState("");
  const [page,          setPage]          = useState(1);

  // ─── Data ──────────────────────────────────────────────────────────
  const [items,   setItems]   = useState<ExpenseItem[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [vendors, setVendors] = useState<VendorTotal[]>([]);
  const [pages,   setPages]   = useState(1);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [selected, setSelected] = useState<ExpenseItem | null>(null);
  const [adding,   setAdding]   = useState(false);
  const [toast,    setToast]    = useState<{ ok: boolean; msg: string } | null>(null);

  /**
   * Changing a filter sends you back to page 1.
   *
   * Done in the setter rather than in an effect on `filters`: an effect would
   * run *after* loadData had already fired with the stale page, costing a
   * wasted request and a visible flash of the wrong rows. Here both pieces of
   * state change in the same render and only one fetch happens.
   */
  function filterSetter<T>(set: (value: T) => void): (value: T) => void {
    return (value: T) => { set(value); setPage(1); };
  }

  const filters: ExpenseFilters = useMemo(() => ({
    date_from:      dateFrom || undefined,
    date_to:        dateTo   || undefined,
    category:       category      ? [category]      : undefined,
    payment_method: paymentMethod ? [paymentMethod] : undefined,
    review_status:  reviewStatus  ? [reviewStatus]  : undefined,
    source:         source && source !== MANUAL_SOURCE ? [source] : undefined,
    manual_only:    source === MANUAL_SOURCE || undefined,
    search:         search || undefined,
  }), [dateFrom, dateTo, category, paymentMethod, reviewStatus, source, search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The totals come from their own endpoint rather than being summed off
      // the page — a headline figure that changed when you paged forward
      // would be worse than having none at all.
      const [pageData, summaryData] = await Promise.all([
        apiListExpenses({ ...filters, page, count: PAGE_SIZE }),
        apiExpenseSummary(filters),
      ]);
      setItems(pageData.items);
      setPages(pageData.pages || 1);
      setTotal(pageData.total || 0);
      setSummary(summaryData);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { loadData(); }, [loadData]);

  // Vendors is its own aggregate and only the Vendors tab wants it.
  useEffect(() => {
    if (tab !== "vendors") return;
    let cancelled = false;
    apiExpenseVendors(filters)
      .then((v) => { if (!cancelled) setVendors(v); })
      .catch(() => { if (!cancelled) setVendors([]); });
    return () => { cancelled = true; };
  }, [tab, filters]);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function resetFilters() {
    setPage(1);
    setDateFrom(thisMonth.from);
    setDateTo(thisMonth.to);
    setCategory("");
    setPaymentMethod("");
    setReviewStatus("");
    setSource("");
    setSearch("");
  }

  async function handleDelete(expense: ExpenseItem) {
    if (!window.confirm(`Delete this ${categoryLabel(expense.category)} expense?`)) return;
    try {
      await apiDeleteExpense(expense.id);
      showToast(true, "Expense deleted.");
      setSelected(null);
      await loadData();
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Delete failed.");
    }
  }

  async function handleVerify(expense: ExpenseItem) {
    try {
      await apiUpdateExpense(expense.id, { reviewStatus: "verified" });
      showToast(true, "Marked verified.");
      await loadData();
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Could not update.");
    }
  }

  // ─── KPI row ───────────────────────────────────────────────────────
  // Doubles as the category filter, the way every other list page in this
  // app works. The other five filters live in the bar below.
  const grandTotal = summary ? money(summary.total) : null;

  // The permission that hides amounts hides them everywhere, so the tiles
  // have to cope with having no figure to show.
  const amountsHidden = summary !== null && grandTotal === null;

  /**
   * Where a row can have come from.
   *
   * Driven off the catalog's `imports` declaration rather than the whole
   * integration list: Google Maps, SendGrid and Twilio are integrations too,
   * and none of them can ever produce an expense — offering them as sources
   * would be offering filters that match nothing, forever.
   *
   * Providers are listed whether or not they are currently connected, on
   * purpose. Disconnecting a fuel card does not delete the expenses it
   * already produced, and those rows have to stay findable.
   */
  const sourceOptions = useMemo(() => [
    { value: MANUAL_SOURCE, label: "Manual entry" },
    ...(ref?.integrations ?? [])
      .filter((i) => (i.imports ?? []).includes(EXPENSE_RESOURCE))
      .map((i) => ({ value: i.slug, label: i.name })),
  ], [ref]);

  return (
    <div className="flex flex-col gap-4">
      {/* ─── KPI row ─────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <KpiCard
          label="Total Expenses"
          value={amountsHidden ? "—" : (grandTotal ?? "—")}
          sub={summary ? `${summary.count} transaction${summary.count === 1 ? "" : "s"}` : undefined}
          icon={CircleDollarSign}
          accent="#6b7e96"
          active={category === ""}
          onClick={() => { setCategory(""); setPage(1); }}
        />
        {KPI_CATEGORIES.map((key) => {
          const row   = summary?.by_category?.[key];
          const value = row ? money(row.amount) : null;
          const share = row && summary && Number(summary.total) > 0
            ? `${((Number(row.amount) / Number(summary.total)) * 100).toFixed(1)}% of total`
            : row ? `${row.count} transaction${row.count === 1 ? "" : "s"}` : "No spend";

          return (
            <KpiCard
              key={key}
              label={categoryLabel(key)}
              value={amountsHidden ? "—" : (value ?? "$0.00")}
              sub={share}
              icon={categoryIcon(key)}
              accent={categoryColor(key)}
              active={category === key}
              onClick={() => { setCategory(category === key ? "" : key); setPage(1); }}
            />
          );
        })}
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          ["ledger",   "Expense ledger"],
          ["by_truck", "By truck"],
          ["vendors",  "Vendors"],
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
        {/* Not built yet. Shown rather than hidden so the shape of the page
            is honest about what is coming. */}
        {["Mile log", "Reminders"].map((label) => (
          <span
            key={label}
            title="Not available yet"
            className="px-3 py-2 text-xs font-mono text-muted-foreground/40 cursor-not-allowed"
          >
            {label}
          </span>
        ))}
      </div>

      {/* ─── Filter bar ──────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-md px-4 py-3 flex flex-wrap items-end gap-3">
        <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); setPage(1); }} />
        <FilterSelect
          label="Methods"
          value={paymentMethod}
          onChange={filterSetter(setPaymentMethod)}
          options={(ref?.expensePaymentMethods ?? []).map((m) => ({ value: m, label: paymentLabel(m) }))}
        />
        <FilterSelect
          label="Status"
          value={reviewStatus}
          onChange={filterSetter(setReviewStatus)}
          options={(ref?.expenseReviewStatuses ?? []).map((s) => ({ value: s, label: reviewLabel(s) }))}
          width={130}
        />
        <FilterSelect
          label="Sources"
          value={source}
          onChange={filterSetter(setSource)}
          options={sourceOptions}
          width={140}
        />
        <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <span className="text-[11px] font-mono text-muted-foreground">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Description, vendor, card…"
            className="w-full rounded border border-border bg-input-background px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <Btn variant="outline" onClick={resetFilters}>
          <RotateCcw size={11} className="inline mr-1" />Reset
        </Btn>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono ${
          toast.ok
            ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
            : "bg-red-500/10 border border-red-500/25 text-red-400"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ─── Content ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {tab === "ledger" ? "Expenses" : tab === "by_truck" ? "By truck" : "Vendors"}
            </span>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {tab === "ledger" ? total : tab === "vendors" ? vendors.length : byTruck(items).length}
            </span>
          </div>
          <Btn variant="primary" onClick={() => setAdding(true)}>
            <Plus size={11} className="inline mr-1" />Add Expense
          </Btn>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-xs font-mono text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-xs font-mono text-red-400">{error}</p>
            <Btn variant="outline" onClick={loadData}>Retry</Btn>
          </div>
        ) : tab === "ledger" ? (
          <LedgerTable
            items={items}
            integrationName={(slug) => ref?.integrations.find((i) => i.slug === slug)?.name}
            onOpen={setSelected}
            onVerify={handleVerify}
            onDelete={handleDelete}
          />
        ) : tab === "by_truck" ? (
          <ByTruckTable rows={byTruck(items)} />
        ) : (
          <VendorsTable rows={vendors} />
        )}

        {tab === "ledger" && !loading && !error && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
            <span className="text-xs font-mono text-muted-foreground">
              {total === 0
                ? "No expenses in this range"
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
            </span>
            <div className="flex items-center gap-2">
              <Btn variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Btn>
              <span className="text-xs font-mono text-muted-foreground">{page} / {pages}</span>
              <Btn variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Btn>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <ExpenseDrawer
          expense={selected}
          integrationName={(slug) => ref?.integrations.find((i) => i.slug === slug)?.name}
          onClose={() => setSelected(null)}
          onSaved={async () => { setSelected(null); await loadData(); showToast(true, "Expense updated."); }}
          onDelete={() => handleDelete(selected)}
          onError={(msg) => showToast(false, msg)}
        />
      )}

      {adding && (
        <AddExpenseModal
          categories={ref?.expenseCategories ?? []}
          paymentMethods={ref?.expensePaymentMethods ?? []}
          onClose={() => setAdding(false)}
          onSaved={async () => { setAdding(false); await loadData(); showToast(true, "Expense added."); }}
          onError={(msg) => showToast(false, msg)}
        />
      )}
    </div>
  );
}

// ─── Ledger table ────────────────────────────────────────────────────────────

function LedgerTable({ items, integrationName, onOpen, onVerify, onDelete }: {
  items: ExpenseItem[];
  integrationName: (slug: string) => string | undefined;
  onOpen: (e: ExpenseItem) => void;
  onVerify: (e: ExpenseItem) => void;
  onDelete: (e: ExpenseItem) => void;
}) {
  const headers = ["Date", "Category", "Description", "Vendor", "Method", "Amount", "Receipt", "Status", "Odometer", "Source", ""];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((e) => {
            const Icon   = categoryIcon(e.category);
            const amount = money(e.amount, e.currency);

            return (
              <tr
                key={e.id}
                onClick={() => onOpen(e)}
                className="border-b border-border/50 hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-foreground">
                  {formatDate(e.occurred_on)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-foreground">
                    <Icon size={11} style={{ color: categoryColor(e.category) }} />
                    {categoryLabel(e.category)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-xs font-mono text-foreground">{e.description ?? "—"}</div>
                  {e.truck?.truck_number && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">Truck {e.truck.truck_number}</div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-xs font-mono text-foreground">{e.vendor_name ?? "—"}</div>
                  {(e.location_city || e.location_state) && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {[e.location_city, e.location_state].filter(Boolean).join(", ")}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="text-xs font-mono text-foreground">{paymentLabel(e.payment_method)}</div>
                  {e.card_last4 && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">•••• {e.card_last4}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono font-semibold text-foreground">
                  {/* Absent, not zero: a caller without expenses.view_amounts
                      gets the row with the figures stripped. */}
                  {amount ?? <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {e.receipt_hash
                    ? <Paperclip size={12} className="text-emerald-400" />
                    : <span className="text-[11px] text-muted-foreground/40">—</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <StatusPill label={reviewLabel(e.review_status)} color={reviewColor(e.review_status)} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-muted-foreground">
                  {num(e.odometer_miles) ? `${num(e.odometer_miles)} mi` : "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`text-[11px] font-mono ${e.source ? "text-primary" : "text-muted-foreground"}`}>
                    {sourceLabel(e.source, e.source ? integrationName(e.source) : undefined)}
                  </span>
                </td>
                <td className="px-3 py-2.5" onClick={(ev) => ev.stopPropagation()}>
                  <ActionsMenu
                    items={[
                      { label: "Edit", onClick: () => onOpen(e), icon: Pencil },
                      ...(e.review_status === "verified"
                        ? []
                        : [{ label: "Mark verified", onClick: () => onVerify(e), icon: CheckCircle }]),
                      { label: "Delete", onClick: () => onDelete(e), icon: Trash2, variant: "danger" as const },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">
                No expenses found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── By truck ────────────────────────────────────────────────────────────────

interface TruckRow { key: string; label: string; count: number; total: number; hasAmounts: boolean }

/**
 * Groups the *current page*, and says so in the UI.
 *
 * A real by-truck report belongs on the server next to the summary endpoint;
 * grouping a page is a useful glance, not a report, and labelling it honestly
 * beats quietly presenting a partial total as a complete one.
 */
function byTruck(items: ExpenseItem[]): TruckRow[] {
  const rows = new Map<string, TruckRow>();

  for (const e of items) {
    const key   = e.truck ? String(e.truck.id) : "unassigned";
    const label = e.truck?.truck_number ? `Truck ${e.truck.truck_number}` : "Unassigned";
    const row   = rows.get(key) ?? { key, label, count: 0, total: 0, hasAmounts: false };

    row.count += 1;
    if (e.amount !== undefined && e.amount !== null) {
      row.total += Number(e.amount);
      row.hasAmounts = true;
    }
    rows.set(key, row);
  }

  return Array.from(rows.values()).sort((a, b) => b.total - a.total);
}

function ByTruckTable({ rows }: { rows: TruckRow[] }) {
  return (
    <>
      <div className="px-4 py-2 border-b border-border bg-muted/20">
        <span className="text-[11px] font-mono text-muted-foreground">
          Grouped from the expenses on this page — page through to see the rest.
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {["Truck", "Transactions", "Total"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                <td className="px-3 py-2.5 text-xs font-mono text-foreground">{r.label}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{r.count}</td>
                <td className="px-3 py-2.5 text-xs font-mono font-semibold text-foreground">
                  {r.hasAmounts ? money(String(r.total)) : <span className="text-muted-foreground/50">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">Nothing to group</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Vendors ─────────────────────────────────────────────────────────────────

function VendorsTable({ rows }: { rows: VendorTotal[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {["Vendor", "Transactions", "Total spend"].map((h) => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.vendor} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
              <td className="px-3 py-2.5 text-xs font-mono text-foreground">{r.vendor}</td>
              <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{r.count}</td>
              <td className="px-3 py-2.5 text-xs font-mono font-semibold text-foreground">
                {money(r.amount) ?? <span className="text-muted-foreground/50">—</span>}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">No vendors in this range</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Detail drawer ───────────────────────────────────────────────────────────

function ExpenseDrawer({ expense, integrationName, onClose, onSaved, onDelete, onError }: {
  expense: ExpenseItem;
  integrationName: (slug: string) => string | undefined;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onDelete: () => void;
  onError: (msg: string) => void;
}) {
  const [notes,  setNotes]  = useState(expense.notes ?? "");
  const [review, setReview] = useState(expense.review_status);
  const [saving, setSaving] = useState(false);

  const imported = Boolean(expense.source);
  const fuel     = expense.fuel_detail;

  async function save() {
    setSaving(true);
    try {
      await apiUpdateExpense(expense.id, { notes, reviewStatus: review });
      await onSaved();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SlideDrawer
      open
      onClose={onClose}
      title={expense.description ?? categoryLabel(expense.category)}
      badge={categoryLabel(expense.category).toUpperCase()}
      onSave={save}
      saving={saving}
      onDelete={onDelete}
    >
      <DrawerSection title="Expense">
        <DrawerFieldRow cols={2}>
          <DrawerField label="Date"   value={formatDate(expense.occurred_on)} readOnly />
          <DrawerField label="Amount" value={money(expense.amount, expense.currency) ?? "Hidden"} readOnly mono />
        </DrawerFieldRow>
        <DrawerFieldRow cols={2}>
          <DrawerField label="Vendor"  value={expense.vendor_name ?? "—"} readOnly />
          <DrawerField label="Method"  value={paymentLabel(expense.payment_method)} readOnly />
        </DrawerFieldRow>
        <DrawerFieldRow cols={2}>
          <DrawerField
            label="Location"
            value={[expense.location_city, expense.location_state, expense.location_zip].filter(Boolean).join(", ") || "—"}
            readOnly
          />
          <DrawerField
            label="Odometer"
            value={num(expense.odometer_miles) ? `${num(expense.odometer_miles)} mi` : "—"}
            readOnly
          />
        </DrawerFieldRow>
        <DrawerFieldRow cols={2}>
          <DrawerField label="Truck"  value={expense.truck?.truck_number ?? "Unassigned"} readOnly />
          <DrawerField
            label="Driver"
            value={expense.driver ? `${expense.driver.first_name ?? ""} ${expense.driver.last_name ?? ""}`.trim() || "—" : "—"}
            readOnly
          />
        </DrawerFieldRow>
      </DrawerSection>

      {fuel && (
        <DrawerSection title="Fuel">
          <DrawerFieldRow cols={2}>
            <DrawerField label="Quantity" value={num(fuel.quantity, 3) ? `${num(fuel.quantity, 3)} ${fuel.quantity_unit ?? "gal"}` : "—"} readOnly mono />
            <DrawerField label="Grade"    value={fuel.fuel_grade ?? "—"} readOnly />
          </DrawerFieldRow>
          <DrawerFieldRow cols={2}>
            <DrawerField label="Price / unit"  value={money(fuel.unit_price) ?? "Hidden"} readOnly mono />
            <DrawerField label="Retail / unit" value={money(fuel.retail_unit_price) ?? "Hidden"} readOnly mono />
          </DrawerFieldRow>
          <DrawerFieldRow cols={2}>
            <DrawerField label="Saved vs retail" value={money(fuel.savings_amount) ?? "Hidden"} readOnly mono />
            <DrawerField label="Non-fuel"        value={money(fuel.non_fuel_amount) ?? "Hidden"} readOnly mono />
          </DrawerFieldRow>
        </DrawerSection>
      )}

      <DrawerSection title="Review">
        <DrawerSelect label="Status" value={review} onChange={setReview}>
          <option value="unverified">Unverified</option>
          <option value="verified">Verified</option>
          <option value="flagged">Flagged</option>
        </DrawerSelect>
        <DrawerTextarea label="Notes" value={notes} onChange={setNotes} rows={3} />
      </DrawerSection>

      <DrawerSection title="Provenance">
        <DrawerField
          label="Source"
          value={sourceLabel(expense.source, expense.source ? integrationName(expense.source) : undefined)}
          readOnly
        />
        {imported && (
          <>
            <DrawerField label="Provider reference" value={expense.external_id ?? "—"} readOnly mono />
            <DrawerField
              label="Last synced"
              value={expense.imported_at ? formatDate(expense.imported_at.slice(0, 10)) : "—"}
              readOnly
            />
            <p className="text-[11px] text-muted-foreground px-1">
              Amounts, dates and the merchant come from the provider and are refreshed on
              every sync. The truck, driver, notes and review status are yours and are
              never overwritten.
            </p>
          </>
        )}
      </DrawerSection>
    </SlideDrawer>
  );
}

// ─── Add ─────────────────────────────────────────────────────────────────────

function AddExpenseModal({ categories, paymentMethods, onClose, onSaved, onError }: {
  categories: string[];
  paymentMethods: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [category,    setCategory]    = useState("fuel");
  const [description, setDescription] = useState("");
  const [amount,      setAmount]      = useState("");
  const [date,        setDate]        = useState(today);
  const [vendor,      setVendor]      = useState("");
  const [method,      setMethod]      = useState("credit_card");
  const [truckId,     setTruckId]     = useState("");
  const [driverId,    setDriverId]    = useState("");
  const [odometer,    setOdometer]    = useState("");
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);

  const [trucks,  setTrucks]  = useState<TruckItem[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiListTrucks(), apiListDrivers()])
      .then(([t, d]) => { if (!cancelled) { setTrucks(t); setDrivers(d); } })
      .catch(() => { /* the selects just stay empty; the expense saves without them */ });
    return () => { cancelled = true; };
  }, []);

  const valid = category !== "" && amount.trim() !== "" && !Number.isNaN(Number(amount)) && date !== "";

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      await apiCreateExpense({
        category,
        description: description || null,
        amount: Number(amount),
        // The API takes a datetime; a hand-entered expense is dated, not timed.
        occurredAt: `${date}T12:00:00Z`,
        vendorName: vendor || null,
        paymentMethod: method,
        truck: truckId ? Number(truckId) : null,
        driver: driverId ? Number(driverId) : null,
        odometerMiles: odometer ? Number(odometer) : null,
        notes: notes || null,
        reviewStatus: "verified",
      });
      await onSaved();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not add the expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Expense"
      subtitle="Record a cost against your fleet."
      width={620}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={!valid || saving}>
            {saving ? "Saving…" : "Save Expense"}
          </Btn>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <DrawerFieldRow cols={2}>
          <DrawerSelect label="Category" value={category} onChange={setCategory} required>
            {categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </DrawerSelect>
          <DrawerField label="Date" type="date" value={date} onChange={setDate} required />
        </DrawerFieldRow>

        <DrawerField label="Description" value={description} onChange={setDescription} />

        <DrawerFieldRow cols={2}>
          <DrawerField label="Amount" type="number" value={amount} onChange={setAmount} required mono />
          <DrawerSelect label="Payment method" value={method} onChange={setMethod}>
            {paymentMethods.map((m) => <option key={m} value={m}>{paymentLabel(m)}</option>)}
          </DrawerSelect>
        </DrawerFieldRow>

        <DrawerFieldRow cols={2}>
          <DrawerField label="Vendor" value={vendor} onChange={setVendor} />
          <DrawerField label="Odometer (mi)" type="number" value={odometer} onChange={setOdometer} mono />
        </DrawerFieldRow>

        <DrawerFieldRow cols={2}>
          <DrawerSelect label="Truck" value={truckId} onChange={setTruckId}>
            <option value="">Unassigned</option>
            {trucks.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.truck_number ?? `#${t.id}`}</option>
            ))}
          </DrawerSelect>
          <DrawerSelect label="Driver" value={driverId} onChange={setDriverId}>
            <option value="">Unassigned</option>
            {drivers.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {`${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || `#${d.id}`}
              </option>
            ))}
          </DrawerSelect>
        </DrawerFieldRow>

        <DrawerTextarea label="Notes" value={notes} onChange={setNotes} rows={2} />
      </div>
    </Modal>
  );
}
