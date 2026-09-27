import { useState } from "react";
import { Building2, Hash, Loader2, PackageOpen, Phone, User, X } from "lucide-react";
import { apiGeocode, type GeocodeResult } from "../../lib/api";
import { maskPhone } from "../../lib/masks";
import AddressAutocomplete from "./AddressAutocomplete";
import {
  SectionCard, Row, Cell, TextCell, DateCell, TimeCell, TimeRangeCell,
  ChoiceCell, SECTION_LEAD_PX,
} from "../../lib/cells";
import type { LoadMapPin } from "./LoadMap";

/**
 * Section 2 — Pickup Details (controlled).
 *
 * The card runs the full page width, so its fields sit three to a row and are
 * grouped by what they answer: where it is, when it's booked, who to call.
 *
 *   Facility Name | Address (autocomplete)      | Pickup Date
 *   Scheduling    | Pickup Window ↔ Appointment | Facility Hours
 *   Contact Person| Phone                       | Reference #
 *
 * An even three-by-three: nine fields, three to a row, so every column edge
 * lines up the whole way down instead of stepping in and out per row.
 *
 * Scheduling sits next to the field it governs because it changes that field's
 * shape: an appointment is a single time, a window is a pair of bounds. Ticking
 * "By Appointment" swaps the Pickup Window range for one Appointment Time,
 * stored in the same windowStart slot — scheduling_type is what tells a reader
 * how to interpret it. windowEnd is left alone in local state so unticking
 * restores the bound the dispatcher already typed; only the payload nulls it.
 *
 * On address blur (or prediction pick) we call apiGeocode and hand the pin up
 * via onGeocode so Section 1's map can render it without waiting for save.
 */

export interface PickupFormState {
  facilityName:   string;
  date:           string; // YYYY-MM-DD
  address:        string;
  /** HH:MM. Doubles as the appointment time when schedulingType is "appointment". */
  windowStart:    string;
  windowEnd:      string;
  contactPerson:  string;
  hoursStart:     string;
  hoursEnd:       string;
  phone:          string;
  schedulingType: string; // "" | "fcfs" | "appointment"
  reference:      string;
}

export const emptyPickupForm = (): PickupFormState => ({
  facilityName: "",   date: "",
  address:      "",
  windowStart:  "",   windowEnd: "",
  contactPerson:"",   hoursStart: "",
  hoursEnd:     "",   phone: "",
  schedulingType: "", reference: "",
});

/**
 * Serialize local form state to the LoadStop payload shape the backend
 * expects. Empty fields go as null so Symfony's nullable columns stay null.
 *
 * An appointment has no end bound, so windowEnd is sent as null regardless of
 * what the range inputs still hold — otherwise a value the user can no longer
 * see would keep being written back.
 *
 * No `sequence`: a stop's position belongs to the load's stop list, not to
 * this card's field set. The Add page stamps it in stopsToPayload (stops.ts)
 * from the list order; a per-section PATCH from the control page omits the
 * key entirely and leaves the stored position alone — which it has to, since
 * load_stop is unique on (load_id, sequence) and a fixed 1 here would drag
 * the third stop of a run on top of the first.
 */
