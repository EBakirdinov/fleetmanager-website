import { Package, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { StatusPill } from "../../lib/ui";
import { LOAD_STATUS_LABEL, LOAD_STATUS_COLOR } from "../../lib/loads";
import { money } from "../../lib/expenses";
import { formatDate } from "../../lib/validators";
import type { RecentBookedLoad } from "../../lib/api";

/**
 * The last loads booked with a broker, newest first.
 *
 * The compact table idiom — `text-[11px] font-mono`, `border-separate`,
 * tighter cells — copied from the Dashboard's truck aside. Deliberately not
 * the primary-table idiom used by the directory above it: this is a readout
 * somebody glances at, not a grid they work in.
 *
 * `rate` is absent rather than null for a caller without `loads.view_rate`,
 * so the cell checks presence and renders a dash.
 */
export default function RecentLoadsBooked({ loads }: { loads: RecentBookedLoad[] }) {
  return (
    <div className="bg-card border border-border rounded-md flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Package size={13} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Recent Loads Booked</span>
          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{loads.length}</span>
        </div>
        <Link
          to="/loads"
          className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          View All Loads <ArrowRight size={11} />
        </Link>
      </div>

      {loads.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs font-mono text-muted-foreground">
          No loads booked with a broker yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono border-separate border-spacing-0 min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {["Load #", "Pickup", "Delivery", "Broker", "Rate", "Equipment", "Booked By", "Booked On", "Status"].map(h => (
                  <th key={h} className="text-left font-normal px-2 py-1.5 border-b border-border whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loads.map(l => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-2 py-1.5 border-b border-border/50 whitespace-nowrap">
                    <Link to={`/loads/${l.id}`} className="text-primary hover:underline">
                      {l.reference_number || l.broker_load_number || `#${l.id}`}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 border-b border-border/50 text-foreground max-w-[180px] truncate" title={l.origin ?? ""}>
                    {l.origin ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 border-b border-border/50 text-foreground max-w-[180px] truncate" title={l.destination ?? ""}>
                    {l.destination ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 border-b border-border/50 text-foreground whitespace-nowrap">
                    {l.broker_name ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 border-b border-border/50 text-foreground whitespace-nowrap">
                    {"rate" in l ? (money(l.rate) ?? "—") : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-2 py-1.5 border-b border-border/50 text-muted-foreground whitespace-nowrap">
                    {l.trailer_type || l.load_type || "—"}
                  </td>
                  <td className="px-2 py-1.5 border-b border-border/50 text-muted-foreground whitespace-nowrap">
                    {l.booked_by ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 border-b border-border/50 text-muted-foreground whitespace-nowrap">
                    {formatDate(l.booked_on) || "—"}
                  </td>
                  <td className="px-2 py-1.5 border-b border-border/50 whitespace-nowrap">
                    <StatusPill
                      label={LOAD_STATUS_LABEL[l.status] ?? l.status}
                      color={LOAD_STATUS_COLOR[l.status] ?? "#6b7e96"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
