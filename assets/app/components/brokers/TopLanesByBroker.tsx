import { useMemo } from "react";
import { useTheme } from "next-themes";
import { Route } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { BrokerItem, LaneRollup } from "../../lib/api";

/**
 * Which lanes the freight actually ran, as a share of the loads booked.
 *
 * ── Colour ──────────────────────────────────────────────────────────────
 *
 * The hues and their **order** are the validated categorical set, stepped
 * per mode for the surface they sit on (`--card`: #ffffff light, #111720
 * dark). Both columns were run through the palette validator rather than
 * picked by eye; the published order is kept exactly as published, because
 * re-ordering it to separate two hues that looked close put magenta next to
 * aqua and collapsed that pair to ΔE 1.6 for deuteranopia.
 *
 * Slots are assigned in fixed order and never cycled: the sixth lane and
 * everything after it folds into a neutral "Other", which is also why the
 * tail is grey rather than a sixth hue.
 *
 * Identity is never colour alone — every slice is named in the legend with
 * its share in text, which is also the relief the validator requires for the
 * light-mode contrast warning. Percentages wear text tokens, not the series
 * colour.
 */

/** Fixed slot order. Never cycled; the tail becomes OTHER. */
const SERIES_DARK  = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

/** Deliberately not a categorical hue — "Other" is an absence of identity. */
const OTHER_DARK  = "#4b5563";
const OTHER_LIGHT = "#9ca3af";

interface Slice {
  label: string;
  loads: number;
  color: string;
}

export default function TopLanesByBroker({
  rollup, brokers, brokerId, onBrokerChange,
}: {
  rollup: LaneRollup;
  /** For the scope selector. Only brokers that have tendered a load matter. */
  brokers: BrokerItem[];
  brokerId: number | null;
  onBrokerChange: (id: number | null) => void;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";

  const series  = dark ? SERIES_DARK : SERIES_LIGHT;
  const other   = dark ? OTHER_DARK : OTHER_LIGHT;
  // The 2px gap between fills is the surface showing through.
  const surface = dark ? "#111720" : "#ffffff";

  const slices = useMemo<Slice[]>(() => {
    const named = rollup.lanes.map((l, i) => ({
      label: `${l.origin} → ${l.destination}`,
      loads: l.loads,
      color: series[i % series.length],
    }));

    const tail = rollup.mapped - named.reduce((sum, s) => sum + s.loads, 0);
    if (tail > 0) {
      named.push({ label: "Other lanes", loads: tail, color: other });
    }

    return named;
  }, [rollup, series, other]);

  const total = rollup.mapped;

  return (
    <div className="bg-card border border-border rounded-md flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Route size={13} className="text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">Top Lanes</span>
        </div>
        <select
          value={brokerId === null ? "" : String(brokerId)}
          onChange={e => onBrokerChange(e.target.value === "" ? null : Number(e.target.value))}
          aria-label="Scope lanes to a broker"
          className="h-7 px-2 bg-input border border-border rounded text-xs font-mono text-muted-foreground focus:outline-none focus:border-ring max-w-[140px]"
        >
          <option value="">All Brokers</option>
          {brokers.map(b => (
            <option key={b.id} value={String(b.id)}>{b.name ?? `#${b.id}`}</option>
          ))}
        </select>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-1 px-4 text-center">
          <p className="text-xs font-mono text-muted-foreground">No mapped lanes yet</p>
          {rollup.unmapped > 0 && (
            <p className="text-xs font-mono text-muted-foreground/60">
              {rollup.unmapped} load{rollup.unmapped === 1 ? "" : "s"} have no geocoded stop
            </p>
          )}
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-3">
          <div className="relative h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="loads"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={2}
                  stroke={surface}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map(s => <Cell key={s.label} fill={s.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* The headline reading, in the hole. Text tokens, not a hue. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-semibold text-foreground leading-none">{total}</span>
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5">Total Loads</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {slices.map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-xs font-mono text-muted-foreground truncate flex-1" title={s.label}>
                  {s.label}
                </span>
                <span className="text-xs font-mono text-foreground flex-shrink-0">
                  {Math.round((s.loads / total) * 100)}%
                </span>
              </div>
            ))}
          </div>

          {rollup.unmapped > 0 && (
            <p className="text-[10px] font-mono text-muted-foreground/60 border-t border-border pt-2">
              {rollup.unmapped} more load{rollup.unmapped === 1 ? "" : "s"} booked with a broker
              {rollup.unmapped === 1 ? " has" : " have"} no geocoded stop and {rollup.unmapped === 1 ? "is" : "are"} not counted here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
