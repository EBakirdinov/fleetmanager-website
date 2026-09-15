import {
  Children, createContext, useContext, useEffect, useId, useRef, useState,
  type CSSProperties, type ElementType, type MouseEvent, type ReactNode,
} from "react";
import { ArrowRight, Calendar, Check, ChevronDown, Loader2, Pencil, X } from "lucide-react";

/**
 * Spec-sheet form kit — the app's shared language for data entry.
 *
 * Instead of a grid of boxed inputs (a wall of grey rectangles), a form is a
 * sheet of hairline-divided cells: a small mono caption with a borderless
 * value under it. The cell itself lifts on hover and tints on focus, so the
 * affordance lives in the surface rather than in a border drawn around every
 * field. Hairlines match the KPI strips on the Load page, so records, forms
 * and readouts all read as one system.
 *
 *   Sheet / SheetHeader — the bordered container and its title band
 *   Row                 — one record row: one or two cells, split by a hairline
 *   Cell                — caption + value; the atom every field is built on
 *   TextCell, SelectCell, DateCell, TimeRangeCell, DateTimeCell,
 *   TextareaCell, ChoiceCell — the field types
 *   SectionCard         — Sheet + titled header, the shell every section uses
 *   MaskedDateInput     — locale-proof MM/DD/YYYY input, shared by both skins
 *
 * Drawer forms use the same atoms through the Drawer* wrappers in ui.tsx.
 */

// ─── Shared class atoms ──────────────────────────────────────────────────────

/**
 * The app's small caption: KPI strips, list headers, cell labels.
 *
 * Full-strength muted-foreground at 11px: the dimmed 10px version cleared
 * only ~3.8:1 against the card in light mode, short of the 4.5:1 small-text
 * floor. Weight 500 holds the mono caps apart without turning them loud.
 */
export const captionCls =
  "text-[length:var(--cell-label-fs)] font-mono font-medium uppercase tracking-[0.08em] text-muted-foreground";

/** Caption above a cell value — same as captionCls, plus the focus tint. */
export const cellLabelCls =
  `${captionCls} group-focus-within/cell:text-primary transition-colors`;

/**
 * A hairline band that isn't a labelled field — an invoice row, a total, a
 * custom control. Same surface behaviour as Cell so the sheet reads as one.
 */
export const bandCls =
  "px-[var(--cell-px)] py-[var(--cell-py)] transition-colors";

/**
 * Borderless value input — the cell provides the surface. Width is left to
 * the caller: full-width for text, content-width for the times that sit
 * side by side in a range.
 */
export const cellInputCls =
  "bg-transparent text-foreground border-0 p-0 text-[length:var(--cell-fs)] " +
  "placeholder:text-muted-foreground/35 focus:outline-none focus:ring-0";

/**
 * Roomier cell metrics for standalone forms.
 *
 * The defaults in theme.css are tuned for tables, where rows have to stay
 * dense. A form the user came here specifically to fill in gets the space
 * instead. Drawers and the Settings sections share this so the two never
 * drift into looking like different products.
 */
export const formMetrics = {
  "--cell-px":       "1.125rem",
  "--cell-py":       "0.875rem",
  "--cell-fs":       "1rem",
  "--cell-label-fs": "12px",
  "--cell-hint-fs":  "11px",
  "--cell-title-fs": "1rem",
} as CSSProperties;

/**
 * Time fields drop the native clock button so a window reads as one phrase —
 * "08:00 → 12:00" — instead of two icon-laden boxes. Typing and arrow keys
 * still work; the segments are what dispatchers actually use.
 */
const timeInputCls =
  `${cellInputCls} font-mono w-auto flex-none [&::-webkit-calendar-picker-indicator]:hidden`;

// ─── Per-section edit mode ───────────────────────────────────────────────────

/**
 * A section that can be read or edited, one section at a time.
 *
 * Provided by EditableSection and consumed in two places without any section
 * component needing to know about it: SectionCard renders the Edit / Cancel /
 * Save affordance in its header, and every field cell renders its value as
 * text instead of an input while the section is at rest. That keeps the Load
 * page's view and edit modes as literally the same components, so they cannot
 * drift apart the way a separate read-only page always eventually does.
 */
