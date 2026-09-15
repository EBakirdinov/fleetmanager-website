import { SectionCard, Row, TextareaCell } from "../../lib/cells";

/**
 * Section 7 — Notes (controlled).
 *
 * Three distinct free-text fields (not one blob) so per-audience visibility
 * can be added later — e.g. hiding Internal Comments from broker-facing
 * views — without a schema migration.
 *
 * Laid out three-up rather than stacked: the section spans the full page
 * width, and a full-width textarea would set lines far too long to scan.
 * Each note's hint says who can see it, which is the thing people get wrong.
 */

export interface NotesFormState {
  specialInstructions: string;
  brokerNotes:         string;
  internalComments:    string;
}

export const emptyNotesForm = (): NotesFormState => ({
  specialInstructions: "",
  brokerNotes:         "",
  internalComments:    "",
});

export function notesFormToPayload(f: NotesFormState): Record<string, unknown> {
  return {
    specialInstructions: f.specialInstructions || null,
    brokerNotes:         f.brokerNotes         || null,
    internalComments:    f.internalComments    || null,
  };
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function NotesSection({
  value, onChange, sectionNumber = 7, columns = 3,
}: {
  value:    NotesFormState;
  onChange: (patch: Partial<NotesFormState>) => void;
  /** Numbered by the page, which owns the sequence. */
  sectionNumber?: number;
  /**
   * Three-up when the section spans the page, stacked when it shares a row —
   * a third of a third of the width is not a place to write a paragraph.
   */
  columns?: 1 | 3;
}) {
  return (
    <SectionCard n={sectionNumber} color="#0ea5e9" title="Notes">
      <Row cols={columns}>
        <TextareaCell
          label="Special Instructions"
          hint="Driver-visible — gate codes, appointments, security requirements."
          placeholder="Anything the driver needs at the dock…"
          rows={3}
          value={value.specialInstructions}
          onChange={v => onChange({ specialInstructions: v })}
        />
        <TextareaCell
          label="Broker Notes"
          hint="About the broker or customer — visible to office staff."
          placeholder="Billing quirks, contact preferences…"
          rows={3}
          value={value.brokerNotes}
          onChange={v => onChange({ brokerNotes: v })}
        />
        <TextareaCell
          label="Internal Comments"
          hint="Your dispatch team only — never shared externally."
          placeholder="Anything you wouldn't send to the broker…"
          rows={3}
          value={value.internalComments}
          onChange={v => onChange({ internalComments: v })}
        />
      </Row>
    </SectionCard>
  );
}
