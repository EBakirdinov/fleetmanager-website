import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ElementType, ReactNode } from "react";
import { Check, FileUp, MoreVertical, Save, Trash2, X } from "lucide-react";

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

export function SlideDrawer({ open, onClose, title, badge, children, onSave, saving, onDelete, deleting }: {
  open: boolean;
  onClose: () => void;
  title: string;
  badge?: string;
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
        className={`fixed top-0 right-0 h-full w-[480px] bg-card border-l border-border z-50 flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.35)" : "none" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <p className="text-base font-semibold text-foreground">{title}</p>
            {badge && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary tracking-wider">
                {badge}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-4 bg-primary rounded-full" />
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function DrawerField({ label, value, type = "text", hint, readOnly, mono, maxLength, required, onChange, onBlur, error }: {
  label: string;
  value: string;
  type?: string;
  hint?: string;
  readOnly?: boolean;
  mono?: boolean;
  maxLength?: number;
  required?: boolean;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
}) {
  const borderClass = error
    ? "border-red-500/60 focus:ring-red-500/50"
    : "border-border focus:ring-ring";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        maxLength={maxLength}
        onChange={e => onChange?.(e.target.value)}
        onBlur={onBlur}
        className={`bg-input-background text-foreground border ${borderClass} rounded px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors ${mono ? "font-mono" : ""} ${readOnly ? "opacity-50 cursor-not-allowed select-all" : ""}`}
      />
      {error
        ? <p className="text-xs font-mono text-red-400">{error}</p>
        : hint && <p className="text-xs font-mono text-muted-foreground">{hint}</p>}
    </div>
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
  const borderClass = error
    ? "border-red-500/60 focus:ring-red-500/50"
    : "border-border focus:ring-ring";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`bg-input-background text-foreground border ${borderClass} rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-colors appearance-none`}
      >
        {children}
      </select>
      {error && <p className="text-xs font-mono text-red-400">{error}</p>}
    </div>
  );
}

export function DrawerTextarea({ label, value, onChange, rows = 3, hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="bg-input-background text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-colors resize-none"
      />
      {hint && <p className="text-xs font-mono text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DrawerFieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
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
      onClick={onToggle}
      className={`flex-1 py-2 rounded text-xs font-mono font-bold border transition-colors ${active ? "bg-primary/15 border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-white/20 hover:text-foreground"}`}
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
    <div className="flex flex-col gap-1" title={hint ?? label}>
      <label className="text-xs font-mono text-muted-foreground tracking-wider uppercase truncate">
        {label}
      </label>
      <div className="relative">
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
          className="text-center text-[10px] font-mono font-semibold tracking-wider uppercase text-primary hover:text-primary/80 transition-colors"
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
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
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Actions"
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1 min-w-[140px] bg-card border border-border rounded-md shadow-lg z-30 py-1`}
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
        </div>
      )}
    </div>
  );
}
