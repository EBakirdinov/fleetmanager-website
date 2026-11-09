import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, Clock, TrendingUp, Truck as TruckIcon, CalendarCheck,
  Mail, MessageSquare, Send, Search, UserMinus, ExternalLink,
} from "lucide-react";
import { Link } from "react-router";
import {
  KpiCard, StatusPill, Btn, ActionsMenu, Modal,
  DrawerField, DrawerSelect, DrawerTextarea, FilterSelect,
} from "../lib/ui";
import {
  apiRetentionSummary, apiRetentionDrivers, apiRetentionTerminals,
  apiRetentionReviews, apiListCommunications, apiSendCommunication,
  apiRetentionAudience, apiGetCommunication, apiUpdateDriver, ApiError,
  type RetentionSummary, type RetentionDriverRow, type RetentionReview,
  type CommunicationItem, type CommunicationChannel, type CommunicationAudience,
  type AudienceReach,
} from "../lib/api";
import { useRefData } from "../lib/data";
import { formatDate } from "../lib/validators";

type Tab = "current" | "past";

const PAGE_SIZE = 10;

/**
 * Employee Retention.
 *
 * Two things make this page different from the other list pages, and both
 * come from the same place: on a real install almost nothing is filled in.
 * Drivers arrive through the ELD roster sync, which carries a name, a licence
 * and not much else — no hire date, no home terminal, usually no email or
 * mobile number.
 *
 * So: **a missing metric renders as an em-dash with a pointer, never as a
 * zero.** "0.0 yrs average tenure" and "0% retention" are two lies that look
 * like facts, and a fleet owner seeing them would reasonably conclude the
 * product was broken rather than that a field was empty. The API returns null
 * for exactly this reason; the job here is not to paper over it with `?? 0`.
 *
 * And the Send panel says what it can actually reach *before* anyone commits
 * — "12 recipients · 1 can be emailed" — because discovering that in the
 * delivery log afterwards is too late.
 */
