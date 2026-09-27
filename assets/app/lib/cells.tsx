import {
  createContext, useContext, useEffect, useId, useRef, useState,
  type CSSProperties, type ElementType, type MouseEvent, type ReactNode, type Ref,
} from "react";
import { ArrowRight, Calendar, Check, ChevronDown, Clock, Loader2, Pencil, X } from "lucide-react";

/**
 * Form kit — the app's shared language for data entry.
 *
 * A form is a grid of labelled controls: a sentence-case label over a bordered
 * field shell that holds a leading icon and the control itself. The shell is
 * what carries state — it tints its border and lifts a ring on focus, turns
 * red on error — so every field announces the same affordance in the same
 * place, whatever control is inside it.
 *
 * Two label registers, and the split is deliberate:
 *   captionCls    — mono caps, for readouts: KPI strips, list headers, section
 *                   captions. Things you scan, never type into.
 *   cellLabelCls  — sentence case, for field labels. Things you fill in.
 *
 * At rest (a section on the Load page that isn't being edited) the shells drop
 * away and values render as plain text, so a section visibly opens up into
 * inputs when you press Edit rather than looking editable the whole time.
 *
 *   Sheet / SheetHeader — the bordered container and its title band
 *   Row                 — a responsive grid of cells; `wide` spans the row
 *   Cell                — label + field shell; the atom every field is built on
 *   TextCell, SelectCell, SelectOtherCell, DateCell, TimeCell, TimeRangeCell,
 *   DateTimeCell, TextareaCell, ChoiceCell — the field types
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

/**
 * Label above a field. Sentence case, not the mono caps of captionCls: a
 * caption labels a number you read, a label names a box you type in, and
 * setting both in the same register made forms read like dashboards.
 */
export const cellLabelCls =
  "text-[length:var(--cell-label-fs)] font-medium text-muted-foreground " +
  "group-focus-within/cell:text-foreground transition-colors";

/**
 * A hairline band that isn't a labelled field — an invoice row, a total, a
 * custom control. Same surface behaviour as Cell so the sheet reads as one.
 */
export const bandCls =
  "px-[var(--cell-px)] py-[var(--cell-py)] transition-colors";

/**
 * Borderless value input — the field shell around it provides the surface,
 * the border and the focus state. Width is left to the caller: full-width for
 * text, content-width for the times that sit side by side in a range.
 */
export const cellInputCls =
  "bg-transparent text-foreground border-0 p-0 text-[length:var(--cell-fs)] " +
  "placeholder:text-muted-foreground/45 focus:outline-none focus:ring-0";

/**
 * The bordered box a control sits in.
 *
 * Exported because not every field is built on Cell — AddressAutocomplete
 * renders its own control and has to draw the same box around it, or it would
 * be the one bare field in a form full of boxed ones.
 *
 * `focus-within` rather than `focus` so the shell reacts no matter which of
 * its children took focus, which is what lets a two-control field (a time
 * range, a date + time pair) light up as the single field it reads as.
 */
export const fieldShellCls =
  "flex items-center gap-2 w-full rounded-md border bg-input-background " +
  "px-[var(--field-px)] min-h-[var(--field-h)] transition-colors " +
  "border-border hover:border-muted-foreground/35 " +
  "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15";

/** Error variant — same geometry, red border and a faint red wash. */
export const fieldShellErrorCls =
  "flex items-center gap-2 w-full rounded-md border bg-red-500/[0.04] " +
  "px-[var(--field-px)] min-h-[var(--field-h)] transition-colors " +
  "border-red-500/50 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/15";

/** Leading glyph inside a shell. Muted so it frames the value, not competes. */
export const fieldIconCls = "text-muted-foreground/60 flex-shrink-0";

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
  "--cell-fs":       "0.9375rem",
  "--cell-label-fs": "12px",
  "--cell-hint-fs":  "11px",
  "--cell-title-fs": "1rem",
  "--field-px":      "0.75rem",
  "--field-h":       "2.5rem",
} as CSSProperties;

/**
 * Time fields drop the native clock button so a window reads as one phrase —
 * "08:00 → 12:00" — instead of two icon-laden boxes. Typing and arrow keys
 * still work; the segments are what dispatchers actually use.
 */
