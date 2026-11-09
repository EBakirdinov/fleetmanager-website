import { useState, useEffect } from "react";
import { RefreshCw, Check, X } from "lucide-react";
import { useRefData, type IntegrationDef, type IntegrationField } from "../lib/data";
import { useIntegrationStatus } from "../lib/useIntegrationStatus";
import { SlideDrawer, DrawerSection, DrawerField, DrawerCell, Btn, Switch } from "../lib/ui";
import {
  apiGetIntegrationStatus, apiSaveIntegration, apiDeleteIntegration,
  apiGetIntegrationConfig, apiTestIntegration, apiGetIntegrationLinked,
  ApiError, type IntegrationProbeResult, type IntegrationLinkedCounts,
} from "../lib/api";
import { IntegrationIcon } from "../lib/integrationIcons";

interface IntegrationView extends IntegrationDef {
  connected: boolean;
  /**
   * Name of the connected integration that rules this one out, for the
   * exclusive types where a company gets exactly one provider. Undefined
   * when nothing is in the way.
   */
  blockedBy?: string;
}

/** Credentials are typed in; everything else is a setting with a state. */
type FieldValue = string | boolean;

function isSetting(f: IntegrationField): boolean {
  return f.type === "checkbox";
}

/**
 * Name a probe result after the field it corresponds to, so the verdict reads
 * in the same words as the toggle above it. Falls back to the raw key for a
 * capability the catalog has no field for.
 */
function labelFor(integration: IntegrationView, key: string): string {
  return integration.fields.find(f => f.key === key)?.label ?? key;
}

/** "12 trucks and 1 driver" — the repo has no i18n layer to defer the plural to. */
function describeLinked(counts: IntegrationLinkedCounts): string {
  const part = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return `${part(counts.trucks, "truck")} and ${part(counts.drivers, "driver")}`;
}

function IntegrationCard({ integration, onClick }: {
  integration: IntegrationView;
  onClick: () => void;
}) {
  // A blocked card is inert rather than hidden: the provider is still part of
  // the catalog, and saying why it can't be connected is more use than
  // leaving the dispatcher to wonder where it went.
  const blocked = !!integration.blockedBy;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={blocked}
      className={`bg-card border border-border rounded-xl p-5 text-left transition-colors flex flex-col gap-3 ${blocked ? "opacity-60 cursor-not-allowed" : "hover:border-white/20"}`}
    >
      <div className="flex items-center gap-3">
        <IntegrationIcon slug={integration.slug} name={integration.name} iconUrl={integration.iconUrl} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{integration.name}</p>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">{integration.type}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: integration.connected ? "#10b981" : "#4b5563" }}
        />
        <span className={`text-xs font-mono ${integration.connected ? "text-emerald-400" : "text-muted-foreground"}`}>
          {integration.connected ? "Connected" : blocked ? "Unavailable" : "Not connected"}
        </span>
      </div>
      {blocked && (
        <p className="text-[11px] font-mono text-muted-foreground/70 leading-relaxed">
          {integration.blockedBy} is connected. Only one {integration.type.toUpperCase()} at a time —
          disconnect it to switch.
        </p>
      )}
      <div className="flex justify-end pt-1 mt-auto">
        {integration.connected ? (
          <Btn variant="primary">Manage</Btn>
        ) : (
          <Btn variant="outline" disabled={blocked}>Connect</Btn>
        )}
      </div>
    </button>
  );
}

