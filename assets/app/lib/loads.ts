import type { LoadItem, DriverItem, LoadStopItem } from "./api";

export const LOAD_STATUS_LABEL: Record<string, string> = {
  pending:    "Pending",
  assigned:   "Assigned",
  in_transit: "In Transit",
  delivered:  "Delivered",
  cancelled:  "Cancelled",
};

export const LOAD_STATUS_COLOR: Record<string, string> = {
  pending:    "#f59e0b",
  assigned:   "#0ea5e9",
  in_transit: "#10b981",
  delivered:  "#8b5cf6",
  cancelled:  "#ef4444",
};

export function driverLabel(d: DriverItem | LoadItem["driver"]): string {
  if (!d) return "—";
  const name = [d.first_name, d.last_name].filter(Boolean).join(" ");
  return name || `Driver #${d.id}`;
}

/**
 * The load's lane, as "Dallas, TX → Oklahoma City, OK".
 *
 * Built from the stops, never from `origin`/`destination`: those are a cache
 * of `facility_name ?: address`, so they hold values like "Acme Distribution
 * Center" or a full raw street address. The stops carry `city`/`state`
 * filled from the geocode, and the API orders them by `sequence`, so the
 * lane is the first pickup and the last delivery.
 *
 * Falls back to the old origin → destination text when a stop was never
 * geocoded — a column that used to show something must not start showing
 * nothing. Null only when there is nothing at all to show.
 */
export function laneOf(load: LoadItem): { from: string; to: string; mapped: boolean } | null {
  const stops = load.stops ?? [];

  const pickups    = stops.filter(s => s.type === "pickup");
  const deliveries = stops.filter(s => s.type === "delivery");
  const first = pickups[0] ?? null;
  const last  = deliveries.length ? deliveries[deliveries.length - 1] : null;

  const label = (s: LoadStopItem | null): string | null =>
    s && s.city && s.state ? `${s.city}, ${s.state}` : null;

  const from = label(first);
  const to   = label(last);

  if (from && to) {
    return { from, to, mapped: true };
  }

  if (load.origin || load.destination) {
    return { from: load.origin || "—", to: load.destination || "—", mapped: false };
  }

  return null;
}

/**
 * Rate per mile, as a display string.
 *
 * Null rather than "$0.00" whenever the figure would not mean anything: the
 * rate is absent for a caller without `loads.view_rate`, the load has not
 * been priced, or it has not been routed. "Nobody has measured this" and
 * "this ran for nothing" must not render the same.
 */
export function rpm(rate: number | null | undefined, miles: number | null | undefined): string | null {
  if (rate === null || rate === undefined || rate <= 0) return null;
  if (miles === null || miles === undefined || miles <= 0) return null;

  return `$${(rate / miles).toFixed(2)}`;
}
