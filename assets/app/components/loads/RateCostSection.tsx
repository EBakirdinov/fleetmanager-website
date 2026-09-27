import {
  useEffect, useRef, useState,
  type ChangeEvent, type ReactNode,
} from "react";
import { ChevronDown, DollarSign, EyeOff, Info, Pencil, Plus, X } from "lucide-react";
import { SECTION_LEAD_PX, SectionCard, captionCls, cellInputCls, useCellReadOnly } from "../../lib/cells";
import AddAccessorialModal, { type AccessorialDraft } from "./AddAccessorialModal";
import { ESTIMATED_NOTE } from "./routeSummary";
import {
  ACCESSORIAL_GROUPS, CUSTOM_TYPE,
  costBlockIsEmpty, groupTotal, isRevenue,
  linesFromApi, linesToPayload, nextCustomKey, totalCost, totalRevenue,
  type AccessorialLine, type GroupDef,
} from "./accessorials";

/**
 * Section 6 — Rate & Cost Breakdown, as a ledger of grouped lines.
 *
 * Every figure is a line, and a line is either one of the eleven presets in
 * the catalog or something a dispatcher added through the Add Accessorial
 * dialog. See accessorials.ts for the catalog and the arithmetic; this file
 * is the reading of it.
 *
 * The blocks fold because the ledger is long and most loads only ever touch
 * two or three of its lines — folding Surcharges away is how a dispatcher
 * keeps the run of figures they care about on one screen.
 *
 * Rules mark arithmetic, not rows. A block gets a rule above its subtotal;
 * Total Revenue and Profit are washed bands rather than ruled rows, because
 * they are conclusions rather than more line items. Inside a block, rows are
 * separated by nothing but space — which is what lets the few rules that are
 * there read as arithmetic instead of table furniture.
 *
 * The figure column carries its own currency mark and right-aligns whole, so
 * amounts line up on their last digit with nothing floating between a label
 * and its number.
 */

/** Default suggestion for Est. Fuel Cost; move to a company setting later. */
const COST_PER_MILE = 1.6;

export interface RateCostFormState {
  lines: AccessorialLine[];
}

export const emptyRateCostForm = (): RateCostFormState => ({ lines: linesFromApi(null) });

