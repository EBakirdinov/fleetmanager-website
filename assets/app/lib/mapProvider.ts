import { useEffect, useState } from "react";
import { useRefData } from "./data";
import { apiGetIntegrationStatus, apiGetIntegrationConfig } from "./api";

/**
 * Active map integration for the current company. Discovered generically —
 * the resolver picks the first connected integration whose catalog `type`
 * is `"map"`, so adding Mapbox/OSM/etc. later is just a new integration
 * entry (backend catalog) and a new `slug` branch in the consumer.
 */
export interface ActiveMapProvider {
  slug:   string;   // e.g. "google_maps"
  apiKey: string;   // decrypted from integration config
}

/**
 * Hook that resolves the active map provider.
 *
 *  - loading  : catalog + status + config are being fetched
 *  - provider : ready to render (slug + apiKey known)
 *  - null     : no map integration connected or its config is missing
 */
export function useMapProvider(): { provider: ActiveMapProvider | null; loading: boolean } {
  const { data: refData, loading: refLoading } = useRefData();
  const [provider, setProvider] = useState<ActiveMapProvider | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (refLoading || !refData) return;

    let cancelled = false;
    (async () => {
      try {
        const status = await apiGetIntegrationStatus();
        const mapDef = refData.integrations.find(
          i => i.type === "map" && status[i.slug] === true,
        );
        if (!mapDef) { if (!cancelled) { setProvider(null); setLoading(false); } return; }

        const config = await apiGetIntegrationConfig<{ apiKey?: string }>(mapDef.slug);
        if (cancelled) return;

        if (!config?.apiKey) {
          setProvider(null);
        } else {
          setProvider({ slug: mapDef.slug, apiKey: config.apiKey });
        }
        setLoading(false);
      } catch {
        if (!cancelled) { setProvider(null); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [refData, refLoading]);

  return { provider, loading: loading || refLoading };
}
