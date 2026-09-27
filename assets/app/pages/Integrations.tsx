import { useState, useEffect } from "react";
import { RefreshCw, Check, X } from "lucide-react";
import { useRefData, type IntegrationDef, type IntegrationField } from "../lib/data";
import { SlideDrawer, DrawerSection, DrawerField, DrawerCell, Btn, Switch } from "../lib/ui";
import {
  apiGetIntegrationStatus, apiSaveIntegration, apiDeleteIntegration,
  apiGetIntegrationConfig, apiTestIntegration,
  ApiError, type IntegrationProbeResult,
} from "../lib/api";
import { IntegrationIcon } from "../lib/integrationIcons";

interface IntegrationView extends IntegrationDef {
  connected: boolean;
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

function IntegrationCard({ integration, onClick }: {
  integration: IntegrationView;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-5 text-left hover:border-white/20 transition-colors flex flex-col gap-3"
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
          {integration.connected ? "Connected" : "Not connected"}
        </span>
      </div>
      <div className="flex justify-end pt-1">
        {integration.connected ? (
          <Btn variant="primary">Manage</Btn>
        ) : (
          <Btn variant="outline">Connect</Btn>
        )}
      </div>
    </button>
  );
}

export default function Integrations() {
  const { data: refData, loading: refLoading } = useRefData();

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

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      setStatus(await apiGetIntegrationStatus());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  const integrations: IntegrationView[] = (refData?.integrations ?? []).map(def => ({
    ...def,
    connected: !!status[def.slug],
  }));

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function openDrawer(integration: IntegrationView) {
    setSelected(integration);
    setProbe(null);

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
      showToast(false, e instanceof ApiError ? e.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!selected) return;
    if (!window.confirm(`Disconnect ${selected.name}? This will remove your stored credentials.`)) return;

    setDeleting(true);
    try {
      await apiDeleteIntegration(selected.slug);
      await loadStatus();
      showToast(true, "Disconnected");
      setDrawerOpen(false);
      setSelected(null);
      setForm({});
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
