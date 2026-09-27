import {
  emptyPickupForm, pickupFormToStopPayload, type PickupFormState,
} from "./PickupDetailsSection";
import {
  emptyDeliveryForm, deliveryFormToStopPayload, type DeliveryFormState,
} from "./DeliveryDetailsSection";
import type { LoadMapPin } from "./LoadMap";

/**
 * The Add page's stop list — the run as a sequence of calls rather than a
 * fixed pickup-and-delivery pair.
 *
 * A load has always been able to carry any number of stops: `load_stop` is an
 * ordered collection with a `sequence` column, and the load's own origin,
 * destination, pickup date and delivery date are cached from the first pickup
 * and the last delivery. Only the form was a pair. This module is the list
 * the form now edits, kept out of the page so LoadAdd stays a layout file.
 *
 * Two rules hold the list together:
 *
 *   • Pickups come before deliveries. A new pickup lands after the last
 *     pickup, a new delivery at the end. Nothing stops a real run from
 *     interleaving them, but a dispatcher building a multi-stop load is
 *     describing "collect these, then drop these", and grouping keeps the
 *     first-pickup / last-delivery reading behind the cached columns honest.
 *   • The ends stay. The first pickup and the last delivery are where the run
 *     starts and finishes, so neither offers a Remove button — they are what
 *     the map routes between and what the KPI strip measures.
 */

export type StopKind = "pickup" | "delivery";

/**
 * One card on the page. `key` is a client-side handle: it keys the React
 * list, the pin map and the weather map, and is never sent to the API — the
 * stop's identity on the server is its row id, which it does not have yet.
 */
export type StopEntry =
  | { key: string; kind: "pickup";   form: PickupFormState }
  | { key: string; kind: "delivery"; form: DeliveryFormState };

let keySeq = 0;
const freshKey = (): string => `stop-${++keySeq}`;

export function newStop(kind: StopKind): StopEntry {
  return kind === "pickup"
    ? { key: freshKey(), kind: "pickup",   form: emptyPickupForm() }
    : { key: freshKey(), kind: "delivery", form: emptyDeliveryForm() };
}

/** What a fresh page starts as: one pickup, one delivery. */
export const initialStops = (): StopEntry[] => [newStop("pickup"), newStop("delivery")];

// ─── List operations ─────────────────────────────────────────────────────────

/**
 * Insert a stop of the given kind, keeping pickups ahead of deliveries: a
 * pickup slots in behind the last existing pickup, a delivery goes on the end.
 */
export function addStop(stops: StopEntry[], kind: StopKind): StopEntry[] {
  const entry = newStop(kind);
  if (kind === "delivery") return [...stops, entry];

  let at = 0;
  stops.forEach((s, i) => { if (s.kind === "pickup") at = i + 1; });

  return [...stops.slice(0, at), entry, ...stops.slice(at)];
}

export function removeStop(stops: StopEntry[], key: string): StopEntry[] {
  return stops.filter(s => s.key !== key);
}

/**
 * A stop can go if it isn't the last of its kind — a load with no pickup has
 * no origin, and one with no delivery has nowhere to go.
 */
export function canRemove(stops: StopEntry[], key: string): boolean {
  const entry = stops.find(s => s.key === key);
  if (!entry) return false;

  return stops.filter(s => s.kind === entry.kind).length > 1;
}

/** Merge a section's `onChange` patch into the stop it came from. */
export function patchStopForm(
  stops: StopEntry[],
  key:   string,
  patch: Partial<PickupFormState> | Partial<DeliveryFormState>,
): StopEntry[] {
  return stops.map(s =>
    s.key === key ? ({ ...s, form: { ...s.form, ...patch } } as StopEntry) : s);
}

// ─── The two ends ────────────────────────────────────────────────────────────

/**
 * Where the run starts and finishes. Everything the page routes, ranks and
 * measures reads these two and nothing else: §1's KPI strip, the deadhead leg
 * and the dispatch suggestions all ask about origin and destination, and a
 * stop in the middle changes neither.
 */
export function firstPickup(stops: StopEntry[]): StopEntry | null {
  return stops.find(s => s.kind === "pickup") ?? null;
}

export function lastDelivery(stops: StopEntry[]): StopEntry | null {
  for (let i = stops.length - 1; i >= 0; i--) {
    if (stops[i].kind === "delivery") return stops[i];
  }

  return null;
}

// ─── Naming ──────────────────────────────────────────────────────────────────

/**
 * "Pickup" while there is one, "Pickup 2" once there are several — a number
 * on a card that has no sibling to be distinguished from is just noise.
 */
export function stopShortLabel(stops: StopEntry[], index: number): string {
  const entry = stops[index];
  const base  = entry.kind === "pickup" ? "Pickup" : "Delivery";

  const sameKind = stops.filter(s => s.kind === entry.kind);
  if (sameKind.length < 2) return base;

  return `${base} ${sameKind.findIndex(s => s.key === entry.key) + 1}`;
}

/** The section heading: the short label plus the word every card carries. */
export function stopTitle(stops: StopEntry[], index: number): string {
  return `${stopShortLabel(stops, index)} Details`;
}

// ─── Payload ─────────────────────────────────────────────────────────────────

/**
 * The `stops` array of a load POST.
 *
 * Sequence is stamped here from list order rather than inside the per-card
 * builders: position is a property of the list, and the same builders are
 * used by the control page to PATCH one stop in place, where sending a
 * position would move the stop as a side effect of editing a phone number.
 *
 * The backend renumbers these 1..N again in LoadManager::normalizeStops, so a
 * disagreement is settled there rather than at the unique index on
 * (load_id, sequence).
 *
 * Coordinates ride along because the page already has them: every pin on the
 * map is a geocode this form paid for while the dispatcher typed. Sending
 * them means the load's detail page can draw its map and pull its forecasts
 * the moment it opens, instead of the backend buying the same answers a
 * second time — the stop's own docblock allows for exactly this, a client
 * that geocoded ahead of the save.
 */
export function stopsToPayload(
  stops: StopEntry[],
  pins:  Record<string, LoadMapPin | null> = {},
): Record<string, unknown>[] {
  return stops.map((entry, i) => {
    const pin = pins[entry.key] ?? null;

    return {
      ...(entry.kind === "pickup"
        ? pickupFormToStopPayload(entry.form)
        : deliveryFormToStopPayload(entry.form)),
      sequence:  i + 1,
      latitude:  pin ? pin.lat : null,
      longitude: pin ? pin.lng : null,
    };
  });
}

/**
 * Enough of a load to save.
 *
 * An address at each end and nothing else: the columns are all nullable and
 * the backend states no constraints, so anything more would be this form
 * inventing requirements. But a load whose ends are blank has no origin and
 * no destination — it would come back from the list page as a nameless row.
 */
export function canCreateLoad(stops: StopEntry[]): boolean {
  const from = firstPickup(stops);
  const to   = lastDelivery(stops);

  return !!from && !!to
    && from.form.address.trim() !== ""
    && to.form.address.trim()   !== "";
}
