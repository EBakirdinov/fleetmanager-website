import { useEffect, useState } from "react";
import { DollarSign, Info } from "lucide-react";
import { Btn, Modal, Switch } from "../../lib/ui";
import { SelectCell, TextCell, TextareaCell, cellLabelCls } from "../../lib/cells";
import {
  CATEGORY_OPTIONS, CUSTOM_NAME_SUGGESTIONS, NOTES_MAX,
  type AccessorialCategory, type AccessorialLine,
} from "./accessorials";

/**
 * Add (or rename) a charge that is not one of the eleven named lines.
 *
 * Everything this dialog produces is stored as a custom line — the preset
 * lines already have a row of their own on every load and are edited in
 * place, so they are deliberately missing from the type list here. Offering
 * "Detention" would put a second Detention underneath the first.
 *
 * Category is the substantive choice: it decides which block the line lands
 * in and, for costs, which side of the ledger it counts on. Everything below
 * it is naming and bookkeeping.
 */

/** Sentinel for "none of these" in the type list. */
const OTHER = "__other__";

export interface AccessorialDraft {
  category: AccessorialCategory;
  name:     string;
  amount:   string;
  notes:    string;
  includeInRateCon: boolean;
}

export default function AddAccessorialModal({ open, editing, onClose, onSubmit }: {
  open:    boolean;
  /** The line being changed, or null when adding a new one. */
  editing: AccessorialLine | null;
  onClose: () => void;
  onSubmit: (draft: AccessorialDraft) => void;
}) {
  const [category,   setCategory]   = useState<AccessorialCategory>("rate_addition");
  const [picked,     setPicked]     = useState("");
  const [customName, setCustomName] = useState("");
  const [amount,     setAmount]     = useState("");
  const [notes,      setNotes]      = useState("");
  const [includeInRateCon, setIncludeInRateCon] = useState(true);

  /**
   * Reload the fields every time the dialog opens. A dialog that remembers
   * the last thing typed into it is a dialog that quietly adds it twice.
   */
  useEffect(() => {
    if (!open) return;

    if (editing) {
      // A name that matches a suggestion comes back as that suggestion, so
      // reopening a line does not demote it to a free-text one.
      const suggested = CUSTOM_NAME_SUGGESTIONS[editing.category].includes(editing.label);
      setCategory(editing.category);
      setPicked(suggested ? editing.label : OTHER);
      setCustomName(suggested ? "" : editing.label);
      setAmount(editing.amount);
      setNotes(editing.notes);
      setIncludeInRateCon(editing.includeInRateCon);

      return;
    }

    setCategory("rate_addition");
    setPicked("");
    setCustomName("");
    setAmount("");
    setNotes("");
    setIncludeInRateCon(true);
  }, [open, editing]);

  /**
   * Switching category swaps the whole suggestion list, so a pick made
   * against the old one no longer means anything.
   */
  const changeCategory = (v: string) => {
    const next = v as AccessorialCategory;
    setCategory(next);
    setPicked("");
    setIncludeInRateCon(next !== "cost");
  };

  // The custom name wins when it has anything in it — it is the more specific
  // of the two, and typing one after picking from the list clearly means it.
  const name = customName.trim() || (picked === OTHER || picked === "" ? "" : picked);
  const canSubmit = name !== "";

  // A cost is what the load takes out of your pocket; it is never itemised on
  // a rate confirmation, so there is no question to put to the user.
  const rateConApplies = category !== "cost";

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ category, name, amount, notes: notes.trim(), includeInRateCon: rateConApplies && includeInRateCon });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit Accessorial" : "Add Accessorial"}
      subtitle={editing ? "Change this line of the breakdown." : "Add an additional accessorial to the load."}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={!canSubmit}>
            {editing ? "Save Accessorial" : "Add Accessorial"}
          </Btn>
        </>
      }
    >
      <SelectCell label="Category" value={category} onChange={changeCategory} required>
        {CATEGORY_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </SelectCell>

      <SelectCell
        label="Accessorial type"
        value={picked}
        onChange={setPicked}
        hint="Pick a common charge, or choose Other and name it yourself."
      >
        <option value="">Select accessorial type</option>
        {CUSTOM_NAME_SUGGESTIONS[category].map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
        <option value={OTHER}>Other…</option>
      </SelectCell>

      <TextCell
        label="Custom name"
        value={customName}
        onChange={setCustomName}
        placeholder="e.g. Unloading, Waiting Time"
        maxLength={100}
        hint={picked === OTHER ? "Required — nothing was picked above." : "Optional. Overrides the type above."}
      />

      <TextCell
        label="Amount"
        icon={DollarSign}
        mono
        value={amount}
        onChange={v => setAmount(cleanMoney(v))}
        placeholder="0.00"
      />

      <TextareaCell
        label="Notes"
        value={notes}
        onChange={v => setNotes(v.slice(0, NOTES_MAX))}
        rows={3}
        placeholder="Rate confirmation details, broker notes…"
        hint={`Optional. ${notes.length}/${NOTES_MAX}`}
      />

      {rateConApplies && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className={`${cellLabelCls} flex items-center gap-1`}>
            Include in rate confirmation
            <span
              title="Itemised separately on the rate confirmation sent to the broker. Turn off to keep the charge in your own totals only."
              className="text-muted-foreground/60 cursor-help"
            >
              <Info size={11} />
            </span>
          </span>
          <Switch
            label="Include in rate confirmation"
            checked={includeInRateCon}
            onChange={setIncludeInRateCon}
          />
        </div>
      )}
    </Modal>
  );
}

/** Digits and a single decimal point, capped at two places. */
function cleanMoney(raw: string): string {
  const kept = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  const dot = kept.indexOf(".");

  return dot === -1 ? kept : kept.slice(0, dot + 3);
}
