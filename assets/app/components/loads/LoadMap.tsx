import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { MapPin } from "lucide-react";
import { Link } from "react-router";
import {
  loadGoogleMapsScript, getGoogleNamespace,
  USA_CENTER, USA_ZOOM, DARK_MAP_STYLE, LIGHT_MAP_STYLE,
  type GMap, type GMarker, type GLatLngLit,
} from "../../lib/googleMaps";
import { useMapProvider } from "../../lib/mapProvider";

/**
 * Compact Load-detail map: renders up to three pins (pickup / delivery /
 * truck) and auto-fits bounds around whatever is present. When there are
 * no pins yet, shows an empty US-centered map so the frame doesn't collapse.
 *
 * Provider-agnostic at the call site — internally switches on the active
 * integration slug (via useMapProvider). Google Maps is the only branch
 * for now; Mapbox/OSM land as sibling render paths.
 */
export interface LoadMapPin {
  lat:   number;
  lng:   number;
  label?: string;
}

export interface LoadMapProps {
  pickup?:   LoadMapPin | null;
  delivery?: LoadMapPin | null;
  truck?:    LoadMapPin | null;
  /** Height of the map area. Default fills the section (min 320px). */
  className?: string;
}

export default function LoadMap(props: LoadMapProps) {
  const { provider, loading } = useMapProvider();

  if (loading) {
    return <MapShell className={props.className}><div className="text-xs font-mono text-muted-foreground">Loading map…</div></MapShell>;
  }
  if (!provider) {
    return (
      <MapShell className={props.className}>
        <MapPin size={18} className="text-muted-foreground" />
        <div className="text-xs font-mono text-muted-foreground text-center">
          No map integration connected.<br />
          <Link to="/integrations" className="text-primary hover:underline">Connect one in Integrations</Link>.
        </div>
      </MapShell>
    );
  }
  if (provider.slug === "google_maps") {
    return <GoogleLoadMap apiKey={provider.apiKey} {...props} />;
  }
  return (
    <MapShell className={props.className}>
      <div className="text-xs font-mono text-muted-foreground text-center">
        Map provider <span className="font-semibold">{provider.slug}</span> is not supported yet.
      </div>
    </MapShell>
  );
}

// ─── Empty/error/loading shell ───────────────────────────────────────────────

function MapShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative w-full h-full min-h-[320px] bg-muted/40 flex flex-col items-center justify-center gap-2 ${className ?? ""}`}>
      {children}
    </div>
  );
}

// ─── Google Maps branch ──────────────────────────────────────────────────────

function GoogleLoadMap({ apiKey, pickup, delivery, truck, className }: LoadMapProps & { apiKey: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<GMap | null>(null);
  const markersRef   = useRef<Record<string, GMarker>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  // Boot once per apiKey.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const google = getGoogleNamespace();
        if (!google) { setError("Google Maps failed to initialize"); return; }
        const map = new google.maps.Map(containerRef.current, {
          center: USA_CENTER,
          zoom:   USA_ZOOM,
          disableDefaultUI:  true,
          keyboardShortcuts: false,
          clickableIcons:    false,
          styles: isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Map failed to load"); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Re-apply theme after boot.
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({ styles: isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE });
  }, [isDark]);

  // Stable JSON view of pin inputs so the sync effect isn't over-invalidated.
  const pinsKey = useMemo(
    () => JSON.stringify({ pickup, delivery, truck }),
    [pickup, delivery, truck],
  );

  // Sync pins whenever the pin inputs change (or the map finishes booting).
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = getGoogleNamespace();
    if (!google) return;
    const map = mapRef.current;

    const desired: Array<{ id: string; pin: LoadMapPin; icon: string }> = [];
    if (pickup)   desired.push({ id: "pickup",   pin: pickup,   icon: dotSvg("#10b981") });
    if (delivery) desired.push({ id: "delivery", pin: delivery, icon: dotSvg("#ef4444") });
    if (truck)    desired.push({ id: "truck",    pin: truck,    icon: dotSvg("#3b82f6") });

    // Drop stale markers.
    for (const id of Object.keys(markersRef.current)) {
      if (!desired.find(d => d.id === id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    }
    // Upsert current markers.
    for (const { id, pin, icon } of desired) {
      const pos: GLatLngLit = { lat: pin.lat, lng: pin.lng };
      const existing = markersRef.current[id];
      if (existing) {
        existing.setPosition(pos);
      } else {
        markersRef.current[id] = new google.maps.Marker({
          map,
          position: pos,
          title:    pin.label,
          icon: { url: icon },
        });
      }
    }

    // Fit bounds around whatever pins we have; leave defaults otherwise.
    if (desired.length === 1) {
      map.setCenter({ lat: desired[0].pin.lat, lng: desired[0].pin.lng });
      map.setZoom(10);
    } else if (desired.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      desired.forEach(d => bounds.extend({ lat: d.pin.lat, lng: d.pin.lng }));
      map.fitBounds(bounds, 48);
    } else {
      map.setCenter(USA_CENTER);
      map.setZoom(USA_ZOOM);
    }
  // pinsKey captures all three pin inputs — safe to omit them individually.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinsKey]);

  if (error) {
    return (
      <MapShell className={className}>
        <div className="text-xs font-mono text-red-400 text-center">{error}</div>
      </MapShell>
    );
  }
  return <div ref={containerRef} className={`w-full h-full min-h-[320px] bg-muted/40 ${className ?? ""}`} />;
}

// Inline SVG data-URL for a colored dot marker. Keeps the map self-contained
// (no icon hosting) and avoids pulling in @types/google.maps for real Marker
// symbols.
function dotSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="7" fill="${color}" stroke="white" stroke-width="2.5"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
