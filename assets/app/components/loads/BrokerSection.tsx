import { Handshake, AlertTriangle } from "lucide-react";
import { SectionCard, Row, SelectCell, TextCell, captionCls } from "../../lib/cells";
import type { BrokerItem } from "../../lib/api";

/**
 * Section — Broker / Customer (controlled).
 *
 * Who tendered the load, and their number for it. Sits before Assignment
 * because "who is this for" precedes "who drives it".
 *
 * The readout under the picker is the point of the whole section. A
 * dispatcher agreeing a rate needs to know the terms are net-45 before
 * saying yes, and needs to be stopped outright if this is the broker that
 * never paid invoice 4471. Both are read off the broker list the page has
 * already fetched, so neither costs a request.
 *
 * `brokerLoadNumber` is a different fact from the load's own
 * `referenceNumber`: that one is this carrier's and prints as "Load #" on the
 * confirmation, this one is what a shipper's guard asks for at the gate and
 * what the broker's AP needs to match an invoice.
 */

export interface BrokerFormState {
  /** Broker id as a string — it comes out of a <select>. "" means none. */
  brokerId:        string;
  brokerLoadNumber: string;
}

export const emptyBrokerForm = (): BrokerFormState => ({
  brokerId:         "",
  brokerLoadNumber: "",
});

export function brokerFormToPayload(f: BrokerFormState): Record<string, unknown> {
  return {
    broker:           f.brokerId ? parseInt(f.brokerId) : null,
    brokerLoadNumber: f.brokerLoadNumber || null,
  };
}

/** Terms as one line: "Net 30 · Quick Pay 3%". Null when nothing is on file. */
function termsLine(b: BrokerItem): string | null {
  const parts: string[] = [];
  if (b.payment_terms_days) parts.push(`Net ${b.payment_terms_days}`);
  if (b.quick_pay_available) {
    const fee = b.quick_pay_fee_percent ? Number(b.quick_pay_fee_percent) : 0;
    parts.push(fee > 0 ? `Quick Pay ${fee}%` : "Quick Pay available");
  }
  return parts.length ? parts.join(" · ") : null;
}

function brokerName(b: BrokerItem): string {
  return b.display_name || b.name || `#${b.id}`;
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function BrokerSection({
  value, onChange, brokers, sectionNumber = 3,
}: {
  value:    BrokerFormState;
  onChange: (patch: Partial<BrokerFormState>) => void;
  /** The directory, fetched once by the page. */
  brokers:  BrokerItem[];
  /** Numbered by the page, which owns the sequence. */
  sectionNumber?: number;
}) {
  const selected = value.brokerId
    ? brokers.find(b => String(b.id) === value.brokerId) ?? null
    : null;

  const terms = selected ? termsLine(selected) : null;

  return (
    <SectionCard n={sectionNumber} color="#8b5cf6" title="Broker / Customer" icon={Handshake} collapsible>
      <Row cols={2}>
        <SelectCell
          label="Broker"
          hint="Who tendered this load. Manage the directory on the Brokers page."
          value={value.brokerId}
          readLabel={selected ? brokerName(selected) : ""}
          onChange={v => onChange({ brokerId: v })}
        >
          <option value="">— none —</option>
          {brokers.map(b => (
            <option key={b.id} value={String(b.id)}>
              {brokerName(b)}{b.mc_number ? ` · ${b.mc_number}` : ""}
            </option>
          ))}
        </SelectCell>
        <TextCell
          label="Broker Load #"
          hint="Their number for this load — the one the gate and their AP ask for."
          placeholder="e.g. 4471883"
          mono
          value={value.brokerLoadNumber}
          onChange={v => onChange({ brokerLoadNumber: v })}
        />
      </Row>

      {selected?.do_not_load && (
        <div className="mt-1 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-400" />
          <div className="text-xs font-mono text-red-400">
            <span className="font-semibold">Do not load.</span>{" "}
            {selected.do_not_load_reason || "This broker is blocked — check with the office before booking."}
          </div>
        </div>
      )}

      {selected && !selected.do_not_load && (
        <div className={`mt-1 flex flex-wrap gap-x-4 gap-y-1 ${captionCls}`}>
          {terms && <span>Terms: {terms}</span>}
          {selected.phone && <span>Phone: {selected.phone}</span>}
          {selected.contact_name && <span>Contact: {selected.contact_name}</span>}
          {!terms && !selected.phone && !selected.contact_name && (
            <span>No contact or terms on file — add them on the Brokers page.</span>
          )}
        </div>
      )}
    </SectionCard>
  );
}
