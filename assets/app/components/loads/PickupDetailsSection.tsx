import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiGeocode, type GeocodeResult } from "../../lib/api";
import { maskPhone } from "../../lib/masks";
import AddressAutocomplete from "./AddressAutocomplete";
import {
  SectionCard, Row, Cell, TextCell, DateCell, TimeRangeCell, DateTimeCell,
  ChoiceCell,
} from "../../lib/cells";
import type { LoadMapPin } from "./LoadMap";

/**
 * Section 2 — Pickup Details (controlled).
 *
 * Rendered as a spec sheet: hairline-divided cells, borderless values, one
 * record per row. Fields are grouped by what they answer rather than by the
 * old 2-column fill order — where (facility, address), when (window, hours),
 * who (contact, phone), and how it's booked (scheduling, reference).
 *
 *   Facility Name       | Pickup Date
 *   Address (full width, autocomplete)
 *   Pickup Window       | Facility Hours
 *   Contact Person      | Phone
 *   Scheduling          | Reference #
 *   Confirmed On        | Confirmed By        ← Appointment only
 *
 * Scheduling is a segmented FCFS/Appointment control; picking Appointment
 * reveals the confirmation row. On address blur (or prediction pick) we call
 * apiGeocode and hand the pin up via onGeocode so Section 1's map can render
 * it without waiting for save.
 */

export interface PickupFormState {
  facilityName:   string;
  date:           string; // YYYY-MM-DD
  address:        string;
  windowStart:    string; // HH:MM
  windowEnd:      string;
  contactPerson:  string;
  hoursStart:     string;
  hoursEnd:       string;
  phone:          string;
  schedulingType: string; // "" | "fcfs" | "appointment"
  reference:      string;
  confirmedDate:  string; // YYYY-MM-DD
  confirmedTime:  string; // HH:MM
  confirmedBy:    string;
}

export const emptyPickupForm = (): PickupFormState => ({
  facilityName: "",   date: "",
  address:      "",
  windowStart:  "",   windowEnd: "",
  contactPerson:"",   hoursStart: "",
  hoursEnd:     "",   phone: "",
  schedulingType: "", reference: "",
  confirmedDate:"",   confirmedTime: "",
  confirmedBy:  "",
});

/**
 * Serialize local form state to the LoadStop payload shape the backend
 * expects. Confirm date + time compose into a single "YYYY-MM-DDTHH:MM"
 * string; empty fields go as null so Symfony's nullable columns stay null.
 */
export function pickupFormToStopPayload(f: PickupFormState): Record<string, unknown> {
  const confirmedOn = f.confirmedDate || f.confirmedTime
    ? `${f.confirmedDate || "1970-01-01"}T${f.confirmedTime || "00:00"}`
    : null;

  return {
    type:            "pickup",
    sequence:        1,
    facilityName:    f.facilityName   || null,
    date:            f.date           || null,
    address:         f.address        || null,
    windowStart:     f.windowStart    || null,
    windowEnd:       f.windowEnd      || null,
    contactPerson:   f.contactPerson  || null,
    hoursStart:      f.hoursStart     || null,
    hoursEnd:        f.hoursEnd       || null,
    phone:           f.phone          || null,
    schedulingType:  f.schedulingType || null,
    reference:       f.reference      || null,
    confirmedOn,
    confirmedBy:     f.confirmedBy    || null,
  };
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function PickupDetailsSection({
  value, onChange, onGeocode,
}: {
  value:     PickupFormState;
  onChange:  (patch: Partial<PickupFormState>) => void;
  /** Fired on address blur with the geocode result (or null on failure). */
  onGeocode?: (result: LoadMapPin | null) => void;
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
      n={2}
      color="#10b981"
      title="Pickup Details"
      meta={geocoding && (
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 flex-shrink-0">
          <Loader2 size={11} className="animate-spin" /> Locating…
        </span>
      )}
    >
      <Row>
        <TextCell
          label="Facility Name" value={value.facilityName}
          placeholder="Warehouse or DC name"
          onChange={v => onChange({ facilityName: v })}
        />
        <DateCell
          label="Pickup Date" value={value.date}
          onChange={v => onChange({ date: v })}
        />
      </Row>

      <Row>
        <Cell wide>
          <div onBlur={() => geocodeAddress(value.address)}>
            <AddressAutocomplete
              bare
              label="Address"
              value={value.address}
              rows={2}
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
      </Row>

      <Row>
        <TimeRangeCell
          label="Pickup Window"
          start={value.windowStart} end={value.windowEnd}
          onChangeStart={v => onChange({ windowStart: v })}
          onChangeEnd={v   => onChange({ windowEnd:   v })}
        />
        <TimeRangeCell
          label="Facility Hours"
          start={value.hoursStart} end={value.hoursEnd}
          onChangeStart={v => onChange({ hoursStart: v })}
          onChangeEnd={v   => onChange({ hoursEnd:   v })}
        />
      </Row>

      <Row>
        <TextCell
          label="Contact Person" value={value.contactPerson}
          placeholder="Full name"
          onChange={v => onChange({ contactPerson: v })}
        />
        <TextCell
          label="Phone" type="tel" value={value.phone} mono
          placeholder="(555) 123-4567"
          onChange={v => onChange({ phone: maskPhone(v) })}
        />
      </Row>

      <Row>
        <ChoiceCell
          label="Scheduling"
          value={value.schedulingType}
          options={[
            { value: "fcfs",        label: "FCFS" },
            { value: "appointment", label: "Appointment" },
          ]}
          onChange={v => onChange({ schedulingType: v })}
        />
        <TextCell
          label="Reference #" value={value.reference} mono
          placeholder="PO / BOL number"
          onChange={v => onChange({ reference: v })}
        />
      </Row>

      {isAppointment && (
        <Row>
          <DateTimeCell
            label="Confirmed On"
            date={value.confirmedDate} time={value.confirmedTime}
            onChangeDate={v => onChange({ confirmedDate: v })}
            onChangeTime={v => onChange({ confirmedTime: v })}
          />
          <TextCell
            label="Confirmed By" value={value.confirmedBy}
            placeholder="Who confirmed it"
            onChange={v => onChange({ confirmedBy: v })}
          />
        </Row>
      )}
    </SectionCard>
  );
}
