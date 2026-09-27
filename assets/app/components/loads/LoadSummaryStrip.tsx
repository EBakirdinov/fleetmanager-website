import { captionCls } from "../../lib/cells";
import { LOAD_STATUS_COLOR, LOAD_STATUS_LABEL } from "../../lib/loads";
import { ESTIMATED_NOTE } from "./routeSummary";

/**
 * The at-a-glance strip under Route Overview: the numbers a dispatcher reads
 * before anything else, and the only place on the page showing rate per mile.
 *
 * Read-only by design. Every figure here is either an identifier, a status, or
 * arithmetic over fields that are edited in their own sections — editing them
 * twice in two places is how the two copies start disagreeing.
 */
export interface LoadSummary {
  reference?: string | null;
  status?:    string | null;
  rate?:      number | null;
  /** Loaded miles — the billable leg. */
  loadedMiles?: number | null;
  /** Loaded + deadhead. */
  totalMiles?:  number | null;
  driverName?:  string | null;

  /**
   * How the mileage was arrived at. Matters more here than anywhere else on
   * the page: rate per mile divides by it, so a straight-line estimate
   * running 15–25% under the real distance overstates RPM by a third, and
   * overstated RPM is a load that looks worth taking when it isn't.
   */
  milesSource?: "routed" | "estimated" | null;
}

export default function LoadSummaryStrip({ value }: { value: LoadSummary }) {
  const rate = value.rate ?? null;
  const rpmLoaded = rate !== null && value.loadedMiles ? rate / value.loadedMiles : null;
  const rpmAll    = rate !== null && value.totalMiles  ? rate / value.totalMiles  : null;

  // Only the two RPM cells are affected — Load ID, Status, Driver and Rate
  // are recorded figures, not arithmetic over an estimated distance.
  const estimated = value.milesSource === "estimated";

  const status = value.status ?? "";
  const statusLabel = LOAD_STATUS_LABEL[status] ?? (status || "—");
  const statusColor = LOAD_STATUS_COLOR[status] ?? "#6b7e96";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 -ml-px -mt-px">
      <Figure label="Load ID" value={value.reference || "—"} mono />
      <Figure label="Status">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-mono border"
          style={{ color: statusColor, borderColor: `${statusColor}55`, background: `${statusColor}1a` }}
        >
          {statusLabel}
        </span>
      </Figure>
      <Figure label="Driver" value={value.driverName || "Unassigned"} />
      <Figure label="Rate" value={rate === null ? "—" : money(rate)} mono accent />
      <Figure
        label="RPM (loaded)"
        value={rpmLoaded === null ? "—" : `$${rpmLoaded.toFixed(2)}`}
        mono
        estimated={estimated}
        hint={value.loadedMiles ? `${value.loadedMiles.toLocaleString()} mi${estimated ? " est." : ""}` : undefined}
      />
      <Figure
        label="RPM (all miles)"
        value={rpmAll === null ? "—" : `$${rpmAll.toFixed(2)}`}
        mono
        estimated={estimated}
        hint={value.totalMiles ? `${value.totalMiles.toLocaleString()} mi${estimated ? " est." : ""}` : undefined}
      />
    </div>
  );
}

function Figure({ label, value, children, mono, accent, hint, estimated }: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
  hint?: string;
  /** Derived from an estimated distance, so worth less than it looks. */
  estimated?: boolean;
}) {
  return (
    <div className="px-[var(--cell-px)] py-[var(--cell-py)] border-l border-t border-border">
      <div className={captionCls}>{label}</div>
      <div
        className={`mt-1 text-[length:var(--cell-fs)] font-semibold ${mono ? "font-mono" : ""} ${accent ? "text-emerald-500" : "text-foreground"}`}
        // The strip is read-only and has no room for a second line of
        // explanation, so the caveat rides on the figure itself.
        title={estimated ? ESTIMATED_NOTE : undefined}
      >
        {children ?? value}
        {estimated && <span className="text-amber-500 font-normal ml-1">*</span>}
      </div>
      {hint && (
        <div className={`text-[length:var(--cell-hint-fs)] font-mono mt-0.5 ${estimated ? "text-amber-500/70" : "text-muted-foreground/70"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
