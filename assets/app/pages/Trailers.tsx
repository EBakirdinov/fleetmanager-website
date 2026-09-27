import { useState, useEffect } from "react";
import { useRefData } from "../lib/data";
import { Container, CheckCircle, AlertCircle, Pencil, Plus, Trash2 } from "lucide-react";
import {
  KpiCard, Btn, SlideDrawer, DrawerSection, DrawerFieldRow,
  DrawerField as Field, DrawerSelect as Select, DrawerFieldRow as FieldRow, ToggleButton as Toggle,
  DrawerTextarea as Textarea, DrawerCell, ActionsMenu, DrawerFileField,
} from "../lib/ui";
import {
  apiListTrailers, apiCreateTrailer, apiUpdateTrailer, apiDeleteTrailer, ApiError, type TrailerItem,
  apiListTrailerMakes, apiListTrailerModels, type MakeItem, type ModelItem,
  apiUploadTrailerInspection, apiDeleteTrailerInspection, documentUrl, type InspectionType,
} from "../lib/api";
import { validateVIN, validateYear, validatePositiveInt, validateRequired, combineValidators, todayIsoDate, formatDate } from "../lib/validators";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

// ─── Form state ──────────────────────────────────────────────────────────────

interface TrailerForm {
  trailerNumber: string;
  type: string;
  year: string;
  makeId: string;
  modelId: string;
  vin: string;
  plateNumber: string;
  plateExpirationDate: string;
  color: string;
  length: string;
  width: string;
  height: string;
  axleCount: string;
  tireSize: string;
  tireCount: string;
  gvwr: string;
  tareWeight: string;
  payloadCapacity: string;
  doorType: string;
  roofType: string;
  floorType: string;
  sideMaterial: string;
  frontMaterial: string;
  status: string;
  airRideSuspension: boolean;
  slidingTandem: boolean;
  ventilation: boolean;
  absBrakes: boolean;
  eTrack: boolean;
  liftgate: boolean;
  hazmatCertified: boolean;
  thermoKingUnit: boolean;
  odometer: string;
  tireChangeInterval: string;
  pmServiceInterval: string;
  federalInspectionInterval: string;
  federalInspectionDate: string;
  stateInspectionInterval: string;
  stateInspectionDate: string;
  homeLocation: string;
  purchaseDate: string;
  purchasePrice: string;
  notes: string;
}

const emptyForm = (): TrailerForm => ({
  trailerNumber: "", type: "", year: "", makeId: "", modelId: "", vin: "", plateNumber: "", plateExpirationDate: "", color: "",
  length: "", width: "", height: "", axleCount: "", tireSize: "", tireCount: "",
  gvwr: "", tareWeight: "", payloadCapacity: "",
  doorType: "", roofType: "", floorType: "", sideMaterial: "", frontMaterial: "",
  status: "1",
  airRideSuspension: false, slidingTandem: false, ventilation: false, absBrakes: false,
  eTrack: false, liftgate: false, hazmatCertified: false, thermoKingUnit: false,
  odometer: "", tireChangeInterval: "", pmServiceInterval: "",
  federalInspectionInterval: "", federalInspectionDate: "",
  stateInspectionInterval: "", stateInspectionDate: "",
  homeLocation: "", purchaseDate: "", purchasePrice: "", notes: "",
});

