import { useMemo } from "react";
import { Gauge } from "lucide-react";
import { money, num } from "../../lib/expenses";
import type { BrokerItem, BrokerSummaryRow } from "../../lib/api";

/**
 * Who is actually worth hauling for, ranked.
 *
 * Three of the four figures here did not exist before this panel: total paid
 * and average payment time come from the broker_payment ledger, and the
 * on-time rate from `load.delivered_at`. All three accrue forward — the
 * component shows a dash where there is nothing yet rather than a zero, since
 * "has never been measured" and "measured at zero" are different claims.
 *
 * The A/R columns are **absent** from the payload for a caller without
 * `billing.view_invoices`, so presence is checked on the rows, never
 * truthiness.
 */

/** Good / warning / serious, reserved status colours — never a series hue. */
function onTimeColor(pct: number): string {
  if (pct >= 95) return "#10b981";
  if (pct >= 85) return "#f59e0b";
  return "#ef4444";
}

interface Row {
  id: number;
  name: string;
  loads: number;
  revenue: string | null;
  totalPaid: string | null;
  outstanding: string | null;
  avgPayDays: number | null;
  onTimePct: number | null;
  onTimeOf: number;
}

export default function BrokerPerformance({
  brokers, summary, showAr,
}: {
  brokers: BrokerItem[];
  summary: Record<string, BrokerSummaryRow>;
  /** True when the payload carried A/R at all — drives the column's presence. */
  showAr: boolean;
}) {
  const rows = useMemo<Row[]>(() => {
    return brokers
      .map(b => {
        const s = summary[String(b.id)];
        if (!s || s.loads === 0) return null;

        return {
          id: b.id,
          name: b.name ?? `#${b.id}`,
          loads: s.loads,
          revenue: s.revenue ?? null,
          totalPaid: s.total_paid ?? null,
          outstanding: s.outstanding ?? null,
          avgPayDays: s.avg_pay_days ?? null,
          onTimePct: s.on_time_pct ?? null,
          onTimeOf: s.on_time_of ?? 0,
        } as Row;
      })
      .filter((r): r is Row => r !== null)
      .sort((a, b) => b.loads - a.loads);
  }, [brokers, summary]);

  return (
    <div className="bg-card border border-border rounded-md flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Gauge size={13} className="text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Broker Performance</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-10 px-4 text-center text-xs font-mono text-muted-foreground">
          No broker has tendered a load yet
        </div>
      ) : (
        <div className="p-3 flex flex-col gap-3">
          {rows.map(r => (
            <div key={r.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-foreground truncate" title={r.name}>{r.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                  {r.loads} load{r.loads === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {figuresFor(r, showAr).map(f => (
                  <Figure key={f.label} label={f.label} value={f.value} />
                ))}
              </div>

              {/* The on-time bar. Track plus fill, the idiom this app did not
                  have yet; the numeral beside it carries the value so the
                  colour is never the only encoding. */}
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[10px] font-mono text-muted-foreground w-12 flex-shrink-0">On time</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  {r.onTimePct !== null && (
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${r.onTimePct}%`, backgroundColor: onTimeColor(r.onTimePct) }}
                    />
                  )}
                </div>
                <span className="text-[10px] font-mono text-foreground w-14 text-right flex-shrink-0">
                  {r.onTimePct !== null ? `${num(r.onTimePct, 0)}%` : "—"}
                </span>
              </div>
              {r.onTimePct !== null && (
                <span className="text-[10px] font-mono text-muted-foreground/50 pl-14">
                  over {r.onTimeOf} recorded deliver{r.onTimeOf === 1 ? "y" : "ies"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Which figures a row shows.
 *
 * Without `billing.view_invoices` the payload carries no A/R at all, so the
 * panel falls back to booked revenue alone rather than rendering four dashes.
 */
function figuresFor(r: Row, showAr: boolean): Array<{ label: string; value: string | null }> {
  if (!showAr) {
    return [{ label: "Revenue", value: money(r.revenue) }];
  }

  return [
    { label: "Paid",        value: money(r.totalPaid) },
    { label: "Revenue",     value: money(r.revenue) },
    { label: "Outstanding", value: r.outstanding && Number(r.outstanding) > 0 ? money(r.outstanding) : null },
    { label: "Avg pay",     value: r.avgPayDays !== null ? `${num(r.avgPayDays, 1)} days` : null },
  ];
}

/** One labelled figure. A dash means "not measured", never "zero". */
function Figure({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
      <span className="text-[10px] font-mono text-foreground">
        {value ?? <span className="text-muted-foreground/50">—</span>}
      </span>
    </div>
  );
}