export default function EmployeeRetention() {
  const { data: ref } = useRefData();

  const [tab, setTab] = useState<Tab>("current");

  const [summary,   setSummary]   = useState<RetentionSummary | null>(null);
  const [rows,      setRows]      = useState<RetentionDriverRow[]>([]);
  const [total,     setTotal]     = useState(0);
  const [terminals, setTerminals] = useState<string[]>([]);
  const [reviews,   setReviews]   = useState<RetentionReview[]>([]);
  const [log,       setLog]       = useState<CommunicationItem[]>([]);

  const [status,   setStatus]   = useState("");
  const [terminal, setTerminal] = useState("");
  const [reason,   setReason]   = useState("");
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ ok: boolean; msg: string } | null>(null);

  const [separating, setSeparating] = useState<RetentionDriverRow | null>(null);
  const [showReviews, setShowReviews] = useState(false);
  const [detail, setDetail] = useState<CommunicationItem | null>(null);

  // Bumped on every context reload. The Send panel's recipient count is the
  // number next to a button that spends money at SendGrid and Twilio, so it
  // must not go on claiming 11 recipients after one of them has left.
  const [rosterVersion, setRosterVersion] = useState(0);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // The headline numbers and the message log are company-wide, so they are
  // loaded once rather than refetched every time a filter moves.
  const loadContext = useCallback(async () => {
    try {
      const [s, t, r, c] = await Promise.all([
        apiRetentionSummary(),
        apiRetentionTerminals(),
        apiRetentionReviews(),
        apiListCommunications(8),
      ]);
      setSummary(s);
      setTerminals(t);
      setReviews(r);
      setLog(c);
      setRosterVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load retention data.");
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRetentionDrivers({
        cohort: tab,
        status: tab === "current" ? status || undefined : undefined,
        terminal: terminal || undefined,
        separation_reason: tab === "past" ? reason || undefined : undefined,
        search: search || undefined,
        page,
        count: PAGE_SIZE,
      });
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load drivers.");
    } finally {
      setLoading(false);
    }
  }, [tab, status, terminal, reason, search, page]);

  useEffect(() => { loadContext(); }, [loadContext]);
  useEffect(() => { loadRows(); }, [loadRows]);

  // Any filter change puts you back on page one; staying on page 4 of a
  // result set that now has one page shows an empty table.
  useEffect(() => { setPage(1); }, [tab, status, terminal, reason, search]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const gaps  = summary?.data_gaps;

  const hireDateHint = gaps && gaps.missing_hire_date > 0
    ? `${gaps.missing_hire_date} of ${gaps.current_drivers} have no hire date`
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <KpiCard
          label="Current Drivers"
          value={summary ? summary.current_drivers : "—"}
          sub={summary && summary.hired_this_month > 0
            ? `+${summary.hired_this_month} hired this month`
            : "Active drivers"}
          icon={Users} accent="#3b82f6"
          active={tab === "current"} onClick={() => setTab("current")}
        />
        <KpiCard
          label="Avg. Tenure"
          value={summary?.avg_tenure_years != null ? `${summary.avg_tenure_years} yrs` : "—"}
          sub={summary?.avg_tenure_years == null
            ? "Add hire dates on Drivers"
            : hireDateHint ?? "Average tenure"}
          icon={Clock} accent="#8b5cf6"
        />
        <KpiCard
          label="Retention Rate"
          value={summary?.retention_rate_12m != null ? `${summary.retention_rate_12m}%` : "—"}
          sub={summary?.retention_rate_12m == null
            ? "Needs 12 months of history"
            : "12-month retention"}
          icon={TrendingUp} accent="#10b981"
        />
        <KpiCard
          label="On the Road"
          value={summary ? summary.on_the_road : "—"}
          sub="On an active load now"
          icon={TruckIcon} accent="#f59e0b"
        />
        <KpiCard
          label="Upcoming Reviews"
          value={summary?.upcoming_reviews != null ? summary.upcoming_reviews : "—"}
          sub={summary?.upcoming_reviews == null
            ? "Add hire dates on Drivers"
            : `In next ${summary.review_window_days} days`}
          icon={CalendarCheck} accent="#ec4899"
          onClick={summary?.upcoming_reviews ? () => setShowReviews(true) : undefined}
        />
      </div>

      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono ${
          toast.ok
            ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
            : "bg-red-500/10 border border-red-500/25 text-red-400"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex items-center gap-1 border-b border-border">
            {([
              ["current", `Current Drivers${summary ? ` (${summary.current_drivers})` : ""}`],
              ["past",    `Past Drivers${summary ? ` (${summary.past_drivers})` : ""}`],
            ] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-2 text-xs font-mono transition-colors border-b-2 -mb-px ${
                  tab === key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border rounded-md px-4 py-3 flex flex-wrap items-end gap-3">
            {tab === "current" ? (
              <FilterSelect
                label="Status" value={status} onChange={setStatus}
                options={[
                  { value: "active",    label: "Active" },
                  { value: "off_duty",  label: "Off duty" },
                  { value: "on_leave",  label: "On leave" },
                  { value: "suspended", label: "Suspended" },
                ]}
                width={150}
              />
            ) : (
              <FilterSelect
                label="Reasons" value={reason} onChange={setReason}
                options={(ref?.driverSeparationReasons ?? []).map((r) => ({ value: r, label: reasonLabel(r) }))}
                width={170}
              />
            )}

            {/* `home_terminal` is free text with no catalog behind it, so the
                options are whatever has actually been typed. No terminals
                entered yet means no filter worth showing. */}
            {terminals.length > 0 && (
              <FilterSelect
                label="Locations" value={terminal} onChange={setTerminal}
                options={terminals.map((t) => ({ value: t, label: t }))}
                width={170}
              />
            )}

            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className="text-[11px] font-mono text-muted-foreground">Search</span>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, email, phone or driver number"
                  className="w-full rounded border border-border bg-input-background pl-7 pr-2 py-1.5 text-xs font-mono text-foreground
                    focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </label>
          </div>

          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {tab === "current" ? "Current drivers" : "Past drivers"}
                </span>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{total}</span>
              </div>
              {hireDateHint && tab === "current" && (
                <Link to="/drivers" className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  {hireDateHint}<ExternalLink size={10} />
                </Link>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-xs font-mono text-muted-foreground">Loading…</div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-xs font-mono text-red-400">{error}</p>
                <Btn variant="outline" onClick={loadRows}>Retry</Btn>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-xs font-mono text-muted-foreground">
                {tab === "past" ? "Nobody has left yet." : "No drivers match those filters."}
              </div>
            ) : (
              <RosterTable
                rows={rows}
                tab={tab}
                onSeparate={(row) => setSeparating(row)}
              />
            )}

            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs font-mono text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <Btn variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn>
                  <span className="text-xs font-mono text-muted-foreground">{page} / {pages}</span>
                  <Btn variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
                </div>
              </div>
            )}
          </div>

          <RecentCommunications rows={log} onOpen={setDetail} />
        </div>

        <SendPanel
          gaps={summary?.data_gaps ?? null}
          rosterVersion={rosterVersion}
          onSent={async (msg) => { showToast(true, msg); await loadContext(); }}
          onError={(msg) => showToast(false, msg)}
        />
      </div>

      {separating && (
        <SeparateModal
          driver={separating}
          reasons={ref?.driverSeparationReasons ?? []}
          onClose={() => setSeparating(null)}
          onSaved={async () => {
            setSeparating(null);
            await Promise.all([loadRows(), loadContext()]);
            showToast(true, "Driver moved to past drivers.");
          }}
          onError={(msg) => showToast(false, msg)}
        />
      )}

      {showReviews && (
        <ReviewsModal rows={reviews} onClose={() => setShowReviews(false)} />
      )}

      {detail && (
        <CommunicationModal id={detail.id} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

/* ── Tables ─────────────────────────────────────────────────────────────── */

function RosterTable({ rows, tab, onSeparate }: {
  rows: RetentionDriverRow[];
  tab: Tab;
  onSeparate: (row: RetentionDriverRow) => void;
}) {
  const headers = tab === "current"
    ? ["Driver", "Truck", "Hire date", "Status", "Tenure", "Location", "On the road", ""]
    : ["Driver", "Last active", "Reason", "Tenure", "Location", "Previous truck", ""];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} className="text-left px-3 py-2.5 text-xs font-mono text-muted-foreground tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
              <td className="px-3 py-2.5 whitespace-nowrap">
                <Link to="/drivers" className="text-xs font-mono text-primary font-semibold hover:underline">{r.name || `#${r.id}`}</Link>
                {r.driver_number && <div className="text-[11px] text-muted-foreground mt-0.5">#{r.driver_number}</div>}
              </td>

              {tab === "current" ? (
                <>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {r.truck?.number ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {r.hire_date ? formatDate(r.hire_date) : "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusPill label={statusLabel(r.status)} color={statusColor(r.status)} />
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">{tenureLabel(r.tenure_days)}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{locationOf(r)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.on_the_road ? (
                      <StatusPill
                        label={r.active_load_count > 1 ? `${r.active_load_count} loads` : "On a load"}
                        color="#f59e0b"
                      />
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground">At home</span>
                    )}
                  </td>
                </>
              ) : (
                <>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {r.last_active ? formatDate(r.last_active) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">
                    {r.separation_reason ? reasonLabel(r.separation_reason) : "Not recorded"}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">{tenureLabel(r.tenure_days)}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{locationOf(r)}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{r.truck?.number ?? "—"}</td>
                </>
              )}

              <td className="px-3 py-2.5 whitespace-nowrap text-right">
                <div className="inline-flex items-center gap-1">
                  {r.email && <Mail size={12} className="text-muted-foreground" aria-label="Has an email address" />}
                  {r.phone && <MessageSquare size={12} className="text-muted-foreground" aria-label="Has a mobile number" />}
                  {tab === "current" && (
                    <ActionsMenu
                      items={[
                        { label: "Mark as past driver", icon: UserMinus, onClick: () => onSeparate(r) },
                      ]}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentCommunications({ rows, onOpen }: {
  rows: CommunicationItem[];
  onOpen: (row: CommunicationItem) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Recent communications</span>
        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs font-mono text-muted-foreground">
          Nothing sent yet.
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {rows.map((c) => {
            const failed = c.email_failed + c.sms_failed;
            const sent   = c.email_sent + c.sms_sent;
            return (
              <button
                key={c.id}
                onClick={() => onOpen(c)}
                className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-start gap-3"
              >
                <div className="mt-0.5 text-muted-foreground">
                  {c.channel === "sms" ? <MessageSquare size={14} /> : <Mail size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-foreground truncate">
                    {c.subject || firstLine(c.body)}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    {channelLabel(c.channel)} · {audienceLabel(c.audience)} · {c.recipient_count} recipient{c.recipient_count === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {c.sent_at ? formatDate(c.sent_at) : "Not sent"}
                  </div>
                  <div className="text-[11px] font-mono mt-0.5">
                    <span className="text-emerald-400">{sent} sent</span>
                    {failed > 0 && <span className="text-red-400"> · {failed} failed</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Send panel ─────────────────────────────────────────────────────────── */

function SendPanel({ gaps, rosterVersion, onSent, onError }: {
  gaps: RetentionSummary["data_gaps"] | null;
  /** Changes whenever the roster may have — see the note at its declaration. */
  rosterVersion: number;
  onSent: (msg: string) => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [audience, setAudience] = useState<CommunicationAudience>("current");
  const [channel,  setChannel]  = useState<CommunicationChannel>("email");
  const [subject,  setSubject]  = useState("");
  const [body,     setBody]     = useState("");
  const [reach,    setReach]    = useState<AudienceReach | null>(null);
  const [sending,  setSending]  = useState(false);

  // The key is generated per composed message, not per click: that is what
  // makes a double-clicked Send bill once. It changes only after a send
  // succeeds, so a retry after a network error reuses it.
  const [key, setKey] = useState(() => newKey());

  useEffect(() => {
    let cancelled = false;
    apiRetentionAudience(audience)
      .then((r) => { if (!cancelled) setReach(r); })
      .catch(() => { if (!cancelled) setReach(null); });
    return () => { cancelled = true; };
  }, [audience, rosterVersion]);

  const warning = useMemo(() => {
    if (!reach) return null;
    if (reach.total === 0) return "That audience has nobody in it.";
    if (channel === "email" && reach.email === 0) return `None of the ${reach.total} have an email address on file.`;
    if (channel === "sms"   && reach.sms   === 0) return `None of the ${reach.total} have a mobile number on file.`;
    if (channel === "both" && reach.email === 0 && reach.sms === 0) return `None of the ${reach.total} have contact details on file.`;
    return null;
  }, [reach, channel]);

  async function send() {
    if (body.trim() === "") { onError("Write a message first."); return; }

    setSending(true);
    try {
      const result = await apiSendCommunication({
        channel,
        audience,
        subject: channel === "sms" ? null : subject || null,
        body,
        idempotency_key: key,
      });

      const sent = result.email_sent + result.sms_sent;
      const failed = result.email_failed + result.sms_failed;
      await onSent(
        failed > 0
          ? `Sent to ${sent} of ${result.recipient_count}. ${failed} failed — open the log to see why.`
          : `Sent to ${sent} of ${result.recipient_count} drivers.`,
      );

      setSubject("");
      setBody("");
      setKey(newKey());
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-md flex flex-col gap-4 p-4 xl:sticky xl:top-4">
      <div>
        <div className="text-sm font-medium text-foreground">Send a message</div>
        <p className="text-[11px] font-mono text-muted-foreground mt-1">
          Goes out from your own SendGrid and Twilio, under Integrations.
        </p>
      </div>

      <DrawerSelect
        label="Audience"
        value={audience}
        onChange={(v) => setAudience(v as CommunicationAudience)}
      >
        <option value="current">Current drivers</option>
        <option value="past">Past drivers</option>
        <option value="all">All drivers</option>
      </DrawerSelect>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-mono text-muted-foreground">Channel</span>
        <div className="grid grid-cols-3 gap-1">
          {([
            ["email", "Email"],
            ["sms",   "Text"],
            ["both",  "Both"],
          ] as [CommunicationChannel, string][]).map(([key2, label]) => (
            <button
              key={key2}
              onClick={() => setChannel(key2)}
              className={`text-xs font-mono rounded px-2 py-1.5 border transition-colors ${
                channel === key2
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-white/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {reach && (
        <div className="text-[11px] font-mono text-muted-foreground border border-border rounded px-3 py-2">
          <div className="text-foreground">{reach.total} recipient{reach.total === 1 ? "" : "s"}</div>
          <div className="mt-1">
            {reach.email} can be emailed · {reach.sms} can be texted
          </div>
        </div>
      )}

      {warning && (
        <div className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded px-3 py-2">
          {warning}
        </div>
      )}

      {channel !== "sms" && (
        <DrawerField label="Subject" value={subject} onChange={setSubject} maxLength={255} />
      )}

      <DrawerTextarea
        label="Message"
        value={body}
        onChange={setBody}
        rows={7}
        hint="Use {{first_name}}, {{last_name}} or {{company}} to personalise."
      />

      {channel !== "email" && body.length > 320 && (
        <div className="text-[11px] font-mono text-amber-400">
          Texts are cut at 320 characters — yours is {body.length}.
        </div>
      )}

      <Btn variant="primary" onClick={send} disabled={sending || body.trim() === ""}>
        <Send size={11} className="inline mr-1" />
        {sending ? "Sending…" : "Send now"}
      </Btn>

      {gaps && (gaps.missing_email > 0 || gaps.missing_phone > 0) && (
        <p className="text-[11px] font-mono text-muted-foreground">
          {gaps.missing_email} of {gaps.total_drivers} drivers have no email and {gaps.missing_phone} have no mobile
          number. Add them on the{" "}
          <Link to="/drivers" className="text-primary hover:underline">Drivers</Link> page.
        </p>
      )}
    </div>
  );
}

/* ── Modals ─────────────────────────────────────────────────────────────── */

function SeparateModal({ driver, reasons, onClose, onSaved, onError }: {
  driver: RetentionDriverRow;
  reasons: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [date,   setDate]   = useState(today());
  const [reason, setReason] = useState(reasons[0] ?? "other");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      // Goes through the ordinary driver PATCH: a separation is a status
      // change plus two fields, not a resource of its own.
      await apiUpdateDriver(driver.id, {
        status: "terminated",
        terminatedAt: date || null,
        separationReason: reason,
      });
      await onSaved();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not save.");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Mark as past driver"
      subtitle={driver.name}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Confirm"}</Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <DrawerField label="Last day" value={date} type="date" onChange={setDate} />
        <DrawerSelect label="Reason" value={reason} onChange={setReason}>
          {reasons.map((r) => <option key={r} value={r}>{reasonLabel(r)}</option>)}
        </DrawerSelect>
        <p className="text-[11px] font-mono text-muted-foreground">
          They keep their loads, documents and history, and can be moved back to active at any time.
        </p>
      </div>
    </Modal>
  );
}

function ReviewsModal({ rows, onClose }: { rows: RetentionReview[]; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Upcoming reviews" subtitle="Tenure milestones in the next 30 days" width={680}>
      {rows.length === 0 ? (
        <p className="text-xs font-mono text-muted-foreground py-6 text-center">Nothing due.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Driver", "Milestone", "Due", "In", "Location"].map((h) => (
                <th key={h} className="text-left py-2 text-xs font-mono text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.driver_id}-${r.milestone_key}`} className="border-b border-border/50">
                <td className="py-2 text-xs font-mono text-foreground">{r.name}</td>
                <td className="py-2 text-xs font-mono text-foreground">{r.milestone}</td>
                <td className="py-2 text-xs font-mono text-muted-foreground">{formatDate(r.due_on)}</td>
                <td className="py-2 text-xs font-mono text-muted-foreground">
                  {r.days_until === 0 ? "Today" : `${r.days_until} day${r.days_until === 1 ? "" : "s"}`}
                </td>
                <td className="py-2 text-xs font-mono text-muted-foreground">{r.home_terminal ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function CommunicationModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [item, setItem] = useState<CommunicationItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGetCommunication(id)
      .then((c) => { if (!cancelled) setItem(c); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load."); });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <Modal open onClose={onClose} title={item?.subject || "Message"} subtitle={item ? `${channelLabel(item.channel)} · ${audienceLabel(item.audience)}` : undefined} width={720}>
      {error ? (
        <p className="text-xs font-mono text-red-400 py-6 text-center">{error}</p>
      ) : !item ? (
        <p className="text-xs font-mono text-muted-foreground py-6 text-center">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap bg-muted/40 rounded p-3">{item.body}</pre>

          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-border">
                  {["Driver", "Email", "Text", "Detail"].map((h) => (
                    <th key={h} className="text-left py-2 text-xs font-mono text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(item.recipients ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 text-xs font-mono text-foreground whitespace-nowrap">{r.driver_name}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {r.email_state ? <StatusPill label={r.email_state} color={stateColor(r.email_state)} /> : <span className="text-xs font-mono text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {r.sms_state ? <StatusPill label={r.sms_state} color={stateColor(r.sms_state)} /> : <span className="text-xs font-mono text-muted-foreground">—</span>}
                    </td>
                    {/* Both reasons, labelled. The two channels fail
                        independently and for different reasons — showing only
                        the first one is how you end up unable to explain why
                        none of your texts went out. */}
                    <td className="py-2 text-[11px] font-mono text-muted-foreground">
                      {r.email_error && <div>Email: {r.email_error}</div>}
                      {r.sms_error && <div>Text: {r.sms_error}</div>}
                      {!r.email_error && !r.sms_error && "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── Labels ─────────────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  active: "Active", off_duty: "Off duty", on_leave: "On leave",
  suspended: "Suspended", terminated: "Past driver",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#10b981", off_duty: "#6b7280", on_leave: "#3b82f6",
  suspended: "#ef4444", terminated: "#6b7280",
};

const REASON_LABELS: Record<string, string> = {
  better_pay: "Better pay", home_time: "Home time", relocation: "Relocation",
  equipment: "Equipment", personal: "Personal", pay_benefits: "Pay / benefits",
  for_cause: "For cause", other: "Other",
};

function statusLabel(s: string): string { return STATUS_LABELS[s] ?? s; }
function statusColor(s: string): string { return STATUS_COLORS[s] ?? "#6b7280"; }
function reasonLabel(r: string): string { return REASON_LABELS[r] ?? r; }

function channelLabel(c: string): string {
  return c === "both" ? "Email + text" : c === "sms" ? "Text" : "Email";
}

function audienceLabel(a: string): string {
  return a === "past" ? "Past drivers" : a === "all" ? "All drivers"
    : a === "custom" ? "Selected drivers" : "Current drivers";
}

function stateColor(s: string): string {
  return s === "sent" ? "#10b981" : s === "failed" ? "#ef4444" : "#6b7280";
}

/**
 * Tenure as a person would say it. Null stays an em-dash — see the note at
 * the top of the file.
 */
function tenureLabel(days: number | null): string {
  if (days === null) return "—";
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365.25).toFixed(1)} yrs`;
}

function locationOf(r: RetentionDriverRow): string {
  if (r.home_terminal) return r.home_terminal;
  if (r.city && r.state) return `${r.city}, ${r.state}`;
  return r.city || r.state || "—";
}

function firstLine(body: string): string {
  const line = body.split("\n").find((l) => l.trim() !== "") ?? "";
  return line.length > 70 ? `${line.slice(0, 69)}…` : line;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newKey(): string {
  return `send-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
