import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  Users, AlertTriangle, Clock, Shield, Pencil, Plus, Trash2,
} from "lucide-react";
import {
  KpiCard, StatusPill, Btn, SlideDrawer, DrawerSection, DrawerFieldRow,
  DrawerField as Field, DrawerSelect as Select, DrawerFieldRow as FieldRow,
  DrawerTextarea as Textarea, CodeToggle as EndorsementToggle, DrawerFileField,
  DrawerCell, ActionsMenu,
} from "../lib/ui";
import {
  apiListDrivers, apiCreateDriver, apiUpdateDriver, apiDeleteDriver, ApiError, type DriverItem,
  apiListAvailableTrucks, type TruckItem,
  apiUploadDriverDocument, apiDeleteDriverDocument, documentUrl,
  type DriverDocumentType,
} from "../lib/api";
import { useRefData } from "../lib/data";
import {
  validateRequired, validateEmail, validatePhone, validateSSN, validateZip,
  validateFutureDate, validatePositiveInt, combineValidators, formatDate,
} from "../lib/validators";
import { maskPhone, maskSSN, maskZip } from "../lib/masks";
import { ImportedChip } from "../components/ImportedChip";
import { ImportDropdown } from "../components/ImportDropdown";

// ─── Form state ──────────────────────────────────────────────────────────────

interface DriverForm {
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  ssn: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  driverNumber: string;
  hireDate: string;
  driverType: string;
  homeTerminal: string;
  payType: string;
  licenseType: string;
  licenseNumber: string;
  licenseState: string;
  licenseIssueDate: string;
  licenseExpiration: string;
  endorsementDoublesTriples: boolean;
  endorsementHazardous: boolean;
  endorsementTanker: boolean;
  endorsementPassenger: boolean;
  endorsementSchool: boolean;
  endorsementTank: boolean;
  medicalCertNumber: string;
  medicalCertIssueDate: string;
  medicalCertExpirationDate: string;
  yearsOfExperience: string;
  cdlSchool: string;
  notes: string;
  status: string;
  assignedTruckId: string;
}

const emptyForm = (): DriverForm => ({
  firstName: "", lastName: "", middleName: "", phone: "", email: "",
  dateOfBirth: "", ssn: "", address: "", city: "", state: "", zip: "",
  driverNumber: "", hireDate: "", driverType: "", homeTerminal: "", payType: "",
  licenseType: "", licenseNumber: "", licenseState: "", licenseIssueDate: "", licenseExpiration: "",
  endorsementDoublesTriples: false, endorsementHazardous: false, endorsementTanker: false,
  endorsementPassenger: false, endorsementSchool: false, endorsementTank: false,
  medicalCertNumber: "", medicalCertIssueDate: "", medicalCertExpirationDate: "",
  yearsOfExperience: "", cdlSchool: "", notes: "", status: "active",
  assignedTruckId: "",
});

