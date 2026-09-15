import { SectionCard, Row, Cell } from "../../lib/cells";

/**
 * Section 10 — Additional Information.
 *
 * Provenance, not data entry: where the load runs, who created it, when it
 * last changed. Nothing here is editable because nothing here is typed — it
 * is all either derived from the stops or stamped by the system.
 */
export interface AdditionalInfo {
  origin?:      string | null;
  destination?: string | null;
  totalMiles?:  number | null;
  companyName?: string | null;
  createdAt?:   string | null;
  updatedAt?:   string | null;
}

export default function AdditionalInfoSection({ value, sectionNumber = 10 }: {
  value: AdditionalInfo;
  sectionNumber?: number;
}) {
  const route = value.origin && value.destination
    ? `${value.origin} → ${value.destination}`
    : value.origin || value.destination || null;

  return (
    <SectionCard n={sectionNumber} color="#64748b" title="Additional Information">
      <Row cols={4}>
        <Info label="Route" value={route} wide />
        <Info label="Company" value={value.companyName} />
        {/* Mileage is routed, not stored — it only appears once a route has
            been calculated, so the cell is omitted rather than left dashed. */}
        {value.totalMiles ? (
          <Info label="Miles (est.)" value={`${value.totalMiles.toLocaleString()} mi`} mono />
        ) : <span />}
      </Row>
      <Row cols={4}>
        <Info label="Created" value={formatStamp(value.createdAt)} mono />
        <Info label="Last updated" value={formatStamp(value.updatedAt)} mono />
      </Row>
    </SectionCard>
  );
}

function Info({ label, value, mono, wide }: {
  label: string;
  value?: string | null;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <Cell label={label} wide={wide} as="div">
      <div className={`text-[length:var(--cell-fs)] ${mono ? "font-mono" : ""} ${value ? "text-foreground" : "text-muted-foreground/40"}`}>
        {value || "—"}
      </div>
    </Cell>
  );
}

/** "04/23/2026 10:15 AM" from whatever ISO-ish shape the API sends. */
function formatStamp(raw?: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  return d.toLocaleString(undefined, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
