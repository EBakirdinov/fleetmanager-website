import { Star, Plus, Handshake } from "lucide-react";
import { Btn } from "../../lib/ui";
import type { BrokerItem } from "../../lib/api";

/**
 * The shelf of brokers a dispatcher should call first.
 *
 * Cards rather than another table: this is a short list meant to be
 * recognised at a glance, and the directory table two feet above already
 * serves anyone who wants to compare columns. Shape copied from
 * IntegrationCard — a `<button>`, `rounded-xl p-5`, `mt-auto` footer so
 * uneven cards still bottom-align.
 */

/** "Net 30 · QP 3%", or null when nothing is on file. */
function termsLine(b: BrokerItem): string | null {
  const parts: string[] = [];
  if (b.payment_terms_days) parts.push(`Net ${b.payment_terms_days}`);
  if (b.quick_pay_available) {
    const fee = b.quick_pay_fee_percent ? Number(b.quick_pay_fee_percent) : 0;
    parts.push(fee > 0 ? `QP ${fee}%` : "QP");
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Initials for the tile, so a card reads as a party even with no logo. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function PreferredBrokerCards({
  brokers, onOpen, onAdd,
}: {
  brokers: BrokerItem[];
  onOpen: (b: BrokerItem) => void;
  /**
   * Opens the picker that promotes a broker already in the directory.
   * Omitted when the caller cannot edit a broker.
   */
  onAdd?: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-md flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Star size={13} className="text-amber-400" />
          <span className="text-sm font-medium text-foreground">Preferred Brokers</span>
          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{brokers.length}</span>
        </div>
      </div>

      <div className="p-4">
        {brokers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <p className="text-xs font-mono text-muted-foreground">No preferred brokers yet</p>
            {onAdd ? (
              <Btn variant="outline" onClick={onAdd}>
                <Plus size={11} className="inline mr-1" />Add Broker
              </Btn>
            ) : (
              <p className="text-xs font-mono text-muted-foreground/60">
                Mark one from its card in the directory above
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {brokers.map(b => {
              const name  = b.name ?? `#${b.id}`;
              const terms = termsLine(b);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onOpen(b)}
                  className="bg-card border border-border rounded-xl p-5 text-left transition-colors flex flex-col gap-3 hover:border-white/20"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-mono font-semibold flex-shrink-0"
                      style={{ backgroundColor: "#f59e0b1a", color: "#f59e0b" }}
                    >
                      {initials(name) || <Handshake size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate leading-tight">{name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                        {b.contact_name ?? b.phone ?? "No contact on file"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Star size={11} className="text-amber-400 flex-shrink-0" />
                    <span className="text-xs font-mono text-amber-400">Preferred</span>
                  </div>

                  <div className="flex flex-col gap-1 mt-auto pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {b.mc_number ? `MC ${b.mc_number.replace(/^\s*MC[\s#:.-]*/i, "")}` : "No MC on file"}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {terms ?? "No terms on file"}
                    </span>
                  </div>
                </button>
              );
            })}

            {onAdd && (
              <button
                type="button"
                onClick={onAdd}
                className="border border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-white/20 hover:text-foreground transition-colors"
              >
                <Plus size={16} />
                <span className="text-xs font-mono">Add Broker</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