function formFromItem(d: DriverItem): DriverForm {
  return {
    firstName:                  d.first_name                    ?? "",
    lastName:                   d.last_name                     ?? "",
    middleName:                 d.middle_name                   ?? "",
    phone:                      maskPhone(d.phone               ?? ""),
    email:                      d.email                         ?? "",
    dateOfBirth:                d.date_of_birth                 ?? "",
    ssn:                        maskSSN(d.ssn                   ?? ""),
    address:                    d.address                       ?? "",
    city:                       d.city                          ?? "",
    state:                      d.state                         ?? "",
    zip:                        maskZip(d.zip                   ?? ""),
    driverNumber:               d.driver_number                 ?? "",
    hireDate:                   d.hire_date                     ?? "",
    driverType:                 d.driver_type                   ?? "",
    homeTerminal:               d.home_terminal                 ?? "",
    payType:                    d.pay_type                      ?? "",
    licenseType:                d.license_type                  ?? "",
    licenseNumber:              d.license_number                ?? "",
    licenseState:               d.license_state                 ?? "",
    licenseIssueDate:           d.license_issue_date            ?? "",
    licenseExpiration:          d.license_expiration            ?? "",
    endorsementDoublesTriples:  d.endorsement_doubles_triples   ?? false,
    endorsementHazardous:       d.endorsement_hazardous         ?? false,
    endorsementTanker:          d.endorsement_tanker            ?? false,
    endorsementPassenger:       d.endorsement_passenger         ?? false,
    endorsementSchool:          d.endorsement_school            ?? false,
    endorsementTank:            d.endorsement_tank              ?? false,
    medicalCertNumber:          d.medical_cert_number           ?? "",
    medicalCertIssueDate:       d.medical_cert_issue_date       ?? "",
    medicalCertExpirationDate:  d.medical_cert_expiration_date  ?? "",
    yearsOfExperience:          d.years_of_experience?.toString() ?? "",
    cdlSchool:                  d.cdl_school                    ?? "",
    notes:                      d.notes                         ?? "",
    status:                     d.status                        ?? "active",
    assignedTruckId:            d.assigned_truck?.id?.toString() ?? "",
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

const DRIVER_VALIDATORS: Partial<Record<string, (v: string) => string | null>> = {
  firstName:                 validateRequired,
  lastName:                  validateRequired,
  email:                     validateEmail,
  phone:                     combineValidators(validateRequired, validatePhone),
  ssn:                       validateSSN,
  zip:                       validateZip,
  licenseType:               validateRequired,
  licenseNumber:             validateRequired,
  licenseExpiration:         combineValidators(validateRequired, validateFutureDate),
  medicalCertExpirationDate: validateFutureDate,
  yearsOfExperience:         validatePositiveInt,
};

function validateAllDriver(form: DriverForm): Record<string, string | null> {
  const errs: Record<string, string | null> = {};
  for (const k in DRIVER_VALIDATORS) {
    const fn = DRIVER_VALIDATORS[k];
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

// ─── Driver form component ───────────────────────────────────────────────────

type StringField = "firstName"|"lastName"|"middleName"|"phone"|"email"|"dateOfBirth"|"ssn"|
  "address"|"city"|"state"|"zip"|"driverNumber"|"hireDate"|"driverType"|"homeTerminal"|"payType"|
  "licenseType"|"licenseNumber"|"licenseState"|"licenseIssueDate"|"licenseExpiration"|
  "medicalCertNumber"|"medicalCertIssueDate"|"medicalCertExpirationDate"|
  "yearsOfExperience"|"cdlSchool"|"notes"|"status"|"assignedTruckId";

type BoolField = "endorsementDoublesTriples"|"endorsementHazardous"|"endorsementTanker"|
  "endorsementPassenger"|"endorsementSchool"|"endorsementTank";

function DriverFormFields({
  form, set, toggle, errors, onBlur, trucks, documentsSlot,
}: {
  form: DriverForm;
  set: (k: StringField, v: string) => void;
  toggle: (k: BoolField) => void;
  errors: Record<string, string | null>;
  onBlur: (k: StringField) => void;
  trucks: TruckItem[];
  /** Rendered as its own section by the parent (edit mode only). */
  documentsSlot?: ReactNode;
}) {
  const { data: refData } = useRefData();
  const states       = refData?.states             ?? [];
  const driverTypes  = refData?.driverTypes        ?? ["Company", "Owner-Operator", "Lease"];
  const payTypes     = refData?.driverPayTypes     ?? ["Per Mile", "Hourly", "Salary", "Percentage"];
  const licenseTypes = refData?.driverLicenseTypes ?? ["CDL-A", "CDL-B", "CDL-C", "Non-CDL"];

  return (
    <>
      <DrawerSection title="Personal Information">
        <DrawerFieldRow>
          <Field label="First Name"  value={form.firstName} required onChange={v => set("firstName", v)} onBlur={() => onBlur("firstName")} error={errors.firstName} />
          <Field label="Last Name"   value={form.lastName}  required onChange={v => set("lastName", v)}  onBlur={() => onBlur("lastName")}  error={errors.lastName} />
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Field label="Middle Name" value={form.middleName} onChange={v => set("middleName", v)} />
          <Field label="Date of Birth" value={form.dateOfBirth} type="date" onChange={v => set("dateOfBirth", v)} />
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Field label="Phone" value={form.phone} type="tel" required onChange={v => set("phone", maskPhone(v))} onBlur={() => onBlur("phone")} error={errors.phone} />
          <Field label="Email" value={form.email} type="email" onChange={v => set("email", v)} onBlur={() => onBlur("email")} error={errors.email} />
        </DrawerFieldRow>
        <Field label="SSN" value={form.ssn} mono hint="Social Security Number — stored securely" onChange={v => set("ssn", maskSSN(v))} onBlur={() => onBlur("ssn")} error={errors.ssn} />
      </DrawerSection>

      <DrawerSection title="Address">
        <Field label="Street Address" value={form.address} onChange={v => set("address", v)} />
        <DrawerFieldRow>
          <Field label="City" value={form.city} onChange={v => set("city", v)} />
          <Field label="Zip"  value={form.zip}  mono onChange={v => set("zip", maskZip(v))} onBlur={() => onBlur("zip")} error={errors.zip} />
        </DrawerFieldRow>
        <Select label="State" value={form.state} onChange={v => set("state", v)}>
          <option value="">— Select —</option>
          {states.map(s => <option key={s.value} value={s.value}>{s.value} — {s.label}</option>)}
        </Select>
      </DrawerSection>

      <DrawerSection title="Other Information">
        <DrawerFieldRow>
          <Field label="Driver #" value={form.driverNumber} mono onChange={v => set("driverNumber", v)} />
          <Field label="Hire Date" value={form.hireDate} type="date" onChange={v => set("hireDate", v)} />
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Select label="Driver Type" value={form.driverType} onChange={v => set("driverType", v)}>
            <option value="">— Select —</option>
            {driverTypes.map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
          <Select label="Pay Type" value={form.payType} onChange={v => set("payType", v)}>
            <option value="">— Select —</option>
            {payTypes.map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
        </DrawerFieldRow>
        <Select label="Assigned Truck" value={form.assignedTruckId} onChange={v => set("assignedTruckId", v)}>
          <option value="">— Unassigned —</option>
          {trucks.map(t => {
            const spec = [t.make?.name, t.model?.name, t.year].filter(Boolean).join(" ");
            const label = t.truck_number ?? `#${t.id}`;
            return <option key={t.id} value={t.id}>{spec ? `${label} — ${spec}` : label}</option>;
          })}
        </Select>
        <Field label="Home Terminal" value={form.homeTerminal} onChange={v => set("homeTerminal", v)} />
        <Select label="Status" value={form.status} onChange={v => set("status", v)}>
          <option value="active">Active</option>
          <option value="off_duty">Off Duty</option>
          <option value="suspended">Suspended</option>
        </Select>
      </DrawerSection>

      <DrawerSection title="License & Certification">
        <DrawerFieldRow>
          <Select label="License Type" value={form.licenseType} required error={errors.licenseType} onChange={v => set("licenseType", v)}>
            <option value="">— Select —</option>
            {licenseTypes.map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
          <Field label="License #" value={form.licenseNumber} mono required onChange={v => set("licenseNumber", v)} onBlur={() => onBlur("licenseNumber")} error={errors.licenseNumber} />
        </DrawerFieldRow>
        <DrawerFieldRow>
          <Select label="License State" value={form.licenseState} onChange={v => set("licenseState", v)}>
            <option value="">— Select —</option>
            {states.map(s => <option key={s.value} value={s.value}>{s.value} — {s.label}</option>)}
          </Select>
          <Field label="Issue Date" value={form.licenseIssueDate} type="date" onChange={v => set("licenseIssueDate", v)} />
        </DrawerFieldRow>
        <Field label="Expiration Date" value={form.licenseExpiration} type="date" required onChange={v => set("licenseExpiration", v)} onBlur={() => onBlur("licenseExpiration")} error={errors.licenseExpiration} />
      </DrawerSection>

      <DrawerSection title="Endorsements">
        <DrawerCell>
          <div className="flex gap-1.5">
            <EndorsementToggle code="T/T" label="Doubles/Triples" active={form.endorsementDoublesTriples} onToggle={() => toggle("endorsementDoublesTriples")} />
            <EndorsementToggle code="H"   label="Hazardous"       active={form.endorsementHazardous}       onToggle={() => toggle("endorsementHazardous")} />
            <EndorsementToggle code="N"   label="Tanker"          active={form.endorsementTanker}          onToggle={() => toggle("endorsementTanker")} />
            <EndorsementToggle code="P"   label="Passenger"       active={form.endorsementPassenger}       onToggle={() => toggle("endorsementPassenger")} />
            <EndorsementToggle code="S"   label="School Bus"      active={form.endorsementSchool}          onToggle={() => toggle("endorsementSchool")} />
            <EndorsementToggle code="X"   label="Tank Vehicle"    active={form.endorsementTank}            onToggle={() => toggle("endorsementTank")} />
          </div>
          <p className="text-[10px] font-mono text-muted-foreground/70 mt-2">
            {[
              form.endorsementDoublesTriples && "Doubles/Triples",
              form.endorsementHazardous && "Hazardous",
              form.endorsementTanker && "Tanker",
              form.endorsementPassenger && "Passenger",
              form.endorsementSchool && "School Bus",
              form.endorsementTank && "Tank Vehicle",
            ].filter(Boolean).join(", ") || "None selected"}
          </p>
        </DrawerCell>
      </DrawerSection>

      <DrawerSection title="Medical Certification">
        <DrawerFieldRow>
          <Field label="Cert #" value={form.medicalCertNumber} mono onChange={v => set("medicalCertNumber", v)} />
          <Field label="Issue Date" value={form.medicalCertIssueDate} type="date" onChange={v => set("medicalCertIssueDate", v)} />
        </DrawerFieldRow>
        <Field label="Expiration Date" value={form.medicalCertExpirationDate} type="date" onChange={v => set("medicalCertExpirationDate", v)} onBlur={() => onBlur("medicalCertExpirationDate")} error={errors.medicalCertExpirationDate} />
      </DrawerSection>

      {documentsSlot}

      <DrawerSection title="Additional Information">
        <DrawerFieldRow>
          <Field label="Years of Experience" value={form.yearsOfExperience} type="number" onChange={v => set("yearsOfExperience", v)} onBlur={() => onBlur("yearsOfExperience")} error={errors.yearsOfExperience} />
          <Field label="CDL School" value={form.cdlSchool} onChange={v => set("cdlSchool", v)} />
        </DrawerFieldRow>
        <Textarea label="Notes" value={form.notes} onChange={v => set("notes", v)} />
      </DrawerSection>
    </>
  );
}

// ─── Document upload slots ───────────────────────────────────────────────────
//
// Mirrors DriverController::DOCUMENT_TYPE_SETTERS on the API. Rendered as one
// DrawerFileField per entry inside the "Documents" section of the edit drawer.
// Add a slot here to expose a new upload widget — no other UI change needed.

const DOCUMENT_SLOTS: { type: DriverDocumentType; label: string; hint?: string }[] = [
  { type: "license_front",       label: "License (Front)",     hint: "Photo or scan — JPG/PNG" },
  { type: "license_back",        label: "License (Back)",      hint: "Photo or scan — JPG/PNG" },
  { type: "medical_certificate", label: "Medical Certificate", hint: "Photo or scan — JPG/PNG" },
  { type: "ssn_card",            label: "SSN Card",            hint: "Sensitive — stored securely" },
  { type: "proof_of_address",    label: "Proof of Address",    hint: "Utility bill / lease agreement" },
  { type: "other",               label: "Other Document" },
];

// ─── Status helpers ──────────────────────────────────────────────────────────

const DRIVER_STATUS_LABEL: Record<string, string> = {
  active: "Active", off_duty: "Off Duty", suspended: "Suspended", terminated: "Terminated",
};
const DRIVER_STATUS_COLOR: Record<string, string> = {
  active: "#10b981", off_duty: "#f59e0b", suspended: "#ef4444", terminated: "#6b7e96",
};

// ─── Expiry helpers ──────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function expiryClass(days: number | null): string {
  if (days == null) return "text-muted-foreground";
  if (days < 0) return "text-red-400 font-semibold";
  if (days < 90) return "text-amber-400";
  return "text-muted-foreground";
}

// ─── Endorsements + Documents row-cell helpers ───────────────────────────────

/** Same code → boolean-field mapping used in the drawer's Endorsements section. */
const ENDORSEMENT_CELLS: { code: string; field: keyof DriverItem }[] = [
  { code: "T/T", field: "endorsement_doubles_triples" },
  { code: "H",   field: "endorsement_hazardous" },
  { code: "N",   field: "endorsement_tanker" },
  { code: "P",   field: "endorsement_passenger" },
  { code: "S",   field: "endorsement_school" },
  { code: "X",   field: "endorsement_tank" },
];

/**
 * All six document hashes on the Driver entity. Missing any of them → the
 * Documents cell shows "N Required" (amber). All present → "All up to date"
 * (emerald).
 */
const REQUIRED_DOC_HASHES: (keyof DriverItem)[] = [
  "license_front_hash",
  "license_back_hash",
  "medical_certificate_hash",
  "ssn_card_hash",
  "proof_of_address_hash",
  "other_document_hash",
];

function missingDocCount(d: DriverItem): number {
  return REQUIRED_DOC_HASHES.filter(k => !d[k]).length;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Drivers() {
  const [items,        setItems]        = useState<DriverItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [drawerMode,   setDrawerMode]   = useState<"add" | "edit">("add");
  const [selected,     setSelected]     = useState<DriverItem | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [toast,        setToast]        = useState<{ ok: boolean; msg: string } | null>(null);
  const [form,         setFormState]    = useState<DriverForm>(emptyForm());
  const [errors,       setErrors]       = useState<Record<string, string | null>>({});
  const [trucks,       setTrucks]       = useState<TruckItem[]>([]);

  // Document hashes are managed outside the form — the upload endpoint
  // writes them directly to the entity, so we mirror them here so the
  // widget can render the current thumbnail without a full driver reload.
  const [docHashes,    setDocHashes]    = useState<Record<string, string | null>>({});
  const [docBusy,      setDocBusy]      = useState<string | null>(null);
  const { data: refData } = useRefData();
  const imagesHost = refData?.imagesHost ?? "";

  useEffect(() => {
    setFormState(selected ? formFromItem(selected) : emptyForm());
    setErrors({});
    setDocHashes({
      license_front:        selected?.license_front_hash        ?? null,
      license_back:         selected?.license_back_hash         ?? null,
      medical_certificate:  selected?.medical_certificate_hash  ?? null,
      ssn_card:             selected?.ssn_card_hash             ?? null,
      proof_of_address:     selected?.proof_of_address_hash     ?? null,
      other:                selected?.other_document_hash       ?? null,
    });
  }, [selected]);

  // Truck picker options: /available returns trucks with no driver. When
  // editing a driver who already has a truck, prepend it so the current
  // selection can still render in the dropdown.
  const truckOptions = useMemo(() => {
    const current = selected?.assigned_truck;
    if (!current) return trucks;
    if (trucks.some(t => t.id === current.id)) return trucks;
    return [{ id: current.id, status: 1, truck_number: current.truck_number } as TruckItem, ...trucks];
  }, [trucks, selected]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      setItems(await apiListDrivers());
    } catch {
      setError("Failed to load drivers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    apiListAvailableTrucks().then(setTrucks).catch(() => setTrucks([]));
  }, []);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function set(k: StringField, v: string) {
    setFormState(p => ({ ...p, [k]: v }));
    setErrors(p => (p[k] ? { ...p, [k]: null } : p));
  }

  function toggle(k: BoolField) {
    setFormState(p => ({ ...p, [k]: !p[k] }));
  }

  function handleBlur(k: StringField) {
    const fn = DRIVER_VALIDATORS[k];
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

  function openEdit(d: DriverItem) {
    setSelected(d);
    setDrawerMode("edit");
    setDrawerOpen(true);
  }

  async function handleSave() {
    const errs = validateAllDriver(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast(false, `Please fix ${Object.keys(errs).length} validation error(s)`);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        firstName:                 form.firstName                 || null,
        lastName:                  form.lastName                  || null,
        middleName:                form.middleName                || null,
        phone:                     form.phone                     || null,
        email:                     form.email                     || null,
        dateOfBirth:               form.dateOfBirth               || null,
        ssn:                       form.ssn                       || null,
        address:                   form.address                   || null,
        city:                      form.city                      || null,
        state:                     form.state                     || null,
        zip:                       form.zip                       || null,
        driverNumber:              form.driverNumber              || null,
        hireDate:                  form.hireDate                  || null,
        driverType:                form.driverType                || null,
        homeTerminal:              form.homeTerminal              || null,
        payType:                   form.payType                   || null,
        licenseType:               form.licenseType               || null,
        licenseNumber:             form.licenseNumber             || null,
        licenseState:              form.licenseState              || null,
        licenseIssueDate:          form.licenseIssueDate          || null,
        licenseExpiration:         form.licenseExpiration         || null,
        endorsementDoublesTriples: form.endorsementDoublesTriples,
        endorsementHazardous:      form.endorsementHazardous,
        endorsementTanker:         form.endorsementTanker,
        endorsementPassenger:      form.endorsementPassenger,
        endorsementSchool:         form.endorsementSchool,
        endorsementTank:           form.endorsementTank,
        medicalCertNumber:         form.medicalCertNumber         || null,
        medicalCertIssueDate:      form.medicalCertIssueDate      || null,
        medicalCertExpirationDate: form.medicalCertExpirationDate || null,
        yearsOfExperience:         form.yearsOfExperience ? parseInt(form.yearsOfExperience) : null,
        cdlSchool:                 form.cdlSchool                 || null,
        notes:                     form.notes                     || null,
        status:                    form.status,
        assignedTruck:             form.assignedTruckId ? parseInt(form.assignedTruckId) : null,
      };
      if (drawerMode === "add") {
        await apiCreateDriver(payload);
      } else if (selected) {
        await apiUpdateDriver(selected.id, payload);
      }
      await loadData();
      showToast(true, drawerMode === "add" ? "Driver created" : "Driver updated");
      setDrawerOpen(false);
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(d: DriverItem) {
    const label = [d.first_name, d.last_name].filter(Boolean).join(" ") || `driver #${d.id}`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiDeleteDriver(d.id);
      await loadData();
      showToast(true, "Driver deleted");
      if (selected?.id === d.id) setDrawerOpen(false);
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleUploadDocument(type: DriverDocumentType, file: File) {
    if (!selected) return;
    setDocBusy(type);
    try {
      const res = await apiUploadDriverDocument(selected.id, type, file);
      setDocHashes(prev => ({ ...prev, [type]: res.hash }));
      showToast(true, "Document uploaded");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setDocBusy(null);
    }
  }

  async function handleDeleteDocument(type: DriverDocumentType) {
    if (!selected) return;
    if (!window.confirm("Remove this document?")) return;
    setDocBusy(type);
    try {
      await apiDeleteDriverDocument(selected.id, type);
      setDocHashes(prev => ({ ...prev, [type]: null }));
      showToast(true, "Document removed");
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setDocBusy(null);
    }
  }

  const today = new Date();
  const in90  = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  const kpiAll       = items.length;
  const kpiActive    = items.filter(d => d.status === "active").length;
  const kpiOffDuty   = items.filter(d => d.status === "off_duty").length;
  const kpiSuspended = items.filter(d => d.status === "suspended").length;
  const kpiMedExp    = items.filter(d => {
    if (!d.medical_cert_expiration_date) return false;
    const exp = new Date(d.medical_cert_expiration_date);
    return exp > today && exp <= in90;
  }).length;
  const kpiLicExp = items.filter(d => {
    if (!d.license_expiration) return false;
    const exp = new Date(d.license_expiration);
    return exp > today && exp <= in90;
  }).length;

  const withinDays = (iso: string | null | undefined) => {
    if (!iso) return false;
    const exp = new Date(iso);
    return exp > today && exp <= in90;
  };

  const filtered = statusFilter === "all"           ? items
                 : statusFilter === "active"        ? items.filter(d => d.status === "active")
                 : statusFilter === "off_duty"      ? items.filter(d => d.status === "off_duty")
                 : statusFilter === "suspended"     ? items.filter(d => d.status === "suspended")
                 : statusFilter === "med_expiring"  ? items.filter(d => withinDays(d.medical_cert_expiration_date))
                 : statusFilter === "lic_expiring"  ? items.filter(d => withinDays(d.license_expiration))
                 : items;

  const driverName = (d: DriverItem) =>
    [d.first_name, d.last_name].filter(Boolean).join(" ") || `Driver #${d.id}`;

  const driverInitials = (d: DriverItem) =>
    ((d.first_name?.[0] ?? "") + (d.last_name?.[0] ?? "")).toUpperCase() || "?";

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* KPIs */}
        <div className="flex gap-3 flex-wrap">
          <KpiCard label="All Drivers"    value={kpiAll}       icon={Users}         accent="#6b7e96" active={statusFilter === "all"}       onClick={() => setStatusFilter("all")} />
          <KpiCard label="Active"         value={kpiActive}    icon={Users}         accent="#10b981" active={statusFilter === "active"}    onClick={() => setStatusFilter("active")} />
          <KpiCard label="Off Duty"       value={kpiOffDuty}   icon={Clock}         accent="#f59e0b" active={statusFilter === "off_duty"}  onClick={() => setStatusFilter("off_duty")} />
          <KpiCard label="Suspended"      value={kpiSuspended} icon={AlertTriangle} accent="#ef4444" active={statusFilter === "suspended"} onClick={() => setStatusFilter("suspended")} />
          <KpiCard label="Med Expiring"   value={kpiMedExp}    icon={Clock}         accent="#f59e0b" sub="Within 90 days" active={statusFilter === "med_expiring"} onClick={() => setStatusFilter("med_expiring")} />
          <KpiCard label="Lic. Expiring"  value={kpiLicExp}    icon={Shield}        accent="#8b5cf6" sub="Within 90 days" active={statusFilter === "lic_expiring"} onClick={() => setStatusFilter("lic_expiring")} />
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
              <span className="text-sm font-medium text-foreground">All Drivers</span>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <ImportDropdown resource="drivers" onImported={loadData} />
              <Btn variant="primary" onClick={openAdd}><Plus size={11} className="inline mr-1" />Add Driver</Btn>
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
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Driver", "Contact", "License / CDL", "Medical Cert.", "Endorsements", "Documents", "Experience", ""].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const missingDocs = missingDocCount(d);
                    const medDays     = daysUntil(d.medical_cert_expiration_date);
                    const licDays     = daysUntil(d.license_expiration);
                    return (
                      <tr key={d.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                        {/* Driver: initials-in-status-color + name, phone below */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-semibold flex-shrink-0"
                              style={{ backgroundColor: `${DRIVER_STATUS_COLOR[d.status] ?? "#6b7e96"}20`, color: DRIVER_STATUS_COLOR[d.status] ?? "#6b7e96" }}
                            >
                              {driverInitials(d)}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-foreground">{driverName(d)}</span>
                                <ImportedChip eldSource={d.eld_source} size="xs" />
                              </div>
                              {d.phone && <div className="text-[11px] font-mono text-muted-foreground">{d.phone}</div>}
                            </div>
                          </div>
                        </td>

                        {/* Contact: phone + email */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="text-xs font-mono text-foreground">{d.phone ?? "—"}</div>
                          {d.email && <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{d.email}</div>}
                        </td>

                        {/* License / CDL: type on top, number below */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="text-xs font-mono text-foreground">{d.license_type ?? "—"}</div>
                          {d.license_number && <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{d.license_number}</div>}
                          {d.license_expiration && licDays != null && licDays < 90 && (
                            <div className={`text-[11px] font-mono mt-0.5 ${expiryClass(licDays)}`}>
                              {licDays < 0 ? "EXPIRED" : `Exp in ${licDays}d`}
                            </div>
                          )}
                        </td>

                        {/* Medical Cert.: issue date on top, expiration below */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {d.medical_cert_issue_date
                            ? <div className="text-xs font-mono text-foreground">{formatDate(d.medical_cert_issue_date)}</div>
                            : <div className="text-xs text-muted-foreground">—</div>}
                          {d.medical_cert_expiration_date && (
                            <div className={`text-[11px] font-mono mt-0.5 ${medDays != null && medDays < 90 ? expiryClass(medDays) : "text-muted-foreground"}`}>
                              Exp {formatDate(d.medical_cert_expiration_date)}
                            </div>
                          )}
                        </td>

                        {/* Endorsements: compressed codes, active in primary, inactive muted */}
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1.5 text-[11px] font-mono font-semibold tracking-wider">
                            {ENDORSEMENT_CELLS.map(e => (
                              <span
                                key={e.code}
                                title={e.code}
                                className={d[e.field] ? "text-primary" : "text-muted-foreground/30"}
                              >
                                {e.code}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Documents: aggregate status */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {missingDocs === 0
                            ? <span className="text-xs font-mono text-emerald-400">All up to date</span>
                            : <span className="text-xs font-mono text-amber-400">{missingDocs} Required</span>}
                        </td>

                        {/* Experience */}
                        <td className="px-3 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">
                          {d.years_of_experience != null ? `${d.years_of_experience} yr` : "—"}
                        </td>

                        <td className="px-3 py-2.5">
                          <ActionsMenu items={[
                            { label: "Edit",   onClick: () => openEdit(d),   icon: Pencil },
                            { label: "Delete", onClick: () => handleDelete(d), icon: Trash2, variant: "danger" },
                          ]} />
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-xs font-mono text-muted-foreground">No drivers found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
            <span className="text-xs font-mono text-muted-foreground">Showing {filtered.length} of {kpiAll} drivers</span>
          </div>
        </div>
      </div>

      <SlideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerMode === "add" ? "Add New Driver" : "Edit Driver"}
        badge={drawerMode === "edit" ? (selected?.driver_number ?? `#${selected?.id}`) : "NEW"}
        onSave={handleSave}
        saving={saving}
        onDelete={drawerMode === "edit" && selected ? () => handleDelete(selected) : undefined}
        deleting={deleting}
      >
        {drawerMode === "edit" && selected?.eld_source && (
          <div className="pb-3"><ImportedChip eldSource={selected.eld_source} /></div>
        )}
        <DriverFormFields
          form={form} set={set} toggle={toggle} errors={errors} onBlur={handleBlur} trucks={truckOptions}
          documentsSlot={drawerMode === "edit" && selected && (
            <DrawerSection title="Documents">
              <DrawerFieldRow cols={3}>
                {DOCUMENT_SLOTS.map(slot => (
                  <DrawerFileField
                    key={slot.type}
                    label={slot.label}
                    hint={slot.hint}
                    imageUrl={documentUrl(imagesHost, "drivers", docHashes[slot.type], "full")}
                    busy={docBusy === slot.type}
                    onUpload={file => handleUploadDocument(slot.type, file)}
                    onDelete={() => handleDeleteDocument(slot.type)}
                  />
                ))}
              </DrawerFieldRow>
            </DrawerSection>
          )}
        />
      </SlideDrawer>
    </>
  );
}
