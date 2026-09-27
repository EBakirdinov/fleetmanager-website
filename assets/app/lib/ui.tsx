import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChangeEvent, ElementType, ReactNode } from "react";
import { Check, FileUp, Loader2, MoreVertical, Save, Trash2, Upload, X } from "lucide-react";
import {
  Sheet, SheetHeader, SheetBody, Row, Cell, TextCell, SelectCell, TextareaCell, bandCls, formMetrics,
} from "./cells";

export function KpiCard({ label, value, sub, icon: Icon, accent, active, onClick }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ElementType;
  accent: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 bg-card border rounded-md px-4 py-3 text-left transition-colors ${active ? "border-primary/60 bg-primary/5" : "border-border hover:border-white/15"}`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={12} style={{ color: accent }} />
        <span className="text-xs font-mono text-muted-foreground truncate">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-foreground leading-none tracking-tight">{value}</div>
      {sub && <div className="text-xs font-mono text-muted-foreground mt-1">{sub}</div>}
    </button>
  );
}

export function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono" style={{ color }}>
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}80` }}
      />
      {label}
    </span>
  );
}

export function Btn({ children, variant = "ghost", size = "sm", onClick, disabled, className = "" }: {
  children: ReactNode;
  variant?: "ghost" | "outline" | "primary" | "danger";
  size?: "sm" | "xs";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const cls: Record<string, string> = {
    ghost:   "text-muted-foreground hover:text-foreground hover:bg-white/5",
    outline: "border border-border text-foreground hover:border-white/20 hover:bg-white/5",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    danger:  "border border-red-500/30 text-red-400 hover:bg-red-500/10",
  };
  const sz = size === "xs" ? "text-xs px-2 py-1" : "text-xs px-3 py-1.5";
  return (
    <button onClick={onClick} disabled={disabled} className={`font-mono rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cls[variant]} ${sz} ${className}`}>
      {children}
    </button>
  );
}

export function RightPanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="px-4 py-2.5 border-b border-border/60">
        <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export function ComingSoon({ title, icon: Icon }: { title: string; icon: ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-96 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Icon size={20} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs font-mono text-muted-foreground">This section is under construction</p>
    </div>
  );
}

export function SlideDrawer({ open, onClose, title, badge, titleExtra, children, onSave, saving, onDelete, deleting }: {
  open: boolean;
  onClose: () => void;
  title: string;
  badge?: string;
  /** Extra slot after the badge in the header (e.g. an ELD-source chip). */
  titleExtra?: ReactNode;
  children: ReactNode;
  onSave?: () => void;
  saving?: boolean;
  /** When set, a red Delete button appears on the left side of the footer. */
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const busy = saving || deleting;
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-[680px] max-w-[94vw] bg-card border-l border-border z-50 flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.35)" : "none" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <p className="text-base font-semibold text-foreground">{title}</p>
            {badge && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary tracking-wider">
                {badge}
              </span>
            )}
            {titleExtra}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-6 space-y-6" style={formMetrics}>
          {children}
        </div>
        {(onSave || onDelete) && (
          <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border flex-shrink-0 bg-card">
            <div>
              {onDelete && (
                <Btn variant="danger" onClick={onDelete} disabled={busy}>
                  <Trash2 size={11} className="inline mr-1.5" />{deleting ? "Deleting…" : "Delete"}
                </Btn>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} disabled={busy} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 disabled:opacity-50">
                Cancel
              </button>
              {onSave && (
                <Btn variant="primary" onClick={onSave} disabled={busy}>
                  <Save size={11} className="inline mr-1.5" />{saving ? "Saving…" : "Save"}
                </Btn>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * A centred dialog.
 *
 * Distinct from SlideDrawer, which is for working through a record at length
 * beside the page it came from. A modal is for one decision, made and
 * dismissed — it takes the middle of the screen precisely because there is
 * nothing else to attend to until it is answered.
 *
 * Portalled to the body so a card's overflow-hidden can never clip it, and
 * Escape closes it: a dialog whose only exit is finding the right button is
 * a trap. The overlay dismisses on mousedown-and-up over itself, so a text
 * selection that happens to end outside the panel does not close the dialog
 * and throw away what was typed.
 */
export function Modal({ open, onClose, title, subtitle, children, footer, width = 560 }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Buttons along the bottom, right-aligned. */
  footer?: ReactNode;
  /** Max width in px. The panel is narrower on a small screen. */
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);

    // The page behind must not scroll under the dialog.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full bg-card border border-border rounded-xl flex flex-col max-h-[90vh]"
        style={{ maxWidth: width, boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin px-5 pb-4 space-y-3.5" style={formMetrics}>
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * An on/off switch.
 *
 * For a setting that reads as a state the thing is in — "included on the rate
 * confirmation" — rather than an item being ticked off a list. A checkbox
 * says "selected"; this says "on", and the difference is worth a component.
 */
export function Switch({ checked, onChange, label }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Announced to screen readers; the visible text lives beside the switch. */
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full flex-shrink-0 cursor-pointer transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        checked ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/45"
      }`}
    >
      <span
        className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-[left] ${
          checked ? "left-[21px]" : "left-[3px]"
        }`}
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
      />
    </button>
  );
}

/**
 * A titled sheet inside a drawer. Every direct child becomes a hairline-
 * separated band: a DrawerFieldRow pairs two cells, a bare field spans the
 * full width. The shared cell kit in lib/cells.tsx does the rest, so drawer
 * forms and the Load page sections look and behave the same.
 */
/**
 * A scroller that admits it is one.
 *
 * A bare overflow-y-auto slices its last card in half with no indication that
 * anything is below — and on macOS the overlay scrollbar is invisible until
 * you actually scroll, so the clipped edge reads as a rendering bug. This
 * keeps a thin bar visible and fades the content out at whichever edge has
 * more beyond it, so the cut always looks deliberate.
 */
export function ScrollArea({ children, className = "", contentClassName = "", fadeHeight = 24, fadeFrom = "card" }: {
  children: ReactNode;
  className?: string;
  /**
   * Classes for the wrapper that actually holds the children.
   *
   * It sits between the scroller and the content, so a percentage height set
   * on a child of it resolves against `auto` and collapses to nothing — a
   * column told to fill the scroller silently keeps its natural height
   * instead. Anything that has to fill styles this wrapper rather than an
   * element inside it.
   *
   * The wrapper stays in place regardless: the fades are measured from it,
   * because the scroller's own box doesn't change when its contents grow.
   */
  contentClassName?: string;
  /** Height of the fade in px. Smaller for short lists. */
  fadeHeight?: number;
  /**
   * The surface the fade blends into. The default suits a scroller inside a
   * card, which is where most of them live; a column laid straight onto the
   * page needs "background", or the fade reads as a pale band sitting over a
   * darker ground instead of the content running out under an edge.
   */
  fadeFrom?: "card" | "background";
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const content  = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    // 2px of slack: sub-pixel layout means scrollTop rarely lands on an exact
    // 0 or max, and a fade that flickers at rest is worse than no fade.
    const measure = () => {
      const max = el.scrollHeight - el.clientHeight;
      setEdge({ top: el.scrollTop > 2, bottom: max > 2 && el.scrollTop < max - 2 });
    };

    measure();
    el.addEventListener("scroll", measure, { passive: true });

    // The scroller's own box doesn't change when its contents grow, so the
    // observer watches the content wrapper instead.
    const ro = new ResizeObserver(measure);
    if (content.current) ro.observe(content.current);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, []);

  // Written out in full rather than composed — Tailwind scans source for
  // literal class names and would never emit a `from-${…}` it can't read.
  const from = fadeFrom === "background" ? "from-background" : "from-card";

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={scroller} className={`h-full overflow-y-auto scroll-thin ${className}`}>
        <div ref={content} className={contentClassName}>{children}</div>
      </div>
      <div
        aria-hidden
        style={{ height: fadeHeight }}
        className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b ${from} to-transparent transition-opacity duration-150 ${edge.top ? "opacity-100" : "opacity-0"}`}
      />
      <div
        aria-hidden
        style={{ height: fadeHeight }}
        className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t ${from} to-transparent transition-opacity duration-150 ${edge.bottom ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Sheet>
      <SheetHeader lead={<div className="w-1 h-4 bg-primary rounded-full" />} title={title} />
      <SheetBody>{children}</SheetBody>
    </Sheet>
  );
}

export function DrawerField({ label, value, type = "text", hint, readOnly, mono, maxLength, max, min, required, onChange, onBlur, error }: {
  label: string;
  value: string;
  type?: string;
  hint?: string;
  readOnly?: boolean;
  mono?: boolean;
  maxLength?: number;
  max?: string;
  min?: string;
  required?: boolean;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
}) {
  return (
    <TextCell
      label={label} value={value} type={type} hint={hint} error={error}
      readOnly={readOnly} mono={mono} maxLength={maxLength} max={max} min={min}
      required={required} onChange={onChange} onBlur={onBlur}
    />
  );
}

export function DrawerSelect({ label, value, onChange, children, required, error }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  required?: boolean;
  error?: string | null;
}) {
  return (
    <SelectCell label={label} value={value} onChange={onChange} required={required} error={error}>
      {children}
    </SelectCell>
  );
}

export function DrawerTextarea({ label, value, onChange, rows = 3, hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return <TextareaCell label={label} value={value} onChange={onChange} rows={rows} hint={hint} />;
}

/**
 * A labelled band for controls the field types don't cover — toggle groups,
 * pill rows, anything bespoke. Same surface, hover and focus behaviour as a
 * regular field cell.
 */
export { Cell as DrawerCell } from "./cells";

/** Cells on one band, split by hairlines. Two per band unless told otherwise. */
export function DrawerFieldRow({ children, cols }: { children: ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  return <Row cols={cols}>{children}</Row>;
}

export function ToggleButton({ label, active, onToggle }: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${active ? "bg-primary/15 border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-white/20"}`}
    >
      {active ? "✓ " : ""}{label}
    </button>
  );
}

/**
 * One code in a multi-select row — a CDL endorsement, and anything else that
 * is a set of independent on/off letters rather than one choice out of many.
 *
 * Picked is a fill, not a tint: a 15%-alpha wash read as "slightly different"
 * next to five other buttons rather than as the answer. Unpicked keeps a
 * surface and a border of its own so it still looks pressable — it is the
 * state most of these spend their life in, and a bare letter on a panel gives
 * no clue that it does anything.
 */
export function CodeToggle({ code, label, active, onToggle }: {
  code: string;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-pressed={active}
      aria-label={`${label} (${code})`}
      onClick={onToggle}
      className={`flex-1 py-2 rounded-md text-xs font-mono font-bold border cursor-pointer
                  transition-colors focus:outline-none focus-visible:ring-2
                  focus-visible:ring-primary/40 ${
        active
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-card border-border text-foreground/70 hover:bg-muted hover:text-foreground hover:border-muted-foreground/40"
      }`}
    >
      {code}
    </button>
  );
}

/**
 * Compact file upload field for drawers. Designed to tile in a grid — the
 * whole thumbnail is the click-target (upload or replace), and remove is a
 * small text link below. Empty state shows a dashed placeholder with an
 * icon; uploaded state shows the image. `busy` disables interaction while
 * the request is in-flight.
 */
export function DrawerFileField({
  label, hint, imageUrl, accept = "image/*", busy = false, onUpload, onDelete,
}: {
  label: string;
  hint?: string;
  imageUrl?: string | null;
  accept?: string;
  busy?: boolean;
  onUpload: (file: File) => void;
  onDelete?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function pick() {
    if (!busy) inputRef.current?.click();
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  }

  return (
    <Cell label={label} as="div" boxed={false}>
      <div className="relative" title={hint ?? label}>
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          title={imageUrl ? "Replace" : "Upload"}
          className={`w-full h-10 rounded border transition-colors flex items-center justify-center
            ${busy ? "opacity-60 cursor-wait" : "cursor-pointer"}
            ${imageUrl
              ? "border-primary/40 bg-primary/10 text-primary hover:border-primary/60"
              : "border-dashed border-border bg-muted/40 hover:border-primary/60 hover:bg-muted/60 text-muted-foreground"}`}
        >
          {imageUrl ? <Check size={14} /> : <FileUp size={14} />}
        </button>
        {imageUrl && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            title="Remove"
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow disabled:opacity-50 transition-colors"
          >
            <X size={9} strokeWidth={3} />
          </button>
        )}
      </div>
      {imageUrl && (
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[10px] font-mono font-semibold tracking-wider uppercase text-primary hover:text-primary/80 transition-colors mt-1"
        >
          View
        </a>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onChange}
        disabled={busy}
      />
    </Cell>
  );
}

/**
 * The photo that stands for a person or a company.
 *
 * Deliberately not a DrawerFileField: a document tile only has to say
 * "attached" or "not attached", while an avatar has to show the actual image
 * at the size it will be seen. Uploads land immediately rather than joining a
 * draft — a file picker has nothing meaningful to cancel back to, and making
 * the user press Save after choosing a photo only invites them to walk away
 * believing it was kept.
 */
export function ImageUploadField({
  shape, imageUrl, fallback, busy = false, hint, onUpload, onRemove,
}: {
  shape: "round" | "square";
  imageUrl: string | null;
  /** Initials shown while there is no image. */
  fallback: string;
  busy?: boolean;
  hint?: string;
  onUpload: (file: File) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const radius = shape === "round" ? "rounded-full" : "rounded-lg";

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    // Reset so picking the same file twice still fires a change.
    e.target.value = "";
  }

  return (
    <div className={`${bandCls} flex items-center gap-4`}>
      <div
        className={`relative w-16 h-16 flex-shrink-0 ${radius} border border-border bg-muted/40 overflow-hidden flex items-center justify-center`}
      >
        {imageUrl
          ? <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          : <span className="text-lg font-semibold text-muted-foreground">{fallback}</span>}
        {busy && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Btn variant="outline" onClick={() => { if (!busy) inputRef.current?.click(); }} disabled={busy}>
            <Upload size={11} className="inline mr-1.5" />
            {imageUrl ? "Replace" : "Upload"}
          </Btn>
          {imageUrl && onRemove && (
            <Btn variant="ghost" onClick={onRemove} disabled={busy}>Remove</Btn>
          )}
        </div>
        {hint && (
          <p className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/75 mt-2">{hint}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
        disabled={busy}
      />
    </div>
  );
}

/**
 * Row actions kebab (3-dot dropdown). Drop into the last cell of any table
 * where users need per-row Edit / Delete / etc. actions without a full
 * always-visible button strip. Closes on click outside or Escape.
 *
 * `variant: "danger"` on an item colors it red — use for destructive actions.
 */
export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  icon?: ElementType;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export function ActionsMenu({ items, align = "right" }: {
  items: ActionMenuItem[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: "bottom" | "top" } | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const MENU_WIDTH = 140;
    const MENU_HEIGHT_ESTIMATE = items.length * 28 + 8;
    const GAP = 4;

    function updatePosition() {
      if (!buttonRef.current) return;
      // The app applies CSS `zoom` on <html> (see ZoomControls). getBoundingClientRect
      // returns already-scaled visual coordinates, but a fixed-positioned portal inside
      // <body> is itself scaled by the same zoom — so raw rect values would be scaled twice.
      // Divide by the current zoom so the fixed coords land at the button's visual position.
      const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeightVisual = MENU_HEIGHT_ESTIMATE * zoom;
      const menuWidthVisual = MENU_WIDTH * zoom;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placement: "bottom" | "top" = spaceBelow < menuHeightVisual + GAP && rect.top > menuHeightVisual + GAP ? "top" : "bottom";
      const topVisual = placement === "bottom" ? rect.bottom + GAP : rect.top - GAP - menuHeightVisual;
      const leftVisual = align === "right" ? rect.right - menuWidthVisual : rect.left;
      setPos({ top: topVisual / zoom, left: leftVisual / zoom, placement });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, align, items.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Actions"
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <MoreVertical size={14} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: 140 }}
          className="bg-card border border-border rounded-md shadow-lg z-50 py-1"
        >
          {items.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick(); }}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
                  ${item.variant === "danger"
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-foreground hover:bg-white/[0.04]"}`}
              >
                {Icon && <Icon size={11} />}
                {item.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
