import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Package, Truck as TruckIcon, CheckCircle, Clock, Plus, Trash2 } from "lucide-react";
import {
  KpiCard, StatusPill, Btn, ActionsMenu,
} from "../lib/ui";
import {
  apiListLoads, apiDeleteLoad, ApiError, type LoadItem,
} from "../lib/api";
import { formatDate } from "../lib/validators";
import { LOAD_STATUS_LABEL, LOAD_STATUS_COLOR, driverLabel } from "../lib/loads";

export default function Loads() {
  const navigate = useNavigate();

  const [items,        setItems]        = useState<LoadItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleting,     setDeleting]     = useState(false);
  const [toast,        setToast]        = useState<{ ok: boolean; msg: string } | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      setItems(await apiListLoads());
    } catch {
      setError("Failed to load loads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete(l: LoadItem) {
    const label = l.reference_number ?? `load #${l.id}`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiDeleteLoad(l.id);
      await loadData();
      showToast(true, "Load deleted");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const total     = items.length;
  const pending   = items.filter(l => l.status === "pending").length;
  const inTransit = items.filter(l => l.status === "assigned" || l.status === "in_transit").length;
  const delivered = items.filter(l => l.status === "delivered").length;

  const filtered =
      statusFilter === "all"        ? items
    : statusFilter === "pending"    ? items.filter(l => l.status === "pending")
    : statusFilter === "in_transit" ? items.filter(l => l.status === "assigned" || l.status === "in_transit")
    : statusFilter === "delivered"  ? items.filter(l => l.status === "delivered")
    : items;

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs */}
      <div className="flex gap-3">
        <KpiCard label="Total Loads" value={total}     icon={Package}     accent="#6b7e96" active={statusFilter === "all"}        onClick={() => setStatusFilter("all")} />
        <KpiCard label="Pending"     value={pending}   icon={Clock}       accent="#f59e0b" active={statusFilter === "pending"}    onClick={() => setStatusFilter("pending")} />
        <KpiCard label="In Transit"  value={inTransit} icon={TruckIcon}   accent="#10b981" active={statusFilter === "in_transit"} onClick={() => setStatusFilter("in_transit")} />
        <KpiCard label="Delivered"   value={delivered} icon={CheckCircle} accent="#8b5cf6" active={statusFilter === "delivered"}  onClick={() => setStatusFilter("delivered")} />
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
            <span className="text-sm font-medium text-foreground">Loads</span>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{filtered.length}</span>
          </div>
          <Btn variant="primary" onClick={() => navigate("/loads/new")}><Plus size={11} className="inline mr-1" />Add Load</Btn>
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
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Reference", "Route", "Driver", "Pickup", "Delivery", "Rate", "Status", ""].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr
                    key={l.id}
                    onClick={() => navigate(`/loads/${l.id}`)}
                    onKeyDown={e => {
                      // A clickable row still has to be reachable without a
                      // mouse; Enter and Space are what a button would accept.
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/loads/${l.id}`);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Open load ${l.reference_number ?? l.id}`}
                    className="border-b border-border/50 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs font-mono text-primary font-semibold">
                        {l.reference_number ?? `#${l.id}`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground">
                      {l.origin || l.destination ? (
                        <div className="flex items-center gap-1.5">
                          <span>{l.origin || "—"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{l.destination || "—"}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">
                      {l.driver ? driverLabel(l.driver) : <span className="text-muted-foreground">Unassigned</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {l.pickup_date ? formatDate(l.pickup_date) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {l.delivery_date ? formatDate(l.delivery_date) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">
                      {l.rate ? `$${Number(l.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill
                        label={LOAD_STATUS_LABEL[l.status] ?? l.status}
                        color={LOAD_STATUS_COLOR[l.status] ?? "#6b7e96"}
                      />
                    </td>
                    {/* Opening the menu is not opening the load — the row's
                        own click has to stop at this cell. */}
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <ActionsMenu items={[
                        { label: "Delete", onClick: () => handleDelete(l), icon: Trash2, variant: "danger" },
                      ]} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">No loads found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
          <span className="text-xs font-mono text-muted-foreground">Showing {filtered.length} of {total} loads</span>
          {deleting && <span className="text-xs font-mono text-muted-foreground">Deleting…</span>}
        </div>
      </div>
    </div>
  );
}
