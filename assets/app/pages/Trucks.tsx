import { useState, useEffect, useMemo } from "react";
import { useRefData } from "../lib/data";
import { Truck, AlertCircle, CheckCircle, Pencil, Plus, Trash2 } from "lucide-react";
import {
  KpiCard, StatusPill, Btn, SlideDrawer, DrawerSection, DrawerFieldRow,
  DrawerField as Field, DrawerSelect as Select, DrawerFieldRow as FieldRow, DrawerFileField,
  ActionsMenu,
} from "../lib/ui";
import {
  apiListTrucks, apiCreateTruck, apiUpdateTruck, apiDeleteTruck, ApiError, type TruckItem,
  apiListTrailers, type TrailerItem,
  apiListTruckMakes, apiListTruckModels, type MakeItem, type ModelItem,
  apiUploadTruckImage, apiDeleteTruckImage, documentUrl,
  apiGetFleetLocations, type TruckLocation,
} from "../lib/api";
import { validateVIN, validateYear, validatePositiveInt, validateRequired, combineValidators } from "../lib/validators";
import { ImportedChip } from "../components/ImportedChip";
import { ImportDropdown } from "../components/ImportDropdown";

// ─── Form state ──────────────────────────────────────────────────────────────

interface TruckForm {
  truckNumber: string;
  year: string;
  makeId: string;
  modelId: string;
  vin: string;
  plateNumber: string;
  plateState: string;
  color: string;
  bedCount: string;
  cabType: string;
  sleeperSize: string;
  engineType: string;
  engineNumber: string;
  fuelType: string;
  transmission: string;
  axleCount: string;
  gvwr: string;
  fuelCapacity: string;
  currentLocation: string;
  homeTerminal: string;
  currentMileage: string;
  engineHours: string;
  lastInspectionDate: string;
  inspectionInterval: string;
  oilChangeInterval: string;
  pmServiceInterval: string;
  status: string;
  assignedTrailerId: string;
}

const emptyForm = (): TruckForm => ({
  truckNumber: "", year: "", makeId: "", modelId: "", vin: "", plateNumber: "", plateState: "",
  color: "", bedCount: "", cabType: "", sleeperSize: "",
  engineType: "", engineNumber: "",
  fuelType: "", transmission: "",
  axleCount: "", gvwr: "", fuelCapacity: "",
  currentLocation: "", homeTerminal: "",
  currentMileage: "", engineHours: "",
  lastInspectionDate: "", inspectionInterval: "", oilChangeInterval: "", pmServiceInterval: "",
  status: "1",
  assignedTrailerId: "",
});