const timeInputCls =
  `${cellInputCls} font-mono w-auto flex-none min-w-0 [&::-webkit-calendar-picker-indicator]:hidden`;

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
      className={`border border-border rounded-lg overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Height of a section's number badge — and, because of that, the height a
 * header's content sits at.
 *
 * Exported so SheetHeader and SectionNum read the same number instead of
 * each carrying its own 22. Sections stack down a page and line up at their
 * headers, so this is a shared measurement rather than a local one.
 */
export const SECTION_LEAD_PX = 22;

export function SheetHeader({ lead, title, meta, tint, onClick }: {
  /** Marker before the title — a section badge, an accent bar, an icon. */
  lead?:  ReactNode;
  title:  ReactNode;
  /** Right-hand slot: status pill, progress indicator, action. */
  meta?:  ReactNode;
  /**
   * Accent the band is washed with. A section's header takes its own colour
   * so a page of stacked sections is scannable by band rather than by reading
   * every title — the same colour its number badge and map pin already carry.
   */
  tint?:  string;
  /** Set when the whole band toggles the section open or shut. */
  onClick?: () => void;
}) {
  return (
    <header
      onClick={onClick}
      style={tint ? { backgroundColor: `color-mix(in srgb, ${tint} 7%, transparent)` } : undefined}
      className={`flex items-center justify-between gap-2 px-[var(--cell-px)] py-[var(--cell-py)] border-b border-border ${
        tint ? "" : "bg-muted/25"
      } ${onClick ? "cursor-pointer select-none hover:brightness-[0.98] dark:hover:brightness-110 transition-[filter]" : ""}`}
    >
      <div className="flex items-center gap-2.5 min-w-0" style={{ minHeight: SECTION_LEAD_PX }}>
        {lead}
        <h3 className="text-[length:var(--cell-title-fs)] font-semibold text-foreground tracking-tight truncate">{title}</h3>
      </div>
      {/* The meta slot is chrome, and chrome does not get to set the header's
          height: a button a few px taller than the badge would leave its
          section standing above the one beside it. Fixed rather than merely
          capped, so anything oversized overflows into the band's padding —
          centred, and still the same header height — instead of opening it. */}
      <div
        className="flex items-center gap-3 flex-shrink-0"
        style={{ height: SECTION_LEAD_PX }}
      >{meta}</div>
    </header>
  );
}

/**
 * A row of fields. `cols` is the widest the row ever gets; it steps down on
 * narrow viewports so a four-up row never squeezes four controls into a phone
 * rather than stacking them.
 *
 * Overflowing cells wrap onto the next line by themselves — this is a real
 * grid, not the hand-chunked bands the hairline sheet needed.
 */
export function Row({ children, cols = 2 }: {
  children: ReactNode;
  /** Cells per row at full width. Two is the norm; three and four for dense sections. */
  cols?: 1 | 2 | 3 | 4;
}) {
  const grid = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  }[cols];

  return (
    <div className={`grid ${grid} gap-x-4 gap-y-3.5 items-start`}>
      {children}
    </div>
  );
}

/**
 * The body of a section: the rows, spaced and padded away from the header.
 * Sections that render their own layout (the dispatch panel, the rate ledger)
 * skip this and pad themselves.
 */
export function SheetBody({ children, className = "" }: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-[var(--cell-px)] py-[var(--cell-py)] flex flex-col gap-3.5 ${className}`}>
      {children}
    </div>
  );
}

