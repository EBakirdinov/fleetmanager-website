import { useEffect, useState } from "react";
import { apiRoute, apiGetFleetLocations, type RouteSummary } from "../../lib/api";
import type { LoadMapPin } from "./LoadMap";

/**
 * Section 1's KPI strip: the routed figures, and the reading each one gets.
 *
 * The backend returns one object covering the whole strip (RoutingService),
 * so there is a single request behind all six cells rather than one per cell.
 * Everything here is formatting — what the strip shows is decided by what the
 * route call could compute, not by this module.
 *
 * Shared by the Add page and the control page: both render the same strip from
 * the same endpoint, and a second copy would be a second place to drift.
 */

export interface RouteKpis {
  emptyMiles:    string | null;
  loadedMiles:   string | null;
  totalMiles:    string | null;
  totalDuration: string | null;
  etaToPickup:   string | null;
  etaToDelivery: string | null;

  /** Second lines: each leg's share of the trip, and when an ETA lands. */
  emptyShare:    string | null;
  loadedShare:   string | null;
  etaPickupAt:   string | null;
  etaDeliveryAt: string | null;

  /**
   * How the figures were arrived at, or null while there is no answer yet.
   *
   * The strip prints this rather than leaving it implicit: `estimated` means
   * straight-line distance at an assumed speed, 15–25% under real road
   * miles, and a reader cannot tell that from the numbers themselves.
   */
  source:        RouteSummary["source"] | null;

  /**
   * Which provider produced the figures, named by the integration catalog.
   * Null under the estimate — there was no provider to name.
   */
  provider:      string | null;
}

/**
 * What every estimated figure says for itself. One constant rather than three
 * copies: this line appears beside the KPI strip, the RPM cells and the Rate
 * & Cost header, and three wordings of the same caveat read as three
 * different caveats.
 *
 * It names the fix rather than the arithmetic — how far off the number is
 * matters less to the reader than what to switch on to stop seeing it.
 */
export const ESTIMATED_NOTE = "Approximate — enable Google APIs for exact mileage";

export const EMPTY_KPIS: RouteKpis = {
  emptyMiles: null, loadedMiles: null, totalMiles: null, totalDuration: null,
  etaToPickup: null, etaToDelivery: null,
  emptyShare: null, loadedShare: null, etaPickupAt: null, etaDeliveryAt: null,
  source: null, provider: null,
};

export function toRouteKpis(r: RouteSummary | null): RouteKpis {
  if (!r) return EMPTY_KPIS;

  return {
    emptyMiles:    r.empty_miles == null ? null : formatMiles(r.empty_miles),
    loadedMiles:   formatMiles(r.loaded_miles),
    totalMiles:    formatMiles(r.total_miles),
    totalDuration: formatDuration(r.duration_sec),
    etaToPickup:   r.eta_pickup_sec == null ? null : formatDuration(r.eta_pickup_sec),
    etaToDelivery: formatDuration(r.eta_delivery_sec),

    emptyShare:    share(r.empty_miles, r.total_miles),
    loadedShare:   share(r.loaded_miles, r.total_miles),
    etaPickupAt:   r.eta_pickup_sec == null ? null : formatArrival(r.eta_pickup_sec),
    etaDeliveryAt: formatArrival(r.eta_delivery_sec),

    source:        r.source,
    provider:      r.provider ?? null,
  };
}

function formatMiles(mi: number): string {
  return `${Math.round(mi).toLocaleString()} mi`;
}

/**
 * "4h 20m" up to a day, "1d 8h" beyond it. Past a day the minutes are noise —
 * nobody plans a two-day run to the minute — and dropping them keeps the cell
 * to one line.
 */
