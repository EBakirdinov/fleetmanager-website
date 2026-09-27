import { useState } from "react";
import { Building2, Flag, Hash, Loader2, Phone, Store, User } from "lucide-react";
import { apiGeocode, type GeocodeResult } from "../../lib/api";
import { maskPhone } from "../../lib/masks";
import AddressAutocomplete from "./AddressAutocomplete";
import {
  SectionCard, Row, Cell, TextCell, DateCell, TimeCell, TimeRangeCell,
  TextareaCell, ChoiceCell,
} from "../../lib/cells";
import { RemoveStopButton } from "./PickupDetailsSection";
import type { LoadMapPin } from "./LoadMap";

/**
 * Section 3 — Delivery Details (controlled).
 *
 * Same treatment as Pickup, and deliberately the same row order so the two
 * cards read as a matched pair when stacked one under the other:
 *
 *   Facility Name  | Address (autocomplete)        | Delivery Date
 *   Scheduling     | Delivery Window ↔ Appointment | POD Required
 *   Contact Person | Phone                         | Store / DC #
 *   Reference #
 *   Delivery Instructions (own row)
 *
 * Receivers book docks the same two ways shippers do, so Scheduling works
 * exactly as it does on Pickup: ticking "By Appointment" collapses the
 * Delivery Window into a single Appointment Time, stored in the same
 * windowStart slot with windowEnd nulled on save.
 *
 * No Receiver Hours and no manual ETA here: the arrival estimate the
 * dispatcher actually reads is the computed "ETA to Delivery" in Section 1's
 * strip, and a second hand-typed one only drifts from it. The load_stop
 * columns (hours_start/hours_end, eta) still exist — Pickup's Facility Hours
 * uses the first pair — this card just doesn't surface them.
 *
 * Address blur → apiGeocode → pin fed up via onGeocode for Section 1's map.
 */

export interface DeliveryFormState {
  facilityName:  string;
  date:          string; // YYYY-MM-DD
  address:       string;
  /** HH:MM. Doubles as the appointment time when schedulingType is "appointment". */
  windowStart:   string;
  windowEnd:     string;
  contactPerson: string;
  phone:         string;
  instructions:  string;
  reference:     string;
  podRequired:   boolean;
  storeDc:       string;
  schedulingType: string; // "" | "fcfs" | "appointment"
}

export const emptyDeliveryForm = (): DeliveryFormState => ({
  facilityName: "", date: "",
  address: "",
  windowStart: "", windowEnd: "",
  contactPerson: "",
  phone: "", instructions: "",
  reference: "", podRequired: false,
  storeDc: "", schedulingType: "",
});

/**
 * Compose local state into the LoadStop payload the backend form expects.
 *
 * An appointment has no end bound, so windowEnd is sent as null regardless of
 * what the range inputs still hold — otherwise a value the user can no longer
 * see would keep being written back.
 *
 * No `sequence` here either — see pickupFormToStopPayload for why the stop's
 * position is the list's business rather than the card's.
 */
export function deliveryFormToStopPayload(f: DeliveryFormState): Record<string, unknown> {
  const byAppointment = f.schedulingType === "appointment";

  return {
    type:           "delivery",
    facilityName:   f.facilityName  || null,
    date:           f.date          || null,
    address:        f.address       || null,
    windowStart:    f.windowStart   || null,
    windowEnd:      byAppointment ? null : (f.windowEnd || null),
    contactPerson:  f.contactPerson || null,
    phone:          f.phone         || null,
    instructions:   f.instructions  || null,
    reference:      f.reference     || null,
    podRequired:    f.podRequired,
    storeDc:        f.storeDc       || null,
    schedulingType: f.schedulingType || null,
  };
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function DeliveryDetailsSection({
  value, onChange, onGeocode, sectionNumber = 3, title = "Delivery Details", onRemove,
}: {
  value:     DeliveryFormState;
  onChange:  (patch: Partial<DeliveryFormState>) => void;
  /** Fired on address blur/select with the geocode result (or null). */
  onGeocode?: (result: LoadMapPin | null) => void;
  /** Numbered and named by the page — a multi-drop load renders this card once
   *  per delivery, each at its own number. */
  sectionNumber?: number;
  title?:         string;
  /** Present only on deliveries the run can do without; the last one stays. */
  onRemove?: () => void;
}) {
  const isAppointment = value.schedulingType === "appointment";
  const [geocoding,    setGeocoding]    = useState(false);
  const [lastGeocoded, setLastGeocoded] = useState<string>("");

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
      color="#ef4444"
      title={title}
      icon={Flag}
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
                geocodeAddress(address);
              }}
            />
          </div>
        </Cell>
        <DateCell
          label="Delivery Date" value={value.date}
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
            label="Delivery Window"
            start={value.windowStart} end={value.windowEnd}
            onChangeStart={v => onChange({ windowStart: v })}
            onChangeEnd={v   => onChange({ windowEnd:   v })}
          />
        )}
        <ChoiceCell
          label="POD Required"
          value={value.podRequired ? "yes" : "no"}
          options={[
            { value: "no",  label: "No", tone: "neutral" },
            { value: "yes", label: "Yes" },
          ]}
          clearable={false}
          onChange={v => onChange({ podRequired: v === "yes" })}
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
          label="Store / DC #" value={value.storeDc} mono icon={Store}
          placeholder="Store or DC number"
          onChange={v => onChange({ storeDc: v })}
        />
      </Row>

      <Row cols={3}>
        <TextCell
          label="Reference #" value={value.reference} mono icon={Hash}
          placeholder="PO / BOL number"
          onChange={v => onChange({ reference: v })}
        />
      </Row>

      {/* The one multi-line field gets its own row. Beside a single-line input
          it was the only thing setting the row's height, and left a hole under
          whatever sat next to it. */}
      <Row cols={1}>
        <TextareaCell
          label="Delivery Instructions"
          value={value.instructions}
          placeholder="Gate code, dock notes, driver requirements…"
          onChange={v => onChange({ instructions: v })}
        />
      </Row>
    </SectionCard>
  );
}
