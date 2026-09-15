import { useRefData } from "../../lib/data";
import { SectionCard, Row, TextCell, SelectCell, ChoiceCell } from "../../lib/cells";

/**
 * Section 4 — Equipment Requirements (controlled).
 *
 * Spec-sheet layout matching Pickup / Delivery:
 *
 *   Trailer Type  | Temperature
 *   Weight (lbs)  | Pallets / Pieces
 *   Commodity     | Straps / Load Bars
 *   Hazmat        | Seal Required
 *
 * The two yes/no answers are segmented pills rather than dropdowns — they
 * are the fields a dispatcher scans for, so they should be readable without
 * opening a menu, and Hazmat: Yes carries a danger tone so it stands out.
 *
 * Trailer Type comes from the shared catalog (DataManager.trailerTypes).
 * Temperature / Commodity / Straps live as small enums here — they'll
 * migrate to DataManager if additional consumers appear.
 */

// ─── Local enums (small; not worth a round-trip to DataManager yet) ─────────

const TEMPERATURE_OPTIONS = [
  "N/A",
  "Ambient",
  "Refrigerated (33–40°F)",
  "Frozen (<0°F)",
  "Heated",
];

const COMMODITY_OPTIONS = [
  "Food", "Beverages", "Electronics", "Machinery", "Building Materials",
  "Chemicals", "Paper Products", "Automotive", "Other",
];

const STRAPS_OPTIONS = ["None", "Straps", "Load Bars", "Both"];

// ─── Form state + payload adapter ────────────────────────────────────────────

export interface EquipmentFormState {
  trailerType:    string;
  temperature:    string;
  weightLbs:      string; // kept as string in form state; parsed to int on save
  palletsPieces:  string;
  commodity:      string;
  hazmat:         "" | "yes" | "no";
  sealRequired:   "" | "yes" | "no";
  strapsLoadBars: string;
}

export const emptyEquipmentForm = (): EquipmentFormState => ({
  trailerType: "", temperature: "",
  weightLbs: "", palletsPieces: "",
  commodity: "", hazmat: "",
  sealRequired: "", strapsLoadBars: "",
});

export function equipmentFormToPayload(f: EquipmentFormState): Record<string, unknown> {
  const weight = f.weightLbs.trim();
  return {
    trailerType:    f.trailerType    || null,
    temperature:    f.temperature    || null,
    weightLbs:      weight ? Number(weight) : null,
    palletsPieces:  f.palletsPieces  || null,
    commodity:      f.commodity      || null,
    hazmat:         f.hazmat === "yes" ? true : f.hazmat === "no" ? false : null,
    sealRequired:   f.sealRequired === "yes" ? true : f.sealRequired === "no" ? false : null,
    strapsLoadBars: f.strapsLoadBars || null,
  };
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function EquipmentSection({
  value, onChange,
}: {
  value:    EquipmentFormState;
  onChange: (patch: Partial<EquipmentFormState>) => void;
}) {
  const { data: refData } = useRefData();
  const trailerTypes = refData?.trailerTypes ?? [];

  return (
    <SectionCard n={4} color="#f59e0b" title="Equipment Requirements">
      <Row>
        <SelectCell
          label="Trailer Type" value={value.trailerType}
          onChange={v => onChange({ trailerType: v })}
        >
          <option value="">— Select —</option>
          {trailerTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </SelectCell>
        <SelectCell
          label="Temperature" value={value.temperature}
          onChange={v => onChange({ temperature: v })}
        >
          <option value="">— Select —</option>
          {TEMPERATURE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </SelectCell>
      </Row>

      <Row>
        <TextCell
          label="Weight (lbs)" type="number" value={value.weightLbs} mono
          placeholder="42000"
          onChange={v => onChange({ weightLbs: v })}
        />
        <TextCell
          label="Pallets / Pieces" value={value.palletsPieces} mono
          placeholder="20 / 30"
          onChange={v => onChange({ palletsPieces: v })}
        />
      </Row>

      <Row>
        <SelectCell
          label="Commodity" value={value.commodity}
          onChange={v => onChange({ commodity: v })}
        >
          <option value="">— Select —</option>
          {COMMODITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </SelectCell>
        <SelectCell
          label="Straps / Load Bars" value={value.strapsLoadBars}
          onChange={v => onChange({ strapsLoadBars: v })}
        >
          <option value="">— Select —</option>
          {STRAPS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </SelectCell>
      </Row>

      <Row>
        <ChoiceCell
          label="Hazmat" value={value.hazmat}
          options={[
            { value: "no",  label: "No", tone: "neutral" },
            { value: "yes", label: "Yes", tone: "danger" },
          ]}
          onChange={v => onChange({ hazmat: v as EquipmentFormState["hazmat"] })}
        />
        <ChoiceCell
          label="Seal Required" value={value.sealRequired}
          options={[
            { value: "no",  label: "No", tone: "neutral" },
            { value: "yes", label: "Yes" },
          ]}
          onChange={v => onChange({ sealRequired: v as EquipmentFormState["sealRequired"] })}
        />
      </Row>
    </SectionCard>
  );
}
