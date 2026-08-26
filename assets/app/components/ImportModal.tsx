import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Link2, X } from "lucide-react";
import { Btn } from "../lib/ui";
import { ApiError, type EldImportActions, type EldImportCandidate, type EldImportPreview, type EldImportResult } from "../lib/api";

/**
 * Generic ELD import modal. Each ELD provides its own preview + import
 * functions (from api.ts); this component owns UX for the three per-row
 * states:
 *
 *   - NEW:      no local match. Checkbox → creates a fresh local record.
 *   - MATCH:    local record with same VIN/license found. Toggle → links
 *               the two (writes eld_source + external_id onto the local
 *               row). Off by default; user opts in.
 *   - IMPORTED: local record already linked to this ELD. Not selectable.
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
  importFn:  (actions: EldImportActions) => Promise<EldImportResult>;
  /** Called after a successful import so the parent page can refresh its list. */
  onImported?: () => void;
}) {
  const [loading,   setLoading]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview,   setPreview]   = useState<EldImportPreview | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [toCreate,  setToCreate]  = useState<Set<string>>(new Set());
  const [toLink,    setToLink]    = useState<Set<string>>(new Set());
  const [result,    setResult]    = useState<EldImportResult | null>(null);

  // Load preview whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setResult(null);
    previewFn()
      .then(p => {
        setPreview(p);
        // Default: all NEW rows selected for create; MATCH rows opted out —
        // user must explicitly acknowledge linking.
        setToCreate(new Set(p.candidates.filter(c => c.match === null).map(c => c.externalId)));
        setToLink(new Set());
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

  const newCount      = preview?.new       ?? 0;
  const existCount    = preview?.existing  ?? 0;
  const matchCount    = preview?.matchable ?? 0;
  const totalSelected = toCreate.size + toLink.size;

  function toggleCreate(externalId: string) {
    setToCreate(prev => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId); else next.add(externalId);
      return next;
    });
  }

  function toggleLink(externalId: string) {
    setToLink(prev => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId); else next.add(externalId);
      return next;
    });
  }

  function selectAllNew() {
    if (!preview) return;
    setToCreate(new Set(preview.candidates.filter(c => c.match === null).map(c => c.externalId)));
  }

  function selectAllLinks() {
    if (!preview) return;
    setToLink(new Set(preview.candidates.filter(c => c.match && c.match.type !== "imported").map(c => c.externalId)));
  }

  function clearAll() {
    setToCreate(new Set());
    setToLink(new Set());
  }

  async function runImport() {
    if (totalSelected === 0 || !preview) return;
    setImporting(true);
    setError(null);

    const linkPairs = Array.from(toLink)
      .map(extId => {
        const c = preview.candidates.find(x => x.externalId === extId);
        return c?.match ? { externalId: extId, localId: c.match.localId } : null;
      })
      .filter((p): p is { externalId: string; localId: number } => p !== null);

    try {
      const res = await importFn({ create: Array.from(toCreate), link: linkPairs });
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
                  {matchCount > 0 && <> · <span className="text-amber-400">{matchCount} to link</span></>}
                  {existCount > 0 && <> · {existCount} already imported</>}
                </div>

                <div className="flex items-center justify-between gap-2 border-y border-border py-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Btn variant="outline" size="xs" onClick={selectAllNew} disabled={newCount === 0}>Select all new</Btn>
                    {matchCount > 0 && (
                      <Btn variant="outline" size="xs" onClick={selectAllLinks} disabled={matchCount === 0}>
                        <Link2 size={10} className="inline mr-1" />Link all matches
                      </Btn>
                    )}
                    <Btn variant="ghost"   size="xs" onClick={clearAll} disabled={totalSelected === 0}>Clear</Btn>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{totalSelected} selected</span>
                </div>

                <div className="flex flex-col divide-y divide-border/50">
                  {preview.candidates.map(c => (
                    <CandidateRow
                      key={c.externalId}
                      candidate={c}
                      resource={resource}
                      createChecked={toCreate.has(c.externalId)}
                      linkChecked={toLink.has(c.externalId)}
                      onToggleCreate={() => toggleCreate(c.externalId)}
                      onToggleLink={() => toggleLink(c.externalId)}
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
                    {result.imported > 0
                      ? <>Imported {result.imported} {resource}</>
                      : <>Synced with {sourceLabel}</>}
                    {result.linked   > 0 && <> · {result.linked} linked</>}
                    {result.imported > 0 && result.skipped > 0 && <> · {result.skipped} skipped</>}
                    {(result.driversAutoImported ?? 0) > 0 && (
                      <> · {result.driversAutoImported} driver{result.driversAutoImported === 1 ? "" : "s"} auto-imported</>
                    )}
                    {(result.driversReassigned ?? 0) > 0 && (
                      <> · {result.driversReassigned} driver reassignment{result.driversReassigned === 1 ? "" : "s"}</>
                    )}
                    {(result.trucksRefreshed ?? 0) > 0 && (
                      <> · {result.trucksRefreshed} truck{result.trucksRefreshed === 1 ? "" : "s"} refreshed</>
                    )}
                    {(result.driversRefreshed ?? 0) > 0 && (
                      <> · {result.driversRefreshed} driver{result.driversRefreshed === 1 ? "" : "s"} refreshed</>
                    )}
                    {(result.trucksInactivated ?? 0) > 0 && (
                      <> · {result.trucksInactivated} truck{result.trucksInactivated === 1 ? "" : "s"} inactivated</>
                    )}
                    {(result.driversTerminated ?? 0) > 0 && (
                      <> · {result.driversTerminated} driver{result.driversTerminated === 1 ? "" : "s"} terminated</>
                    )}
                    {result.errors.length > 0 && <> · {result.errors.length} failed</>}
                  </span>
                </div>
                {result.rosterIncomplete && (
                  <div className="flex items-start gap-2 border border-amber-500/30 bg-amber-500/10 rounded px-3 py-2 text-xs font-mono text-amber-400">
                    <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                    <span>Roster hit the pagination cap — removal detection was skipped this run. Records that vanished from the ELD side will remain <em>active</em> until the next full sync.</span>
                  </div>
                )}
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

          {/* Footer */}
          {!loading && !error && preview && !result && (
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0 bg-card">
              <button
                onClick={onClose}
                disabled={importing}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 disabled:opacity-50"
              >
                Cancel
              </button>
              <Btn
                variant="primary"
                onClick={runImport}
                disabled={importing || (totalSelected === 0 && existCount === 0)}
              >
                <Download size={11} className="inline mr-1.5" />
                {importing
                  ? (totalSelected > 0 ? "Importing…" : "Syncing…")
                  : (totalSelected > 0 ? `Import ${totalSelected}` : "Sync now")}
              </Btn>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CandidateRow({
  candidate, resource, createChecked, linkChecked, onToggleCreate, onToggleLink,
}: {
  candidate: EldImportCandidate;
  resource: "trucks" | "drivers";
  createChecked: boolean;
  linkChecked: boolean;
  onToggleCreate: () => void;
  onToggleLink: () => void;
}) {
  const primary = resource === "trucks" ? primaryTruckLine(candidate) : primaryDriverLine(candidate);
  const detail  = resource === "trucks" ? detailTruckLine(candidate)  : detailDriverLine(candidate);
  const match   = candidate.match;

  // Already-imported: fully greyed-out, informational only.
  if (match && match.type === "imported") {
    return (
      <div className="flex items-start gap-3 py-2 opacity-50 cursor-not-allowed">
        <div className="mt-0.5 w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground truncate">{primary}</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground tracking-wider uppercase">
              Already imported
            </span>
          </div>
          {detail && <div className="text-xs font-mono text-muted-foreground truncate">{detail}</div>}
        </div>
      </div>
    );
  }

  // VIN / license match: prompt to link the local record.
  if (match) {
    return (
      <label className="flex items-start gap-3 py-2 cursor-pointer hover:bg-amber-500/5">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-amber-500/60 bg-input-background text-amber-500 focus:ring-amber-500/50"
          checked={linkChecked}
          onChange={onToggleLink}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground truncate">{primary}</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 tracking-wider uppercase inline-flex items-center gap-1">
              <Link2 size={9} />Link to {(resource == "trucks") ? "#" : ""}{match.localLabel}
            </span>
          </div>
          {detail && <div className="text-xs font-mono text-muted-foreground truncate">{detail}</div>}
        </div>
      </label>
    );
  }

  // New: standard create checkbox.
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer hover:bg-white/[0.02]">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-border bg-input-background text-primary focus:ring-primary/50"
        checked={createChecked}
        onChange={onToggleCreate}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground truncate">{primary}</span>
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
