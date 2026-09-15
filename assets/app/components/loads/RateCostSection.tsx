import {
  useEffect, useRef, useState,
  type ChangeEvent, type CSSProperties, type ReactNode,
} from "react";
import { Info } from "lucide-react";
import { SectionCard, bandCls, captionCls, cellInputCls } from "../../lib/cells";

/**
 * Section 6 — Rate & Cost Breakdown, as a ledger.
 *
 * Rules mark the arithmetic, not every row. The sheet draws a hairline
 * between its direct children, so grouping the four revenue lines into one
 * child — and the cost/result pair into another — leaves exactly the three
 * rules that mean something: under the header, and bracketing Total Revenue.
 * Rows inside a group are separated by space alone, which is what lets the
 * rules read as arithmetic rather than as table furniture.
 *
 * The figure column carries its own currency mark and right-aligns whole,
 * so amounts line up on their last digit with nothing floating between the
 * label and the number.
 *
 * Public API (state, payload adapter) unchanged from prior version.
 */

const COST_PER_MILE = 1.6; // Default suggestion; move to company setting later.

/**
 * The ledger runs looser than the rest of the kit. A column of figures is
 * read by jumping down it, and rows set tight enough for a dense form make
 * that jump harder — statements and invoices have always given their lines
 * more air than a form gives its fields.
 */
const LEDGER_METRICS = {
  "--cell-px": "1.125rem",
  "--cell-py": "1rem",
  "--cell-fs": "0.9375rem",
} as CSSProperties;

export interface RateCostFormState {
  lineHaulRate:   string;
  fuelSurcharge:  string;
  accessorials:   string;
  detention:      string;
  estimatedCost:  string;
}

export const emptyRateCostForm = (): RateCostFormState => ({
  lineHaulRate: "", fuelSurcharge: "", accessorials: "", detention: "",
  estimatedCost: "",
});

