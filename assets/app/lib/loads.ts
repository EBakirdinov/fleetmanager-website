import type { LoadItem, DriverItem } from "./api";

export const LOAD_STATUS_LABEL: Record<string, string> = {
  pending:    "Pending",
  assigned:   "Assigned",
  in_transit: "In Transit",
  delivered:  "Delivered",
  cancelled:  "Cancelled",
};

export const LOAD_STATUS_COLOR: Record<string, string> = {
  pending:    "#f59e0b",
  assigned:   "#0ea5e9",
  in_transit: "#10b981",
  delivered:  "#8b5cf6",
  cancelled:  "#ef4444",
};

export function driverLabel(d: DriverItem | LoadItem["driver"]): string {
  if (!d) return "—";
  const name = [d.first_name, d.last_name].filter(Boolean).join(" ");
  return name || `Driver #${d.id}`;
}