function formatDuration(sec: number): string {
  const totalMin = Math.round(sec / 60);
  const days     = Math.floor(totalMin / 1440);
  const hours    = Math.floor((totalMin % 1440) / 60);
  const minutes  = totalMin % 60;

  if (days > 0)  return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Where a duration lands on the clock, counted from now — the question a
 * dispatcher actually asks of an ETA ("so what time does he get there?").
 */
function formatArrival(sec: number): string {
  const at = new Date(Date.now() + sec * 1000);
  // Composed from the two halves rather than one toLocaleString: that inserts
  // a comma before the time ("Sep 17, 2026, 8:45 PM"), which reads as a third
  // list item instead of a timestamp.
  const day  = at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return `${day} ${time}`;
}

/** A leg's share of the trip. Silent when there is no trip to take a share of. */
function share(leg: number | null, total: number): string | null {
  if (leg == null || total <= 0) return null;

  return `${Math.round((leg / total) * 100)}% of total`;
}

// ─── Fetching ────────────────────────────────────────────────────────────────

/**
 * Route the load as it currently stands.
 *
 * Takes every stop in order, not just the ends: a load that collects, calls
 * somewhere in the middle and then delivers does not travel the direct line
 * between its first and last address, and the strip is where its mileage is
 * read off.
 *
 * All of them have to be pinned before there is anything to ask. Routing the
 * ones that happen to be geocoded would answer with a shorter trip than the
 * load is taking and show it as though it were the real figure — so a stop
 * still waiting on its address keeps the strip empty, and the hint under the
 * cells says which. A truck adds the deadhead leg, which is the only way
 * Deadhead and ETA to Pickup can be filled in at all.
 *
 * Returns null while there is nothing to show, including when the map
 * integration is off: apiRoute answers 404 there and the hook stays quiet
 * rather than surfacing an error over a form the user is still filling in.
 */
export function useRouteSummary(
  stops:  (LoadMapPin | null | undefined)[],
  truck?: LoadMapPin | null,
): RouteSummary | null {
  const [summary, setSummary] = useState<RouteSummary | null>(null);

  const tLat = truck?.lat, tLng = truck?.lng;

  // The stop list is rebuilt on every render, so its identity is useless as a
  // dependency. Collapse it to the only thing the request depends on.
  const stopsKey = stops
    .map(s => (s?.lat == null || s?.lng == null ? "" : `${s.lat},${s.lng}`))
    .join("|");

  useEffect(() => {
    const coords = stopsKey.split("|");
    if (coords.length < 2 || coords.some(c => c === "")) {
      setSummary(null);
      return;
    }

    const routeStops = coords.map(c => {
      const [lat, lng] = c.split(",");
      return { lat: Number(lat), lng: Number(lng) };
    });

    let cancelled = false;
    // Debounced: an address typed a character at a time would otherwise bill
    // a routing request per keystroke once the stops are geocoded.
    const timer = setTimeout(() => {
      apiRoute(routeStops, tLat != null && tLng != null ? { lat: tLat, lng: tLng } : null)
        .then(r => { if (!cancelled) setSummary(r); })
        .catch(() => { if (!cancelled) setSummary(null); });
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [stopsKey, tLat, tLng]);

  return summary;
}

/**
 * Where the assigned driver's truck is right now, from the fleet location
 * cache — the pin Section 1 draws for the truck and the origin of the
 * deadhead leg.
 *
 * Matched on truck number where we have one, falling back to driver name:
 * the Add page knows the truck from the assignment suggestion, while the
 * control page only knows who is driving.
 *
 * Silent on failure. Locations come from the ELD integration, so a fleet
 * without one simply has no truck pin, which is not an error state.
 */
export function useTruckPin(
  truckNumber: string | null | undefined,
  driverName?: string | null,
): LoadMapPin | null {
  const [pin, setPin] = useState<LoadMapPin | null>(null);

  useEffect(() => {
    if (!truckNumber && !driverName) { setPin(null); return; }

    let cancelled = false;
    apiGetFleetLocations()
      .then(items => {
        if (cancelled) return;
        const match = items.find(i =>
          (truckNumber && i.truckNumber === truckNumber)
          || (!truckNumber && driverName && i.driverName === driverName));
        setPin(match
          ? { lat: match.lat, lng: match.lng, label: match.truckNumber ?? match.driverName ?? "Truck" }
          : null);
      })
      .catch(() => { if (!cancelled) setPin(null); });

    return () => { cancelled = true; };
  }, [truckNumber, driverName]);

  return pin;
}
