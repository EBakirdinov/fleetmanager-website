import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { useRefData, type IntegrationDef } from "../lib/data";
import { SlideDrawer, DrawerSection, DrawerField, DrawerCell, Btn } from "../lib/ui";
import {
  apiGetIntegrationStatus, apiSaveIntegration, apiDeleteIntegration,
  ApiError,
} from "../lib/api";
import { IntegrationIcon } from "../lib/integrationIcons";

interface IntegrationView extends IntegrationDef {
  connected: boolean;
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
  const [form,       setForm]       = useState<Record<string, string>>({});
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);

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

  function openDrawer(integration: IntegrationView) {
    setSelected(integration);
    const initial: Record<string, string> = {};
    for (const f of integration.fields) initial[f.key] = "";
    setForm(initial);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (saving || deleting) return;
    setDrawerOpen(false);
    setSelected(null);
    setForm({});
  }

  function setField(key: string, value: string) {
    setForm(p => ({ ...p, [key]: value }));
  }

  async function handleSave() {
    if (!selected) return;
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v.trim() !== "") payload[k] = v;
    }

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
            {selected.fields.map(f => (
              <DrawerField
                key={f.key}
                label={f.label}
                required={f.required}
                value={form[f.key] ?? ""}
                type={f.type}
                mono={f.type === "password"}
                onChange={v => setField(f.key, v)}
              />
            ))}
            {selected.connected && (
              <DrawerCell>
                <Btn variant="danger" onClick={handleDisconnect} disabled={saving || deleting}>
                  {deleting ? "Disconnecting…" : "Disconnect"}
                </Btn>
              </DrawerCell>
            )}
          </DrawerSection>
        )}
      </SlideDrawer>
    </>
  );
}