export interface SectionEditState {
  editing: boolean;
  saving:  boolean;
  /** Set briefly after a successful save, to show the confirmation. */
  saved:   boolean;
  error:   string | null;
  start():  void;
  cancel(): void;
  save():   void;
}

const SectionEditContext = createContext<SectionEditState | null>(null);

export function SectionEditProvider({ state, children }: {
  state: SectionEditState;
  children: ReactNode;
}) {
  return <SectionEditContext.Provider value={state}>{children}</SectionEditContext.Provider>;
}

export const useSectionEdit = (): SectionEditState | null => useContext(SectionEditContext);

/**
 * True when this cell sits in a section that is currently at rest.
 *
 * Exported because not every field is built on TextCell — AddressAutocomplete
 * renders its own control and has to make the same decision.
 */
export function useCellReadOnly(): boolean {
  return useReadOnly();
}

function useReadOnly(): boolean {
  const edit = useContext(SectionEditContext);

  return edit !== null && !edit.editing;
}

/** A value at rest. Keeps the row height of the input it replaces. */
function ReadValue({ mono, children }: { mono?: boolean; children: ReactNode }) {
  const empty = children === null || children === undefined || children === "";

  return (
    <div className={`text-[length:var(--cell-fs)] leading-[1.6] ${mono ? "font-mono" : ""} ${empty ? "text-muted-foreground/40" : "text-foreground"}`}>
      {empty ? "—" : children}
    </div>
  );
}

// ─── Containers ──────────────────────────────────────────────────────────────

/**
 * Bordered sheet. Every direct child becomes a band separated by a hairline,
 * so Rows, standalone Cells and one-off blocks can be mixed freely.
 */
export function Sheet({ children, className = "", style }: {
  children: ReactNode;
  className?: string;
  /** Usually the cell-metric overrides that set a sheet's density. */
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`border border-border rounded-lg overflow-hidden divide-y divide-border ${className}`}
    >
      {children}
    </div>
  );
}

export function SheetHeader({ lead, title, meta }: {
  /** Marker before the title — a section badge, an accent bar, an icon. */
  lead?:  ReactNode;
  title:  ReactNode;
  /** Right-hand slot: status pill, progress indicator, action. */
  meta?:  ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-2 px-[var(--cell-px)] py-[var(--cell-py)]">
      <div className="flex items-center gap-2 min-w-0">
        {lead}
        <h3 className="text-[length:var(--cell-title-fs)] font-semibold text-foreground tracking-tight truncate">{title}</h3>
      </div>
      {meta}
    </header>
  );
}

/**
 * One or more record bands. Cells are laid `cols` to a band and split by a
 * vertical hairline; pass more cells than that (a set of document tiles, say)
 * and they wrap onto further bands, each separated by a horizontal hairline.
 */
export function Row({ children, cols = 2 }: {
  children: ReactNode;
  /** Cells per band. Two is the norm; three suits compact tiles. */
  cols?: 1 | 2 | 3 | 4;
}) {
  const grid = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[cols];
  const items = Children.toArray(children);
  const bands: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) bands.push(items.slice(i, i + cols));

  return (
    <div className="divide-y divide-border">
      {bands.map((band, i) => (
        <div key={i} className={`grid ${grid} [&>*+*]:border-l [&>*+*]:border-border`}>
          {band}
        </div>
      ))}
    </div>
  );
}

