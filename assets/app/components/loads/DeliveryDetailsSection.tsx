import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiGeocode, type GeocodeResult } from "../../lib/api";
import { maskPhone } from "../../lib/masks";
import AddressAutocomplete from "./AddressAutocomplete";
import {
  SectionCard, Row, Cell, TextCell, DateCell, TimeRangeCell, DateTimeCell,
  TextareaCell, ChoiceCell,
} from "../../lib/cells";
import type { LoadMapPin } from "./LoadMap";

/**
 * Section 3 — Delivery Details (controlled).
 *
 * Same spec-sheet treatment as Pickup, and deliberately the same row order
 * so the two cards read as a matched pair when they sit side by side:
 *
 *   Facility Name       | Delivery Date
 *   Address (full width, autocomplete)
 *   Delivery Window     | Receiver Hours
 *   Contact Person      | Phone
 *   ETA (Est.)          | Store / DC #
 *   Reference #         | POD Required
 *   Delivery Instructions (full width)
 *
 * No FCFS / Confirm On on delivery per spec (backend fields exist on
 * LoadStop for parity with pickup — the UI just doesn't surface them here).
 * Address blur → apiGeocode → pin fed up via onGeocode for Section 1's map.
 */

export interface DeliveryFormState {
  facilityName:  string;
  date:          string; // YYYY-MM-DD
  address:       string;
  windowStart:   string;
  windowEnd:     string;
  contactPerson: string;
  etaDate:       string; // YYYY-MM-DD
  etaTime:       string; // HH:MM
  phone:         string;
  instructions:  string;
  reference:     string;
  podRequired:   boolean;
  hoursStart:    string; // Receiver Hours open
  hoursEnd:      string; // Receiver Hours close
  storeDc:       string;
}

export const emptyDeliveryForm = (): DeliveryFormState => ({
  facilityName: "", date: "",
  address: "",
  windowStart: "", windowEnd: "",
  contactPerson: "", etaDate: "", etaTime: "",
  phone: "", instructions: "",
  reference: "", podRequired: false,
  hoursStart: "", hoursEnd: "",
  storeDc: "",
});

/** Compose local state into the LoadStop payload the backend form expects. */
export function deliveryFormToStopPayload(f: DeliveryFormState): Record<string, unknown> {
  const eta = f.etaDate || f.etaTime
    ? `${f.etaDate || "1970-01-01"}T${f.etaTime || "00:00"}`
    : null;

  return {
    type:           "delivery",
    sequence:       2,
    facilityName:   f.facilityName  || null,
    date:           f.date          || null,
    address:        f.address       || null,
    windowStart:    f.windowStart   || null,
    windowEnd:      f.windowEnd     || null,
    contactPerson:  f.contactPerson || null,
    eta,
    phone:          f.phone         || null,
    instructions:   f.instructions  || null,
    reference:      f.reference     || null,
    podRequired:    f.podRequired,
    hoursStart:     f.hoursStart    || null,
    hoursEnd:       f.hoursEnd      || null,
    storeDc:        f.storeDc       || null,
  };
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function DeliveryDetailsSection({
  value, onChange, onGeocode,
}: {
  value:     DeliveryFormState;
  onChange:  (patch: Partial<DeliveryFormState>) => void;
  /** Fired on address blur/select with the geocode result (or null). */
  onGeocode?: (result: LoadMapPin | null) => void;
}) {
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
      n={3}
      color="#ef4444"
      title="Delivery Details"
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
          label="Delivery Date" value={value.date}
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
                geocodeAddress(address);
              }}
            />
          </div>
        </Cell>
      </Row>

      <Row>
        <TimeRangeCell
          label="Delivery Window"
          start={value.windowStart} end={value.windowEnd}
          onChangeStart={v => onChange({ windowStart: v })}
          onChangeEnd={v   => onChange({ windowEnd:   v })}
        />
        <TimeRangeCell
          label="Receiver Hours"
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
        <DateTimeCell
          label="ETA (Est.)"
          date={value.etaDate} time={value.etaTime}
          onChangeDate={v => onChange({ etaDate: v })}
          onChangeTime={v => onChange({ etaTime: v })}
        />
        <TextCell
          label="Store / DC #" value={value.storeDc} mono
          placeholder="Store or DC number"
          onChange={v => onChange({ storeDc: v })}
        />
      </Row>

      <Row>
        <TextCell
          label="Reference #" value={value.reference} mono
          placeholder="PO / BOL number"
          onChange={v => onChange({ reference: v })}
        />
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

      <Row>
        <TextareaCell
          wide
          label="Delivery Instructions"
          value={value.instructions}
          placeholder="Gate code, dock notes, driver requirements…"
          onChange={v => onChange({ instructions: v })}
        />
      </Row>
    </SectionCard>
  );
}