export function rateCostFormToPayload(f: RateCostFormState): Record<string, unknown> {
  return { accessorialLines: linesToPayload(f.lines) };
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function RateCostSection({
  value, onChange, totalMiles, milesSource, sectionNumber = 6,
}: {
  value:      RateCostFormState;
  onChange:   (patch: Partial<RateCostFormState>) => void;
  totalMiles?: number | null;
  /**
   * How `totalMiles` was arrived at. Every per-mile figure here inherits its
   * error: an `estimated` distance runs 15–25% under the real one, which
   * understates the suggested fuel cost by the same margin and overstates
   * all-in RPM by about a third — both in the flattering direction, which is
   * the direction worth labelling.
   */
  milesSource?: "routed" | "estimated" | null;
  /**
   * Sections are numbered per page, not per component: the Add page runs
   * Assignment at 4 and this at 6, while the control page has no Assignment
   * and runs this at 5. The page owns the sequence.
   */
  sectionNumber?: number;
}) {
  /**
   * The control page wraps this section in an EditableSection, so it spends
   * most of its life being read rather than filled in. At rest the figures
   * are text: eleven live inputs sitting in a section nobody pressed Edit on
   * invite a stray keystroke into the one number on the page that decides
   * whether the load was worth taking.
   */
  const atRest = useCellReadOnly();

  const [costTouched, setCostTouched] = useState(false);
  const [dialogOpen,  setDialogOpen]  = useState(false);
  /** Set when the dialog was opened to change an existing custom line. */
  const [editingKey,  setEditingKey]  = useState<string | null>(null);

  const lines = value.lines;

  const patchLines = (next: AccessorialLine[]) => onChange({ lines: next });

  const setAmount = (key: string, amount: string, category: AccessorialLine["category"]) => {
    if (category === "cost") setCostTouched(true);
    patchLines(lines.map(l => (l.key === key ? { ...l, amount } : l)));
  };

  const removeLine = (key: string) => patchLines(lines.filter(l => l.key !== key));

  /**
   * Est. Fuel Cost fills itself in from the routed miles until somebody
   * types a cost of their own.
   *
   * Gated on the whole cost block being empty rather than on this one line:
   * a load carried over from the single `estimated_cost` column lands its
   * figure in Other Costs, and suggesting a fuel cost on top of that would
   * quietly double the load's costs the first time the page was opened.
   */
  useEffect(() => {
    if (atRest) return;
    if (costTouched) return;
    if (typeof totalMiles !== "number" || totalMiles <= 0) return;
    if (!costBlockIsEmpty(lines)) return;

    const suggested = (totalMiles * COST_PER_MILE).toFixed(2);
    onChange({ lines: lines.map(l => (l.type === "est_fuel" ? { ...l, amount: suggested } : l)) });
  }, [atRest, totalMiles, costTouched, lines, onChange]);

  const revenue = totalRevenue(lines);
  const cost    = totalCost(lines);
  const profit  = revenue - cost;
  const margin  = revenue > 0 ? (profit / revenue) * 100 : null;

  const milesKnown = typeof totalMiles === "number" && totalMiles > 0;
  /** All-in rate per mile — the one figure worth promoting into the header. */
  const allInRpm = milesKnown && revenue > 0 ? revenue / totalMiles! : null;

  const suggestionShowing = !costTouched && milesKnown;

  const milesEstimated = milesSource === "estimated";

  // ── Dialog plumbing ──────────────────────────────────────────────────
  const editing = editingKey === null ? null : lines.find(l => l.key === editingKey) ?? null;

  const commitDraft = (draft: AccessorialDraft) => {
    if (editing) {
      patchLines(lines.map(l => (l.key === editing.key ? { ...l, ...draftToLine(draft) } : l)));
    } else {
      patchLines([...lines, { key: nextCustomKey(), preset: false, ...draftToLine(draft) }]);
    }
    setDialogOpen(false);
    setEditingKey(null);
  };

  return (
    <SectionCard
      n={sectionNumber}
      color="#059669"
      title="Rate & Cost Breakdown"
      icon={DollarSign}
      bare
      collapsible
      meta={
        <>
          {allInRpm !== null && (
            <span
              className={`${captionCls} flex-shrink-0 hidden sm:inline`}
              title={milesEstimated ? ESTIMATED_NOTE : undefined}
            >
              <span className="text-foreground font-semibold">${allInRpm.toFixed(2)}</span> / mi all-in
              {milesEstimated && <span className="text-amber-500 ml-1">(est. miles)</span>}
            </span>
          )}
          {!atRest && (
          <button
            type="button"
            // The header band toggles the section; this button sits inside it
            // and must not fold the ledger shut on its way to opening a dialog.
            onClick={e => { e.stopPropagation(); setEditingKey(null); setDialogOpen(true); }}
            // Pinned to the header's own height so it sits in the band rather
            // than stretching it — see SheetHeader's meta slot.
            style={{ height: SECTION_LEAD_PX }}
            className="flex items-center gap-1 flex-shrink-0 px-2 leading-none rounded-md border border-primary/40
                       bg-primary/10 text-primary text-xs font-medium cursor-pointer
                       hover:bg-primary/20 hover:border-primary/60 transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Plus size={12} /> <span className="hidden sm:inline">Add Accessorial</span>
          </button>
          )}
        </>
      }
    >
      {ACCESSORIAL_GROUPS.map(def => (
        <div key={def.category}>
          <Group
            def={def}
            atRest={atRest}
            lines={lines.filter(l => l.category === def.category)}
            subtotal={groupTotal(lines, def.category)}
            suggestionShowing={suggestionShowing}
            totalMiles={totalMiles}
            milesEstimated={milesEstimated}
            onAmount={setAmount}
            onRemove={removeLine}
            onEdit={key => { setEditingKey(key); setDialogOpen(true); }}
          />

          {/* Revenue is settled once the last revenue block has been read;
              the whole sheet is settled once costs have. */}
          {def.category === "other_revenue" && (
            <TotalBand label="Total Revenue" amount={revenue} tone="positive" />
          )}
          {def.category === "cost" && (
            <TotalBand
              label="Profit / Margin"
              amount={profit}
              note={margin === null ? null : `${margin.toFixed(1)}%`}
              tone={profit >= 0 ? "positive" : "negative"}
              grand
            />
          )}
        </div>
      ))}

      <AddAccessorialModal
        open={dialogOpen}
        editing={editing}
        onClose={() => { setDialogOpen(false); setEditingKey(null); }}
        onSubmit={commitDraft}
      />
    </SectionCard>
  );
}

function draftToLine(d: AccessorialDraft): Omit<AccessorialLine, "key" | "preset"> {
  return {
    type:     CUSTOM_TYPE,
    category: d.category,
    label:    d.name,
    tooltip:  d.notes || undefined,
    amount:   d.amount,
    notes:    d.notes,
    includeInRateCon: d.includeInRateCon,
  };
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

function Group({
  def, atRest, lines, subtotal, suggestionShowing, totalMiles, milesEstimated, onAmount, onRemove, onEdit,
}: {
  def:      GroupDef;
  atRest:   boolean;
  lines:    AccessorialLine[];
  subtotal: number;
  suggestionShowing: boolean;
  totalMiles?: number | null;
  /** `totalMiles` is a straight-line estimate, so the suggestion off it is low. */
  milesEstimated?: boolean;
  onAmount: (key: string, amount: string, category: AccessorialLine["category"]) => void;
  onRemove: (key: string) => void;
  onEdit:   (key: string) => void;
}) {
  const [open, setOpen] = useState(true);

  // A folded block still has to admit what it is holding, or folding one
  // becomes a way to lose money without noticing.
  const filled = lines.filter(l => l.amount.trim() !== "").length;

  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full px-[var(--cell-px)] py-2 cursor-pointer
                   hover:bg-muted/25 transition-colors text-left
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        <ChevronDown
          size={13}
          aria-hidden
          className={`text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className={`${captionCls} truncate`}>{def.label}</span>
        {!open && filled > 0 && (
          <span className="ml-auto text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/70 flex-shrink-0">
            {filled} filled
          </span>
        )}
      </button>

      {open && (
        <>
          {lines.map(line => (
            <LineRow
              key={line.key}
              line={line}
              atRest={atRest}
              subtitle={
                line.type === "est_fuel" && suggestionShowing && typeof totalMiles === "number"
                  ? `suggested at $${COST_PER_MILE.toFixed(2)}/mi × ${Math.round(totalMiles).toLocaleString()} mi${
                      milesEstimated ? " (approx.)" : ""}`
                  : null
              }
              onAmount={onAmount}
              onRemove={onRemove}
              onEdit={onEdit}
            />
          ))}

          {def.subtotal && (
            <div className="flex items-center justify-between gap-3 mx-[var(--cell-px)] py-2 border-t border-border">
              <span className="text-[length:var(--cell-fs)] font-semibold text-foreground">{def.subtotal}</span>
              <Amount negative={def.category === "cost" && subtotal !== 0}>
                <span>{formatFigure(Math.abs(subtotal))}</span>
              </Amount>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LineRow({ line, atRest, subtitle, onAmount, onRemove, onEdit }: {
  line:     AccessorialLine;
  atRest:   boolean;
  subtitle: string | null;
  onAmount: (key: string, amount: string, category: AccessorialLine["category"]) => void;
  onRemove: (key: string) => void;
  onEdit:   (key: string) => void;
}) {
  const hiddenFromBroker = isRevenue(line.category) && !line.includeInRateCon;

  // A <label> at rest would still hand focus to a control that is no longer
  // there, and advertise a text caret over a figure that cannot be typed in.
  const Wrapper = atRest ? "div" : "label";

  return (
    <Wrapper
      className={`group/row flex flex-col justify-center px-[var(--cell-px)] py-1.5
                  hover:bg-muted/25 focus-within:bg-primary/[0.05] transition-colors ${
        atRest ? "" : "cursor-text"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 min-w-0 flex-1 text-[length:var(--cell-fs)] text-muted-foreground">
          <span className="truncate">{line.label}</span>

          {line.tooltip && (
            <span
              title={line.tooltip}
              onClick={e => e.preventDefault()}
              className="text-muted-foreground/60 cursor-help flex-shrink-0"
            >
              <Info size={11} />
            </span>
          )}

          {hiddenFromBroker && (
            <span
              title="Not itemised on the rate confirmation."
              onClick={e => e.preventDefault()}
              className="text-muted-foreground/50 cursor-help flex-shrink-0"
            >
              <EyeOff size={11} />
            </span>
          )}
        </span>

        {/* Custom lines are the only ones that can be renamed or taken away —
            a preset with no amount is already as absent as it can be. */}
        {!line.preset && !atRest && (
          <span className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
            <RowAction label={`Edit ${line.label}`} onClick={() => onEdit(line.key)}>
              <Pencil size={11} />
            </RowAction>
            <RowAction label={`Remove ${line.label}`} danger onClick={() => onRemove(line.key)}>
              <X size={12} />
            </RowAction>
          </span>
        )}

        <Amount negative={line.category === "cost"} dim={line.amount.trim() === ""}>
          {atRest
            ? <span>{formatFigure(num(line.amount))}</span>
            : <MoneyInput value={line.amount} onChange={v => onAmount(line.key, v, line.category)} />}
        </Amount>
      </div>

      {subtitle && (
        <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/75 text-right">
          {subtitle}
        </div>
      )}
    </Wrapper>
  );
}

function RowAction({ label, danger, onClick, children }: {
  label:   string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Inside a <label>: without this the click focuses the money input
      // instead of firing the action.
      onClick={e => { e.preventDefault(); onClick(); }}
      className={`p-1 rounded cursor-pointer transition-colors focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-primary/40 ${
        danger
          ? "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Total Revenue and Profit / Margin — washed bands rather than ruled rows.
 * Both are conclusions drawn from everything above them, and a plain rule
 * would file them as one more line in whichever block they happen to follow.
 */
function TotalBand({ label, amount, note, tone, grand }: {
  label:  string;
  amount: number;
  note?:  string | null;
  tone:   "positive" | "negative";
  /** The final figure — heavier type, and the margin rides alongside it. */
  grand?: boolean;
}) {
  const color = tone === "negative" ? "text-red-500" : "text-emerald-500";
  const wash  = tone === "negative" ? "bg-red-500/[0.07]" : "bg-emerald-500/[0.07]";

  return (
    <div className={`flex items-center justify-between gap-3 px-[var(--cell-px)] py-2.5 border-t border-border ${wash}`}>
      <span className={`${grand ? "text-base" : "text-[length:var(--cell-fs)]"} font-semibold text-foreground`}>
        {label}
      </span>
      <span className="flex items-baseline gap-1.5 flex-shrink-0">
        <Amount negative={amount < 0} strong={grand} color={color}>
          <span>{formatFigure(Math.abs(amount))}</span>
        </Amount>
        {note && (
          <span className={`text-[length:var(--cell-hint-fs)] font-mono ${color} opacity-80`}>
            ({note})
          </span>
        )}
      </span>
    </div>
  );
}

// ─── The money column ────────────────────────────────────────────────────────

/**
 * Figures right-align as whole strings — "$2,500.00" — with the mark
 * attached, so nothing floats between a label and its number.
 */
function Amount({ negative, strong, color, dim, children }: {
  negative?: boolean;
  strong?:   boolean;
  color?:    string;
  /** Nothing entered — matches the weight of the input's placeholder. */
  dim?:      boolean;
  children:  ReactNode;
}) {
  const size = strong ? "text-base" : "text-[length:var(--cell-fs)]";
  const tone = dim ? "text-muted-foreground/45" : (color ?? "text-foreground");

  // A gap after the mark: set tight, "$123123123123" reads as one long token
  // and the eye has to hunt for where the number starts.
  return (
    <span className={`flex items-baseline flex-shrink-0 gap-1 font-mono font-semibold ${size} ${tone}`}>
      {negative && !dim && <span>−</span>}
      <span>$</span>
      {children}
    </span>
  );
}

function MoneyInput({ value, onChange }: {
  value:    string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  /**
   * Group as the user types, the way a banking field does. The naive version
   * of this jumps the caret to the end on every keystroke, because inserting
   * a separator shifts every character after it — so the caret is restored by
   * counting *value* characters (digits and the decimal point) rather than
   * raw offsets, and re-finding that position in the regrouped string.
   */
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const caret = el.selectionStart ?? el.value.length;
    const keep = countValueChars(el.value.slice(0, caret));

    const cleaned = clean(el.value);
    const next = groupDigits(cleaned);

    // Written straight to the DOM as well as through state: when a keystroke
    // cleans away to the same value (typing a stray comma, say), React has no
    // re-render to do and the input would otherwise keep showing the reject.
    el.value = next;
    let pos = 0, seen = 0;
    while (pos < next.length && seen < keep) {
      if (isValueChar(next[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);

    onChange(cleaned);
  }

  // Typing shows what's there; at rest the figure settles to two decimals.
  const display = focused ? groupDigits(value) : (value === "" ? "" : formatFigure(num(value)));
  // Exactly as wide as its contents — the figures are monospaced, so 1ch is
  // one glyph and any slack here shows up as a gap after the "$". Four is
  // the placeholder's width.
  const chars = Math.max(display.length, 4);

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="0.00"
      style={{ width: `${chars}ch` }}
      className={`${cellInputCls} font-mono font-semibold text-right placeholder:text-muted-foreground/45 placeholder:font-normal`}
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isValueChar = (c: string) => c === "." || (c >= "0" && c <= "9");

const countValueChars = (s: string) =>
  [...s].reduce((n, c) => n + (isValueChar(c) ? 1 : 0), 0);

/**
 * Keep digits and a single decimal point, capped at two places — what the
 * field shows and what it stores stay the same number, so nothing is quietly
 * rounded away between the screen and the payload.
 */
function clean(raw: string): string {
  const kept = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  const dot = kept.indexOf(".");
  return dot === -1 ? kept : kept.slice(0, dot + 3);
}

/** Thousands separators on the integer part; decimals left as typed. */
function groupDigits(v: string): string {
  if (v === "") return "";
  const dot = v.indexOf(".");
  const int = dot === -1 ? v : v.slice(0, dot);
  const dec = dot === -1 ? "" : v.slice(dot);
  const trimmed = int.replace(/^0+(?=\d)/, "");
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + dec;
}

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Grouped, two-decimal figure — no currency mark; Amount renders that. */
function formatFigure(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
