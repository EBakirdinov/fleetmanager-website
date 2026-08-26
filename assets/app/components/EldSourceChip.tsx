import { RadioTower } from "lucide-react";
import { useRefData } from "../lib/data";

/**
 * Compact ELD-source chip shown in the drawer's title bar next to the
 * record's own badge. Signals that the record is being synced from an ELD
 * without taking any body real estate.
 */
export function EldSourceChip({ eldSource }: { eldSource?: string | null }) {
  const { data: refData } = useRefData();
  if (!eldSource) return null;

  const integration = refData?.integrations?.find(i => i.slug === eldSource);
  const label = integration?.name ?? eldSource;

  return (
    <span
      title={`Synced from ${label}`}
      className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary tracking-wider uppercase"
    >
      {integration?.iconUrl
        ? <img src={integration.iconUrl} alt="" className="w-3 h-3" />
        : <RadioTower size={10} strokeWidth={2.25} />}
      <span className="truncate max-w-[110px]">{label}</span>
    </span>
  );
}
