import type { LoadAccessorialItem } from "../../lib/api";

/**
 * The rate & cost breakdown's catalog and arithmetic.
 *
 * Every figure in Section 6 is a line, and a line is either one of the eleven
 * presets below or something a dispatcher named themselves in the Add
 * Accessorial dialog. The server stores both as rows in `load_accessorial`;
 * this module is what turns those rows into a ledger and back.
 *
 * The preset list mirrors the constants on App\Entity\LoadAccessorial, which
 * is the authority on which category a type belongs to. The labels, tooltips
 * and display order are ours — the API has no opinion about them, which is
 * why renaming a line here renames it on every load at once rather than only
 * on the ones created afterwards.
 */

export type AccessorialCategory =
  | "rate_addition"
  | "surcharge"
  | "other_revenue"
  | "cost";

export const CUSTOM_TYPE = "custom";

/** How long a line's note may be — matches the column and the dialog counter. */
export const NOTES_MAX = 250;

export interface PresetDef {
  type:     string;
  category: AccessorialCategory;
  label:    string;
  /** Shown behind the ⓘ beside the label. Line Haul needs no explaining. */
  tooltip?: string;
}

export const ACCESSORIAL_CATALOG: PresetDef[] = [
  {
    type: "line_haul", category: "rate_addition",
    label: "Line Haul Rate",
  },
  {
    type: "stop_off", category: "rate_addition",
    label: "Stop-Off Pay",
    tooltip: "Paid per extra stop beyond the first pickup and the last delivery.",
  },
  {
    type: "detention", category: "rate_addition",
    label: "Detention",
    tooltip: "Paid when the driver is held at a facility past the free time — usually after two hours.",
  },
  {
    type: "layover", category: "rate_addition",
    label: "Layover",
    tooltip: "Paid when the driver has to wait overnight before loading or unloading.",
  },
  {
    type: "tonu", category: "rate_addition",
    label: "TONU / Cancellation",
    tooltip: "Truck Ordered Not Used — paid when a booked load is cancelled after the truck was dispatched.",
  },
  {
    type: "other_accessorial", category: "rate_addition",
    label: "Other Accessorials",
    tooltip: "Lumper fees, driver assist, pallet exchange — anything else billed on top of the rate.",
  },
  {
    type: "fuel_surcharge", category: "surcharge",
    label: "Fuel Surcharge",
    tooltip: "Additional charge covering fuel cost fluctuations. Some brokers price this as $ per loaded mile.",
  },
  {
    type: "tolls", category: "other_revenue",
    label: "Tolls",
    tooltip: "Road and bridge tolls billed back to the broker.",
  },
  {
    type: "other_revenue", category: "other_revenue",
    label: "Other Revenue",
    tooltip: "Anything earned on this load that is neither part of the rate nor a surcharge.",
  },
  {
    type: "est_fuel", category: "cost",
    label: "Est. Fuel Cost",
    tooltip: "What fuel for this run is expected to cost you. Suggested from the total miles until you type your own.",
  },
  {
    type: "other_cost", category: "cost",
    label: "Other Costs",
    tooltip: "Driver pay, tolls paid out, lumpers — everything else this load costs you to run.",
  },
];

export interface GroupDef {
  category: AccessorialCategory;
  label:    string;
  /**
   * The subtotal row under the group, when it earns one. Rate additions get
   * theirs because that sum is what a rate confirmation quotes, and costs get
   * theirs because it is the figure subtracted from revenue. Surcharges and
   * Other Revenue don't: a subtotal that only ever restates the lines above
   * it is furniture, and both groups feed straight into Total Revenue.
   */
  subtotal?: string;
}

export const ACCESSORIAL_GROUPS: GroupDef[] = [
  { category: "rate_addition", label: "Rate additions (added to line haul)", subtotal: "Total (Rate Additions)" },
  { category: "surcharge",     label: "Surcharges" },
  { category: "other_revenue", label: "Other revenue" },
  { category: "cost",          label: "Estimated costs", subtotal: "Estimated Cost" },
];

/** Category picker in the Add Accessorial dialog, in ledger order. */
export const CATEGORY_OPTIONS: Array<{ value: AccessorialCategory; label: string }> = [
  { value: "rate_addition", label: "Rate Addition (added to line haul)" },
  { value: "surcharge",     label: "Surcharge" },
  { value: "other_revenue", label: "Other Revenue" },
  { value: "cost",          label: "Cost" },
];

/**
 * Common charges the Add Accessorial dialog offers per category.
 *
 * These are names, not types: everything added through the dialog is stored
 * as a custom line carrying whatever it ended up called. The list exists so
 * the usual charges are one pick rather than one spelling decision — three
 * dispatchers left to type it themselves produce "lumper", "Lumper fee" and
 * "LUMPER", and no report can add those together.
 *
 * Presets from the catalog above are deliberately absent: those already have
 * a line of their own on every load, and offering them here would be a second
 * Detention sitting underneath the first.
 */
export const CUSTOM_NAME_SUGGESTIONS: Record<AccessorialCategory, string[]> = {
  rate_addition: [
    "Unloading / Lumper",
    "Driver Assist",
    "Pallet Exchange",
    "Reconsignment",
    "Redelivery",
    "Waiting Time",
    "Hazmat Premium",
    "Team Service",
    "Extra Stop",
  ],
  surcharge: [
    "Peak Season Surcharge",
    "Border Crossing",
    "Fuel Adjustment",
  ],
  other_revenue: [
    "Scale / Weigh Fee",
    "Permit Reimbursement",
    "Escort Fee",
  ],
  cost: [
    "Driver Pay",
    "Lumper Paid",
    "Tolls Paid",
    "Permits",
    "Escort / Pilot Car",
  ],
};

