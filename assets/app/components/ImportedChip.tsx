import { useRefData } from "../lib/data";

/**
 * Small provenance badge shown next to trucks/drivers that were pulled from
 * an ELD. Renders nothing when eldSource is null (manually-created rows).
 *
 * Looks up the source's display name from the integrations catalog so we
 * don't have to hardcode ELD names in the UI.
 */
export function ImportedChip({ eldSource, size = "sm" }: {
  eldSource?: string | null;
  size?: "sm" | "xs";
}) {
  const { data: refData } = useRefData();

  if (!eldSource) return null;

  const integration = refData?.integrations?.find(i => i.slug === eldSource);
  const label       = integration?.name ?? eldSource;

  const sizeClass = size === "xs"
    ? "text-[9px] px-1.5 py-0.5"
    : "text-[10px] px-2 py-0.5";

  return (
    <span
      title={`Imported from ${label}`}
      className={`inline-flex items-center gap-1 rounded font-mono tracking-wider uppercase border border-primary/30 bg-primary/10 text-primary ${sizeClass}`}
    >
      {label}
    </span>
  );
}
