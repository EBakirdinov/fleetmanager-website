import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, DownloadCloud } from "lucide-react";
import { Btn } from "../lib/ui";
import { useIntegrationStatus } from "../lib/useIntegrationStatus";
import { useRefData } from "../lib/data";
import { ImportModal } from "./ImportModal";
import {
  apiQuantumPreviewTrucks, apiQuantumImportTrucks,
  apiQuantumPreviewDrivers, apiQuantumImportDrivers,
  type EldImportPreview, type EldImportResult,
} from "../lib/api";

type PreviewFn = () => Promise<EldImportPreview>;
type ImportFn  = (externalIds: string[]) => Promise<EldImportResult>;

interface ResourceHandlers {
  preview: PreviewFn;
  import:  ImportFn;
}

/**
 * Frontend wiring for ELD import calls — one entry per ELD, keyed by slug,
 * holding the preview + import functions per resource. This map only says
 * *how* to call each ELD; *whether* a given resource can be imported is
 * decided by the API catalog (IntegrationDef.imports).
 *
 * When adding a new ELD:
 *  1. Ship its `imports: [...]` array in the API catalog (DataManager.php).
 *  2. Add a matching entry here with its api.ts helpers.
 */
const HANDLERS: Record<string, Partial<Record<"trucks" | "drivers", ResourceHandlers>>> = {
  quantum_eld: {
    trucks:  { preview: apiQuantumPreviewTrucks,  import: apiQuantumImportTrucks  },
    drivers: { preview: apiQuantumPreviewDrivers, import: apiQuantumImportDrivers },
  },
};

/**
 * Import button + menu. An ELD appears in the menu only when all three hold:
 *   1. Connected for this company                    (useIntegrationStatus)
 *   2. Catalog declares it supports this resource    (integration.imports)
 *   3. Frontend has API bindings for it              (HANDLERS map)
 *
 * If no ELD qualifies, the whole button is hidden.
 */
export function ImportDropdown({ resource, onImported }: {
  resource: "trucks" | "drivers";
  onImported?: () => void;
}) {
  const { isConnected } = useIntegrationStatus();
  const { data: refData } = useRefData();
  const [open, setOpen]         = useState(false);
  const [selected, setSelected] = useState<{ slug: string; label: string; handlers: ResourceHandlers } | null>(null);
  const rootRef                 = useRef<HTMLDivElement | null>(null);

  const sources = useMemo(() => {
    const catalog = refData?.integrations ?? [];
    return catalog
      .filter(def => isConnected(def.slug))
      .filter(def => (def.imports ?? []).includes(resource))
      .map(def => {
        const handlers = HANDLERS[def.slug]?.[resource];
        return handlers ? { slug: def.slug, label: def.name, handlers } : null;
      })
      .filter((s): s is { slug: string; label: string; handlers: ResourceHandlers } => s !== null);
  }, [refData, isConnected, resource]);

  // Click-outside handler while the menu is open.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (sources.length === 0) return null;

  return (
    <>
      <div ref={rootRef} className="relative">
        <Btn variant="outline" onClick={() => setOpen(o => !o)}>
          <DownloadCloud size={11} className="inline mr-1" />
          Import
          <ChevronDown size={11} className="inline ml-1" />
        </Btn>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 min-w-[180px] bg-card border border-border rounded-md shadow-lg z-30 py-1"
          >
            {sources.map(s => (
              <button
                key={s.slug}
                role="menuitem"
                onClick={() => { setSelected(s); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-mono text-foreground hover:bg-white/[0.04] transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ImportModal
          open={true}
          onClose={() => setSelected(null)}
          sourceLabel={selected.label}
          resource={resource}
          previewFn={selected.handlers.preview}
          importFn={selected.handlers.import}
          onImported={onImported}
        />
      )}
    </>
  );
}
