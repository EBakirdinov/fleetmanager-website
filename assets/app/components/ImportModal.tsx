import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, X } from "lucide-react";
import { Btn } from "../lib/ui";
import { ApiError, type EldImportCandidate, type EldImportPreview, type EldImportResult } from "../lib/api";

/**
 * Generic ELD import modal. Each ELD provides its own preview + import
 * functions (from api.ts) and this component handles the rest: fetching
 * candidates, letting the user select which new ones to import, submitting
 * the request, and reporting the result.
 *
 * Rendered as a centered dialog rather than a slide-out drawer so the
 * candidate list can be wide and the interaction feels like a batch
 * operation instead of an edit.
 */
export function ImportModal({
  open, onClose, sourceLabel, resource, previewFn, importFn, onImported,
}: {
  open: boolean;
  onClose: () => void;
  /** Human-readable ELD name for the header ("Quantum ELD", "Samsara", …). */
  sourceLabel: string;
  /** What we're importing — used for copy only. */
  resource: "trucks" | "drivers";
  previewFn: () => Promise<EldImportPreview>;
  importFn:  (externalIds: string[]) => Promise<EldImportResult>;
  /** Called after a successful import so the parent page can refresh its list. */
  onImported?: () => void;
}) {
  const [loading,    setLoading]    = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [preview,    setPreview]    = useState<EldImportPreview | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [result,     setResult]     = useState<EldImportResult | null>(null);

  // Load preview whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setResult(null);
    previewFn()
      .then(p => {
        setPreview(p);
        setSelected(new Set(p.candidates.filter(c => !c.exists).map(c => c.externalId)));
      })
      .catch(e => setError(e instanceof ApiError ? e.message : "Failed to load preview"))
      .finally(() => setLoading(false));
  }, [open, previewFn]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !importing) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, importing, onClose]);

  const newCount     = preview?.new     ?? 0;
  const existCount   = preview?.existing ?? 0;
  const selectedList = useMemo(() => Array.from(selected), [selected]);

  function toggle(externalId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId); else next.add(externalId);
      return next;
    });
  }

  function selectAllNew() {
    if (!preview) return;
    setSelected(new Set(preview.candidates.filter(c => !c.exists).map(c => c.externalId)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function runImport() {
    if (selectedList.length === 0 || !preview) return;
    setImporting(true);
    setError(null);
    try {
      const res = await importFn(selectedList);
      setResult(res);
      onImported?.();
      if (res.errors.length === 0) {
        setTimeout(onClose, 900);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-150 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={importing ? undefined : onClose}
      />
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-150 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
          className={`w-full max-w-2xl max-h-[85vh] bg-card border border-border rounded-lg shadow-2xl flex flex-col transition-transform duration-150 ${open ? "scale-100" : "scale-95"}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <p className="text-base font-semibold text-foreground">Import from {sourceLabel}</p>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary tracking-wider uppercase">
                {resource}
              </span>
            </div>
            <button
              onClick={onClose}
              disabled={importing}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {loading && (
              <div className="text-xs font-mono text-muted-foreground">Loading preview…</div>
            )}

            {error && (
              <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 rounded px-3 py-2 text-xs font-mono text-red-400">
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && preview && !result && (
              <>
                <div className="text-xs font-mono text-muted-foreground">
                  {preview.total} {resource} found · <span className="text-foreground">{newCount} new</span>
                  {existCount > 0 && <> · {existCount} already imported</>}
                </div>

                <div className="flex items-center justify-between gap-2 border-y border-border py-2">
                  <div className="flex items-center gap-2">
                    <Btn variant="outline" size="xs" onClick={selectAllNew} disabled={newCount === 0}>Select all new</Btn>
                    <Btn variant="ghost"   size="xs" onClick={clearAll}    disabled={selected.size === 0}>Clear</Btn>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{selected.size} selected</span>
                </div>

                <div className="flex flex-col divide-y divide-border/50">
                  {preview.candidates.map(c => (
                    <CandidateRow
                      key={c.externalId}
                      candidate={c}
                      resource={resource}
                      checked={selected.has(c.externalId)}
                      onToggle={() => toggle(c.externalId)}
                    />
                  ))}
                  {preview.candidates.length === 0 && (
                    <div className="py-6 text-center text-xs font-mono text-muted-foreground">
                      No {resource} available in {sourceLabel}
                    </div>
                  )}
                </div>
              </>
            )}

            {result && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 border border-emerald-500/30 bg-emerald-500/10 rounded px-3 py-2 text-xs font-mono text-emerald-400">
                  <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    Imported {result.imported} {resource}
                    {result.skipped  > 0 && <> · {result.skipped} skipped</>}
                    {(result.driversAutoImported ?? 0) > 0 && (
                      <> · {result.driversAutoImported} driver{result.driversAutoImported === 1 ? "" : "s"} auto-imported</>
                    )}
                    {result.errors.length > 0 && <> · {result.errors.length} failed</>}
                  </span>
                </div>
                {result.errors.length > 0 && (
                  <div className="flex flex-col gap-1 text-xs font-mono">
                    <div className="text-red-400 mb-1">Failures:</div>
                    {result.errors.map(e => (
                      <div key={e.externalId} className="text-muted-foreground">
                        <span className="text-red-400">{e.externalId}</span> — {e.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer — only when there's something to submit */}
          {!loading && !error && preview && !result && (
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0 bg-card">
              <button
                onClick={onClose}
                disabled={importing}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 disabled:opacity-50"
              >
                Cancel
              </button>
              <Btn variant="primary" onClick={runImport} disabled={importing || selected.size === 0}>
                <Download size={11} className="inline mr-1.5" />
                {importing ? "Importing…" : `Import ${selected.size}`}
              </Btn>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CandidateRow({ candidate, resource, checked, onToggle }: {
  candidate: EldImportCandidate;
  resource: "trucks" | "drivers";
  checked: boolean;
  onToggle: () => void;
}) {
  const disabled = candidate.exists;
  const primary  = resource === "trucks" ? primaryTruckLine(candidate)  : primaryDriverLine(candidate);
  const detail   = resource === "trucks" ? detailTruckLine(candidate)   : detailDriverLine(candidate);

  return (
    <label
      className={`flex items-start gap-3 py-2 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.02]"}`}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-border bg-input-background text-primary focus:ring-primary/50"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground truncate">{primary}</span>
          {disabled && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground tracking-wider uppercase">
              Already imported
            </span>
          )}
        </div>
        {detail && <div className="text-xs font-mono text-muted-foreground truncate">{detail}</div>}
      </div>
    </label>
  );
}

// ─── Helpers to display each ELD candidate row cleanly ────────────────────────

function primaryTruckLine(c: EldImportCandidate): string {
  const num  = (c.truckNumber as string | undefined)?.trim();
  const make = (c.make        as string | undefined) ?? "";
  const mdl  = (c.model       as string | undefined) ?? "";
  const year = c.year != null ? String(c.year) : "";
  const parts = [make, mdl, year].filter(Boolean).join(" ");
  return num ? `${num}${parts ? ` — ${parts}` : ""}` : (parts || `#${c.externalId}`);
}

function detailTruckLine(c: EldImportCandidate): string {
  const vin   = (c.vin         as string | undefined)?.trim();
  const plate = (c.plateNumber as string | undefined)?.trim();
  const state = (c.plateState  as string | undefined)?.trim();
  const bits: string[] = [];
  if (vin)   bits.push(`VIN ${vin}`);
  if (plate) bits.push(state ? `${plate} · ${state}` : plate);
  return bits.join(" · ");
}

function primaryDriverLine(c: EldImportCandidate): string {
  const first = (c.firstName as string | undefined) ?? "";
  const last  = (c.lastName  as string | undefined) ?? "";
  const name  = [first, last].filter(Boolean).join(" ").trim();
  return name || `#${c.externalId}`;
}

function detailDriverLine(c: EldImportCandidate): string {
  const phone  = (c.phone         as string | undefined)?.trim();
  const email  = (c.email         as string | undefined)?.trim();
  const lic    = (c.licenseNumber as string | undefined)?.trim();
  const bits: string[] = [];
  if (lic)   bits.push(`License ${lic}`);
  if (phone) bits.push(phone);
  if (email) bits.push(email);
  return bits.join(" · ");
}
