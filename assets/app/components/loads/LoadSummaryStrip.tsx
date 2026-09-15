import { captionCls } from "../../lib/cells";
import { LOAD_STATUS_COLOR, LOAD_STATUS_LABEL } from "../../lib/loads";

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
}

export default function LoadSummaryStrip({ value }: { value: LoadSummary }) {
  const rate = value.rate ?? null;
  const rpmLoaded = rate !== null && value.loadedMiles ? rate / value.loadedMiles : null;
  const rpmAll    = rate !== null && value.totalMiles  ? rate / value.totalMiles  : null;

  const status = value.status ?? "";
  const statusLabel = LOAD_STATUS_LABEL[status] ?? (status || "—");
  const statusColor = LOAD_STATUS_COLOR[status] ?? "#6b7e96";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t border-border">
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
        hint={value.loadedMiles ? `${value.loadedMiles.toLocaleString()} mi` : undefined}
      />
      <Figure
        label="RPM (all miles)"
        value={rpmAll === null ? "—" : `$${rpmAll.toFixed(2)}`}
        mono
        hint={value.totalMiles ? `${value.totalMiles.toLocaleString()} mi` : undefined}
      />
    </div>
  );
}

function Figure({ label, value, children, mono, accent, hint }: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="px-[var(--cell-px)] py-[var(--cell-py)] border-l border-border first:border-l-0">
      <div className={captionCls}>{label}</div>
      <div className={`mt-1 text-[length:var(--cell-fs)] font-semibold ${mono ? "font-mono" : ""} ${accent ? "text-emerald-500" : "text-foreground"}`}>
        {children ?? value}
      </div>
      {hint && (
        <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/70 mt-0.5">{hint}</div>
      )}
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