export function Cell({
  label, hint, error, required, wide, as, cursor = "text", captionId, onClick, children,
}: {
  /** Omit to let the child render its own caption. */
  label?:    string;
  hint?:     string;
  error?:    string | null;
  required?: boolean;
  /** Span both columns of the row. */
  wide?:     boolean;
  /**
   * A labelled cell renders as a <label> so the whole band — caption, value,
   * and the empty space around them — focuses its field. Pass "div" for cells
   * whose children own their click behaviour (toggle pills, file pickers,
   * anything that renders its own <label>), since nesting or mis-forwarding
   * a label click is worse than not forwarding it at all.
   */
  as?:       "div" | "label";
  /** Caret for text fields, pointer for things that open on click. */
  cursor?:   "text" | "pointer";
  /**
   * Id stamped on the caption so a control that can't be wrapped in a label
   * can still point at it with aria-labelledby.
   */
  captionId?: string;
  /** Click anywhere in the band — used by cells that open something. */
  onClick?:  (e: MouseEvent<HTMLElement>) => void;
  children:  ReactNode;
}) {
  const Tag = as ?? (label ? "label" : "div");
  const clickable = Tag === "label"
    ? (cursor === "pointer" ? "cursor-pointer" : "cursor-text")
    : "";

  return (
    <Tag
      onClick={onClick}
      className={`group/cell block min-w-0 px-[var(--cell-px)] py-[var(--cell-py)] transition-colors ${clickable} ${wide ? "col-span-2" : ""} ${
        error ? "bg-red-500/[0.06] hover:bg-red-500/[0.09]"
              : "hover:bg-muted/25 focus-within:bg-primary/[0.05]"
      }`}
    >
      {label ? (
        <>
          <div id={captionId} className={`${cellLabelCls} ${error ? "text-red-500/90" : ""}`}>
            {label}{required && <span className="text-red-400 ml-1">*</span>}
          </div>
          <div className="mt-1.5">{children}</div>
        </>
      ) : children}
      {error
        ? <div className="text-[length:var(--cell-hint-fs)] font-mono text-red-400 mt-1">{error}</div>
        : hint && <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/75 mt-1">{hint}</div>}
    </Tag>
  );
}

/**
 * Sheet + titled header — the shell every page section sits in.
 *
 * Load pages number their sections, so they pass `n` and get the accent
 * badge. Settings sections aren't a sequence to work through, so they pass
 * an `icon` instead and get a quieter chip. Either way the header carries
 * the same Edit / Cancel / Save affordance, which is the whole point of
 * going through one component rather than two.
 */
export function SectionCard({ n, icon: Icon, color, title, meta, style, children }: {
  /** Step number for sections that form a sequence. */
  n?:     number;
  /** Marker for sections that don't — mutually exclusive with `n`. */
  icon?:  ElementType;
  /** Accent for the number badge — echoes the map/weather colour story. */
  color?: string;
  title:  string;
  meta?:  ReactNode;
  /** Cell-metric overrides when a section wants its own density. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  const lead = n !== undefined
    ? <SectionNum n={n} color={color} />
    : Icon
      ? (
        <div className="w-[22px] h-[22px] rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Icon size={12} className="text-primary" />
        </div>
      )
      : undefined;

  return (
    <Sheet className="bg-card" style={style}>
      <SheetHeader
        lead={lead}
        title={title}
        meta={<><EditAffordance />{meta}</>}
      />
      {children}
    </Sheet>
  );
}

/**
 * Edit / Cancel / Save for the section, rendered only when the section was
 * wrapped in an EditableSection. Sections that are always-editable (the Add
 * form) render nothing here.
 */
function EditAffordance() {
  const edit = useSectionEdit();
  if (edit === null) return null;

  if (!edit.editing) {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        {edit.saved && (
          <span className="text-[length:var(--cell-hint-fs)] font-mono text-emerald-500 flex items-center gap-1">
            <Check size={11} /> Saved
          </span>
        )}
        <button
          type="button"
          onClick={edit.start}
          className="flex items-center gap-1 text-[length:var(--cell-hint-fs)] font-mono text-primary hover:text-primary/80 transition-colors"
        >
          <Pencil size={11} /> Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {edit.error && (
        <span className="text-[length:var(--cell-hint-fs)] font-mono text-red-400 truncate max-w-[16rem]" title={edit.error}>
          {edit.error}
        </span>
      )}
      <button
        type="button"
        onClick={edit.cancel}
        disabled={edit.saving}
        className="flex items-center gap-1 text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        <X size={11} /> Cancel
      </button>
      <button
        type="button"
        onClick={edit.save}
        disabled={edit.saving}
        className="flex items-center gap-1 rounded px-2 py-1 text-[length:var(--cell-hint-fs)] font-mono bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {edit.saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        {edit.saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

// ─── Field types ─────────────────────────────────────────────────────────────

export function TextCell({
  label, value, onChange, onBlur, placeholder, type = "text", mono, hint, error,
  required, readOnly, maxLength, min, max, wide,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  hint?: string;
  error?: string | null;
  required?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  min?: string;
  max?: string;
  wide?: boolean;
}) {
  const atRest = useReadOnly();

  if (atRest) {
    return (
      <Cell label={label} hint={hint} error={error} required={required} wide={wide} as="div">
        <ReadValue mono={mono || type === "date"}>
          {type === "date" ? isoToDisplay(value) : value}
        </ReadValue>
      </Cell>
    );
  }

  if (type === "date") {
    return (
      <Cell label={label} hint={hint} error={error} required={required} wide={wide}>
        <MaskedDateInput
          bare value={value} min={min} max={max} readOnly={readOnly}
          onChange={v => onChange?.(v)} onBlur={onBlur}
        />
      </Cell>
    );
  }
  return (
    <Cell label={label} hint={hint} error={error} required={required} wide={wide}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        maxLength={maxLength}
        min={min}
        max={max}
        onChange={e => onChange?.(e.target.value)}
        onBlur={onBlur}
        className={`${cellInputCls} w-full ${mono ? "font-mono" : ""} ${
          readOnly ? "opacity-50 cursor-not-allowed select-all" : ""
        }`}
      />
    </Cell>
  );
}

/**
 * A select can't use the wrapping-label trick the other cells use: a label
 * click *focuses* a select, it doesn't open it, so the band would look
 * clickable and then do nothing visible. Instead the band opens the picker
 * itself, and the caption is tied to the control by aria-labelledby rather
 * than by a <label> — a label here would forward its own synthetic click on
 * top of ours and toggle the popup straight back shut.
 */
export function SelectCell({ label, value, onChange, children, hint, error, required, wide }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  hint?: string;
  error?: string | null;
  required?: boolean;
  wide?: boolean;
}) {
  const captionId = useId();
  const ref = useRef<HTMLSelectElement>(null);
  const atRest = useReadOnly();

  function openPicker(e: MouseEvent<HTMLElement>) {
    const el = ref.current;
    // A direct hit on the control already opens it natively; opening again
    // would close what the browser just opened.
    if (!el || el.disabled || e.target === el) return;

    const withPicker = el as HTMLSelectElement & { showPicker?: () => void };
    if (typeof withPicker.showPicker === "function") {
      try {
        withPicker.showPicker();
        return;
      } catch {
        // showPicker needs transient activation; fall through to focus.
      }
    }
    el.focus();
  }

  if (atRest) {
    return (
      <Cell label={label} hint={hint} error={error} required={required} wide={wide} as="div">
        <ReadValue>{value}</ReadValue>
      </Cell>
    );
  }

  return (
    <Cell
      label={label} hint={hint} error={error} required={required} wide={wide}
      as="div" cursor="pointer" captionId={captionId} onClick={openPicker}
    >
      <div className="relative">
        <select
          ref={ref}
          value={value}
          aria-labelledby={captionId}
          onChange={e => onChange(e.target.value)}
          className={`${cellInputCls} w-full appearance-none cursor-pointer pr-5 truncate [&>option]:bg-popover [&>option]:text-popover-foreground ${value ? "" : "text-muted-foreground/50"}`}
        >
          {children}
        </select>
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground/50"
        />
      </div>
    </Cell>
  );
}

export function DateCell({ label, value, onChange, min, max, hint, error, required, wide }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  wide?: boolean;
}) {
  const atRest = useReadOnly();

  return (
    <Cell label={label} hint={hint} error={error} required={required} wide={wide} as={atRest ? "div" : undefined}>
      {atRest
        ? <ReadValue mono>{isoToDisplay(value)}</ReadValue>
        : <MaskedDateInput bare value={value} min={min} max={max} onChange={onChange} />}
    </Cell>
  );
}

/** "08:00 → 12:00" under one caption — time windows and facility hours. */
export function TimeRangeCell({ label, start, end, onChangeStart, onChangeEnd, wide }: {
  label: string;
  start: string;
  end:   string;
  onChangeStart: (v: string) => void;
  onChangeEnd:   (v: string) => void;
  wide?: boolean;
}) {
  const atRest = useReadOnly();

  if (atRest) {
    return (
      <Cell label={label} wide={wide} as="div">
        <ReadValue mono>{start || end ? `${start || "--:--"} → ${end || "--:--"}` : ""}</ReadValue>
      </Cell>
    );
  }

  return (
    <Cell label={label} wide={wide}>
      <div className="flex items-center gap-2.5">
        <input
          type="time" value={start} onChange={e => onChangeStart(e.target.value)}
          className={timeInputCls}
        />
        <ArrowRight size={11} className="text-muted-foreground/40 flex-shrink-0" />
        <input
          type="time" value={end} onChange={e => onChangeEnd(e.target.value)}
          className={timeInputCls}
        />
      </div>
    </Cell>
  );
}

/** Date + time under one caption — ETA, appointment confirmation. */
export function DateTimeCell({ label, date, time, onChangeDate, onChangeTime, wide }: {
  label: string;
  date:  string;
  time:  string;
  onChangeDate: (v: string) => void;
  onChangeTime: (v: string) => void;
  wide?: boolean;
}) {
  const atRest = useReadOnly();

  if (atRest) {
    return (
      <Cell label={label} wide={wide} as="div">
        <ReadValue mono>{date || time ? `${isoToDisplay(date) || "—"}  ${time}`.trim() : ""}</ReadValue>
      </Cell>
    );
  }

  return (
    <Cell label={label} wide={wide}>
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <MaskedDateInput bare value={date} onChange={onChangeDate} />
        </div>
        <span className="w-px h-4 bg-border flex-shrink-0" />
        <input
          type="time" value={time} onChange={e => onChangeTime(e.target.value)}
          className={timeInputCls}
        />
      </div>
    </Cell>
  );
}

export function TextareaCell({ label, value, onChange, placeholder, rows = 2, hint, wide }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
  wide?: boolean;
}) {
  const atRest = useReadOnly();

  if (atRest) {
    return (
      <Cell label={label} hint={hint} wide={wide} as="div">
        <div className={`text-[length:var(--cell-fs)] leading-relaxed whitespace-pre-wrap ${value ? "text-foreground" : "text-muted-foreground/40"}`}>
          {value || "—"}
        </div>
      </Cell>
    );
  }

  return (
    <Cell label={label} hint={hint} wide={wide}>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`${cellInputCls} w-full resize-none leading-relaxed`}
      />
    </Cell>
  );
}

export interface ChoiceOption {
  value: string;
  label: string;
  /** Selected-state colour. Default follows the app accent. */
  tone?: "default" | "neutral" | "danger" | "success";
}

/**
 * Segmented pills instead of a two-option dropdown — one click instead of
 * three, and the current answer is readable without opening anything.
 * Clicking the active pill clears the field back to "not set"; pass
 * clearable={false} for fields backed by a plain boolean, which have no
 * unset state to return to.
 */
export function ChoiceCell({ label, value, options, onChange, wide, clearable = true }: {
  label: string;
  value: string;
  options: ChoiceOption[];
  onChange: (v: string) => void;
  wide?: boolean;
  clearable?: boolean;
}) {
  const atRest = useReadOnly();

  if (atRest) {
    const picked = options.find(o => o.value === value);

    return (
      <Cell label={label} wide={wide} as="div">
        {picked ? (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono border ${activeToneCls(picked.tone)}`}>
            {picked.label}
          </span>
        ) : <ReadValue>{""}</ReadValue>}
      </Cell>
    );
  }

  return (
    <Cell label={label} wide={wide} as="div">
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map(o => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(active && clearable ? "" : o.value)}
              className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                active ? activeToneCls(o.tone)
                       : "border-border text-muted-foreground/80 hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Cell>
  );
}

function activeToneCls(tone: ChoiceOption["tone"]): string {
  switch (tone) {
    case "neutral": return "border-transparent bg-muted text-foreground";
    case "danger":  return "border-transparent bg-red-500/15 text-red-600 dark:text-red-400";
    case "success": return "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    default:        return "border-transparent bg-primary/15 text-primary";
  }
}

// ─── Section badge ───────────────────────────────────────────────────────────

export function SectionNum({ n, color = "#2563eb", size = 22 }: {
  n: number;
  color?: string;
  /** Diameter in px. Default 22; pass smaller for compact headers. */
  size?: number;
}) {
  const fontSize = size >= 22 ? 11 : size >= 18 ? 10 : 9;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
      style={{ background: color, width: size, height: size, fontSize }}
    >{n}</span>
  );
}

// ─── Masked date input ───────────────────────────────────────────────────────

// Convert stored ISO ("YYYY-MM-DD") to display ("MM/DD/YYYY").
function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
}

// Parse display ("MM/DD/YYYY") back to ISO. Returns "" if invalid.
function displayToIso(display: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return "";
  const mm = parseInt(m[1], 10), dd = parseInt(m[2], 10), yyyy = parseInt(m[3], 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) return "";
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return "";
  return `${m[3]}-${m[1]}-${m[2]}`;
}

// Insert slashes as the user types so the value always reads MM/DD/YYYY.
function autoSlash(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Date input that always renders MM/DD/YYYY regardless of browser/OS locale.
 * Stores its value as ISO ("YYYY-MM-DD") for API consumption. The visible
 * field is our masked text input; a native <input type="date"> is overlaid
 * on the calendar-icon area (opacity 0) so clicking the icon opens the OS
 * date picker anchored at that location and typing still goes into the
 * masked text field.
 */
export function MaskedDateInput({
  value, max, min, readOnly, onChange, onBlur,
  borderClass = "border-border focus:ring-ring", bare = false,
}: {
  value: string;
  max?: string;
  min?: string;
  readOnly?: boolean;
  onChange: (iso: string) => void;
  onBlur?: () => void;
  borderClass?: string;
  /** Borderless variant for spec-sheet cells. */
  bare?: boolean;
}) {
  const [text, setText] = useState(() => isoToDisplay(value));

  useEffect(() => { setText(isoToDisplay(value)); }, [value]);

  function isoInRange(iso: string): boolean {
    if (max && iso > max) return false;
    if (min && iso < min) return false;
    return true;
  }

  function handleText(raw: string) {
    const masked = autoSlash(raw);
    setText(masked);
    if (!masked) { onChange(""); return; }
    const iso = displayToIso(masked);
    // Only commit fully-typed, in-range dates. Partial or out-of-range
    // typing lingers in the text field until blur snaps it back.
    if (iso && isoInRange(iso)) onChange(iso);
  }

  function handleBlur() {
    // Reset display to the canonical form of the committed value so a
    // half-typed or out-of-range entry doesn't linger in the field.
    setText(isoToDisplay(value));
    onBlur?.();
  }

  const inputCls = bare
    ? `${cellInputCls} w-full pr-5 font-mono ${readOnly ? "opacity-50 cursor-not-allowed" : ""}`
    : `bg-input-background text-foreground border ${borderClass} rounded pl-3 pr-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors font-mono w-full ${readOnly ? "opacity-50 cursor-not-allowed" : ""}`;

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={text}
        placeholder="MM/DD/YYYY"
        readOnly={readOnly}
        maxLength={10}
        onChange={e => handleText(e.target.value)}
        onBlur={handleBlur}
        className={inputCls}
      />
      <span className={`absolute ${bare ? "right-0" : "right-2"} top-1/2 -translate-y-1/2 pointer-events-none ${bare ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
        <Calendar size={bare ? 12 : 14} />
      </span>
      <input
        type="date"
        value={value}
        max={max}
        min={min}
        disabled={readOnly}
        onChange={e => onChange(e.target.value)}
        aria-label="Pick date"
        tabIndex={-1}
        className={`absolute right-0 top-0 h-full ${bare ? "w-5" : "w-9"} opacity-0 cursor-pointer disabled:cursor-not-allowed`}
      />
    </div>
  );
}