export function pickupFormToStopPayload(f: PickupFormState): Record<string, unknown> {
  const byAppointment = f.schedulingType === "appointment";

  return {
    type:            "pickup",
    facilityName:    f.facilityName   || null,
    date:            f.date           || null,
    address:         f.address        || null,
    windowStart:     f.windowStart    || null,
    windowEnd:       byAppointment ? null : (f.windowEnd || null),
    contactPerson:   f.contactPerson  || null,
    hoursStart:      f.hoursStart     || null,
    hoursEnd:        f.hoursEnd       || null,
    phone:           f.phone          || null,
    schedulingType:  f.schedulingType || null,
    reference:       f.reference      || null,
  };
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function PickupDetailsSection({
  value, onChange, onGeocode, sectionNumber = 2, title = "Pickup Details", onRemove,
}: {
  value:     PickupFormState;
  onChange:  (patch: Partial<PickupFormState>) => void;
  /** Fired on address blur with the geocode result (or null on failure). */
  onGeocode?: (result: LoadMapPin | null) => void;
  /**
   * Numbered and named by the page, which owns the sequence: a load with
   * three pickups renders this card three times, at three different numbers
   * and under three different headings.
   */
  sectionNumber?: number;
  title?:         string;
  /**
   * Offered only for stops the load can do without — the first pickup and the
   * last delivery are the run's two ends and stay put. Absent, no button.
   */
  onRemove?: () => void;
}) {
  const isAppointment = value.schedulingType === "appointment";
  const [geocoding,     setGeocoding]     = useState(false);
  const [lastGeocoded,  setLastGeocoded]  = useState<string>("");

  // Fire a geocode for the given address string — used both when the user
  // picks a prediction from the autocomplete dropdown AND on textarea blur
  // (for free-typed addresses that never triggered a suggestion select).
  // Guard: skip if the trimmed address is unchanged since the last call.
  async function geocodeAddress(address: string) {
    if (!onGeocode) return;
    const trimmed = address.trim();
    if (trimmed === lastGeocoded) return;
    setLastGeocoded(trimmed);
    if (!trimmed) { onGeocode(null); return; }
    setGeocoding(true);
    try {
      const res: GeocodeResult | null = await apiGeocode(trimmed);
      onGeocode(res ? { lat: res.lat, lng: res.lng, label: value.facilityName || res.formatted } : null);
    } catch {
      onGeocode(null);
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <SectionCard
      n={sectionNumber}
      color="#10b981"
      title={title}
      icon={PackageOpen}
      collapsible
      meta={
        <>
          {geocoding && (
            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 flex-shrink-0">
              <Loader2 size={11} className="animate-spin" /> Locating…
            </span>
          )}
          {onRemove && <RemoveStopButton onClick={onRemove} />}
        </>
      }
    >
      <Row cols={3}>
        <TextCell
          label="Facility Name" value={value.facilityName} icon={Building2}
          placeholder="Warehouse or DC name"
          onChange={v => onChange({ facilityName: v })}
        />
        <Cell boxed={false}>
          <div onBlur={() => geocodeAddress(value.address)}>
            <AddressAutocomplete
              bare
              label="Address"
              value={value.address}
              onChange={v => onChange({ address: v })}
              onSelect={address => {
                onChange({ address });
                // Prediction pick → geocode with the fresh string (bypasses
                // the value.address closure which hasn't updated yet).
                geocodeAddress(address);
              }}
            />
          </div>
        </Cell>
        <DateCell
          label="Pickup Date" value={value.date}
          onChange={v => onChange({ date: v })}
        />
      </Row>

      <Row cols={3}>
        <ChoiceCell
          label="Scheduling"
          value={value.schedulingType}
          options={[
            { value: "fcfs",        label: "FCFS" },
            { value: "appointment", label: "By Appointment" },
          ]}
          onChange={v => onChange({ schedulingType: v })}
        />
        {isAppointment ? (
          <TimeCell
            label="Appointment Time" value={value.windowStart}
            onChange={v => onChange({ windowStart: v })}
          />
        ) : (
          <TimeRangeCell
            label="Pickup Window"
            start={value.windowStart} end={value.windowEnd}
            onChangeStart={v => onChange({ windowStart: v })}
            onChangeEnd={v   => onChange({ windowEnd:   v })}
          />
        )}
        <TimeRangeCell
          label="Facility Hours"
          start={value.hoursStart} end={value.hoursEnd}
          onChangeStart={v => onChange({ hoursStart: v })}
          onChangeEnd={v   => onChange({ hoursEnd:   v })}
        />
      </Row>

      <Row cols={3}>
        <TextCell
          label="Contact Person" value={value.contactPerson} icon={User}
          placeholder="Full name"
          onChange={v => onChange({ contactPerson: v })}
        />
        <TextCell
          label="Phone" type="tel" value={value.phone} mono icon={Phone}
          placeholder="(555) 123-4567"
          onChange={v => onChange({ phone: maskPhone(v) })}
        />
        <TextCell
          label="Reference #" value={value.reference} mono icon={Hash}
          placeholder="PO / BOL number"
          onChange={v => onChange({ reference: v })}
        />
      </Row>
    </SectionCard>
  );
}

/**
 * Drop this stop from the run.
 *
 * Shaped like RateCostSection's "Add Accessorial" and for the same reasons:
 * pinned to SECTION_LEAD_PX so it sits inside the header band rather than
 * stretching it, and stopping propagation so removing a stop doesn't also
 * fold the card it lives in shut on the way out.
 */
export function RemoveStopButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ height: SECTION_LEAD_PX }}
      className="flex items-center gap-1 flex-shrink-0 px-2 leading-none rounded-md border border-red-500/30
                 text-red-400 text-xs font-medium cursor-pointer
                 hover:bg-red-500/10 hover:border-red-500/50 transition-colors
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
    >
      <X size={12} /> <span className="hidden sm:inline">Remove</span>
    </button>
  );
}