function formFromItem(t: TruckItem): TruckForm {
  return {
    truckNumber:        t.truck_number        ?? "",
    year:               t.year?.toString()    ?? "",
    makeId:             t.make?.id?.toString()  ?? "",
    modelId:            t.model?.id?.toString() ?? "",
    vin:                t.vin                 ?? "",
    plateNumber:        t.plate_number        ?? "",
    plateState:         t.plate_state         ?? "",
    color:              t.color               ?? "",
    bedCount:           t.bed_count?.toString()     ?? "",
    cabType:            t.cab_type            ?? "",
    sleeperSize:        t.sleeper_size        ?? "",
    engineType:         t.engine_type         ?? "",
    engineNumber:       t.engine_number       ?? "",
    fuelType:           t.fuel_type           ?? "",
    transmission:       t.transmission        ?? "",
    axleCount:          t.axle_count?.toString()    ?? "",
    gvwr:               t.gvwr?.toString()          ?? "",
    fuelCapacity:       t.fuel_capacity?.toString() ?? "",
    currentLocation:    t.current_location    ?? "",
    homeTerminal:       t.home_terminal       ?? "",
    currentMileage:     t.current_mileage?.toString() ?? "",
    engineHours:        t.engine_hours?.toString()    ?? "",
    lastInspectionDate: t.last_inspection_date ?? "",
    inspectionInterval: t.inspection_interval?.toString() ?? "",
    oilChangeInterval:  t.oil_change_interval?.toString() ?? "",
    pmServiceInterval:  t.pm_service_interval?.toString() ?? "",
    status:             t.status?.toString()  ?? "1",
    assignedTrailerId:  t.assigned_trailer?.id?.toString() ?? "",
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

const TRUCK_VALIDATORS: Partial<Record<keyof TruckForm, (v: string) => string | null>> = {
  truckNumber:        validateRequired,
  vin:                combineValidators(validateRequired, validateVIN),
  year:               combineValidators(validateRequired, validateYear),
  makeId:             validateRequired,
  modelId:            validateRequired,
  plateNumber:        validateRequired,
  plateState:         validateRequired,
  bedCount:           validatePositiveInt,
  axleCount:          validatePositiveInt,
  gvwr:               validatePositiveInt,
  fuelCapacity:       validatePositiveInt,
  currentMileage:     validatePositiveInt,
  engineHours:        validatePositiveInt,
  inspectionInterval: validatePositiveInt,
  oilChangeInterval:  validatePositiveInt,
  pmServiceInterval:  validatePositiveInt,
};

function validateAllTruck(form: TruckForm): Record<string, string | null> {
  const errs: Record<string, string | null> = {};
  for (const k in TRUCK_VALIDATORS) {
    const fn = TRUCK_VALIDATORS[k as keyof TruckForm];
    if (fn) {
      const e = fn(form[k as keyof TruckForm] as string);
      if (e) errs[k] = e;
    }
  }
  return errs;
}

// ─── Truck form component ────────────────────────────────────────────────────

function TruckFormFields({ form, set, errors, onBlur, makes, models, modelsLoading, exteriorImage }: {
  form: TruckForm;
  set: (k: keyof TruckForm, v: string) => void;
  errors: Record<string, string | null>;
  onBlur: (k: keyof TruckForm) => void;
  makes: MakeItem[];
  models: ModelItem[];
  modelsLoading: boolean;
  /** Rendered inline next to Cab Type / Sleeper Size when provided (edit mode only). */
  exteriorImage?: {
    imageUrl: string | null;
    busy:     boolean;
    onUpload: (file: File) => void;
    onDelete: () => void;
  };
}) {
  const { data: refData } = useRefData();
  const states       = refData?.states            ?? [];
  const fuelTypes    = refData?.truckFuelTypes    ?? ["Diesel", "Gasoline", "Natural Gas", "Electric", "Hybrid"];
  const transmissions = refData?.truckTransmissions ?? ["Automatic", "Manual", "Automated Manual"];
  const colors        = refData?.colors             ?? [];
  const cabTypes      = refData?.truckCabTypes      ?? [];
  const sleeperSizes  = refData?.truckSleeperSizes  ?? [];
  const engineTypes   = refData?.truckEngineTypes   ?? [];
  const makeIdInt     = form.makeId ? parseInt(form.makeId) : null;
  const modelPlaceholder = !makeIdInt
    ? "— Select Make first —"
    : modelsLoading
      ? "Loading…"
      : "— Select —";

  return (
    <>
      <DrawerSection title="Basic Information">
        <DrawerFieldRow>
          <Field label="Truck Number" value={form.truckNumber} mono required onChange={v => set("truckNumber", v)} onBlur={() => onBlur("truckNumber")} error={errors.truckNumber} hint="e.g. T-1042" />
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
          <Field label="Plate #" value={form.plateNumber} mono required onChange={v => set("plateNumber", v)} onBlur={() => onBlur("plateNumber")} error={errors.plateNumber} />
          <Select label="Plate State" value={form.plateState} required error={errors.plateState} onChange={v => set("plateState", v)}>
            <option value="">— Select —</option>
            {states.map(s => <option key={s.value} value={s.value}>{s.value} — {s.label}</option>)}
          </Select>
        </DrawerFieldRow>
      </DrawerSection>

      <DrawerSection title="Appearance & Configuration">
        <DrawerFieldRow>
          <Select label="Color" value={form.color} onChange={v => set("color", v)}>
            <option value="">— Select —</option>
            {colors.map(v => <option key={v}>{v}</option>)}
          </Select>
          <Field label="Bed Count" value={form.bedCount} type="number" onChange={v => set("bedCount", v)} onBlur={() => onBlur("bedCount")} error={errors.bedCount} />
        </DrawerFieldRow>
        <div className={`grid gap-4 ${exteriorImage ? "grid-cols-3" : "grid-cols-2"}`}>
          <Select label="Cab Type" value={form.cabType} onChange={v => set("cabType", v)}>
            <option value="">— Select —</option>
            {cabTypes.map(v => <option key={v}>{v}</option>)}
          </Select>
          <Select label="Sleeper Size" value={form.sleeperSize} onChange={v => set("sleeperSize", v)}>
            <option value="">— Select —</option>
            {sleeperSizes.map(v => <option key={v}>{v}</option>)}
          </Select>
          {exteriorImage && (
            <DrawerFileField
              label="Exterior Image"
              hint="Photo of the truck"
              imageUrl={exteriorImage.imageUrl}
              busy={exteriorImage.busy}
              onUpload={exteriorImage.onUpload}
              onDelete={exteriorImage.onDelete}
            />
          )}
        </div>
      </DrawerSection>

      <DrawerSection title="Specifications">
        <DrawerFieldRow>
          <Select label="Engine Type" value={form.engineType} onChange={v => set("engineType", v)}>
            <option value="">— Select —</option>
            {engineTypes.map(v => <option key={v}>{v}</option>)}
          </Select>
          <Field label="Engine Number" value={form.engineNumber} mono onChange={v => set("engineNumber", v)} />
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Select label="Fuel Type" value={form.fuelType} onChange={v => set("fuelType", v)}>
            <option value="">— Select —</option>
            {fuelTypes.map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
          <Select label="Transmission" value={form.transmission} onChange={v => set("transmission", v)}>
            <option value="">— Select —</option>
            {transmissions.map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Field label="Axle Count" value={form.axleCount} type="number" onChange={v => set("axleCount", v)} onBlur={() => onBlur("axleCount")} error={errors.axleCount} />
          <Field label="GVWR (lbs)" value={form.gvwr} type="number" mono onChange={v => set("gvwr", v)} onBlur={() => onBlur("gvwr")} error={errors.gvwr} />
        </DrawerFieldRow>
        <Field label="Fuel Capacity (gal)" value={form.fuelCapacity} type="number" mono onChange={v => set("fuelCapacity", v)} onBlur={() => onBlur("fuelCapacity")} error={errors.fuelCapacity} />
      </DrawerSection>

      <DrawerSection title="Location & Assignment">
        <DrawerFieldRow>
          <Field label="Current Location" value={form.currentLocation} onChange={v => set("currentLocation", v)} hint="City, State or Depot" />
          <Field label="Home Terminal" value={form.homeTerminal} onChange={v => set("homeTerminal", v)} />
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Field label="Current Mileage" value={form.currentMileage} type="number" mono onChange={v => set("currentMileage", v)} onBlur={() => onBlur("currentMileage")} error={errors.currentMileage} />
          <Field label="Engine Hours" value={form.engineHours} type="number" mono onChange={v => set("engineHours", v)} onBlur={() => onBlur("engineHours")} error={errors.engineHours} />
        </DrawerFieldRow>
        <Select label="Status" value={form.status} onChange={v => set("status", v)}>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </Select>
      </DrawerSection>

      <DrawerSection title="Maintenance Intervals">
        <Field label="Last Inspection Date" value={form.lastInspectionDate} type="date" onChange={v => set("lastInspectionDate", v)} />
        <DrawerFieldRow>
          <Field label="Inspection Interval (mi)" value={form.inspectionInterval} type="number" mono onChange={v => set("inspectionInterval", v)} onBlur={() => onBlur("inspectionInterval")} error={errors.inspectionInterval} />
          <Field label="Oil Change Interval (mi)" value={form.oilChangeInterval} type="number" mono onChange={v => set("oilChangeInterval", v)} onBlur={() => onBlur("oilChangeInterval")} error={errors.oilChangeInterval} />
        </DrawerFieldRow>
        <Field label="PM Service Interval (mi)" value={form.pmServiceInterval} type="number" mono onChange={v => set("pmServiceInterval", v)} onBlur={() => onBlur("pmServiceInterval")} error={errors.pmServiceInterval} />
      </DrawerSection>
    </>
  );
}

// ─── Status helpers ──────────────────────────────────────────────────────────

const TRUCK_STATUS_LABEL: Record<number, string> = { 1: "Active", 0: "Inactive" };
const TRUCK_STATUS_COLOR: Record<number, string> = { 1: "#10b981", 0: "#ef4444" };

/**
 * Inspection status per doc — three-state summary shown below the last
 * inspection date. We don't track the mileage at which the inspection was
 * done, so "Overdue" is date-based (DOT annual = 365 days) and "Completed"
 * follows option A (last date within 7 days). The middle case shows the
 * interval as a static reminder.
 */
type InspectionStatus =
  | { kind: "none" }
  | { kind: "completed" }
  | { kind: "overdue" }
  | { kind: "due"; miles: number };

function inspectionStatus(t: TruckItem): InspectionStatus {
  if (!t.last_inspection_date) return { kind: "none" };
  const then = new Date(t.last_inspection_date).getTime();
  if (Number.isNaN(then)) return { kind: "none" };
  const daysSince = (Date.now() - then) / (24 * 60 * 60 * 1000);
  if (daysSince < 7)   return { kind: "completed" };
  if (daysSince > 365) return { kind: "overdue" };
  if (t.inspection_interval != null && t.inspection_interval > 0) {
    return { kind: "due", miles: t.inspection_interval };
  }
  return { kind: "none" };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Trucks() {
  const [items,        setItems]        = useState<TruckItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [drawerMode,   setDrawerMode]   = useState<"add" | "edit">("add");
  const [selected,     setSelected]     = useState<TruckItem | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [toast,        setToast]        = useState<{ ok: boolean; msg: string } | null>(null);
  const [form,         setForm]         = useState<TruckForm>(emptyForm());
  const [errors,       setErrors]       = useState<Record<string, string | null>>({});
  const [makes,         setMakes]         = useState<MakeItem[]>([]);
  const [models,        setModels]        = useState<ModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [exteriorHash,  setExteriorHash]  = useState<string | null>(null);
  const [imageBusy,     setImageBusy]     = useState(false);
  const [positions,     setPositions]     = useState<TruckLocation[]>([]);
  const { data: refData } = useRefData();
  const imagesHost = refData?.imagesHost ?? "";

  // Redis-cached ELD positions keyed by local truck id — used to show the
  // Location column when a truck's ELD is connected.
  const positionByTruckId = useMemo(() => {
    const m = new Map<number, TruckLocation>();
    for (const p of positions) m.set(p.truckId, p);
    return m;
  }, [positions]);

  // Full state name lookup, e.g. "GA" → "Georgia".
  const stateNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of (refData?.states ?? [])) m.set(s.value, s.label);
    return m;
  }, [refData]);

  // Sync form when selected changes
  useEffect(() => {
    setForm(selected ? formFromItem(selected) : emptyForm());
    setErrors({});
    setExteriorHash(selected?.exterior_image_hash ?? null);
  }, [selected]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      setItems(await apiListTrucks());
    } catch {
      setError("Failed to load trucks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    apiListTruckMakes().then(setMakes).catch(() => setMakes([]));
  }, []);

  // Poll Redis-cached fleet positions so the Location column shows current
  // state/city for ELD-connected trucks. 60s matches the sync cron cadence.
  useEffect(() => {
    let cancelled = false;
    async function pull() {
      try {
        const items = await apiGetFleetLocations();
        if (!cancelled) setPositions(items);
      } catch { /* silent — column falls back to "—" */ }
    }
    pull();
    const iv = window.setInterval(pull, 60_000);
    return () => { cancelled = true; window.clearInterval(iv); };
  }, []);

  // Fetch models scoped to the selected make. Skipped until a make is picked.
  useEffect(() => {
    const makeIdInt = form.makeId ? parseInt(form.makeId) : NaN;
    if (!Number.isFinite(makeIdInt)) {
      setModels([]);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    apiListTruckModels(makeIdInt)
      .then(res => { if (!cancelled) setModels(res); })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [form.makeId]);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function setField(k: keyof TruckForm, v: string) {
    setForm(p => {
      const next = { ...p, [k]: v };
      if (k === "makeId") next.modelId = "";
      return next;
    });
    // clear this field's error as the user edits; also clear model's error when
    // make changes since we reset model above.
    setErrors(p => {
      const patch: Record<string, string | null> = {};
      if (p[k]) patch[k] = null;
      if (k === "makeId" && p.modelId) patch.modelId = null;
      return Object.keys(patch).length ? { ...p, ...patch } : p;
    });
  }

  function handleBlur(k: keyof TruckForm) {
    const fn = TRUCK_VALIDATORS[k];
    if (!fn) return;
    const err = fn(form[k] as string);
    setErrors(p => ({ ...p, [k]: err }));
  }

  function openAdd() {
    setSelected(null);
    setDrawerMode("add");
    setDrawerOpen(true);
  }

  function openEdit(t: TruckItem) {
    setSelected(t);
    setDrawerMode("edit");
    setDrawerOpen(true);
  }

  async function handleSave() {
    const errs = validateAllTruck(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast(false, `Please fix ${Object.keys(errs).length} validation error(s)`);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        truckNumber:        form.truckNumber,
        year:               form.year               ? parseInt(form.year)               : null,
        make:               form.makeId             ? parseInt(form.makeId)             : null,
        model:              form.modelId            ? parseInt(form.modelId)            : null,
        vin:                form.vin                || null,
        plateNumber:        form.plateNumber        || null,
        plateState:         form.plateState         || null,
        color:              form.color              || null,
        bedCount:           form.bedCount           ? parseInt(form.bedCount)           : null,
        cabType:            form.cabType            || null,
        sleeperSize:        form.sleeperSize        || null,
        engineType:         form.engineType         || null,
        engineNumber:       form.engineNumber       || null,
        fuelType:           form.fuelType           || null,
        transmission:       form.transmission       || null,
        axleCount:          form.axleCount          ? parseInt(form.axleCount)          : null,
        gvwr:               form.gvwr               ? parseInt(form.gvwr)               : null,
        fuelCapacity:       form.fuelCapacity       ? parseInt(form.fuelCapacity)       : null,
        currentLocation:    form.currentLocation    || null,
        homeTerminal:       form.homeTerminal       || null,
        currentMileage:     form.currentMileage     ? parseInt(form.currentMileage)     : null,
        engineHours:        form.engineHours        ? parseInt(form.engineHours)        : null,
        lastInspectionDate: form.lastInspectionDate || null,
        inspectionInterval: form.inspectionInterval ? parseInt(form.inspectionInterval) : null,
        oilChangeInterval:  form.oilChangeInterval  ? parseInt(form.oilChangeInterval)  : null,
        pmServiceInterval:  form.pmServiceInterval  ? parseInt(form.pmServiceInterval)  : null,
        status:             parseInt(form.status),
      };
      if (drawerMode === "add") {
        await apiCreateTruck(payload);
      } else if (selected) {
        await apiUpdateTruck(selected.id, payload);
      }
      await loadData();
      showToast(true, drawerMode === "add" ? "Truck created" : "Truck updated");
      setDrawerOpen(false);
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: TruckItem) {
    const label = t.truck_number ?? `truck #${t.id}`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiDeleteTruck(t.id);
      await loadData();
      showToast(true, "Truck deleted");
      // If the drawer had this same truck open, close it.
      if (selected?.id === t.id) setDrawerOpen(false);
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleUploadExterior(file: File) {
    if (!selected) return;
    setImageBusy(true);
    try {
      const res = await apiUploadTruckImage(selected.id, file);
      setExteriorHash(res.exteriorImageHash);
      showToast(true, "Exterior image uploaded");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setImageBusy(false);
    }
  }

  async function handleDeleteExterior() {
    if (!selected) return;
    if (!window.confirm("Remove exterior image?")) return;
    setImageBusy(true);
    try {
      await apiDeleteTruckImage(selected.id);
      setExteriorHash(null);
      showToast(true, "Exterior image removed");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setImageBusy(false);
    }
  }

  const total    = items.length;
  const active   = items.filter(t => t.status === 1).length;
  const inactive = items.filter(t => t.status === 0).length;

  const filtered = statusFilter === "all"      ? items
                 : statusFilter === "active"   ? items.filter(t => t.status === 1)
                 : statusFilter === "inactive" ? items.filter(t => t.status === 0)
                 : items;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* KPIs */}
        <div className="flex gap-3">
          <KpiCard label="Total Trucks" value={total}    icon={Truck}         accent="#6b7e96" active={statusFilter === "all"}      onClick={() => setStatusFilter("all")} />
          <KpiCard label="Active"       value={active}   icon={CheckCircle}   accent="#10b981" active={statusFilter === "active"}   onClick={() => setStatusFilter("active")} />
          <KpiCard label="Inactive"     value={inactive} icon={AlertCircle}   accent="#ef4444" active={statusFilter === "inactive"} onClick={() => setStatusFilter("inactive")} />
        </div>

        {toast && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono ${toast.ok ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400" : "bg-red-500/10 border border-red-500/25 text-red-400"}`}>
            {toast.msg}
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Trucks</span>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <ImportDropdown resource="trucks" onImported={loadData} />
              <Btn variant="primary" onClick={openAdd}><Plus size={11} className="inline mr-1" />Add Truck</Btn>
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
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Truck", "Driver", "Status", "Location", "Eng. Hrs", "Inspection", ""].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const spec       = [t.make?.name, t.model?.name, t.year].filter(Boolean).join(" ");
                    const driverName = t.assigned_driver
                      ? [t.assigned_driver.first_name, t.assigned_driver.last_name].filter(Boolean).join(" ") || `Driver #${t.assigned_driver.id}`
                      : null;
                    const pos        = positionByTruckId.get(t.id);
                    const insp       = inspectionStatus(t);
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-border/50 transition-colors hover:bg-muted/40"
                      >
                        {/* Truck: number bold, make/model/year below */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-primary font-semibold">#{t.truck_number ?? `#${t.id}`}</span>
                            <ImportedChip eldSource={t.eld_source} size="xs" />
                          </div>
                          {spec && <div className="text-[11px] text-muted-foreground mt-0.5">{spec}</div>}
                        </td>

                        {/* Driver: name + phone */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {driverName
                            ? (
                              <>
                                <div className="text-xs text-foreground">{driverName}</div>
                                {t.assigned_driver?.phone && (
                                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{t.assigned_driver.phone}</div>
                                )}
                              </>
                            )
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5">
                          <StatusPill
                            label={TRUCK_STATUS_LABEL[t.status] ?? String(t.status)}
                            color={TRUCK_STATUS_COLOR[t.status] ?? "#6b7e96"}
                          />
                        </td>

                        {/* Location: city on top, state name + initials below (from Redis-cached ELD position) */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {(pos?.location || pos?.state)
                            ? (
                              <>
                                {pos.location && <div className="text-xs text-foreground">{pos.location}</div>}
                                {pos.state && (
                                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                    {(stateNameByCode.get(pos.state) ?? pos.state)} · {pos.state}
                                  </div>
                                )}
                              </>
                            )
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>

                        {/* Engine Hours */}
                        <td className="px-3 py-2.5 text-xs font-mono text-foreground">
                          {t.engine_hours != null ? t.engine_hours.toLocaleString() : "—"}
                        </td>

                        {/* Inspection: date + status */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {t.last_inspection_date
                            ? <div className="text-xs font-mono text-foreground">{t.last_inspection_date}</div>
                            : <div className="text-xs text-muted-foreground">—</div>}
                          {insp.kind === "completed" && <div className="text-[11px] font-mono text-emerald-400 mt-0.5">Completed</div>}
                          {insp.kind === "overdue"   && <div className="text-[11px] font-mono text-red-400 mt-0.5">Overdue</div>}
                          {insp.kind === "due"       && <div className="text-[11px] font-mono text-muted-foreground mt-0.5">Due in {insp.miles.toLocaleString()} mi</div>}
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
                      <td colSpan={7} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">No trucks found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
            <span className="text-xs font-mono text-muted-foreground">
              Showing {filtered.length} of {total} trucks
            </span>
          </div>
        </div>
      </div>

      <SlideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerMode === "add" ? "Add New Truck" : "Edit Truck"}
        badge={drawerMode === "edit" ? (selected?.truck_number ?? `#${selected?.id}`) : "NEW"}
        onSave={handleSave}
        saving={saving}
        onDelete={drawerMode === "edit" && selected ? () => handleDelete(selected) : undefined}
        deleting={deleting}
      >
        {drawerMode === "edit" && selected?.eld_source && (
          <div className="pb-3"><ImportedChip eldSource={selected.eld_source} /></div>
        )}
        <TruckFormFields
          form={form} set={setField} errors={errors} onBlur={handleBlur} makes={makes} models={models} modelsLoading={modelsLoading}
          exteriorImage={drawerMode === "edit" && selected ? {
            imageUrl: documentUrl(imagesHost, "trucks", exteriorHash, "full"),
            busy:     imageBusy,
            onUpload: handleUploadExterior,
            onDelete: handleDeleteExterior,
          } : undefined}
        />
      </SlideDrawer>
    </>
  );
}