function formFromItem(t: TrailerItem): TrailerForm {
  return {
    trailerNumber:     t.trailer_number          ?? "",
    type:              t.type                    ?? "",
    year:              t.year?.toString()        ?? "",
    makeId:            t.make?.id?.toString()    ?? "",
    modelId:           t.model?.id?.toString()   ?? "",
    vin:               t.vin                     ?? "",
    plateNumber:         t.plate_number          ?? "",
    plateExpirationDate: t.plate_expiration_date ?? "",
    color:             t.color                   ?? "",
    length:            t.length?.toString()      ?? "",
    width:             t.width?.toString()       ?? "",
    height:            t.height?.toString()      ?? "",
    axleCount:         t.axle_count?.toString()  ?? "",
    tireSize:          t.tire_size               ?? "",
    tireCount:         t.tire_count?.toString()  ?? "",
    gvwr:              t.gvwr?.toString()        ?? "",
    tareWeight:        t.tare_weight?.toString() ?? "",
    payloadCapacity:   t.payload_capacity?.toString() ?? "",
    doorType:          t.door_type               ?? "",
    roofType:          t.roof_type               ?? "",
    floorType:         t.floor_type              ?? "",
    sideMaterial:      t.side_material           ?? "",
    frontMaterial:     t.front_material          ?? "",
    status:            t.status?.toString()      ?? "1",
    airRideSuspension: t.air_ride_suspension     ?? false,
    slidingTandem:     t.sliding_tandem          ?? false,
    ventilation:       t.ventilation             ?? false,
    absBrakes:         t.abs_brakes              ?? false,
    eTrack:            t.e_track                 ?? false,
    liftgate:          t.liftgate                ?? false,
    hazmatCertified:   t.hazmat_certified        ?? false,
    thermoKingUnit:    t.thermo_king_unit        ?? false,
    odometer:                  t.odometer?.toString()                    ?? "",
    tireChangeInterval:        t.tire_change_interval?.toString()        ?? "",
    pmServiceInterval:         t.pm_service_interval?.toString()         ?? "",
    federalInspectionInterval: t.federal_inspection_interval?.toString() ?? "",
    federalInspectionDate:     t.federal_inspection_date                 ?? "",
    stateInspectionInterval:   t.state_inspection_interval?.toString()   ?? "",
    stateInspectionDate:       t.state_inspection_date                   ?? "",
    homeLocation:              t.home_location                           ?? "",
    purchaseDate:      t.purchase_date           ?? "",
    purchasePrice:     t.purchase_price          ?? "",
    notes:             t.notes                   ?? "",
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

const TRAILER_VALIDATORS: Partial<Record<string, (v: string) => string | null>> = {
  trailerNumber:   validateRequired,
  vin:             combineValidators(validateRequired, validateVIN),
  year:            combineValidators(validateRequired, validateYear),
  makeId:          validateRequired,
  modelId:         validateRequired,
  type:            validateRequired,
  plateNumber:     validateRequired,
  length:          validatePositiveInt,
  width:           validatePositiveInt,
  height:          validatePositiveInt,
  axleCount:       validatePositiveInt,
  tireCount:       validatePositiveInt,
  gvwr:            validatePositiveInt,
  tareWeight:      validatePositiveInt,
  payloadCapacity: validatePositiveInt,
  odometer:                  validatePositiveInt,
  tireChangeInterval:        validatePositiveInt,
  pmServiceInterval:         validatePositiveInt,
  federalInspectionInterval: validatePositiveInt,
  stateInspectionInterval:   validatePositiveInt,
};

function validateAllTrailer(form: TrailerForm): Record<string, string | null> {
  const errs: Record<string, string | null> = {};
  for (const k in TRAILER_VALIDATORS) {
    const fn = TRAILER_VALIDATORS[k];
    if (fn) {
      const val = (form as unknown as Record<string, unknown>)[k];
      if (typeof val === "string") {
        const e = fn(val);
        if (e) errs[k] = e;
      }
    }
  }
  return errs;
}

// ─── Trailer form component ──────────────────────────────────────────────────

type TrailerStrField = "trailerNumber"|"type"|"year"|"makeId"|"modelId"|"vin"|"plateNumber"|"plateExpirationDate"|"color"|"length"|"width"|"height"|"axleCount"|"tireSize"|"tireCount"|"gvwr"|"tareWeight"|"payloadCapacity"|"doorType"|"roofType"|"floorType"|"sideMaterial"|"frontMaterial"|"status"|"odometer"|"tireChangeInterval"|"pmServiceInterval"|"federalInspectionInterval"|"federalInspectionDate"|"stateInspectionInterval"|"stateInspectionDate"|"homeLocation"|"purchaseDate"|"purchasePrice"|"notes";

type TrailerBoolField = "airRideSuspension"|"slidingTandem"|"ventilation"|"absBrakes"|"eTrack"|"liftgate"|"hazmatCertified"|"thermoKingUnit";

type TrailerInspectionDocSlot = {
  imageUrl: string | null;
  busy:     boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
};

function TrailerFormFields({
  form, set, setBool, errors, onBlur, makes, models, modelsLoading, inspectionDocs,
}: {
  form: TrailerForm;
  set: (k: TrailerStrField, v: string) => void;
  setBool: (k: TrailerBoolField, v: boolean) => void;
  errors: Record<string, string | null>;
  onBlur: (k: TrailerStrField) => void;
  makes: MakeItem[];
  models: ModelItem[];
  modelsLoading: boolean;
  /** Federal / state inspection document slots. Rendered as their own section
   *  after Maintenance Intervals. When omitted (add mode), the section is hidden. */
  inspectionDocs?: {
    federal: TrailerInspectionDocSlot;
    state:   TrailerInspectionDocSlot;
  };
}) {
  const { data: refData } = useRefData();
  const trailerTypes = refData?.trailerTypes ?? ["Dry Van", "Reefer", "Flatbed", "Step Deck", "Lowboy", "Curtain Side", "Tanker"];
  const colors           = refData?.colors                ?? [];
  const doorTypes        = refData?.trailerDoorTypes      ?? [];
  const roofTypes        = refData?.trailerRoofTypes      ?? [];
  const floorTypes       = refData?.trailerFloorTypes     ?? [];
  const sideMaterials    = refData?.trailerSideMaterials  ?? [];
  const frontMaterials   = refData?.trailerFrontMaterials ?? [];
  const makeIdInt        = form.makeId ? parseInt(form.makeId) : null;
  const modelPlaceholder = !makeIdInt
    ? "— Select Make first —"
    : modelsLoading
      ? "Loading…"
      : "— Select —";
  const today = todayIsoDate();

  return (
    <>
      <DrawerSection title="Basic Information">
        <DrawerFieldRow>
          <Field label="Trailer Number" value={form.trailerNumber} mono required onChange={v => set("trailerNumber", v)} onBlur={() => onBlur("trailerNumber")} error={errors.trailerNumber} hint="e.g. TR-1042" />
          <Field label="Year" value={form.year} type="number" required onChange={v => set("year", v)} onBlur={() => onBlur("year")} error={errors.year} />
        </DrawerFieldRow>
        {/* VIN sits before Make/Model — future: a "Decode" button here can auto-fill year/make/model. */}
        <Field label="VIN" value={form.vin} mono required maxLength={17} onChange={v => set("vin", v.toUpperCase())} onBlur={() => onBlur("vin")} error={errors.vin} hint="17-character VIN" />
        <DrawerFieldRow>
          <Select label="Make" value={form.makeId} required error={errors.makeId} onChange={v => set("makeId", v)}>
            <option value="">— Select —</option>
            {makes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select label="Model" value={form.modelId} required error={errors.modelId} onChange={v => set("modelId", v)}>
            <option value="">{modelPlaceholder}</option>
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Select label="Type" value={form.type} required error={errors.type} onChange={v => set("type", v)}>
            <option value="">— Select —</option>
            {trailerTypes.map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
          <Field label="Plate #" value={form.plateNumber} mono required onChange={v => set("plateNumber", v)} onBlur={() => onBlur("plateNumber")} error={errors.plateNumber} />
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Field label="Plate Expiration" value={form.plateExpirationDate} type="date" onChange={v => set("plateExpirationDate", v)} />
          <div />
        </DrawerFieldRow>
      </DrawerSection>

      <DrawerSection title="Physical Details">
        <DrawerFieldRow>
          <Field label="Length (ft)" value={form.length} type="number" mono onChange={v => set("length", v)} onBlur={() => onBlur("length")} error={errors.length} />
          <Field label="Width (in)" value={form.width} type="number" mono onChange={v => set("width", v)} onBlur={() => onBlur("width")} error={errors.width} />
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Field label="Height (in)" value={form.height} type="number" mono onChange={v => set("height", v)} onBlur={() => onBlur("height")} error={errors.height} />
          <Field label="Axle Count" value={form.axleCount} type="number" onChange={v => set("axleCount", v)} onBlur={() => onBlur("axleCount")} error={errors.axleCount} />
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Field label="Tire Size" value={form.tireSize} onChange={v => set("tireSize", v)} />
          <Field label="Tire Count" value={form.tireCount} type="number" onChange={v => set("tireCount", v)} onBlur={() => onBlur("tireCount")} error={errors.tireCount} />
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Field label="GVWR (lbs)" value={form.gvwr} type="number" mono onChange={v => set("gvwr", v)} onBlur={() => onBlur("gvwr")} error={errors.gvwr} />
          <Field label="Tare Weight (lbs)" value={form.tareWeight} type="number" mono onChange={v => set("tareWeight", v)} onBlur={() => onBlur("tareWeight")} error={errors.tareWeight} />
        </DrawerFieldRow>
        <Field label="Payload Capacity (lbs)" value={form.payloadCapacity} type="number" mono onChange={v => set("payloadCapacity", v)} onBlur={() => onBlur("payloadCapacity")} error={errors.payloadCapacity} />
      </DrawerSection>

      <DrawerSection title="Appearance">
        <DrawerFieldRow>
          <Select label="Color" value={form.color} onChange={v => set("color", v)}>
            <option value="">— Select —</option>
            {colors.map(v => <option key={v}>{v}</option>)}
          </Select>
          <Select label="Door Type" value={form.doorType} onChange={v => set("doorType", v)}>
            <option value="">— Select —</option>
            {doorTypes.map(v => <option key={v}>{v}</option>)}
          </Select>
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Select label="Roof Type" value={form.roofType} onChange={v => set("roofType", v)}>
            <option value="">— Select —</option>
            {roofTypes.map(v => <option key={v}>{v}</option>)}
          </Select>
          <Select label="Floor Type" value={form.floorType} onChange={v => set("floorType", v)}>
            <option value="">— Select —</option>
            {floorTypes.map(v => <option key={v}>{v}</option>)}
          </Select>
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Select label="Side Material" value={form.sideMaterial} onChange={v => set("sideMaterial", v)}>
            <option value="">— Select —</option>
            {sideMaterials.map(v => <option key={v}>{v}</option>)}
          </Select>
          <Select label="Front Material" value={form.frontMaterial} onChange={v => set("frontMaterial", v)}>
            <option value="">— Select —</option>
            {frontMaterials.map(v => <option key={v}>{v}</option>)}
          </Select>
        </DrawerFieldRow>
        <DrawerCell label="Additional Features">
          <div className="flex flex-wrap gap-2">
            <Toggle label="Air Ride"       active={form.airRideSuspension} onToggle={() => setBool("airRideSuspension", !form.airRideSuspension)} />
            <Toggle label="Sliding Tandem" active={form.slidingTandem}     onToggle={() => setBool("slidingTandem",     !form.slidingTandem)} />
            <Toggle label="Ventilation"    active={form.ventilation}       onToggle={() => setBool("ventilation",       !form.ventilation)} />
            <Toggle label="ABS Brakes"     active={form.absBrakes}         onToggle={() => setBool("absBrakes",         !form.absBrakes)} />
            <Toggle label="E-Track"        active={form.eTrack}            onToggle={() => setBool("eTrack",            !form.eTrack)} />
            <Toggle label="Liftgate"       active={form.liftgate}          onToggle={() => setBool("liftgate",          !form.liftgate)} />
            <Toggle label="Thermo King"    active={form.thermoKingUnit}    onToggle={() => setBool("thermoKingUnit",    !form.thermoKingUnit)} />
            <Toggle label="Hazmat"         active={form.hazmatCertified}   onToggle={() => setBool("hazmatCertified",   !form.hazmatCertified)} />
          </div>
        </DrawerCell>
      </DrawerSection>

      <DrawerSection title="Operational Information">
        <DrawerFieldRow>
          <Field label="Current Odometer (mi)" value={form.odometer} type="number" mono onChange={v => set("odometer", v)} onBlur={() => onBlur("odometer")} error={errors.odometer} />
          <Select label="Status" value={form.status} onChange={v => set("status", v)}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </Select>
        </DrawerFieldRow>
        <Field label="Home Location" value={form.homeLocation} onChange={v => set("homeLocation", v)} hint="City, state or depot" />
        <DrawerFieldRow>
          <Field label="Purchase Date" value={form.purchaseDate} type="date" onChange={v => set("purchaseDate", v)} />
          <Field label="Purchase Price ($)" value={form.purchasePrice} type="number" mono onChange={v => set("purchasePrice", v)} hint="Dollars and cents (e.g. 24500.00)" />
        </DrawerFieldRow>
        <Textarea label="Notes" value={form.notes} onChange={v => set("notes", v)} />
      </DrawerSection>

      <DrawerSection title="Maintenance Intervals">
        <DrawerFieldRow>
          <Field label="Last Federal Inspection" value={form.federalInspectionDate} type="date" max={today} onChange={v => set("federalInspectionDate", v)} />
          <Field label="Federal Interval (months)" value={form.federalInspectionInterval} type="number" mono onChange={v => set("federalInspectionInterval", v)} onBlur={() => onBlur("federalInspectionInterval")} error={errors.federalInspectionInterval} />
        </DrawerFieldRow>
        {inspectionDocs && (
          <DrawerFileField
            label="Federal Inspection Document"
            hint="Photo or scan of the DOT annual inspection report"
            accept="image/*"
            imageUrl={inspectionDocs.federal.imageUrl}
            busy={inspectionDocs.federal.busy}
            onUpload={inspectionDocs.federal.onUpload}
            onDelete={inspectionDocs.federal.onDelete}
          />
        )}
        <DrawerFieldRow>
          <Field label="Last State Inspection" value={form.stateInspectionDate} type="date" max={today} onChange={v => set("stateInspectionDate", v)} />
          <Field label="State Interval (months)" value={form.stateInspectionInterval} type="number" mono onChange={v => set("stateInspectionInterval", v)} onBlur={() => onBlur("stateInspectionInterval")} error={errors.stateInspectionInterval} />
        </DrawerFieldRow>
        {inspectionDocs && (
          <DrawerFileField
            label="State Inspection Document"
            hint="Photo or scan of the state inspection report"
            accept="image/*"
            imageUrl={inspectionDocs.state.imageUrl}
            busy={inspectionDocs.state.busy}
            onUpload={inspectionDocs.state.onUpload}
            onDelete={inspectionDocs.state.onDelete}
          />
        )}
        <DrawerFieldRow>
          <Field label="PM Service Interval (mi)" value={form.pmServiceInterval} type="number" mono onChange={v => set("pmServiceInterval", v)} onBlur={() => onBlur("pmServiceInterval")} error={errors.pmServiceInterval} />
          <Field label="Tire Change Interval (mi)" value={form.tireChangeInterval} type="number" mono onChange={v => set("tireChangeInterval", v)} onBlur={() => onBlur("tireChangeInterval")} error={errors.tireChangeInterval} />
        </DrawerFieldRow>
      </DrawerSection>
    </>
  );
}

// ─── Static placeholder chart data ───────────────────────────────────────────

const maintenanceTrend = [
  { m: "Jan", cost: 0 }, { m: "Feb", cost: 0 }, { m: "Mar", cost: 0 },
  { m: "Apr", cost: 0 }, { m: "May", cost: 0 }, { m: "Jun", cost: 0 }, { m: "Jul", cost: 0 },
];

// ─── Main-table display helpers ──────────────────────────────────────────────

/**
 * Federal (DOT annual) inspection summary shown under the last inspection
 * date. Interval is stored in months and falls back to the DOT annual 12
 * when unset; "Completed" means the last inspection landed within 7 days.
 *
 * Trailers only ever show the federal inspection on the main table — state
 * inspections are tracked in the drawer but not surfaced here.
 */
type InspectionStatus =
  | { kind: "none" }
  | { kind: "completed" }
  | { kind: "overdue" }
  | { kind: "due"; months: number };

const DAYS_PER_MONTH = 30.44;
const FEDERAL_DEFAULT_MONTHS = 12;

function federalInspectionStatus(t: TrailerItem): InspectionStatus {
  if (!t.federal_inspection_date) return { kind: "none" };
  const then = new Date(t.federal_inspection_date).getTime();
  if (Number.isNaN(then)) return { kind: "none" };
  const daysSince = (Date.now() - then) / (24 * 60 * 60 * 1000);
  if (daysSince < 7) return { kind: "completed" };
  const months = t.federal_inspection_interval && t.federal_inspection_interval > 0
    ? t.federal_inspection_interval
    : FEDERAL_DEFAULT_MONTHS;
  const intervalDays = months * DAYS_PER_MONTH;
  if (daysSince > intervalDays) return { kind: "overdue" };
  return { kind: "due", months: Math.max(1, Math.ceil((intervalDays - daysSince) / DAYS_PER_MONTH)) };
}

/** Amber inside 60 days, red once past — matches the expiry cues elsewhere. */
function plateExpiryClass(iso: string | null | undefined): string {
  if (!iso) return "text-muted-foreground";
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (Number.isNaN(days)) return "text-muted-foreground";
  if (days < 0)  return "text-red-400 font-semibold";
  if (days < 60) return "text-amber-400";
  return "text-muted-foreground";
}

/** "Dry Van (53 ft)" — length is optional, the type alone is a valid label. */
function trailerTypeLabel(t: TrailerItem): string {
  if (!t.type) return "—";
  return t.length ? `${t.type} (${t.length} ft)` : t.type;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Trailers() {
  const [items,        setItems]        = useState<TrailerItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [drawerMode,   setDrawerMode]   = useState<"add" | "edit">("add");
  const [selected,     setSelected]     = useState<TrailerItem | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [toast,        setToast]        = useState<{ ok: boolean; msg: string } | null>(null);
  const [form,         setFormState]    = useState<TrailerForm>(emptyForm());
  const [errors,       setErrors]       = useState<Record<string, string | null>>({});
  const [makes,         setMakes]         = useState<MakeItem[]>([]);
  const [models,        setModels]        = useState<ModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [inspectionHashes, setInspectionHashes] = useState<{ federal: string | null; state: string | null }>({ federal: null, state: null });
  const [inspectionBusy,   setInspectionBusy]   = useState<InspectionType | null>(null);
  const { data: pageRefData } = useRefData();
  const imagesHost = pageRefData?.imagesHost ?? "";

  useEffect(() => {
    setFormState(selected ? formFromItem(selected) : emptyForm());
    setErrors({});
    setInspectionHashes({
      federal: selected?.federal_inspection_hash ?? null,
      state:   selected?.state_inspection_hash   ?? null,
    });
  }, [selected]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      setItems(await apiListTrailers());
    } catch {
      setError("Failed to load trailers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    apiListTrailerMakes().then(setMakes).catch(() => setMakes([]));
  }, []);

  useEffect(() => {
    const makeIdInt = form.makeId ? parseInt(form.makeId) : NaN;
    if (!Number.isFinite(makeIdInt)) {
      setModels([]);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    apiListTrailerModels(makeIdInt)
      .then(res => { if (!cancelled) setModels(res); })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [form.makeId]);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function set(k: TrailerStrField, v: string) {
    setFormState(p => {
      const next = { ...p, [k]: v };
      if (k === "makeId") next.modelId = "";
      return next;
    });
    setErrors(p => {
      const patch: Record<string, string | null> = {};
      if (p[k]) patch[k] = null;
      if (k === "makeId" && p.modelId) patch.modelId = null;
      return Object.keys(patch).length ? { ...p, ...patch } : p;
    });
  }

  function setBool(k: TrailerBoolField, v: boolean) {
    setFormState(p => ({ ...p, [k]: v }));
  }

  function handleBlur(k: TrailerStrField) {
    const fn = TRAILER_VALIDATORS[k];
    if (!fn) return;
    const val = (form as unknown as Record<string, unknown>)[k];
    if (typeof val !== "string") return;
    setErrors(p => ({ ...p, [k]: fn(val) }));
  }

  function openAdd() {
    setSelected(null);
    setDrawerMode("add");
    setDrawerOpen(true);
  }

  function openEdit(t: TrailerItem) {
    setSelected(t);
    setDrawerMode("edit");
    setDrawerOpen(true);
  }

  async function handleSave() {
    const errs = validateAllTrailer(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast(false, `Please fix ${Object.keys(errs).length} validation error(s)`);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        trailerNumber:     form.trailerNumber   || null,
        type:              form.type            || null,
        year:              form.year            ? parseInt(form.year)            : null,
        make:              form.makeId          ? parseInt(form.makeId)          : null,
        model:             form.modelId         ? parseInt(form.modelId)         : null,
        vin:               form.vin             || null,
        plateNumber:         form.plateNumber         || null,
        plateExpirationDate: form.plateExpirationDate || null,
        color:             form.color           || null,
        length:            form.length          ? parseInt(form.length)          : null,
        width:             form.width           ? parseInt(form.width)           : null,
        height:            form.height          ? parseInt(form.height)          : null,
        axleCount:         form.axleCount       ? parseInt(form.axleCount)       : null,
        tireSize:          form.tireSize        || null,
        tireCount:         form.tireCount       ? parseInt(form.tireCount)       : null,
        gvwr:              form.gvwr            ? parseInt(form.gvwr)            : null,
        tareWeight:        form.tareWeight      ? parseInt(form.tareWeight)      : null,
        payloadCapacity:   form.payloadCapacity ? parseInt(form.payloadCapacity) : null,
        doorType:          form.doorType        || null,
        roofType:          form.roofType        || null,
        floorType:         form.floorType       || null,
        sideMaterial:      form.sideMaterial    || null,
        frontMaterial:     form.frontMaterial   || null,
        status:            parseInt(form.status),
        airRideSuspension: form.airRideSuspension,
        slidingTandem:     form.slidingTandem,
        ventilation:       form.ventilation,
        absBrakes:         form.absBrakes,
        eTrack:            form.eTrack,
        liftgate:          form.liftgate,
        hazmatCertified:   form.hazmatCertified,
        thermoKingUnit:    form.thermoKingUnit,
        odometer:                  form.odometer                  ? parseInt(form.odometer, 10)                  : null,
        tireChangeInterval:        form.tireChangeInterval        ? parseInt(form.tireChangeInterval, 10)        : null,
        pmServiceInterval:         form.pmServiceInterval         ? parseInt(form.pmServiceInterval, 10)         : null,
        federalInspectionInterval: form.federalInspectionInterval ? parseInt(form.federalInspectionInterval, 10) : null,
        stateInspectionInterval:   form.stateInspectionInterval   ? parseInt(form.stateInspectionInterval, 10)   : null,
        federalInspectionDate:     form.federalInspectionDate     || null,
        stateInspectionDate:       form.stateInspectionDate       || null,
        homeLocation:              form.homeLocation              || null,
        purchaseDate:      form.purchaseDate  || null,
        purchasePrice:     form.purchasePrice || null,
        notes:             form.notes         || null,
      };
      if (drawerMode === "add") {
        await apiCreateTrailer(payload);
      } else if (selected) {
        await apiUpdateTrailer(selected.id, payload);
      }
      await loadData();
      showToast(true, drawerMode === "add" ? "Trailer created" : "Trailer updated");
      setDrawerOpen(false);
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: TrailerItem) {
    const label = t.trailer_number ?? `trailer #${t.id}`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiDeleteTrailer(t.id);
      await loadData();
      showToast(true, "Trailer deleted");
      if (selected?.id === t.id) setDrawerOpen(false);
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleUploadInspection(type: InspectionType, file: File) {
    if (!selected) return;
    setInspectionBusy(type);
    try {
      const res = await apiUploadTrailerInspection(selected.id, type, file);
      setInspectionHashes(prev => ({ ...prev, [type]: res.hash }));
      showToast(true, `${type === "federal" ? "Federal" : "State"} inspection uploaded`);
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setInspectionBusy(null);
    }
  }

  async function handleDeleteInspection(type: InspectionType) {
    if (!selected) return;
    if (!window.confirm(`Remove ${type === "federal" ? "federal" : "state"} inspection document?`)) return;
    setInspectionBusy(type);
    try {
      await apiDeleteTrailerInspection(selected.id, type);
      setInspectionHashes(prev => ({ ...prev, [type]: null }));
      showToast(true, `${type === "federal" ? "Federal" : "State"} inspection removed`);
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setInspectionBusy(null);
    }
  }

  const total    = items.length;
  const active   = items.filter(t => t.status === 1).length;
  const inactive = items.filter(t => t.status === 0).length;

  const filtered = statusFilter === "all"      ? items
                 : statusFilter === "active"   ? items.filter(t => t.status === 1)
                 : statusFilter === "inactive" ? items.filter(t => t.status === 0)
                 : items;

  const statusDonut = [
    { name: "Active",   value: active   },
    { name: "Inactive", value: inactive },
  ];
  const DONUT_COLORS = ["#10b981", "#ef4444"];

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* KPIs */}
        <div className="flex gap-3">
          <KpiCard label="Total Trailers" value={total}    icon={Container}    accent="#6b7e96" active={statusFilter === "all"}      onClick={() => setStatusFilter("all")} />
          <KpiCard label="Active"         value={active}   icon={CheckCircle}  accent="#10b981" active={statusFilter === "active"}   onClick={() => setStatusFilter("active")} />
          <KpiCard label="Inactive"       value={inactive} icon={AlertCircle}  accent="#ef4444" active={statusFilter === "inactive"} onClick={() => setStatusFilter("inactive")} />
        </div>

        {toast && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono ${toast.ok ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400" : "bg-red-500/10 border border-red-500/25 text-red-400"}`}>
            {toast.msg}
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Trailers</span>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Btn variant="primary" onClick={openAdd}><Plus size={11} className="inline mr-1" />Add Trailer</Btn>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs font-mono text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-xs font-mono text-red-400">{error}</p>
              <Btn variant="outline" onClick={loadData}>Retry</Btn>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Trailer", "Type", "Make / Model", "VIN", "License Plate", "Truck", "Federal Insp.", ""].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const federalInsp = federalInspectionStatus(t);
                    return (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs text-primary font-semibold">{t.trailer_number ?? `#${t.id}`}</span>
                      </td>

                      {/* Type: length folded into the label — "Dry Van (53 ft)" */}
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{trailerTypeLabel(t)}</td>

                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {[t.make?.name, t.model?.name].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{t.vin ?? "—"}</td>

                      {/* License Plate: number on top, expiration below */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-xs font-mono text-muted-foreground">{t.plate_number ?? "—"}</div>
                        {t.plate_expiration_date && (
                          <div className={`text-[11px] font-mono mt-0.5 ${plateExpiryClass(t.plate_expiration_date)}`}>
                            Exp. {formatDate(t.plate_expiration_date)}
                          </div>
                        )}
                      </td>

                      {/* Truck currently pulling this trailer */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {t.assigned_truck
                          ? <span className="text-xs font-mono text-foreground">{t.assigned_truck.truck_number ?? `#${t.assigned_truck.id}`}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>

                      {/* Federal Inspection: date + status */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {t.federal_inspection_date
                          ? <div className="text-xs font-mono text-foreground">{formatDate(t.federal_inspection_date)}</div>
                          : <div className="text-xs text-muted-foreground">—</div>}
                        {federalInsp.kind === "completed" && <div className="text-[11px] font-mono text-emerald-400 mt-0.5">Completed</div>}
                        {federalInsp.kind === "overdue"   && <div className="text-[11px] font-mono text-red-400 mt-0.5">Overdue</div>}
                        {federalInsp.kind === "due"       && <div className="text-[11px] font-mono text-muted-foreground mt-0.5">Due in {federalInsp.months} {federalInsp.months === 1 ? "month" : "months"}</div>}
                      </td>

                      <td className="px-3 py-2.5">
                        <ActionsMenu items={[
                          { label: "Edit",   onClick: () => openEdit(t),   icon: Pencil },
                          { label: "Delete", onClick: () => handleDelete(t), icon: Trash2, variant: "danger" },
                        ]} />
                      </td>
                    </tr>);
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">No trailers found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
            <span className="text-xs font-mono text-muted-foreground">Showing {filtered.length} of {total} trailers</span>
          </div>
        </div>
      </div>

      <SlideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerMode === "add" ? "Add New Trailer" : "Edit Trailer"}
        badge={drawerMode === "edit" ? (selected?.trailer_number ?? `#${selected?.id}`) : "NEW"}
        onSave={handleSave}
        saving={saving}
        onDelete={drawerMode === "edit" && selected ? () => handleDelete(selected) : undefined}
        deleting={deleting}
      >
        <TrailerFormFields
          form={form} set={set} setBool={setBool} errors={errors} onBlur={handleBlur} makes={makes} models={models} modelsLoading={modelsLoading}
          inspectionDocs={drawerMode === "edit" && selected ? {
            federal: {
              imageUrl: documentUrl(imagesHost, "trailers", inspectionHashes.federal, "full"),
              busy:     inspectionBusy === "federal",
              onUpload: (file) => handleUploadInspection("federal", file),
              onDelete: () => handleDeleteInspection("federal"),
            },
            state: {
              imageUrl: documentUrl(imagesHost, "trailers", inspectionHashes.state, "full"),
              busy:     inspectionBusy === "state",
              onUpload: (file) => handleUploadInspection("state", file),
              onDelete: () => handleDeleteInspection("state"),
            },
          } : undefined}
        />
      </SlideDrawer>
    </>
  );
}
