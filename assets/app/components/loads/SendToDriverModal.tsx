import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, Check, FileText, Mail, MessageSquare, Paperclip, Send, X,
} from "lucide-react";
import { Btn, Modal, Switch } from "../../lib/ui";
import { SelectCell, TextareaCell, captionCls, cellLabelCls } from "../../lib/cells";
import {
  ApiError, apiListDrivers, apiSendLoadToDriver, loadConfirmationUrl,
  type DriverItem, type LoadItem, type SendLoadResult,
} from "../../lib/api";
import { driverLabel, LOAD_STATUS_LABEL, LOAD_STATUS_COLOR } from "../../lib/loads";
import { formatDate } from "../../lib/validators";

/**
 * Send a load to its driver — the load's details by email with the generated
 * confirmation attached, and the essentials by text.
 *
 * Two panes: what is being sent on the left, what the driver will actually
 * receive on the right. The preview is not a mock-up — the document tab
 * streams the same PDF the email will carry, so what is reviewed here is what
 * arrives.
 *
 * The driver picked here applies to **this send only**; it does not reassign
 * the load. Likewise the note rides along with the message and is not written
 * back to the load's special instructions.
 */

const NOTES_MAX = 250;

export default function SendToDriverModal({ open, load, onClose, onSent }: {
  open: boolean;
  load: LoadItem;
  onClose: () => void;
  /** Fired after a send in which at least one channel succeeded. */
  onSent?: (result: SendLoadResult) => void;
}) {
  const [drivers,  setDrivers]  = useState<DriverItem[]>([]);
  const [driverId, setDriverId] = useState("");
  const [notes,    setNotes]    = useState("");
  const [cc,       setCc]       = useState("");
  const [sendSms,  setSendSms]  = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [includeConfirmation, setIncludeConfirmation] = useState(true);
  const [files,    setFiles]    = useState<File[]>([]);
  const [tab,      setTab]      = useState<"details" | "document">("details");
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState<SendLoadResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Reload every time the dialog opens. A dialog that remembers the last note
   * typed into it is a dialog that quietly sends it to the next driver.
   */
  useEffect(() => {
    if (!open) return;

    setDriverId(load.driver ? String(load.driver.id) : "");
    setNotes(load.special_instructions ?? "");
    setCc("");
    setSendSms(true);
    setSendEmail(true);
    setIncludeConfirmation(true);
    setFiles([]);
    setTab("details");
    setResult(null);
    setError(null);
  }, [open, load]);

  // The roster is only needed to let a dispatcher send to someone other than
  // the assigned driver, so it loads with the dialog rather than with the page.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    apiListDrivers()
      .then(list => { if (!cancelled) setDrivers(list); })
      .catch(() => { /* the assigned driver still works; the picker just won't list alternatives */ });

    return () => { cancelled = true; };
  }, [open]);

  /**
   * Contact details come from the roster when it has loaded, and fall back to
   * the load's own copy of the driver — which is what the preview shows in the
   * moment before the list arrives.
   */
  const driver = useMemo(() => {
    const picked = drivers.find(d => String(d.id) === driverId);
    if (picked) return { id: picked.id, first_name: picked.first_name, last_name: picked.last_name, phone: picked.phone, email: picked.email };
    if (load.driver && String(load.driver.id) === driverId) return load.driver;
    return load.driver ?? null;
  }, [drivers, driverId, load.driver]);

  const phone = driver?.phone ?? null;
  const email = driver?.email ?? null;

  // Equipment comes from the load's flattened `equipment`, not from
  // driver.assigned_truck — the trailer sits past the serializer's depth
  // limit on that relation and never arrives.
  const truckNumber  = load.equipment?.truck_number ?? null;
  const trailerLabel = [load.equipment?.trailer_number, load.equipment?.trailer_type]
    .filter(Boolean).join(" · ") || null;

  const pickup   = load.stops?.find(s => s.type === "pickup") ?? null;
  const delivery = [...(load.stops ?? [])].reverse().find(s => s.type === "delivery") ?? null;

  // A channel with nowhere to send is offered but marked — the server would
  // refuse it anyway, and saying so here beats a failure after the fact.
  const smsReady   = Boolean(phone);
  const emailReady = Boolean(email);
  const canSend    = Boolean(driver) && (sendSms || sendEmail) && !sending;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    setFiles(prev => [...prev, ...Array.from(incoming)].slice(0, 5));
  };

  async function send() {
    if (!canSend || !driver) return;

    setSending(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiSendLoadToDriver(load.id, {
        driverId: driver.id,
        notes: notes.trim(),
        sendEmail,
        sendSms,
        includeConfirmation,
        cc: cc.split(/[,;]/).map(s => s.trim()).filter(Boolean),
        files,
      });
      setResult(res);
      if (res.sent.email.ok || res.sent.sms.ok) onSent?.(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send this load. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const statusLabel = LOAD_STATUS_LABEL[load.status] ?? load.status;
  const statusColor = LOAD_STATUS_COLOR[load.status] ?? "#6b7280";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send Load to Driver"
      subtitle="Send load details and load confirmation document to the driver."
      width={1040}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>{result ? "Close" : "Cancel"}</Btn>
          <Btn variant="primary" onClick={send} disabled={!canSend}>
            {sending ? "Sending…" : "Send to Driver"}
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Left: what is being sent ─────────────────────────────────── */}
        <div className="space-y-3 min-w-0">
          <div className={captionCls}>Load Details</div>

          <dl className="text-xs space-y-1.5">
            <Row label="Load #">
              <span className="font-mono text-foreground">{load.reference_number ?? `#${load.id}`}</span>
            </Row>
            <Row label="Status">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ background: `${statusColor}1f`, color: statusColor }}
              >
                {statusLabel}
              </span>
            </Row>
            {truckNumber && <Row label="Truck">{truckNumber}</Row>}
            {trailerLabel && <Row label="Trailer">{trailerLabel}</Row>}
            {load.rate && <Row label="Rate"><span className="font-mono">${Number(load.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></Row>}
            {load.total_miles != null && (
              <Row label="Distance">
                <span className="font-mono">{Math.round(load.total_miles).toLocaleString()} mi</span>
                {load.miles_source === "estimated" && <span className="text-muted-foreground"> est.</span>}
              </Row>
            )}
          </dl>

          <SelectCell
            label="Driver"
            value={driverId}
            onChange={setDriverId}
            required
            hint="Sends to this driver only — it does not reassign the load."
          >
            <option value="">Select a driver</option>
            {drivers.length === 0 && load.driver && (
              <option value={String(load.driver.id)}>{driverLabel(load.driver)}</option>
            )}
            {drivers.map(d => (
              <option key={d.id} value={String(d.id)}>
                {driverLabel(d)}{d.phone ? ` (${d.phone})` : ""}
              </option>
            ))}
          </SelectCell>

          <div className="grid grid-cols-2 gap-3">
            <StopBlock kind="Pickup" color="#2563eb"
              city={pickup?.facility_name ?? load.origin}
              date={pickup?.date ?? load.pickup_date}
              window={pickup?.window_start}
              address={pickup?.address}
            />
            <StopBlock kind="Delivery" color="#16a34a"
              city={delivery?.facility_name ?? load.destination}
              date={delivery?.date ?? load.delivery_date}
              window={delivery?.window_start}
              address={delivery?.address}
            />
          </div>

          <TextareaCell
            label="Notes to Driver"
            value={notes}
            onChange={v => setNotes(v.slice(0, NOTES_MAX))}
            rows={3}
            placeholder="Please call dispatch 30 minutes before pickup."
            hint={`Optional. ${notes.length}/${NOTES_MAX}`}
          />

          <div>
            <div className={captionCls}>Document to Send</div>
            <div className="mt-2 space-y-2">
              {includeConfirmation ? (
                <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5">
                  <span className="grid place-items-center w-8 h-8 rounded bg-red-500/10 text-red-400 flex-shrink-0">
                    <FileText size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-foreground truncate">
                      Load Confirmation - {load.reference_number ?? load.id}.pdf
                    </span>
                    <span className="block text-[10px] text-muted-foreground">Generated when you send</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIncludeConfirmation(false)}
                    aria-label="Remove load confirmation"
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer flex-shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIncludeConfirmation(true)}
                  className="w-full rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 cursor-pointer transition-colors"
                >
                  + Re-attach load confirmation
                </button>
              )}

              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2">
                  <Paperclip size={13} className="text-muted-foreground flex-shrink-0" />
                  <span className="min-w-0 flex-1 text-xs text-foreground truncate">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove ${f.name}`}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer flex-shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}

              {files.length < 5 && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => { addFiles(e.target.files); e.target.value = ""; }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="w-full rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-primary hover:bg-primary/5 cursor-pointer transition-colors"
                  >
                    + Add Additional Document (Optional)
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <div className={captionCls}>Send Via</div>
            <div className="mt-2 space-y-2">
              <ChannelRow
                icon={MessageSquare}
                title="SMS"
                detail={phone ?? "No mobile number on file"}
                ready={smsReady}
                checked={sendSms}
                onChange={setSendSms}
              />
              <ChannelRow
                icon={Mail}
                title="Email"
                detail={email ?? "No email address on file"}
                ready={emailReady}
                checked={sendEmail}
                onChange={setSendEmail}
              />
            </div>
          </div>

          {sendEmail && (
            <label className="block">
              <span className={cellLabelCls}>CC (Optional)</span>
              <input
                value={cc}
                onChange={e => setCc(e.target.value)}
                placeholder="Add email addresses (comma separated)"
                className="mt-1.5 w-full rounded-md border border-border bg-input-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:border-muted-foreground/35"
              />
            </label>
          )}
        </div>

        {/* ── Right: what the driver receives ──────────────────────────── */}
        <div className="min-w-0">
          <div className={captionCls}>Preview for Driver</div>

          <div className="mt-2 flex gap-4 border-b border-border">
            {([["details", "Load Details"], ["document", "Document Preview"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`pb-2 text-xs transition-colors cursor-pointer border-b-2 -mb-px ${
                  tab === key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "details" ? (
            <div className="mt-3 rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Load # {load.reference_number ?? load.id}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: `${statusColor}1f`, color: statusColor }}
                >
                  {statusLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <StopBlock kind="Pickup" color="#2563eb"
                  city={pickup?.facility_name ?? load.origin}
                  date={pickup?.date ?? load.pickup_date}
                  window={pickup?.window_start}
                  address={pickup?.address}
                />
                <StopBlock kind="Delivery" color="#16a34a"
                  city={delivery?.facility_name ?? load.destination}
                  date={delivery?.date ?? load.delivery_date}
                  window={delivery?.window_start}
                  address={delivery?.address}
                />
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-border text-xs">
                {truckNumber && <Field label="Truck" value={truckNumber} />}
                {trailerLabel && <Field label="Trailer" value={trailerLabel} />}
                {driver && <Field label="Driver" value={driverLabel(driver)} />}
                {phone && <Field label="Phone" value={phone} />}
              </div>

              {notes.trim() && (
                <div className="pt-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Special Instructions</div>
                  <div className="mt-1 rounded-md bg-muted/40 border border-border px-3 py-2 text-xs text-foreground whitespace-pre-wrap">
                    {notes.trim()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-border overflow-hidden bg-muted/20">
              {includeConfirmation ? (
                <object
                  data={loadConfirmationUrl(load.id)}
                  type="application/pdf"
                  className="w-full"
                  style={{ height: 460 }}
                >
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Your browser can’t display the PDF inline.{" "}
                    <a href={loadConfirmationUrl(load.id)} target="_blank" rel="noreferrer" className="text-primary">
                      Open it in a new tab
                    </a>
                    .
                  </div>
                </object>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  The load confirmation won’t be attached.
                </div>
              )}
            </div>
          )}

          {/* Outcome is per channel: one can land while the other does not. */}
          {result && (
            <div className="mt-3 space-y-2">
              {sendEmail && <Outcome label="Email" r={result.sent.email} />}
              {sendSms && <Outcome label="SMS" r={result.sent.sms} />}
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!result && !error && (
            <div className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2.5 text-[11px] text-muted-foreground">
              The driver receives the load details, the confirmation document, any
              documents you attach, and your dispatch contact details.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-20 flex-shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}

function StopBlock({ kind, color, city, date, window: win, address }: {
  kind: string;
  color: string;
  city?: string | null;
  date?: string | null;
  window?: string | null;
  address?: string | null;
}) {
  return (
    <div className="pl-2.5 border-l-2 min-w-0" style={{ borderColor: color }}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{kind}</div>
      <div className="text-xs font-medium text-foreground truncate">{city || "—"}</div>
      {date && (
        <div className="text-[11px] text-muted-foreground">
          {formatDate(date)}{win ? ` ${win}` : ""}
        </div>
      )}
      {address && <div className="text-[11px] text-muted-foreground/80 truncate">{address}</div>}
    </div>
  );
}

function ChannelRow({ icon: Icon, title, detail, ready, checked, onChange }: {
  icon: React.ElementType;
  title: string;
  detail: string;
  ready: boolean;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
      <Icon size={14} className="text-muted-foreground flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-foreground">{title}</div>
        <div className={`text-[11px] truncate ${ready ? "text-muted-foreground" : "text-amber-500"}`}>
          {detail}
        </div>
      </div>
      <Switch label={`Send by ${title}`} checked={checked} onChange={onChange} />
    </div>
  );
}

function Outcome({ label, r }: { label: string; r: { ok: boolean; message: string } }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs ${
        r.ok
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
          : "border-amber-500/30 bg-amber-500/5 text-amber-500"
      }`}
    >
      {r.ok ? <Check size={13} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />}
      <span><span className="font-medium">{label}:</span> {r.message}</span>
    </div>
  );
}