export function Cell({
  label, hint, error, required, wide, as, cursor = "text", captionId, onClick,
  icon: Icon, boxed = true, align = "center", children,
}: {
  /** Omit to let the child render its own caption. */
  label?:    string;
  hint?:     string;
  error?:    string | null;
  required?: boolean;
  /**
   * Span two columns. In the usual two-up row that is the full width; in a
   * three-up row it is the wide slot an address or a route gets, with a
   * normal cell beside it. A cell that must own a whole three-up row goes in
   * a Row of its own instead.
   */
  wide?:     boolean;
  /**
   * A labelled cell renders as a <label> so the label and the shell under it
   * both focus the field. Pass "div" for cells whose children own their click
   * behaviour (toggle pills, file pickers, anything that renders its own
   * <label>), since nesting or mis-forwarding a label click is worse than not
   * forwarding it at all.
   */
  as?:       "div" | "label";
  /** Caret for text fields, pointer for things that open on click. */
  cursor?:   "text" | "pointer";
  /**
   * Id stamped on the label so a control that can't be wrapped in a label can
   * still point at it with aria-labelledby.
   */
  captionId?: string;
  /** Click anywhere in the shell — used by cells that open something. */
  onClick?:  (e: MouseEvent<HTMLElement>) => void;
  /**
   * Leading glyph inside the shell. Says what kind of thing the field holds
   * at a glance — a pin for an address, a phone for a number — which is what
   * makes a dense row of identical boxes readable.
   */
  icon?:     ElementType;
   /**
   * Draw the bordered shell. Applies to labelled cells only; a cell without a
   * label never gets one. Turn it off for labelled cells whose control is its
   * own surface — upload tiles, and read-only facts that are not fields.
   */
  boxed?:    boolean;
  /** "start" lets a multi-line control (a textarea) grow inside the shell. */
  align?:    "center" | "start";
  children:  ReactNode;
}) {
  // At rest the shells come off: nothing here is editable, and a page of
  // empty-looking inputs invites clicks that do nothing.
  const atRest = useReadOnly();
  // Only a labelled cell is a field. A cell with no caption is a custom block
  // — a toggle group, an upload tile — whose children bring their own surface,
  // and wrapping one in a field shell drew a box around a box.
  const shell  = boxed && !atRest && !!label;

  const Tag = as ?? (label ? "label" : "div");
  const clickable = Tag === "label"
    ? (cursor === "pointer" ? "cursor-pointer" : "cursor-text")
    : "";

  const body = shell ? (
    <div
      onClick={onClick}
      className={`${error ? fieldShellErrorCls : fieldShellCls} ${align === "start" ? "items-start py-[calc(var(--field-px)*0.75)]" : ""}`}
    >
      {Icon && <Icon size={14} className={`${fieldIconCls} ${align === "start" ? "mt-1" : ""}`} />}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  ) : (
    <div onClick={onClick}>{children}</div>
  );

  return (
    <Tag className={`group/cell block min-w-0 ${clickable} ${wide ? "sm:col-span-2" : ""}`}>
      {label && (
        <div
          id={captionId}
          className={`${cellLabelCls} mb-1.5 ${error ? "text-red-500/90" : ""}`}
        >
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </div>
      )}
      {body}
      {error
        ? <div className="text-[length:var(--cell-hint-fs)] text-red-400 mt-1">{error}</div>
        : hint && <div className="text-[length:var(--cell-hint-fs)] text-muted-foreground/75 mt-1">{hint}</div>}
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
 *
 * `collapsible` makes the header a disclosure. A load form is a long page and
 * most of it is filled once and never looked at again, so a dispatcher should
 * be able to fold away what they're done with. Two rules keep that from
 * losing anyone's work:
 *
 *   • a section being edited can't be folded shut — the chevron is inert
 *     while a draft is open, so edits can't be hidden and then forgotten;
 *   • a section holding an error opens itself, so the message is never
 *     announced behind a closed door.
 */
export function SectionCard({
  n, icon: Icon, color, title, meta, style, bare = false,
  collapsible = false, defaultOpen = true, children,
}: {
  /** Step number for sections that form a sequence. */
  n?:     number;
  /**
   * The section's glyph. Pairs with `n` — the number gives the order, the
   * icon gives the subject, and a page of stacked headers is quicker to find
   * your place in with both. On its own (Settings, which is not a sequence)
   * it renders as a tinted chip instead.
   */
  icon?:  ElementType;
  /** Accent for the badge and the header wash — echoes the map/pin colours. */
  color?: string;
  title:  string;
  /**
   * Right-hand slot in the header: a readout, a status pill, a small action.
   * Whatever goes here is held to the header's own height, so a section with
   * a button in its header still lines up with one without.
   */
  meta?:  ReactNode;
  /**
   * Cell-metric overrides when a section wants its own density — the header
   * included, which is the point for a whole-form scale like `formMetrics`
   * but wrong for a body that is merely roomy. Sections sitting side by side
   * line up at the header, so looseness meant for the contents goes on the
   * contents.
   */
  style?: CSSProperties;
  /** Skip the padded body — for sections that lay out their own interior. */
  bare?:  boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const edit = useSectionEdit();

  // An open draft or an unread error pins the section open regardless of what
  // the user last clicked.
  const pinned = !!edit?.editing || !!edit?.error;
  const shown  = !collapsible || open || pinned;

  const numbered = n !== undefined;
  const lead = (numbered || Icon) && (
    <span className="flex items-center gap-2 flex-shrink-0">
      {numbered && <SectionNum n={n!} color={color} />}
      {Icon && (numbered
        // Beside a number the glyph is bare — two badges in a row would read
        // as two separate markers rather than one label.
        ? <Icon size={14} style={color ? { color } : undefined} className={color ? "" : "text-primary"} />
        : (
          <span
            className="w-[22px] h-[22px] rounded-md flex items-center justify-center border"
            style={color
              ? { background: `color-mix(in srgb, ${color} 14%, transparent)`, borderColor: `color-mix(in srgb, ${color} 30%, transparent)`, color }
              : undefined}
          >
            <Icon size={12} className={color ? "" : "text-primary"} />
          </span>
        ))}
    </span>
  );

  return (
    <Sheet className="bg-card" style={style}>
      <SheetHeader
        lead={lead}
        title={title}
        tint={color}
        onClick={collapsible && !pinned ? () => setOpen(o => !o) : undefined}
        meta={
          <>
            <EditAffordance />
            {meta}
            {collapsible && (
              <ChevronDown
                size={16}
                aria-hidden
                className={`text-muted-foreground transition-transform ${shown ? "rotate-180" : ""} ${pinned ? "opacity-30" : ""}`}
              />
            )}
          </>
        }
      />
      {shown && (bare ? children : <SheetBody>{children}</SheetBody>)}
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
  required, readOnly, maxLength, min, max, wide, icon,
}: {
  label: string;
  /** Leading glyph in the shell — see Cell. */
  icon?: ElementType;
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
      <Cell label={label} hint={hint} error={error} required={required} wide={wide} cursor="pointer">
        <MaskedDateInput
          bare value={value} min={min} max={max} readOnly={readOnly}
          onChange={v => onChange?.(v)} onBlur={onBlur}
        />
      </Cell>
    );
  }
  return (
    <Cell label={label} hint={hint} error={error} required={required} wide={wide} icon={icon}>
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
function useSelectPicker() {
  const ref = useRef<HTMLSelectElement>(null);

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

  return { ref, openPicker };
}

/** The bare control, so a cell can pair it with something else in one band. */
function SelectControl({ selectRef, value, captionId, onChange, children }: {
  selectRef: Ref<HTMLSelectElement>;
  value:     string;
  captionId: string;
  onChange:  (v: string) => void;
  children:  ReactNode;
}) {
  return (
    <div className="relative">
      <select
        ref={selectRef}
        value={value}
        aria-labelledby={captionId}
        onChange={e => onChange(e.target.value)}
        className={`${cellInputCls} w-full appearance-none cursor-pointer pr-5 truncate [&>option]:bg-popover [&>option]:text-popover-foreground ${value ? "" : "text-muted-foreground/45"}`}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground/60"
      />
    </div>
  );
}

export function SelectCell({ label, value, onChange, children, hint, error, required, wide, icon }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  hint?: string;
  error?: string | null;
  required?: boolean;
  wide?: boolean;
  icon?: ElementType;
}) {
  const captionId = useId();
  const { ref, openPicker } = useSelectPicker();
  const atRest = useReadOnly();

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
      as="div" cursor="pointer" captionId={captionId} onClick={openPicker} icon={icon}
    >
      <SelectControl selectRef={ref} value={value} captionId={captionId} onChange={onChange}>
        {children}
      </SelectControl>
    </Cell>
  );
}

/** Marks the typed branch in the menu; never leaves this cell. */
const OTHER = "__other__";

/**
 * A select that ends in "Other", which opens a text field under the menu.
 *
 * The typed text *is* the value — callers see the one string they already
 * had, never the sentinel, so nothing downstream learns the field has two
 * input modes. A stored value matching no option reopens in typed mode,
 * which is what carries a custom entry across a reload.
 */
export function SelectOtherCell({
  label, value, options, onChange, placeholder, otherLabel = "Other",
  emptyLabel = "— Select —", maxLength, hint, error, required, wide,
}: {
  label:       string;
  value:       string;
  /** The menu minus "Other" — this cell appends that entry itself. */
  options:     readonly string[];
  onChange:    (v: string) => void;
  placeholder?: string;
  otherLabel?:  string;
  emptyLabel?:  string;
  maxLength?:   number;
  hint?:        string;
  error?:       string | null;
  required?:    boolean;
  wide?:        boolean;
}) {
  const captionId = useId();
  const { ref, openPicker } = useSelectPicker();
  const inputRef = useRef<HTMLInputElement>(null);
  const atRest = useReadOnly();

  // Which branch is open can't be read off the value alone: "Other" with
  // nothing typed yet is empty, and something typed may happen to match an
  // option. So the mode is state, and a value this cell didn't emit — a
  // record loading in, a cancelled edit reverting — resets it.
  const [typing, setTyping] = useState(() => value !== "" && !options.includes(value));
  const mine = useRef(value);

  if (value !== mine.current) {
    mine.current = value;
    setTyping(value !== "" && !options.includes(value));
  }

  function emit(v: string) {
    mine.current = v;
    onChange(v);
  }

  function pick(v: string) {
    if (v === OTHER) {
      setTyping(true);
      emit("");
      // The select keeps focus through its own change event, so hand it to
      // the field that just appeared and the next keystroke lands there.
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setTyping(false);
    emit(v);
  }

  function onBandClick(e: MouseEvent<HTMLElement>) {
    // In typed mode the band belongs to the input; the select still opens
    // itself when hit directly, which is the way back to the menu.
    if (!typing) return openPicker(e);
    if (e.target !== ref.current) inputRef.current?.focus();
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
      as="div" cursor={typing ? "text" : "pointer"} captionId={captionId}
      boxed={false}
    >
      {/* Two shells, not one holding two controls: the menu and the typed
          name are separate fields once "Other" is open, and boxing them
          together would read as a single control with a stray box inside. */}
      <div className={error ? fieldShellErrorCls : fieldShellCls} onClick={onBandClick}>
        <div className="flex-1 min-w-0">
          <SelectControl
            selectRef={ref} captionId={captionId}
            value={typing ? OTHER : value} onChange={pick}
          >
            <option value="">{emptyLabel}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
            <option value={OTHER}>{otherLabel}</option>
          </SelectControl>
        </div>
      </div>
      {typing && (
        <div className={`${error ? fieldShellErrorCls : fieldShellCls} mt-2`}>
          <input
            ref={inputRef}
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-label={`${label} — ${otherLabel}`}
            onChange={e => emit(e.target.value)}
            className={`${cellInputCls} w-full`}
          />
        </div>
      )}
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
    <Cell
      label={label} hint={hint} error={error} required={required} wide={wide}
      as={atRest ? "div" : undefined} cursor="pointer"
    >
      {atRest
        ? <ReadValue mono>{isoToDisplay(value)}</ReadValue>
        : <MaskedDateInput bare value={value} min={min} max={max} onChange={onChange} />}
    </Cell>
  );
}

/**
 * A single clock time under one caption — an appointment, not a window.
 *
 * The native picker button is hidden the way TimeRangeCell hides it, and our
 * own clock glyph is drawn in its place with the (transparent) indicator laid
 * over it — the same trick MaskedDateInput uses for the calendar icon, so a
 * time cell and a date cell carry the same affordance in the same spot.
 */
export function TimeCell({ label, value, onChange, hint, wide }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  wide?: boolean;
}) {
  const atRest = useReadOnly();

  if (atRest) {
    return (
      <Cell label={label} hint={hint} wide={wide} as="div">
        <ReadValue mono>{value}</ReadValue>
      </Cell>
    );
  }

  return (
    <Cell label={label} hint={hint} wide={wide} cursor="pointer">
      {/* The glyph leads the field, and the browser's own (transparent) picker
          button is stretched over it, so the icon a user aims at is the thing
          that opens the picker — the same trick MaskedDateInput uses. */}
      <div className="relative">
        <input
          type="time" value={value} onChange={e => onChange(e.target.value)}
          className={
            `${cellInputCls} font-mono w-full pl-6 ` +
            "[&::-webkit-calendar-picker-indicator]:absolute " +
            "[&::-webkit-calendar-picker-indicator]:left-0 " +
            "[&::-webkit-calendar-picker-indicator]:top-0 " +
            "[&::-webkit-calendar-picker-indicator]:h-full " +
            "[&::-webkit-calendar-picker-indicator]:w-5 " +
            "[&::-webkit-calendar-picker-indicator]:opacity-0 " +
            "[&::-webkit-calendar-picker-indicator]:cursor-pointer"
          }
        />
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none ${fieldIconCls}`}>
          <Clock size={14} />
        </span>
      </div>
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
    <Cell label={label} wide={wide} icon={Clock}>
      <div className="flex items-center gap-2">
        <input
          type="time" value={start} onChange={e => onChangeStart(e.target.value)}
          className={timeInputCls}
        />
        <ArrowRight size={11} className="text-muted-foreground/50 flex-shrink-0" />
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
    <Cell label={label} wide={wide} cursor="pointer">
      <div className="flex items-center gap-2">
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
    <Cell label={label} hint={hint} wide={wide} align="start">
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`${cellInputCls} w-full resize-none leading-relaxed block`}
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
 * One choice out of two or three, drawn as a segmented control.
 *
 * The control fills the field the way an input does, so a row of them lines
 * up with the boxed inputs beside it. That was the whole problem with the
 * previous shapes: loose pills left two thirds of the field empty, and tick
 * boxes inside a field shell read as something you could type into — a text
 * surface wrapped around controls that take no text, with unticked squares
 * washing out against the fill.
 *
 * A segment is a button, not a checkbox, because these answers are mutually
 * exclusive: the track shows both options at once and exactly one can win,
 * which is what the shape should say. Clicking the active segment clears the
 * field back to "not set"; pass clearable={false} for fields backed by a
 * plain boolean, which have no unset state to return to.
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

  // At rest there is no control, only the answer — the same quiet chip the
  // other cells render their value as.
  if (atRest) {
    const picked = options.find(o => o.value === value);

    return (
      <Cell label={label} wide={wide} as="div" boxed={false}>
        {picked ? (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono border ${activeToneCls(picked.tone)}`}>
            {picked.label}
          </span>
        ) : <ReadValue>{""}</ReadValue>}
      </Cell>
    );
  }

  return (
    <Cell label={label} wide={wide} as="div" boxed={false}>
      {/* Each option is its own raised surface with a rule between them, so
          the control reads as a row of buttons standing still rather than as
          a label that happens to react to the pointer. Muted text on a shared
          track gave the unpicked side no affordance at all until hover, by
          which time the user has already had to guess. */}
      <div
        role="radiogroup"
        aria-label={label}
        className="flex w-full items-stretch rounded-md border border-border overflow-hidden
                   divide-x divide-border min-h-[var(--field-h)]
                   focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15
                   transition-colors"
      >
        {options.map(o => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(active && clearable ? "" : o.value)}
              className={`flex-1 min-w-0 truncate px-2 py-1.5 text-[length:var(--cell-fs)]
                          cursor-pointer transition-colors
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-inset
                          focus-visible:ring-primary/40 ${
                active
                  ? segmentToneCls(o.tone)
                  : "bg-card text-foreground/75 hover:bg-muted hover:text-foreground active:bg-muted/80"
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

/**
 * The picked segment. Every tone is a fill rather than a tint, because the
 * unpicked segments are now surfaces of their own — a selection that only
 * shaded the background would have read as another button, not as the answer.
 */
function segmentToneCls(tone: ChoiceOption["tone"]): string {
  switch (tone) {
    // Quiet affirmative — "No" is an answer, not an alarm, so it is filled
    // enough to be unmistakably chosen without shouting like the red branch.
    case "neutral": return "bg-secondary text-secondary-foreground font-semibold";
    case "danger":  return "bg-red-500 text-white font-semibold";
    case "success": return "bg-emerald-500 text-white font-semibold";
    default:        return "bg-primary text-primary-foreground font-semibold";
  }
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

export function SectionNum({ n, color = "#2563eb", size = SECTION_LEAD_PX }: {
  n: number;
  color?: string;
  /** Diameter in px. Defaults to the shared lead size; smaller for compact headers. */
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

  // Inside a field shell the glyph leads, matching every other cell; the
  // standalone variant keeps it trailing, where its own box has room for it.
  const inputCls = bare
    ? `${cellInputCls} w-full pl-6 font-mono ${readOnly ? "opacity-50 cursor-not-allowed" : ""}`
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
      <span className={`absolute ${bare ? "left-0" : "right-2"} top-1/2 -translate-y-1/2 pointer-events-none ${bare ? fieldIconCls : "text-muted-foreground"}`}>
        <Calendar size={14} />
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
        className={`absolute ${bare ? "left-0 w-5" : "right-0 w-9"} top-0 h-full opacity-0 cursor-pointer disabled:cursor-not-allowed`}
      />
    </div>
  );
}
