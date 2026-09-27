import { Boxes, Package, Scale, Thermometer } from "lucide-react";
import { useRefData } from "../../lib/data";
import { SectionCard, Row, TextCell, SelectCell, SelectOtherCell, ChoiceCell } from "../../lib/cells";

/**
 * Equipment Requirements (controlled).
 *
 * Three-up layout matching Pickup / Delivery:
 *
 *   Load Type          | Trailer Type   | Temperature
 *   Weight (lbs)       | Pallets/Pieces | Commodity
 *   Straps / Load Bars | Hazmat         | Seal Required
 *
 * Load Type leads: it says how the freight moves (FTL, LTL, Drayage…), which
 * is the frame everything under it is read against.
 *
 * The two yes/no answers are segmented pills rather than dropdowns — they
 * are the fields a dispatcher scans for, so they should be readable without
 * opening a menu, and Hazmat: Yes carries a danger tone so it stands out.
 *
 * Load Type and Trailer Type come from the shared catalogs
 * (DataManager.loadTypes / trailerTypes).
 * Temperature / Commodity / Straps live as small enums here — they'll
 * migrate to DataManager if additional consumers appear.
 *
 * Commodity's list can't be exhaustive — freight is whatever shipped that
 * day — so its "Other" opens a text field and the typed name is stored as
 * the commodity itself, not as the word "Other".
 */

// ─── Local enums (small; not worth a round-trip to DataManager yet) ─────────

const TEMPERATURE_OPTIONS = [
  "N/A",
  "Ambient",
  "Refrigerated (33–40°F)",
  "Frozen (<0°F)",
  "Heated",
];

// "Other" is not listed: SelectOtherCell appends it as the typed branch.
const COMMODITY_OPTIONS = [
  "Food", "Beverages", "Electronics", "Machinery", "Building Materials",
  "Chemicals", "Paper Products", "Automotive",
];

const STRAPS_OPTIONS = ["None", "Straps", "Load Bars", "Both"];

// ─── Form state + payload adapter ────────────────────────────────────────────

export interface EquipmentFormState {
  loadType:       string;
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
  loadType: "", trailerType: "", temperature: "",
  weightLbs: "", palletsPieces: "",
  commodity: "", hazmat: "",
  sealRequired: "", strapsLoadBars: "",
});

export function equipmentFormToPayload(f: EquipmentFormState): Record<string, unknown> {
  const weight = f.weightLbs.trim();
  return {
    loadType:       f.loadType       || null,
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
  value, onChange, sectionNumber = 4,
}: {
  value:    EquipmentFormState;
  onChange: (patch: Partial<EquipmentFormState>) => void;
  /**
   * Numbered by the page, which owns the sequence: the Add page runs dispatch
   * ahead of equipment, the control page has no dispatch section at all.
   */
  sectionNumber?: number;
}) {
  const { data: refData } = useRefData();
  const loadTypes    = refData?.loadTypes    ?? [];
  const trailerTypes = refData?.trailerTypes ?? [];

  return (
    <SectionCard n={sectionNumber} color="#f59e0b" title="Equipment Requirements" collapsible defaultOpen={false} icon={Boxes}>
      <Row cols={3}>
        <SelectCell
          label="Load Type" value={value.loadType} icon={Boxes}
          onChange={v => onChange({ loadType: v })}
        >
          <option value="">— Select —</option>
          {loadTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </SelectCell>
        <SelectCell
          label="Trailer Type" value={value.trailerType}
          onChange={v => onChange({ trailerType: v })}
        >
          <option value="">— Select —</option>
          {trailerTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </SelectCell>
        <SelectCell
          label="Temperature" value={value.temperature} icon={Thermometer}
          onChange={v => onChange({ temperature: v })}
        >
          <option value="">— Select —</option>
          {TEMPERATURE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </SelectCell>
      </Row>

      <Row cols={3}>
        <TextCell
          label="Weight (lbs)" type="number" value={value.weightLbs} mono icon={Scale}
          placeholder="42000"
          onChange={v => onChange({ weightLbs: v })}
        />
        <TextCell
          label="Pallets / Pieces" value={value.palletsPieces} mono icon={Package}
          placeholder="20 / 30"
          onChange={v => onChange({ palletsPieces: v })}
        />
        <SelectOtherCell
          label="Commodity" value={value.commodity}
          options={COMMODITY_OPTIONS}
          placeholder="Type the commodity…"
          maxLength={100}
          onChange={v => onChange({ commodity: v })}
        />
      </Row>

      <Row cols={3}>
        <SelectCell
          label="Straps / Load Bars" value={value.strapsLoadBars}
          onChange={v => onChange({ strapsLoadBars: v })}
        >
          <option value="">— Select —</option>
          {STRAPS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </SelectCell>
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
