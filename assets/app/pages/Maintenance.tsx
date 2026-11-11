import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wrench, AlertTriangle, CalendarClock, CircleDollarSign, Plus, Trash2, Pencil,
  ChevronRight,
} from "lucide-react";
import {
  KpiCard, StatusPill, Btn, ActionsMenu, Modal, SlideDrawer, DrawerSection,
  DrawerField, DrawerSelect, DrawerTextarea, DrawerFieldRow, FilterSelect,
} from "../lib/ui";
import {
  apiListMaintenance, apiMaintenanceDue, apiMaintenanceVendors,
  apiMaintenanceTrucks, apiCreateMaintenance, apiDeleteMaintenance, apiListTrucks,
  apiListMaintenanceSchedules, apiCreateMaintenanceSchedule,
  apiUpdateMaintenanceSchedule, apiDeleteMaintenanceSchedule, ApiError,
  type MaintenanceItem, type MaintenanceDueItem, type MaintenanceVendorRow,
  type MaintenanceScheduleItem, type MaintenanceTruckRow, type TruckItem,
} from "../lib/api";
import { useRefData } from "../lib/data";
import { formatDate } from "../lib/validators";
import {
  serviceLabel, dueLabel, dueColor, maintenanceStateLabel,
  maintenanceStateColor, kindLabel, money, num,
} from "../lib/expenses";

type Tab = "due" | "records" | "schedules" | "vendors";

