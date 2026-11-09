import type { ElementType } from "react";
import {
  Fuel, Wrench, Receipt, FileBadge, ShieldCheck, BedDouble, UtensilsCrossed,
  Scale, PackageOpen, CircleParking, CircleDollarSign,
} from "lucide-react";

/**
 * Presentation for the ledger's closed sets.
 *
 * The API is the authority on which values exist — they come down in
 * `/api/data` as expenseCategories, expensePaymentMethods and the rest — so
 * nothing here is a list to keep in sync. These are lookups: given a value
 * the server sent, what should it look like. An unknown key falls back to a
 * humanised version of itself rather than rendering blank, which is what
 * makes adding a category server-side a non-event for this file.
 */

function humanise(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const CATEGORY_LABEL: Record<string, string> = {
  fuel: "Fuel",
  maintenance: "Maintenance",
  tolls: "Tolls",
  permits_fees: "Permits & Fees",
  insurance: "Insurance",
  lodging: "Lodging",
  meals: "Meals",
  scale: "Scale",
  lumper: "Lumper",
  parking: "Parking",
  other: "Other",
};

const CATEGORY_COLOR: Record<string, string> = {
  fuel: "#3b82f6",
  maintenance: "#f59e0b",
  tolls: "#ef4444",
  permits_fees: "#10b981",
  insurance: "#8b5cf6",
  lodging: "#ec4899",
  meals: "#f97316",
  scale: "#06b6d4",
  lumper: "#84cc16",
  parking: "#6366f1",
  other: "#6b7e96",
};

const CATEGORY_ICON: Record<string, ElementType> = {
  fuel: Fuel,
  maintenance: Wrench,
  tolls: Receipt,
  permits_fees: FileBadge,
  insurance: ShieldCheck,
  lodging: BedDouble,
  meals: UtensilsCrossed,
  scale: Scale,
  lumper: PackageOpen,
  parking: CircleParking,
  other: CircleDollarSign,
};

export function categoryLabel(key?: string): string {
  if (!key) return "—";
  return CATEGORY_LABEL[key] ?? humanise(key);
}

export function categoryColor(key?: string): string {
  if (!key) return CATEGORY_COLOR.other;
  return CATEGORY_COLOR[key] ?? CATEGORY_COLOR.other;
}

export function categoryIcon(key?: string): ElementType {
  if (!key) return CircleDollarSign;
  return CATEGORY_ICON[key] ?? CircleDollarSign;
}

const PAYMENT_LABEL: Record<string, string> = {
  fuel_card: "Fuel Card",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  transponder: "Transponder",
  cash: "Cash",
  check: "Check",
  ach: "ACH",
  invoice: "Invoice",
  other: "Other",
};

export function paymentLabel(key?: string): string {
  if (!key) return "—";
  return PAYMENT_LABEL[key] ?? humanise(key);
}

const REVIEW_LABEL: Record<string, string> = {
  verified: "Verified",
  unverified: "Unverified",
  flagged: "Flagged",
};

const REVIEW_COLOR: Record<string, string> = {
  verified: "#10b981",
  unverified: "#f59e0b",
  flagged: "#ef4444",
};

export function reviewLabel(key?: string): string {
  if (!key) return "—";
  return REVIEW_LABEL[key] ?? humanise(key);
}

export function reviewColor(key?: string): string {
  if (!key) return "#6b7e96";
  return REVIEW_COLOR[key] ?? "#6b7e96";
}

/**
 * What produced a row. A null source is somebody typing it in; anything else
 * is the integration slug, which the catalog already knows a display name
 * for — pass `integrationName` from useRefData so a provider renamed in the
 * catalog is renamed here too.
 */
export function sourceLabel(source?: string | null, integrationName?: string): string {
  if (!source) return "Manual Entry";
  return `${integrationName ?? humanise(source)} (API)`;
}

const SERVICE_LABEL: Record<string, string> = {
  oil_change: "Oil Change",
  brake_inspection: "Brake Inspection",
  tire_rotation: "Tire Rotation",
  tire_replacement: "Tire Replacement",
  dot_inspection: "DOT Inspection",
  pm_service: "PM Service",
  def_emissions: "DEF / Emissions",
  transmission: "Transmission",
  coolant: "Coolant",
  air_filter: "Air Filter",
  alignment: "Alignment",
  body_work: "Body Work",
  other: "Other",
};

export function serviceLabel(key?: string): string {
  if (!key) return "—";
  return SERVICE_LABEL[key] ?? humanise(key);
}

const DUE_LABEL: Record<string, string> = {
  on_track: "On Track",
  due_soon: "Due Soon",
  overdue: "Overdue",
};

const DUE_COLOR: Record<string, string> = {
  on_track: "#10b981",
  due_soon: "#f59e0b",
  overdue: "#ef4444",
};

export function dueLabel(key?: string): string {
  return DUE_LABEL[key ?? ""] ?? humanise(key ?? "");
}

export function dueColor(key?: string): string {
  return DUE_COLOR[key ?? ""] ?? "#6b7e96";
}

const MAINTENANCE_STATE_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const MAINTENANCE_STATE_COLOR: Record<string, string> = {
  scheduled: "#6366f1",
  in_progress: "#f59e0b",
  completed: "#10b981",
  cancelled: "#6b7e96",
};

export function maintenanceStateLabel(key?: string): string {
  return MAINTENANCE_STATE_LABEL[key ?? ""] ?? humanise(key ?? "");
}

export function maintenanceStateColor(key?: string): string {
  return MAINTENANCE_STATE_COLOR[key ?? ""] ?? "#6b7e96";
}

export function kindLabel(key?: string): string {
  if (key === "repair_order") return "Repair Order";
  if (key === "estimate") return "Estimate";
  if (key === "service") return "Service";
  return humanise(key ?? "");
}

/**
 * Money for display.
 *
 * Returns null when the figure is absent, which is a real state rather than
 * a missing value: `expenses.view_amounts` is a field permission, and a
 * caller without it gets the row with every amount stripped. Callers render
 * null as a dash, not as $0.00 — the difference between "no spend" and "not
 * your business" matters.
 */
export function money(amount?: string | null, currency = "USD"): string | null {
  if (amount === undefined || amount === null || amount === "") return null;
  const value = Number(amount);
  if (Number.isNaN(value)) return null;

  return value.toLocaleString(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Gallons, miles and the like — plain numbers with thousands separators. */
export function num(value?: string | number | null, digits = 0): string | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;

  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** The first and last day of a month, as the API's YYYY-MM-DD. */
export function monthRange(date = new Date()): { from: string; to: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from: iso(new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1))),
    to:   iso(new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0))),
  };
}
