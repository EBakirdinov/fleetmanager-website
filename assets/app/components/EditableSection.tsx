import { useEffect, useRef, useState, type ReactNode } from "react";
import { SectionEditProvider, type SectionEditState } from "../lib/cells";

/**
 * Wraps a section so it reads at rest and edits on demand.
 *
 * The section component inside is the *same* one the Add page uses — nothing
 * about it changes. This holds the draft, and the context it provides is what
 * flips every field cell between text and input, and what puts Edit / Cancel /
 * Save in the section header. One section is editable at a time, so a
 * dispatcher can never lose work in a section they forgot they had open.
 *
 * `value` is the saved truth. Entering edit mode copies it into a draft;
 * Cancel throws the draft away; Save sends it and, only on success, lets the
 * incoming `value` take over again.
 */
export default function EditableSection<T>({
  value, onSave, children,
}: {
  value: T;
  /** Persist the draft. Throw to report failure — the section stays open. */
  onSave: (draft: T) => Promise<void>;
  children: (draft: T, patch: (p: Partial<T>) => void) => ReactNode;
}) {
  const [draft,   setDraft]   = useState<T>(value);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const savedTimer = useRef<number | undefined>(undefined);

  // While at rest, follow the saved value — a refetch elsewhere on the page
  // should show here too. While editing, the draft is the user's, not ours.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  const state: SectionEditState = {
    editing,
    saving,
    saved,
    error,
    start() {
      setDraft(value);
      setError(null);
      setSaved(false);
      setEditing(true);
    },
    cancel() {
      setDraft(value);
      setError(null);
      setEditing(false);
    },
    async save() {
      setSaving(true);
      setError(null);
      try {
        await onSave(draft);
        setEditing(false);
        setSaved(true);
        // The tick is a receipt, not a status — it should fade, or every
        // section ends up wearing one forever.
        window.clearTimeout(savedTimer.current);
        savedTimer.current = window.setTimeout(() => setSaved(false), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
  };

  return (
    <SectionEditProvider state={state}>
      {children(draft, patch => setDraft(prev => ({ ...prev, ...patch })))}
    </SectionEditProvider>
  );
}