export default function Maintenance() {
  const { data: ref } = useRefData();

  const [tab, setTab] = useState<Tab>("due");

  const [due,       setDue]       = useState<MaintenanceDueItem[]>([]);
  const [records,   setRecords]   = useState<MaintenanceItem[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceScheduleItem[]>([]);
  const [vendors,   setVendors]   = useState<MaintenanceVendorRow[]>([]);
  const [trucks,    setTrucks]    = useState<TruckItem[]>([]);
  const [truckRows, setTruckRows] = useState<MaintenanceTruckRow[]>([]);

  const [openTruck,  setOpenTruck]  = useState<TruckItem | null>(null);
  const [completing, setCompleting] = useState<{ truck: TruckItem; due: MaintenanceDueItem } | null>(null);

  const [serviceType, setServiceType] = useState("");
  const [state,       setState]       = useState("");

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [adding,  setAdding]  = useState(false);
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [toast,   setToast]   = useState<{ ok: boolean; msg: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dueRows, recordRows, scheduleRows, vendorRows, truckList, truckRollup] = await Promise.all([
        apiMaintenanceDue(),
        apiListMaintenance({
          count: 100,
          service_type: serviceType ? [serviceType] : undefined,
          state: state ? [state] : undefined,
        }),
        apiListMaintenanceSchedules(),
        apiMaintenanceVendors(),
        apiListTrucks(),
        apiMaintenanceTrucks(),
      ]);
      setDue(dueRows);
      setRecords(recordRows);
      setSchedules(scheduleRows);
      setVendors(vendorRows);
      setTrucks(truckList);
      setTruckRows(truckRollup);
      setOpenTruck((prev) => (prev ? truckList.find((t) => t.id === prev.id) ?? null : null));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load maintenance.");
    } finally {
      setLoading(false);
    }
  }, [serviceType, state]);

  useEffect(() => { loadData(); }, [loadData]);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  const overdue  = due.filter((d) => d.due_state === "overdue");
  const dueSoon  = due.filter((d) => d.due_state === "due_soon");

  // Spend is summed from the vendor rollup, which is already server-side and
  // already excludes estimates — so this agrees with the ledger by
  // construction rather than by coincidence.
  const totalSpend = vendors.reduce((sum, v) => sum + Number(v.total || 0), 0);
  const openEstimates = vendors.reduce((sum, v) => sum + Number(v.open_estimates || 0), 0);

  async function handleDelete(record: MaintenanceItem) {
    if (!window.confirm("Delete this record? Its expense line will be retired too.")) return;
    try {
      await apiDeleteMaintenance(record.id);
      showToast(true, "Record deleted.");
      await loadData();
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Delete failed.");
    }
  }

  async function handleDeleteSchedule(schedule: MaintenanceScheduleItem) {
    if (!window.confirm(`Remove the ${serviceLabel(schedule.service_type)} interval?`)) return;
    try {
      await apiDeleteMaintenanceSchedule(schedule.id);
      showToast(true, "Interval removed.");
      await loadData();
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Delete failed.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <KpiCard
          label="Overdue" value={overdue.length}
          sub={overdue.length ? "Needs attention" : "Nothing overdue"}
          icon={AlertTriangle} accent="#ef4444"
          active={tab === "due" && state === ""} onClick={() => setTab("due")}
        />
        <KpiCard
          label="Due Soon" value={dueSoon.length}
          sub="Within the warning window"
          icon={CalendarClock} accent="#f59e0b"
          onClick={() => setTab("due")}
        />
        <KpiCard
          label="Recorded Spend" value={money(String(totalSpend)) ?? "—"}
          sub={`${records.length} record${records.length === 1 ? "" : "s"}`}
          icon={CircleDollarSign} accent="#10b981"
          onClick={() => setTab("records")}
        />
        <KpiCard
          label="Open Estimates" value={money(String(openEstimates)) ?? "—"}
          sub="Awaiting final invoices"
          icon={Wrench} accent="#6366f1"
          onClick={() => setTab("vendors")}
        />
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {([
          ["due",       "Upcoming & overdue"],
          ["records",   "Service history"],
          ["schedules", "Service intervals"],
          ["vendors",   "Vendors"],
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

      {tab === "records" && (
        <div className="bg-card border border-border rounded-md px-4 py-3 flex flex-wrap items-end gap-3">
          <FilterSelect
            label="Services"
            value={serviceType}
            onChange={setServiceType}
            options={(ref?.maintenanceServiceTypes ?? []).map((s) => ({ value: s, label: serviceLabel(s) }))}
            width={170}
          />
          <FilterSelect
            label="States"
            value={state}
            onChange={setState}
            options={(ref?.maintenanceStates ?? []).map((s) => ({ value: s, label: maintenanceStateLabel(s) }))}
            width={150}
          />
        </div>
      )}

      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono ${
          toast.ok
            ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
            : "bg-red-500/10 border border-red-500/25 text-red-400"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {tab === "due" ? "Upcoming & overdue"
                : tab === "records" ? "Service history"
                : tab === "schedules" ? "Service intervals" : "Vendors"}
            </span>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {tab === "due" ? trucks.length
                : tab === "records" ? records.length
                : tab === "schedules" ? schedules.length : vendors.length}
            </span>
          </div>
          {tab === "schedules" ? (
            <Btn variant="primary" onClick={() => setAddingSchedule(true)}>
              <Plus size={11} className="inline mr-1" />Add Interval
            </Btn>
          ) : (
            <Btn variant="primary" onClick={() => setAdding(true)}>
              <Plus size={11} className="inline mr-1" />Add Service
            </Btn>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-xs font-mono text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-xs font-mono text-red-400">{error}</p>
            <Btn variant="outline" onClick={loadData}>Retry</Btn>
          </div>
        ) : tab === "due" ? (
          <TrucksTable trucks={trucks} due={due} rollup={truckRows} onOpen={setOpenTruck} />
        ) : tab === "records" ? (
          <RecordsTable rows={records} onDelete={handleDelete} />
        ) : tab === "schedules" ? (
          <SchedulesTable rows={schedules} onDelete={handleDeleteSchedule} />
        ) : (
          <VendorsTable rows={vendors} />
        )}
      </div>

      {openTruck && (
        <TruckDrawer
          truck={openTruck}
          due={due.filter((d) => d.truck_id === openTruck.id)}
          schedules={schedules.filter((s) => s.truck?.id === openTruck.id)}
          onComplete={(d) => setCompleting({ truck: openTruck, due: d })}
          onClose={() => setOpenTruck(null)}
        />
      )}

      {(adding || completing) && (
        <AddServiceModal
          serviceTypes={ref?.maintenanceServiceTypes ?? []}
          kinds={ref?.maintenanceKinds ?? []}
          states={ref?.maintenanceStates ?? []}
          trucks={trucks}
          initial={completing ? {
            truckId: completing.truck.id,
            serviceType: completing.due.service_type,
            odometer: completing.truck.current_mileage ?? null,
          } : undefined}
          onClose={() => { setAdding(false); setCompleting(null); }}
          onSaved={async (saved) => {
            // Completing a due service is two facts: the work happened, and
            // the interval it was due on starts counting from here. The
            // record is the first; without the second the line stays overdue
            // for ever, however much work gets logged against it.
            if (completing && saved.state === "completed" && saved.performedOn) {
              await apiUpdateMaintenanceSchedule(completing.due.schedule_id, {
                lastServiceOn: saved.performedOn,
                lastServiceOdometer: saved.odometerMiles,
              });
            }

            const completed = Boolean(completing);
            setAdding(false);
            setCompleting(null);
            await loadData();
            showToast(true, completed ? "Service completed." : "Service recorded.");
          }}
          onError={(msg) => showToast(false, msg)}
        />
      )}

      {addingSchedule && (
        <AddIntervalModal
          serviceTypes={ref?.maintenanceServiceTypes ?? []}
          trucks={trucks}
          onClose={() => setAddingSchedule(false)}
          onSaved={async () => { setAddingSchedule(false); await loadData(); showToast(true, "Interval saved."); }}
          onError={(msg) => showToast(false, msg)}
        />
      )}
    </div>
  );
}

// ─── Tables ──────────────────────────────────────────────────────────────────

function RecordsTable({ rows, onDelete }: { rows: MaintenanceItem[]; onDelete: (r: MaintenanceItem) => void }) {
  const headers = ["Date", "Truck", "Service", "Kind", "Vendor", "Odometer", "Cost", "State", ""];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[950px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
              <td className="px-3 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">
                {r.performed_on ? formatDate(r.performed_on) : r.scheduled_for ? `${formatDate(r.scheduled_for)} (planned)` : "—"}
              </td>
              <td className="px-3 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">{r.truck?.truck_number ?? "—"}</td>
              <td className="px-3 py-2.5">
                <div className="text-xs font-mono text-foreground">{serviceLabel(r.service_type)}</div>
                {r.description && <div className="text-[11px] text-muted-foreground mt-0.5">{r.description}</div>}
              </td>
              <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{kindLabel(r.kind)}</td>
              <td className="px-3 py-2.5">
                <div className="text-xs font-mono text-foreground">{r.vendor_name ?? "—"}</div>
                {r.work_order_number && <div className="text-[11px] text-muted-foreground mt-0.5">WO {r.work_order_number}</div>}
              </td>
              <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                {num(r.odometer_miles) ? `${num(r.odometer_miles)} mi` : "—"}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono font-semibold text-foreground">
                {money(r.cost) ?? money(r.estimated_cost) ?? <span className="text-muted-foreground/50">—</span>}
                {r.cost === undefined && r.estimated_cost !== undefined && (
                  <div className="text-[11px] text-muted-foreground font-normal mt-0.5">estimate</div>
                )}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <StatusPill label={maintenanceStateLabel(r.state)} color={maintenanceStateColor(r.state)} />
              </td>
              <td className="px-3 py-2.5">
                <ActionsMenu items={[{ label: "Delete", onClick: () => onDelete(r), icon: Trash2, variant: "danger" }]} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">No records found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SchedulesTable({ rows, onDelete }: { rows: MaintenanceScheduleItem[]; onDelete: (r: MaintenanceScheduleItem) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {["Applies to", "Service", "Every", "Last service", "Warn before", ""].map((h, i) => (
              <th key={`${h}-${i}`} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
              <td className="px-3 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">
                {r.truck?.truck_number ? `Truck ${r.truck.truck_number}` : "Whole fleet"}
              </td>
              <td className="px-3 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">{serviceLabel(r.service_type)}</td>
              <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                {/* Both intervals can apply; whichever runs out first wins. */}
                {[
                  num(r.interval_miles) ? `${num(r.interval_miles)} mi` : null,
                  r.interval_days ? `${r.interval_days} days` : null,
                ].filter(Boolean).join(" or ") || "—"}
              </td>
              <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                {r.last_service_on ? formatDate(r.last_service_on) : "—"}
                {num(r.last_service_odometer) && (
                  <div className="text-[11px] mt-0.5">at {num(r.last_service_odometer)} mi</div>
                )}
              </td>
              <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                {[
                  num(r.alert_before_miles) ? `${num(r.alert_before_miles)} mi` : null,
                  r.alert_before_days ? `${r.alert_before_days} days` : null,
                ].filter(Boolean).join(" / ") || "—"}
              </td>
              <td className="px-3 py-2.5">
                <ActionsMenu items={[{ label: "Delete", onClick: () => onDelete(r), icon: Trash2, variant: "danger" }]} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">
              No intervals set. Add one to start tracking what is due.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function VendorsTable({ rows }: { rows: MaintenanceVendorRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {["Vendor", "Invoices", "Total spend", "Avg invoice", "Open estimates"].map((h) => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.vendor} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
              <td className="px-3 py-2.5 text-xs font-mono text-foreground">{r.vendor}</td>
              <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{r.invoices}</td>
              <td className="px-3 py-2.5 text-xs font-mono font-semibold text-foreground">{money(r.total) ?? "—"}</td>
              <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{money(r.average) ?? "—"}</td>
              <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                {Number(r.open_estimates) > 0
                  ? <span className="text-amber-400">{money(r.open_estimates)}</span>
                  : "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">No vendor spend recorded</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Upcoming & overdue ──────────────────────────────────────────────────────

/**
 * Headroom in the Due tab's wording, on whichever axis is the binding one.
 * A truck can be 8,000 miles from its next oil change and eleven days past
 * the date, and quoting the miles there would read as reassurance.
 */
function dueDetail(d: MaintenanceDueItem): string {
  if (d.miles_until_due !== null && d.miles_until_due < 0) return `${num(Math.abs(d.miles_until_due))} mi over`;
  if (d.days_until_due !== null && d.days_until_due < 0) return `${Math.abs(d.days_until_due)} days over`;
  if (d.miles_until_due !== null) return `${num(d.miles_until_due)} mi left`;
  if (d.days_until_due !== null) return `${d.days_until_due} days`;
  return "—";
}

/**
 * What the fleet owes, as a roster rather than as a list of service lines:
 * one row per truck, worst first, with the single most urgent thing it owes.
 * The lines themselves are a truck's own business, so they live in its drawer
 * — thirty rows of "0103 · oil change" across twelve tractors is a report
 * nobody triages from.
 *
 * Health and next-due come from the computed due lines; counts and spend from
 * the server-side rollup, which is why the Service-history filters don't move
 * these numbers.
 *
 * Trailer work has no row here. The due report is per truck, and folding
 * trailer jobs into whichever tractor pulled them would invent an attribution
 * the invoice doesn't have — they stay on Service history.
 */
function TrucksTable({ trucks, due, rollup, onOpen }: {
  trucks: TruckItem[];
  due: MaintenanceDueItem[];
  rollup: MaintenanceTruckRow[];
  onOpen: (truck: TruckItem) => void;
}) {
  const headers = ["Truck", "Odometer", "Health", "Next due", "Last service", "Open jobs", "Spend", ""];

  // `due` arrives worst-first, so the first line matching a truck is also the
  // most urgent thing that truck owes.
  const health = useMemo(() => {
    const map = new Map<number, { overdue: number; soon: number; next?: MaintenanceDueItem }>();
    for (const d of due) {
      const entry = map.get(d.truck_id) ?? { overdue: 0, soon: 0 };
      if (d.due_state === "overdue") entry.overdue += 1;
      if (d.due_state === "due_soon") entry.soon += 1;
      if (!entry.next) entry.next = d;
      map.set(d.truck_id, entry);
    }
    return map;
  }, [due]);

  const spend = useMemo(() => new Map(rollup.map((r) => [r.truck_id, r])), [rollup]);

  // Trucks that need attention first, then by number — the same triage order
  // the Due tab uses, lifted to the truck.
  const rows = useMemo(() => {
    const rank = (id: number) => {
      const h = health.get(id);
      if (h?.overdue) return 0;
      if (h?.soon) return 1;
      return 2;
    };

    return [...trucks].sort((a, b) =>
      rank(a.id) - rank(b.id) || (a.truck_number ?? "").localeCompare(b.truck_number ?? ""));
  }, [trucks, health]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[950px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const h = health.get(t.id);
            const s = spend.get(t.id);
            const next = h?.next;

            return (
              <tr
                key={t.id}
                onClick={() => onOpen(t)}
                className="border-b border-border/50 hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="text-xs font-mono text-primary font-semibold">{t.truck_number ?? `#${t.id}`}</div>
                  {(t.make?.name || t.model?.name) && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {[t.make?.name, t.model?.name].filter(Boolean).join(" ")}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                  {num(t.current_mileage) ? `${num(t.current_mileage)} mi` : "No reading"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {h?.overdue
                    ? <StatusPill label={`${h.overdue} overdue`} color={dueColor("overdue")} />
                    : h?.soon
                      ? <StatusPill label={`${h.soon} due soon`} color={dueColor("due_soon")} />
                      : h
                        ? <StatusPill label="On track" color={dueColor("on_track")} />
                        : <span className="text-xs font-mono text-muted-foreground">No intervals</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {next ? (
                    <>
                      <div className="text-xs font-mono text-foreground">{serviceLabel(next.service_type)}</div>
                      <div className={`text-[11px] mt-0.5 ${next.due_state === "overdue" ? "text-red-400" : "text-muted-foreground"}`}>
                        {dueDetail(next)}
                      </div>
                    </>
                  ) : <span className="text-xs font-mono text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                  {s?.last_service_on ? formatDate(s.last_service_on) : "—"}
                </td>
                <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap">
                  {s?.open_jobs
                    ? <span className="text-amber-400">{s.open_jobs}</span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono font-semibold text-foreground">
                  {money(s?.total) ?? <span className="text-muted-foreground/50">—</span>}
                  {Number(s?.open_estimates ?? 0) > 0 && (
                    <div className="text-[11px] font-normal text-amber-400 mt-0.5">
                      {money(s?.open_estimates)} quoted
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <ChevronRight size={13} />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">
              No trucks yet.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What one truck owes and the intervals it owes it on. Work already done is
 * Service history's job — this drawer answers the question the tab asks.
 */
function TruckDrawer({ truck, due, schedules, onComplete, onClose }: {
  truck: TruckItem;
  due: MaintenanceDueItem[];
  schedules: MaintenanceScheduleItem[];
  onComplete: (due: MaintenanceDueItem) => void;
  onClose: () => void;
}) {
  const overdue = due.filter((d) => d.due_state === "overdue").length;
  const driver  = truck.assigned_driver;

  return (
    <SlideDrawer
      open
      onClose={onClose}
      title={`Truck ${truck.truck_number ?? `#${truck.id}`}`}
      badge={overdue ? `${overdue} OVERDUE` : undefined}
    >
      <DrawerSection title="Truck">
        <DrawerFieldRow cols={2}>
          <DrawerField
            label="Odometer"
            value={num(truck.current_mileage) ? `${num(truck.current_mileage)} mi` : "No reading"}
            readOnly mono
          />
          <DrawerField
            label="Make / model"
            value={[truck.make?.name, truck.model?.name].filter(Boolean).join(" ") || "—"}
            readOnly
          />
        </DrawerFieldRow>
        <DrawerFieldRow cols={2}>
          <DrawerField
            label="Driver"
            value={driver ? `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim() || "—" : "Unassigned"}
            readOnly
          />
          <DrawerField label="Trailer" value={truck.assigned_trailer?.trailer_number ?? "—"} readOnly />
        </DrawerFieldRow>
      </DrawerSection>

      <DrawerSection title="Due & overdue">
        {due.length === 0 ? (
          <p className="text-[11px] text-muted-foreground px-1">
            No interval applies to this truck yet, or it has never been serviced — either
            way there is nothing to count down from.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border/50">
            {due.map((d) => (
              <div key={`${d.service_type}-${d.schedule_id}`} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-foreground">{serviceLabel(d.service_type)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {num(d.next_due_mileage) ? `at ${num(d.next_due_mileage)} mi` : null}
                    {d.next_due_mileage !== null && d.next_due_on ? " · " : null}
                    {d.next_due_on ? `by ${formatDate(d.next_due_on)}` : null}
                    {d.overridden ? " · custom interval" : null}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-[11px] font-mono ${d.due_state === "overdue" ? "text-red-400" : "text-muted-foreground"}`}>
                    {dueDetail(d)}
                  </span>
                  <StatusPill label={dueLabel(d.due_state)} color={dueColor(d.due_state)} />
                  {/* Only what is actually due: a service nobody is asking
                      for is an Add Service, not a Complete. */}
                  {d.due_state !== "on_track" && (
                    <Btn variant="outline" onClick={() => onComplete(d)}>Complete</Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DrawerSection>

      <DrawerSection title="Service intervals">
        {schedules.length === 0 ? (
          <p className="text-[11px] text-muted-foreground px-1">
            Runs on the fleet-wide intervals. Add one for this truck to override them.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border/50">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                <div className="text-xs font-mono text-foreground">{serviceLabel(s.service_type)}</div>
                <div className="text-[11px] font-mono text-muted-foreground text-right">
                  <div>
                    {[
                      num(s.interval_miles) ? `${num(s.interval_miles)} mi` : null,
                      s.interval_days ? `${s.interval_days} days` : null,
                    ].filter(Boolean).join(" or ") || "—"}
                  </div>
                  {s.last_service_on && (
                    <div className="mt-0.5">
                      last {formatDate(s.last_service_on)}
                      {num(s.last_service_odometer) ? ` at ${num(s.last_service_odometer)} mi` : ""}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DrawerSection>

    </SlideDrawer>
  );
}

// ─── Add service ─────────────────────────────────────────────────────────────

function AddServiceModal({ serviceTypes, kinds, states, trucks, initial, onClose, onSaved, onError }: {
  serviceTypes: string[];
  kinds: string[];
  states: string[];
  trucks: TruckItem[];
  /** Set when a due line is being closed out, which prefills and renames it. */
  initial?: { truckId: number; serviceType: string; odometer: number | null };
  onClose: () => void;
  onSaved: (saved: { state: string; performedOn: string | null; odometerMiles: number | null }) => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [kind,        setKind]        = useState("service");
  const [state,       setState]       = useState("completed");
  const [serviceType, setServiceType] = useState(initial?.serviceType ?? "oil_change");
  const [truckId,     setTruckId]     = useState(initial ? String(initial.truckId) : "");
  const [description, setDescription] = useState("");
  const [performedOn, setPerformedOn] = useState(today);
  const [odometer,    setOdometer]    = useState(initial?.odometer == null ? "" : String(initial.odometer));
  const [vendor,      setVendor]      = useState("");
  const [workOrder,   setWorkOrder]   = useState("");
  const [cost,        setCost]        = useState("");
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);

  const isEstimate = kind === "estimate";
  const valid = serviceType !== "";

  async function save() {
    if (!valid) return;
    setSaving(true);

    const performed     = state === "completed" ? performedOn : null;
    const odometerMiles = odometer ? Number(odometer) : null;

    try {
      await apiCreateMaintenance({
        kind,
        state,
        serviceType,
        truck: truckId ? Number(truckId) : null,
        description: description || null,
        performedOn: performed,
        scheduledFor: state === "scheduled" ? performedOn : null,
        odometerMiles,
        vendorName: vendor || null,
        workOrderNumber: workOrder || null,
        // An estimate quotes; only finished work has an actual cost, and only
        // an actual cost reaches the ledger.
        estimatedCost: isEstimate && cost ? Number(cost) : null,
        cost: !isEstimate && cost ? Number(cost) : null,
        notes: notes || null,
      });
      await onSaved({ state, performedOn: performed, odometerMiles });
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not record the service.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Complete Service" : "Add Service"}
      subtitle={initial
        ? "Record the work and start the interval counting again."
        : "Record work done, planned, or quoted."}
      width={620}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={!valid || saving}>
            {saving ? "Saving…" : initial ? "Complete Service" : "Save Service"}
          </Btn>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <DrawerFieldRow cols={3}>
          <DrawerSelect label="Kind" value={kind} onChange={setKind}>
            {kinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </DrawerSelect>
          <DrawerSelect label="State" value={state} onChange={setState}>
            {states.map((s) => <option key={s} value={s}>{maintenanceStateLabel(s)}</option>)}
          </DrawerSelect>
          <DrawerSelect label="Service" value={serviceType} onChange={setServiceType} required>
            {serviceTypes.map((s) => <option key={s} value={s}>{serviceLabel(s)}</option>)}
          </DrawerSelect>
        </DrawerFieldRow>

        <DrawerFieldRow cols={2}>
          <DrawerSelect label="Truck" value={truckId} onChange={setTruckId}>
            <option value="">Unassigned</option>
            {trucks.map((t) => <option key={t.id} value={String(t.id)}>{t.truck_number ?? `#${t.id}`}</option>)}
          </DrawerSelect>
          <DrawerField
            label={state === "scheduled" ? "Scheduled for" : "Performed on"}
            type="date" value={performedOn} onChange={setPerformedOn}
          />
        </DrawerFieldRow>

        <DrawerField label="Description" value={description} onChange={setDescription} />

        <DrawerFieldRow cols={3}>
          <DrawerField label="Vendor" value={vendor} onChange={setVendor} />
          <DrawerField label="Work order #" value={workOrder} onChange={setWorkOrder} />
          <DrawerField label="Odometer (mi)" type="number" value={odometer} onChange={setOdometer} mono />
        </DrawerFieldRow>

        <DrawerField
          label={isEstimate ? "Estimated cost" : "Cost"}
          type="number" value={cost} onChange={setCost} mono
          hint={isEstimate
            ? "An estimate stays out of the ledger until the work is done."
            : "A completed service with a cost also creates its expense line."}
        />

        <DrawerTextarea label="Notes" value={notes} onChange={setNotes} rows={2} />
      </div>
    </Modal>
  );
}

// ─── Add interval ────────────────────────────────────────────────────────────

function AddIntervalModal({ serviceTypes, trucks, onClose, onSaved, onError }: {
  serviceTypes: string[];
  trucks: TruckItem[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [serviceType,   setServiceType]   = useState("oil_change");
  const [truckId,       setTruckId]       = useState("");
  const [intervalMiles, setIntervalMiles] = useState("30000");
  const [intervalDays,  setIntervalDays]  = useState("365");
  const [lastOn,        setLastOn]        = useState("");
  const [lastOdometer,  setLastOdometer]  = useState("");
  const [warnMiles,     setWarnMiles]     = useState("1000");
  const [warnDays,      setWarnDays]      = useState("7");
  const [saving,        setSaving]        = useState(false);

  const valid = serviceType !== "" && (intervalMiles !== "" || intervalDays !== "");

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      await apiCreateMaintenanceSchedule({
        serviceType,
        truck: truckId ? Number(truckId) : null,
        intervalMiles: intervalMiles ? Number(intervalMiles) : null,
        intervalDays: intervalDays ? Number(intervalDays) : null,
        lastServiceOn: truckId && lastOn ? lastOn : null,
        lastServiceOdometer: truckId && lastOdometer ? Number(lastOdometer) : null,
        alertBeforeMiles: warnMiles ? Number(warnMiles) : null,
        alertBeforeDays: warnDays ? Number(warnDays) : null,
      });
      await onSaved();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not save the interval.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Service Interval"
      subtitle="How often this service should happen."
      width={560}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={!valid || saving}>
            {saving ? "Saving…" : "Save Interval"}
          </Btn>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <DrawerFieldRow cols={2}>
          <DrawerSelect label="Service" value={serviceType} onChange={setServiceType} required>
            {serviceTypes.map((s) => <option key={s} value={s}>{serviceLabel(s)}</option>)}
          </DrawerSelect>
          <DrawerSelect label="Applies to" value={truckId} onChange={setTruckId}>
            <option value="">Whole fleet</option>
            {trucks.map((t) => <option key={t.id} value={String(t.id)}>{t.truck_number ?? `#${t.id}`}</option>)}
          </DrawerSelect>
        </DrawerFieldRow>

        <DrawerFieldRow cols={2}>
          <DrawerField
            label="Every (miles)" type="number" value={intervalMiles} onChange={setIntervalMiles} mono
            hint="Leave blank to track by date only."
          />
          <DrawerField
            label="Every (days)" type="number" value={intervalDays} onChange={setIntervalDays} mono
            hint="Whichever comes first wins."
          />
        </DrawerFieldRow>

        {/* A fleet-wide row is the policy; the history belongs to each
            truck. Offering these fields there invites one odometer to be
            applied to the whole company — the API drops them for the same
            reason. */}
        {truckId === "" ? (
          <p className="text-[11px] text-muted-foreground px-1">
            A fleet-wide interval sets how often, not when it last happened — each truck
            counts from its own last completed service of this type.
          </p>
        ) : (
          <DrawerFieldRow cols={2}>
            <DrawerField label="Last service date" type="date" value={lastOn} onChange={setLastOn} />
            <DrawerField label="Last service odometer" type="number" value={lastOdometer} onChange={setLastOdometer} mono />
          </DrawerFieldRow>
        )}

        <DrawerFieldRow cols={2}>
          <DrawerField label="Warn before (miles)" type="number" value={warnMiles} onChange={setWarnMiles} mono />
          <DrawerField label="Warn before (days)" type="number" value={warnDays} onChange={setWarnDays} mono />
        </DrawerFieldRow>
      </div>
    </Modal>
  );
}