export function rateCostFormToPayload(f: RateCostFormState): Record<string, unknown> {
  return {
    lineHaulRate:  f.lineHaulRate  ? Number(f.lineHaulRate)  : null,
    fuelSurcharge: f.fuelSurcharge ? Number(f.fuelSurcharge) : null,
    accessorials:  f.accessorials  ? Number(f.accessorials)  : null,
    detention:     f.detention     ? Number(f.detention)     : null,
    estimatedCost: f.estimatedCost ? Number(f.estimatedCost) : null,
  };
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function RateCostSection({
  value, onChange, totalMiles, sectionNumber = 6,
}: {
  value:      RateCostFormState;
  onChange:   (patch: Partial<RateCostFormState>) => void;
  totalMiles?: number | null;
  /**
   * Sections are numbered per page, not per component: the Add page runs
   * Assignment at 5 and this at 6, while the control page has no Assignment
   * and runs this at 5. The page owns the sequence.
   */
  sectionNumber?: number;
}) {
  const [costTouched, setCostTouched] = useState(!!value.estimatedCost);

  useEffect(() => {
    if (costTouched) return;
    if (typeof totalMiles !== "number" || totalMiles <= 0) return;
    const suggested = (totalMiles * COST_PER_MILE).toFixed(2);
    if (value.estimatedCost !== suggested) {
      onChange({ estimatedCost: suggested });
    }
  }, [totalMiles, costTouched, value.estimatedCost, onChange]);

  const totalRevenue = num(value.lineHaulRate) + num(value.fuelSurcharge)
                     + num(value.accessorials) + num(value.detention);
  const cost   = num(value.estimatedCost);
  const profit = totalRevenue - cost;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : null;

  const milesKnown = typeof totalMiles === "number" && totalMiles > 0;

  // Per-mile fuel rate — shown under Fuel Surcharge when miles + amount known.
  const fuelAmount = num(value.fuelSurcharge);
  const fuelSub = milesKnown && fuelAmount > 0
    ? `${Math.round(totalMiles!).toLocaleString()} mi × $${(fuelAmount / totalMiles!).toFixed(2)}/mi`
    : null;

  // All-in rate per mile: the number a dispatcher judges a load by, and the
  // one figure worth promoting out of the breakdown into the header.
  const allInRpm = milesKnown && totalRevenue > 0 ? totalRevenue / totalMiles! : null;

  return (
    <SectionCard
      n={sectionNumber}
      color="#059669"
      title="Rate & Cost Breakdown"
      style={LEDGER_METRICS}
      meta={allInRpm !== null && (
        <span className={`${captionCls} flex-shrink-0`}>
          <span className="text-foreground font-semibold">${allInRpm.toFixed(2)}</span> / mi all-in
        </span>
      )}
    >
      {/* Revenue lines — one group, so no rule falls between them. */}
      <div>
        <LineItem
          label="Line Haul Rate"
          value={value.lineHaulRate}
          onChange={v => onChange({ lineHaulRate: v })}
        />
        <LineItem
          label="Fuel Surcharge"
          tooltip="Additional charge covering fuel cost fluctuations. Some brokers price this as $ per loaded mile."
          value={value.fuelSurcharge}
          onChange={v => onChange({ fuelSurcharge: v })}
          subtitle={fuelSub}
        />
        <LineItem
          label="Accessorials"
          tooltip="Extra services: lumper fees, tolls, driver assist, etc."
          value={value.accessorials}
          onChange={v => onChange({ accessorials: v })}
        />
        <LineItem
          label="Detention"
          value={value.detention}
          onChange={v => onChange({ detention: v })}
        />
      </div>

      {/* Bracketed by the sheet's own rules — the subtotal. */}
      <TotalLine label="Total Revenue" amount={totalRevenue} tone="positive" />

      {/* Cost and result — one group, one rule above it. */}
      <div>
        <LineItem
          label="Estimated Cost"
          value={value.estimatedCost}
          onChange={v => { setCostTouched(true); onChange({ estimatedCost: v }); }}
          subtitle={!costTouched && milesKnown
            ? `suggested at $${COST_PER_MILE.toFixed(2)}/mi × ${Math.round(totalMiles!).toLocaleString()} mi`
            : null}
          negative
        />
        <TotalLine
          label="Profit / Margin"
          amount={profit}
          note={margin === null ? null : `(${margin.toFixed(1)}%)`}
          tone={profit >= 0 ? "positive" : "negative"}
          grand
        />
      </div>
    </SectionCard>
  );
}

// ─── Ledger rows ─────────────────────────────────────────────────────────────

/**
 * Shared row height. Ledger lines want air — and because the whole band is
 * the label, the row's full height is the click target for its field, not
 * just the one text line the caret sits on.
 */
const ROW_MIN_H = "min-h-[4.25rem]";

/**
 * The money column. Figures right-align as whole strings — "$2,500.00" —
 * with the mark attached, so nothing floats between a label and its number.
 */
function Amount({ negative, strong, color, children }: {
  negative?: boolean;
  strong?:   boolean;
  color?:    string;
  children:  ReactNode;
}) {
  const size = strong ? "text-base" : "text-[length:var(--cell-fs)]";
  // A gap after the mark: set tight, "$123123123123" reads as one long token
  // and the eye has to hunt for where the number starts.
  return (
    <span className={`flex items-baseline flex-shrink-0 gap-1 font-mono font-semibold ${size} ${color ?? "text-foreground"}`}>
      {negative && <span>−</span>}
      <span>$</span>
      {children}
    </span>
  );
}

function LineItem({ label, tooltip, subtitle, value, onChange, negative }: {
  label:     string;
  tooltip?:  string;
  subtitle?: string | null;
  value:     string;
  onChange:  (v: string) => void;
  /** Renders a minus ahead of the mark — this figure is taken away. */
  negative?: boolean;
}) {
  return (
    <label
      className={`${bandCls} ${ROW_MIN_H} flex flex-col justify-center cursor-text hover:bg-muted/25 focus-within:bg-primary/[0.05]`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[length:var(--cell-fs)] text-muted-foreground flex items-center gap-1 min-w-0">
          {label}
          {tooltip && (
            <span
              title={tooltip}
              onClick={e => e.preventDefault()}
              className="text-muted-foreground/60 cursor-help flex-shrink-0"
            >
              <Info size={11} />
            </span>
          )}
        </span>
        <Amount negative={negative}>
          <MoneyInput value={value} onChange={onChange} />
        </Amount>
      </div>
      {subtitle && (
        <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/75 mt-1 text-right">
          {subtitle}
        </div>
      )}
    </label>
  );
}

function TotalLine({ label, amount, note, tone, grand }: {
  label:  string;
  amount: number;
  note?:  string | null;
  tone?:  "positive" | "negative";
  /** The final figure — heavier type, and the note rides alongside it. */
  grand?: boolean;
}) {
  const color = tone === "negative" ? "text-red-500"
              : tone === "positive" ? "text-emerald-500"
              : "text-foreground";
  return (
    <div className={`${bandCls} ${ROW_MIN_H} flex items-baseline justify-between gap-3`}>
      <span className={`${grand ? "text-base" : "text-[length:var(--cell-fs)]"} font-semibold text-foreground`}>
        {label}
      </span>
      <span className="flex items-baseline gap-1.5 flex-shrink-0">
        <Amount negative={amount < 0} strong={grand} color={color}>
          <span>{formatFigure(Math.abs(amount))}</span>
        </Amount>
        {note && (
          <span className={`text-[length:var(--cell-hint-fs)] font-mono ${color} opacity-80`}>
            {note}
          </span>
        )}
      </span>
    </div>
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

/** Grouped, two-decimal figure — no currency mark; AmountCol renders that. */
function formatFigure(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
