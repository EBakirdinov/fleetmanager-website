import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, DownloadCloud } from "lucide-react";
import { Btn } from "../lib/ui";
import { useIntegrationStatus } from "../lib/useIntegrationStatus";
import { useRefData } from "../lib/data";
import { ImportModal } from "./ImportModal";
import {
  apiEldImportPreview, apiEldImportRun,
  type EldImportActions, type EldImportPreview,
  type EldImportResource, type EldImportResult,
} from "../lib/api";

type PreviewFn = () => Promise<EldImportPreview>;
type ImportFn  = (actions: EldImportActions) => Promise<EldImportResult>;

interface ResourceHandlers {
  preview: PreviewFn;
  import:  ImportFn;
}

/**
 * Import button + menu. An ELD appears in the menu when both hold:
 *   1. Connected for this company                  (useIntegrationStatus)
 *   2. Catalog declares it supports this resource  (integration.imports)
 *
 * There is deliberately no per-provider wiring here: the API routes are
 * slug-addressed, so connecting a new ELD makes it appear with nothing to
 * change in the frontend. Shipping its catalog entry is the whole job.
 *
 * If no ELD qualifies, the whole button is hidden.
 */
export function ImportDropdown({ resource, onImported }: {
  resource: EldImportResource;
  onImported?: () => void;
}) {
  const { isConnected } = useIntegrationStatus();
  const { data: refData } = useRefData();
  const [open, setOpen]         = useState(false);
  const [selected, setSelected] = useState<{ slug: string; label: string; handlers: ResourceHandlers } | null>(null);
  const rootRef                 = useRef<HTMLDivElement | null>(null);

  // Handlers are built here rather than inline in JSX so each one keeps a
  // stable identity across renders — ImportModal reloads its preview whenever
  // `previewFn` changes, and a fresh closure every render would re-fetch in a
  // loop.
  const sources = useMemo(() => {
    const catalog = refData?.integrations ?? [];
    return catalog
      .filter(def => isConnected(def.slug))
      .filter(def => (def.imports ?? []).includes(resource))
      .map(def => ({
        slug:  def.slug,
        label: def.name,
        handlers: {
          preview: () => apiEldImportPreview(def.slug, resource),
          import:  (actions: EldImportActions) => apiEldImportRun(def.slug, resource, actions),
        } as ResourceHandlers,
      }));
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
          sourceSlug={selected.slug}
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
