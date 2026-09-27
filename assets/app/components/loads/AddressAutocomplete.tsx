import { useEffect, useId, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { apiAddressSuggest, type AddressSuggestion } from "../../lib/api";
import { cellInputCls, cellLabelCls, fieldShellCls, fieldIconCls, useCellReadOnly } from "../../lib/cells";

/**
 * Textarea + address autocomplete dropdown backed by /api/geocode/suggest.
 *
 * Behavior:
 *   • 300ms debounce, min 3 chars — cuts request volume without hurting UX.
 *   • Keyboard nav: ↑/↓ move, Enter selects, Esc closes.
 *   • Click-outside closes the dropdown.
 *   • On select: fires onChange with the picked description AND onSelect
 *     so the parent can trigger a downstream geocode (map pin) immediately.
 *
 * Reusable — Pickup + Delivery + any future address field all use this
 * one component. Two skins: the default matches DrawerTextarea (boxed) for
 * drawer forms; `bare` drops the box so it slots into a spec-sheet Cell on
 * the Load page, rendering its caption with the shared cell label style.
 */
export default function AddressAutocomplete({
  label, value, onChange, onSelect, rows = 1, bare = false,
}: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  /** Fired when the user picks a suggestion (parent can then geocode). */
  onSelect?: (address: string) => void;
  /**
   * Textarea rows. One by default: an address is one line on every document
   * it gets copied from, and a double-height field left the single-line cells
   * beside it stranded at the top of a row twice as tall as they were.
   */
  rows?: number;
  /** Borderless variant for the Load page's cell grid. */
  bare?: boolean;
}) {
  const [predictions, setPredictions] = useState<AddressSuggestion[]>([]);
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [highlight,   setHighlight]   = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef  = useRef<HTMLTextAreaElement | null>(null);

  // The caption is a real <label> for the field. It can't be the wrapping
  // kind — the suggestion listbox lives in this subtree, and clicks on an
  // option would forward to the textarea — so it points by id instead.
  const fieldId = useId();

  // Track which value we've already emitted a select-for so we don't refire
  // suggest fetch on the very keystroke that came from picking a prediction.
  const lastPickedRef = useRef<string | null>(null);

  /**
   * Has the user typed into this field since it mounted?
   *
   * The effect below runs on every `value` change, and a value can arrive
   * without anyone searching for it: a saved record loading, or a cancelled
   * edit restoring the draft. Those used to fetch suggestions and pop the
   * menu open over a page the user had only just opened.
   */
  const typedRef = useRef(false);

  const atRest = useCellReadOnly();

  // Debounced fetch on value change. If value matches what we just picked,
  // suppress — otherwise picking would immediately re-open the dropdown.
  useEffect(() => {
    if (atRest || !typedRef.current) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    if (lastPickedRef.current !== null && lastPickedRef.current === value) {
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const preds = await apiAddressSuggest(q);
        setPredictions(preds);
        setOpen(preds.length > 0);
        setHighlight(0);
      } catch {
        setPredictions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value, atRest]);

  // Click-outside → close.
  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  function pick(p: AddressSuggestion) {
    lastPickedRef.current = p.description;
    onChange(p.description);
    onSelect?.(p.description);
    setOpen(false);
    setPredictions([]);
    // Return focus to the textarea so keyboard flow continues naturally.
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1) % predictions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => (h - 1 + predictions.length) % predictions.length);
    } else if (e.key === "Enter") {
      // Only intercept Enter when a suggestion is highlighted; otherwise
      // preserve the textarea's default newline behavior.
      if (predictions[highlight]) {
        e.preventDefault();
        pick(predictions[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (atRest) {
    return (
      <>
        <div className={`${cellLabelCls} mb-1.5`}>{label}</div>
        <div className={`text-[length:var(--cell-fs)] leading-[1.6] ${value ? "text-foreground" : "text-muted-foreground/40"}`}>
          {value || "—"}
        </div>
      </>
    );
  }

  return (
    <div ref={containerRef} className={bare ? "relative" : "flex flex-col gap-1.5 relative"}>
      <label htmlFor={fieldId} className={`${bare ? `${cellLabelCls} mb-1.5 block` : "text-xs font-mono text-muted-foreground tracking-wider uppercase"} cursor-text`}>
        {label}
        {loading && <span className="ml-2 text-muted-foreground/60 normal-case tracking-normal">searching…</span>}
      </label>
      {bare ? (
        <div className={fieldShellCls}>
          <MapPin size={14} className={fieldIconCls} />
          <textarea
            ref={textareaRef}
            id={fieldId}
            value={value}
            rows={rows}
            placeholder="Street, city, state ZIP"
            onChange={e => {
              typedRef.current = true;
              lastPickedRef.current = null;
              onChange(e.target.value);
            }}
            onFocus={() => { if (predictions.length > 0) setOpen(true); }}
            onKeyDown={handleKeyDown}
            className={`${cellInputCls} flex-1 min-w-0 resize-none block py-0 leading-[1.5]`}
          />
          <Search size={13} className={fieldIconCls} />
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          id={fieldId}
          value={value}
          rows={rows}
          onChange={e => {
            typedRef.current = true;
            lastPickedRef.current = null;
            onChange(e.target.value);
          }}
          onFocus={() => { if (predictions.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="bg-input-background text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-colors resize-none"
        />
      )}

      {open && predictions.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover text-popover-foreground border border-border rounded-md shadow-lg max-h-64 overflow-auto py-1"
        >
          {predictions.map((p, i) => {
            const active = i === highlight;
            return (
              <li
                key={p.place_id}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={e => { e.preventDefault(); pick(p); }}
                className={`px-3 py-1.5 text-xs font-mono cursor-pointer flex items-start gap-2 ${active ? "bg-muted/80 text-foreground" : "text-muted-foreground hover:bg-muted/40"}`}
              >
                <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                <span className="truncate">{p.description}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