export default function Integrations() {
  const { data: refData, loading: refLoading } = useRefData();

  // This page owns its own copy of the status map (it needs the loading and
  // error states), but useIntegrationStatus caches the same map at module
  // scope for everyone else — ImportDropdown included. Refreshing it after a
  // save or a disconnect is what stops the Trucks page from offering an ELD
  // that was just disconnected, which then 400s as "not connected".
  const { refresh: refreshStatusCache } = useIntegrationStatus();

  const [status, setStatus]   = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ ok: boolean; msg: string } | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected,   setSelected]   = useState<IntegrationView | null>(null);
  const [form,       setForm]       = useState<Record<string, FieldValue>>({});
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const [testing, setTesting] = useState(false);
  const [probe,   setProbe]   = useState<Record<string, IntegrationProbeResult> | null>(null);

  // What the open integration owns locally, and whether disconnecting should
  // hand it back. Null until the counts arrive — the Danger zone waits rather
  // than claiming zero.
  const [linked, setLinked] = useState<IntegrationLinkedCounts | null>(null);
  const [unlink, setUnlink] = useState(true);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      setStatus(await apiGetIntegrationStatus());
      refreshStatusCache();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  // For an exclusive type the connected provider rules out the others, so
  // find it once per type rather than scanning the catalog per card.
  const connectedExclusiveByType: Record<string, string> = {};
  for (const def of refData?.integrations ?? []) {
    if (def.exclusive && status[def.slug]) connectedExclusiveByType[def.type] = def.name;
  }

  const integrations: IntegrationView[] = (refData?.integrations ?? []).map(def => {
    const connected = !!status[def.slug];
    const holder    = def.exclusive ? connectedExclusiveByType[def.type] : undefined;

    return {
      ...def,
      connected,
      blockedBy: !connected && holder ? holder : undefined,
    };
  });

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function openDrawer(integration: IntegrationView) {
    if (integration.blockedBy) return;

    setSelected(integration);
    setProbe(null);
    setLinked(null);
    setUnlink(true);

    // Credentials start blank — they're write-only from here, and a blank
    // means "keep what's stored". Settings have to start at their real
    // value instead: a toggle that always opened "on" would misreport the
    // state, and saving would then write that misreport back.
    const initial: Record<string, FieldValue> = {};
    for (const f of integration.fields) {
      initial[f.key] = isSetting(f) ? defaultValue(f) : "";
    }
    setForm(initial);
    setDrawerOpen(true);

    if (!integration.connected) return;

    // Only the exclusive (ELD) integrations own local records; asking for the
    // rest would be a round trip that always answers zero.
    if (integration.exclusive) {
      apiGetIntegrationLinked(integration.slug)
        .then(counts => setLinked(counts))
        .catch(() => setLinked({ trucks: 0, drivers: 0 }));
    }

    try {
      const stored = await apiGetIntegrationConfig<Record<string, unknown>>(integration.slug);
      if (!stored) return;

      setForm(prev => {
        const next = { ...prev };
        for (const f of integration.fields) {
          if (!isSetting(f) || !(f.key in stored)) continue;
          next[f.key] = stored[f.key] !== false;
        }
        return next;
      });
    } catch {
      // Not fatal — the drawer still works, the toggles just show defaults.
    }
  }

  function closeDrawer() {
    if (saving || deleting || testing) return;
    setDrawerOpen(false);
    setSelected(null);
    setForm({});
    setProbe(null);
    setLinked(null);
  }

  function setField(key: string, value: FieldValue) {
    setForm(p => ({ ...p, [key]: value }));
  }

  /** What a toggle reads as before anything is stored for it. */
  function defaultValue(f: IntegrationField): FieldValue {
    return f.default !== false;
  }

  /**
   * What goes to the server: every setting every time, and credentials only
   * when they were actually typed into. A blank credential means "keep the
   * stored one", and the backend merges rather than replaces.
   */
  function payloadFrom(integration: IntegrationView): Record<string, FieldValue> {
    const payload: Record<string, FieldValue> = {};
    for (const f of integration.fields) {
      const v = form[f.key];
      if (isSetting(f)) {
        if (typeof v === "boolean") payload[f.key] = v;
      } else if (typeof v === "string" && v.trim() !== "") {
        payload[f.key] = v;
      }
    }

    return payload;
  }

  async function handleTest() {
    if (!selected) return;
    setTesting(true);
    setProbe(null);
    try {
      setProbe(await apiTestIntegration(selected.slug, payloadFrom(selected)));
    } catch (e) {
      showToast(false, e instanceof ApiError ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    const payload = payloadFrom(selected);

    if (!selected.connected) {
      const missing = selected.fields.filter(f => f.required && !payload[f.key]);
      if (missing.length > 0) {
        showToast(false, "Fill in all required fields");
        return;
      }
    } else if (Object.keys(payload).length === 0) {
      showToast(false, "Nothing to save");
      return;
    }

    setSaving(true);
    try {
      await apiSaveIntegration(selected.slug, payload);
      await loadStatus();
      showToast(true, "Saved");
      setDrawerOpen(false);
      setSelected(null);
      setForm({});
      setProbe(null);
    } catch (e) {
      // A 409 means something else took the slot between this page loading and
      // the save — reload so the cards show who actually holds it.
      if (e instanceof ApiError && e.status === 409) await loadStatus();
      showToast(false, e instanceof ApiError ? e.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!selected) return;

    const releasing = !!selected.exclusive && unlink && !!linked && linked.trucks + linked.drivers > 0;
    const consequence = releasing
      ? `\n\n${describeLinked(linked!)} imported from ${selected.name} will be unlinked so another ELD can take them over. The records themselves are kept.`
      : "";
    if (!window.confirm(`Disconnect ${selected.name}? This will remove your stored credentials.${consequence}`)) return;

    setDeleting(true);
    try {
      await apiDeleteIntegration(selected.slug, releasing);
      await loadStatus();
      showToast(true, releasing ? `Disconnected. Unlinked ${describeLinked(linked!)}.` : "Disconnected");
      setDrawerOpen(false);
      setSelected(null);
      setForm({});
      setLinked(null);
    } catch (e) {
      // 404 = already gone; treat as success
      if (e instanceof ApiError && e.status === 404) {
        await loadStatus();
        setDrawerOpen(false);
        setSelected(null);
        setForm({});
      } else {
        showToast(false, e instanceof ApiError ? e.message : "Disconnect failed. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  }

  const isLoading = loading || refLoading;

  return (
    <>
      <div className="flex flex-col gap-4">
        {toast && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono ${toast.ok ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400" : "bg-red-500/10 border border-red-500/25 text-red-400"}`}>
            {toast.msg}
          </div>
        )}

        {isLoading ? (
          <div className="text-xs font-mono text-muted-foreground py-12 text-center">Loading…</div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-xs font-mono text-red-400">{error}</p>
            <Btn variant="outline" onClick={loadStatus}>
              <RefreshCw size={11} className="inline mr-1.5" />Retry
            </Btn>
          </div>
        ) : integrations.length === 0 ? (
          <div className="text-xs font-mono text-muted-foreground py-12 text-center">
            No integrations available.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {integrations.map(i => (
              <IntegrationCard key={i.slug} integration={i} onClick={() => openDrawer(i)} />
            ))}
          </div>
        )}
      </div>

      <SlideDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={selected ? `${selected.connected ? "Manage" : "Connect"}: ${selected.name}` : ""}
        badge={selected ? selected.type.toUpperCase() : undefined}
        onSave={handleSave}
        saving={saving || deleting}
      >
        {selected && (
          <DrawerSection title="Credentials">
            {selected.connected && (
              <DrawerCell>
                <p className="text-[11px] font-mono text-muted-foreground">
                  Leave a field blank to keep the current value.
                </p>
              </DrawerCell>
            )}
            {selected.fields.filter(f => !isSetting(f)).map(f => (
              <DrawerField
                key={f.key}
                label={f.label}
                required={f.required}
                hint={f.hint}
                value={typeof form[f.key] === "string" ? (form[f.key] as string) : ""}
                type={f.type}
                mono={f.type === "password"}
                onChange={v => setField(f.key, v)}
              />
            ))}

            <DrawerCell>
              <div className="flex items-center gap-2 flex-wrap">
                <Btn variant="outline" onClick={handleTest} disabled={saving || deleting || testing}>
                  {testing ? "Testing…" : "Test connection"}
                </Btn>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Asks the provider what this key can actually do.
                </span>
              </div>
            </DrawerCell>

            {probe && (
              <DrawerCell>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(probe).map(([key, r]) => (
                    <div key={key} className="flex items-start gap-2 text-[11px] font-mono">
                      {r.ok
                        ? <Check size={13} className="text-emerald-400 flex-shrink-0 mt-px" />
                        : <X     size={13} className="text-red-400     flex-shrink-0 mt-px" />}
                      <span className="text-muted-foreground">
                        <span className="text-foreground">{labelFor(selected, key)}</span>
                        {" — "}{r.message}
                      </span>
                    </div>
                  ))}
                </div>
              </DrawerCell>
            )}
          </DrawerSection>
        )}

        {selected && selected.fields.some(isSetting) && (
          <DrawerSection title="Enabled APIs">
            <DrawerCell>
              <p className="text-[11px] font-mono text-muted-foreground">
                Google enables and bills each of these separately. Turn off what this
                key doesn't have so the app stops asking for it.
              </p>
            </DrawerCell>

            {selected.fields.filter(isSetting).map(f => (
              <DrawerCell key={f.key}>
                <div className="flex items-start gap-3">
                  <Switch
                    checked={form[f.key] !== false}
                    onChange={next => setField(f.key, next)}
                    label={f.label}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground leading-tight">{f.label}</p>
                    {f.hint && (
                      <p className="text-[11px] font-mono text-muted-foreground/70 mt-1 leading-relaxed">
                        {f.hint}
                      </p>
                    )}
                  </div>
                </div>
              </DrawerCell>
            ))}

          </DrawerSection>
        )}

        {selected?.connected && (
          <DrawerSection title="Danger zone">
            {selected.exclusive && linked && linked.trucks + linked.drivers > 0 && (
              <DrawerCell>
                <div className="flex items-start gap-3">
                  <Switch
                    checked={unlink}
                    onChange={setUnlink}
                    label="Unlink imported records"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground leading-tight">
                      Unlink imported records
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground/70 mt-1 leading-relaxed">
                      {describeLinked(linked)} came from {selected.name}. Leave this on if
                      you're switching providers — the records are kept either way, but
                      an ELD can only take over records no other provider still holds.
                    </p>
                  </div>
                </div>
              </DrawerCell>
            )}
            <DrawerCell>
              <Btn variant="danger" onClick={handleDisconnect} disabled={saving || deleting}>
                {deleting ? "Disconnecting…" : "Disconnect"}
              </Btn>
            </DrawerCell>
          </DrawerSection>
        )}
      </SlideDrawer>
    </>
  );
}
