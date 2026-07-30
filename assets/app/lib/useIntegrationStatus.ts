import { useEffect, useState } from "react";
import { apiGetIntegrationStatus } from "./api";

/**
 * Shared connection state for /api/integration, cached at module scope so
 * multiple pages/components don't refetch the same map. Refresh by calling
 * `refresh()` on the returned handle (used after Save/Disconnect on the
 * Integrations page).
 */

type StatusMap = Record<string, boolean>;

let cachedPromise: Promise<StatusMap> | null = null;
let cachedValue:   StatusMap | null           = null;

function loadStatus(force = false): Promise<StatusMap> {
  if (force) {
    cachedPromise = null;
    cachedValue   = null;
  }
  if (cachedValue) return Promise.resolve(cachedValue);
  if (cachedPromise) return cachedPromise;

  cachedPromise = apiGetIntegrationStatus().then(
    status => { cachedValue = status; return status; },
    err     => { cachedPromise = null; throw err; },
  );
  return cachedPromise;
}

export function useIntegrationStatus() {
  const [status,  setStatus]  = useState<StatusMap | null>(cachedValue);
  const [loading, setLoading] = useState<boolean>(cachedValue === null);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStatus()
      .then(s => { if (!cancelled) { setStatus(s); setLoading(false); } })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load integrations");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return {
    status,
    loading,
    error,
    isConnected: (slug: string) => !!status?.[slug],
    refresh: () => loadStatus(true).then(setStatus).catch(() => {}),
  };
}