// ─── The editing shape ───────────────────────────────────────────────────────

export interface AccessorialLine {
  /** React key, and the handle an edit is addressed by. Stable for a session. */
  key:  string;
  /** Present once the server has stored this line. Not sent back. */
  id?:  number;
  type: string;
  category: AccessorialCategory;
  /** What the ledger prints: the catalog label, or the dispatcher's own name. */
  label:    string;
  tooltip?: string;
  /** Money as typed — "" when the line is blank. MoneyInput's own shape. */
  amount:   string;
  notes:    string;
  includeInRateCon: boolean;
  /** Presets are always on screen and cannot be deleted; customs can. */
  preset:   boolean;
}

/**
 * Keys for lines that have no server id yet. A counter rather than the array
 * index because a custom line keeps its identity when the ones above it are
 * deleted — an index-based key would hand a deleted line's state to its
 * neighbour.
 */
let customSeq = 0;
export const nextCustomKey = (): string => `custom-new-${++customSeq}`;

export function isRevenue(category: AccessorialCategory): boolean {
  return category !== "cost";
}

/** A line's amount as a number. Blank and unparseable both read as zero. */
export function amountOf(line: AccessorialLine): number {
  const n = Number(line.amount);

  return Number.isFinite(n) ? n : 0;
}

export function groupTotal(lines: AccessorialLine[], category: AccessorialCategory): number {
  return lines.reduce((sum, l) => (l.category === category ? sum + amountOf(l) : sum), 0);
}

export function totalRevenue(lines: AccessorialLine[]): number {
  return lines.reduce((sum, l) => (isRevenue(l.category) ? sum + amountOf(l) : sum), 0);
}

export function totalCost(lines: AccessorialLine[]): number {
  return lines.reduce((sum, l) => (l.category === "cost" ? sum + amountOf(l) : sum), 0);
}

/**
 * Whether the cost block is still untouched — no cost line carries a figure.
 *
 * Gates the Est. Fuel Cost suggestion. Checking the whole block rather than
 * that one line is what stops a load migrated from the old single
 * `estimated_cost` column (which lands in Other Costs) from silently gaining
 * a suggested fuel cost on top of the cost it already recorded.
 */
export function costBlockIsEmpty(lines: AccessorialLine[]): boolean {
  return !lines.some(l => l.category === "cost" && l.amount.trim() !== "");
}

// ─── API ↔ ledger ────────────────────────────────────────────────────────────

/**
 * Build the ledger: every preset in catalog order, carrying whatever the
 * server stored for it, followed by the custom lines.
 *
 * The presets are rendered whether or not a row exists for them — a load with
 * only a line haul rate stores one row, and the other ten lines still show at
 * $0.00 ready to be filled in. That is also how a twelfth preset added here
 * later appears on loads that predate it.
 */
export function linesFromApi(items?: LoadAccessorialItem[] | null): AccessorialLine[] {
  const stored = items ?? [];

  const presets = ACCESSORIAL_CATALOG.map(def => {
    const row = stored.find(i => i.type === def.type);

    return {
      key:      def.type,
      id:       row?.id,
      type:     def.type,
      category: def.category,
      label:    def.label,
      tooltip:  def.tooltip,
      amount:   row?.amount == null ? "" : String(row.amount),
      notes:    row?.notes ?? "",
      includeInRateCon: row?.include_in_rate_confirmation ?? isRevenue(def.category),
      preset:   true,
    } as AccessorialLine;
  });

  const customs = stored
    .filter(i => i.type === CUSTOM_TYPE)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map(row => ({
      key:      row.id === undefined ? nextCustomKey() : `custom-${row.id}`,
      id:       row.id,
      type:     CUSTOM_TYPE,
      category: (row.category as AccessorialCategory) ?? "rate_addition",
      label:    row.custom_name || "Accessorial",
      // A custom line has no catalog blurb, so its note is what the ⓘ has to
      // say. Without this the note is visible right after it is added and
      // gone after the next reload, which reads as the note being lost.
      tooltip:  row.notes || undefined,
      amount:   row.amount == null ? "" : String(row.amount),
      notes:    row.notes ?? "",
      includeInRateCon: row.include_in_rate_confirmation ?? true,
      preset:   false,
    } as AccessorialLine));

  return [...presets, ...customs];
}

/**
 * The lines worth storing, in the order they are read on screen — which is
 * the order the server numbers them in.
 *
 * A blank preset is left out rather than written as a null row: the catalog
 * already puts it on screen, so a row for it would be a row that says
 * nothing. Customs are always sent, blank amount or not, because somebody
 * deliberately added one and deleting it is a separate act.
 */
export function linesToPayload(lines: AccessorialLine[]): Array<Record<string, unknown>> {
  const ordered = ACCESSORIAL_GROUPS.flatMap(g => lines.filter(l => l.category === g.category));

  return ordered
    .filter(l => !l.preset || l.amount.trim() !== "")
    .map(l => ({
      type:     l.type,
      category: l.category,
      customName: l.preset ? null : l.label,
      amount:   l.amount.trim() === "" ? null : Number(l.amount),
      notes:    l.notes.trim() === "" ? null : l.notes.trim(),
      includeInRateConfirmation: l.includeInRateCon,
    }));
}
