import { useEffect, useMemo, useState } from "react";
import { Check, Handshake, Star } from "lucide-react";
import { Btn, Modal } from "../../lib/ui";
import type { BrokerItem } from "../../lib/api";

/**
 * Pick a broker already in the directory and put it on the preferred shelf.
 *
 * Not the add drawer: "Add Broker" on that shelf means *add to preferred*,
 * and the broker being promoted is almost always one you have been loading
 * for months. Creating a second record for a broker already on file is the
 * mistake this dialog exists to prevent — new brokers come in through the
 * directory's own Add Broker button.
 *
 * One decision, so a Modal rather than a SlideDrawer, and single-select: the
 * shelf is a short list of who to call first, built one broker at a time.
 */

/** Initials for the row tile, mirroring the shelf's cards. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AddPreferredBrokerModal({ open, brokers, saving, onClose, onSubmit }: {
  open: boolean;
  /** The whole directory — already-preferred and blocked rows are filtered out here. */
  brokers: BrokerItem[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (b: BrokerItem) => void;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<number | null>(null);

  // Reload every time it opens: a dialog that remembers the last broker
  // picked is a dialog that promotes the wrong one on the next pass.
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setPicked(null);
  }, [open]);

  /**
   * A blocked broker is left out rather than shown and refused — "call these
   * first" and "do not load" cannot both be true, and the directory is where
   * a block gets lifted.
   */
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brokers.filter(b => {
      if (b.is_preferred || b.do_not_load) return false;
      if (!q) return true;
      return [b.name, b.dba, b.mc_number, b.contact_name]
        .some(v => (v ?? "").toLowerCase().includes(q));
    });
  }, [brokers, search]);

  const selected = useMemo(
    () => candidates.find(b => b.id === picked) ?? null,
    [candidates, picked],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Preferred Broker"
      subtitle="Pick a broker from the directory to call first."
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => selected && onSubmit(selected)}
               disabled={!selected || saving}>
            {saving ? "Adding…" : "Add to Preferred"}
          </Btn>
        </>
      }
    >
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search name, MC, contact…"
        aria-label="Search brokers"
        className="w-full h-8 px-2.5 bg-input border border-border rounded text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-ring"
      />

      {candidates.length === 0 ? (
        <p className="py-8 text-center text-xs font-mono text-muted-foreground">
          {brokers.length === 0
            ? "No brokers in the directory yet"
            : search.trim()
              ? "No brokers match that search"
              : "Every broker on file is already preferred or blocked"}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {candidates.map(b => {
            const name = b.name ?? `#${b.id}`;
            const on   = b.id === picked;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setPicked(b.id)}
                className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                  on ? "border-amber-400/50 bg-amber-500/5" : "border-border hover:border-white/20"
                }`}
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-mono font-semibold flex-shrink-0"
                  style={{ backgroundColor: "#f59e0b1a", color: "#f59e0b" }}
                >
                  {initials(name) || <Handshake size={14} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-foreground truncate">{name}</span>
                  <span className="block text-[10px] font-mono text-muted-foreground truncate">
                    {[
                      b.mc_number ? `MC ${b.mc_number.replace(/^\s*MC[\s#:.-]*/i, "")}` : null,
                      b.contact_name ?? b.phone ?? null,
                    ].filter(Boolean).join(" · ") || "Nothing else on file"}
                  </span>
                </span>
                {on
                  ? <Check size={14} className="text-amber-400 flex-shrink-0" />
                  : <Star size={14} className="text-muted-foreground/30 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
