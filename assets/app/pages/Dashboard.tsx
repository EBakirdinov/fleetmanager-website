import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { MapPin, Plug, Navigation } from "lucide-react";
import { Btn } from "../lib/ui";
import { useAuth } from "../lib/auth";
import { apiGetIntegrationConfig, apiGetFleetLocations, ApiError, type TruckLocation } from "../lib/api";

interface GoogleMapsConfig {
  apiKey: string;
}

// Center of the contiguous US.
const USA_CENTER = { lat: 39.8283, lng: -98.5795 };
const USA_ZOOM = 4;

/** How often the dashboard re-polls /api/fleet/locations. Matches the API
 *  cron cadence — pointless to poll faster than the data is refreshed. */
const LOCATIONS_POLL_MS = 30_000;

/**
 * Minimal dark style — geometry only, plus administrative labels (states,
 * localities). Everything else (POIs, road names, transit, water) is stripped
 * so a country-wide view stays readable.
 *
 * Google Maps automatically abbreviates state labels at low zoom ("TX" at
 * country view → "Texas" as you zoom in), so no explicit "show initials only"
 * rule is needed.
 */
const DARK_MAP_STYLE: object[] = [
  // Base palette
  { elementType: "geometry",           stylers: [{ color: "#1d2a3a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f1923" }] },
  { elementType: "labels.text.fill",   stylers: [{ color: "#8a9bb0" }] },

  // Hide clutter: POIs, roads, transit, water labels
  { featureType: "poi",     elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road",    elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "water",   elementType: "labels", stylers: [{ visibility: "off" }] },

  // Keep administrative (country, state, locality) — brighter for readability
  { featureType: "administrative",           elementType: "labels.text.fill", stylers: [{ color: "#d4e0ea" }] },
  { featureType: "administrative.locality",  elementType: "labels.text.fill", stylers: [{ color: "#d4e0ea" }] },
  { featureType: "administrative.province",  elementType: "labels.text.fill", stylers: [{ color: "#e8eaed" }] },
  { featureType: "administrative.country",   elementType: "labels.text.fill", stylers: [{ color: "#e8eaed" }] },

  // Road/water geometry stays visible, just without labels
  { featureType: "road",         elementType: "geometry",        stylers: [{ color: "#293848" }] },
  { featureType: "road",         elementType: "geometry.stroke", stylers: [{ color: "#1d2a3a" }] },
  { featureType: "road.highway", elementType: "geometry",        stylers: [{ color: "#3a4d63" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1d2a3a" }] },
  { featureType: "transit",      elementType: "geometry",        stylers: [{ color: "#2c3e50" }] },
  { featureType: "poi.park",     elementType: "geometry",        stylers: [{ color: "#1a3d2f" }] },
  { featureType: "water",        elementType: "geometry",        stylers: [{ color: "#0f1923" }] },
];

/** Global promise cache so multiple mounts don't re-inject the script. */
let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as unknown as { google?: { maps?: unknown } };
  if (w.google && w.google.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      mapsScriptPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return mapsScriptPromise;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function infoWindowHtml(t: TruckLocation): string {
  // Kept intentionally lightweight — Google's InfoWindow renders raw HTML.
  const num    = t.truckNumber ? escapeHtml(t.truckNumber) : `#${t.truckId}`;
  const driver = t.driverName  ? escapeHtml(t.driverName)  : "Unassigned";
  const where  = [t.location, t.state].filter(Boolean).map(escapeHtml).join(", ");
  const when   = timeAgo(t.time);
  return `
    <div style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;line-height:1.4;color:#0f1923">
      <div style="font-weight:600;color:#0f1923;margin-bottom:2px">${num}</div>
      <div>${driver}</div>
      ${where ? `<div style="color:#556879">${where}</div>` : ""}
      ${when  ? `<div style="color:#556879">${when}</div>`  : ""}
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// ─── Map component with live markers ─────────────────────────────────────────

/**
 * Minimal typing for the bits of the Google Maps API we touch. Full types would
 * mean pulling `@types/google.maps` — overkill for this surface.
 */
type GMap    = { setCenter: (c: { lat: number; lng: number }) => void; setZoom: (z: number) => void };
type GMarker = {
  setPosition: (c: { lat: number; lng: number }) => void;
  setIcon:     (i: object) => void;
  setMap:      (m: GMap | null) => void;
  addListener: (event: string, cb: () => void) => void;
};
type GInfoWin = {
  setContent: (html: string) => void;
  open:       (opts: { map: GMap; anchor: GMarker }) => void;
  close:      () => void;
};

interface GoogleNamespace {
  maps: {
    Map: new (el: HTMLElement, opts: object) => GMap;
    Marker: new (opts: object) => GMarker;
    InfoWindow: new (opts?: object) => GInfoWin;
    Point: new (x: number, y: number) => object;
    Size: new (w: number, h: number) => object;
    ControlPosition: Record<string, number>;
    SymbolPath: Record<string, number>;
  };
}

/**
 * Marker glyph = lucide's `Truck` icon, filled for readability on the dark map:
 *   - Cargo body (left) filled slate gray
 *   - Cab (right, sloped windshield) filled white
 *   - Wheels filled dark navy
 *   - Thin dark stroke defines edges without overwhelming the fills
 *
 * Paths are copied verbatim from lucide-react's Truck icon so upstream
 * visual updates can be re-synced by pasting them again.
 */
function truckIconSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ` +
      `stroke="#0f1923" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">` +
      // Cargo/trailer body — the wider box on the left.
      `<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" fill="#94a3b8"/>` +
      // Cab — the smaller sloped shape on the right (front of the truck).
      `<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" fill="#ffffff"/>` +
      // Wheels.
      `<circle cx="17" cy="18" r="2" fill="#0f1923"/>` +
      `<circle cx="7"  cy="18" r="2" fill="#0f1923"/>` +
    `</svg>`
  );
}

const TRUCK_ICON_URL = "data:image/svg+xml;utf8," + encodeURIComponent(truckIconSvg());

function GoogleMap({ apiKey, positions, onMapReady }: {
  apiKey: string;
  positions: TruckLocation[];
  /** Called once the map instance is created — parent uses it to pan/zoom externally. */
  onMapReady?: (map: GMap) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef      = useRef<GMap | null>(null);
  const markersRef  = useRef<Map<number, GMarker>>(new Map());
  const infoWinRef  = useRef<GInfoWin | null>(null);
  const positionsRef = useRef<Map<number, TruckLocation>>(new Map());
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;

  // Boot the map once per apiKey.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const google = (window as unknown as { google: GoogleNamespace }).google;
        const map = new google.maps.Map(containerRef.current, {
          center: USA_CENTER,
          zoom: USA_ZOOM,
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControlOptions:  { position: google.maps.ControlPosition.LEFT_BOTTOM },
          panControlOptions:   { position: google.maps.ControlPosition.LEFT_BOTTOM },
          styles: DARK_MAP_STYLE,
        });
        mapRef.current = map;
        infoWinRef.current = new google.maps.InfoWindow();
        onMapReadyRef.current?.(map);
        // Flip state so the marker-sync effect re-runs with `positions` that
        // may have arrived before the map finished booting.
        setMapReady(true);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Map failed to load");
      });
    return () => { cancelled = true; };
  }, [apiKey]);

  // Sync markers with the latest positions whenever the array changes OR
  // whenever the map finishes booting (which may happen after positions have
  // already arrived from the poll).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map || typeof window === "undefined") return;
    const google = (window as unknown as { google?: GoogleNamespace }).google;
    if (!google) return;

    const seen = new Set<number>();
    for (const t of positions) {
      seen.add(t.truckId);
      positionsRef.current.set(t.truckId, t);
      const existing = markersRef.current.get(t.truckId);
      const icon = markerIcon(google, t.direction);
      if (existing) {
        existing.setPosition({ lat: t.lat, lng: t.lng });
        existing.setIcon(icon);
      } else {
        const marker = new google.maps.Marker({
          map,
          position: { lat: t.lat, lng: t.lng },
          title: t.truckNumber ?? `#${t.truckId}`,
          icon,
        });
        marker.addListener("click", () => {
          const iw = infoWinRef.current;
          const latest = positionsRef.current.get(t.truckId);
          if (!iw || !latest) return;
          iw.setContent(infoWindowHtml(latest));
          iw.open({ map, anchor: marker });
        });
        markersRef.current.set(t.truckId, marker);
      }
    }

    // Drop markers for trucks the sync no longer reports.
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
        positionsRef.current.delete(id);
      }
    }
  }, [positions, mapReady]);

  // Detach markers on unmount so they don't leak if the map is remounted.
  useEffect(() => () => {
    for (const marker of markersRef.current.values()) marker.setMap(null);
    markersRef.current.clear();
    positionsRef.current.clear();
    infoWinRef.current?.close();
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-card border border-border rounded-lg text-xs font-mono text-red-400">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden bg-muted" />;
}

function markerIcon(google: GoogleNamespace, _direction: string | null): object {
  // Google Maps Icon (image-based) — no rotation support. Direction stays in
  // the info window/sidebar. If direction on the map becomes important, we
  // can composite a rotated arrow around this disc via OverlayView.
  return {
    url:        TRUCK_ICON_URL,
    scaledSize: new google.maps.Size(24, 24),
    anchor:     new google.maps.Point(12, 12),
  };
}

// ─── Aside: right-column truck list ──────────────────────────────────────────

function TruckListAside({ positions, loading, error, onFocus }: {
  positions: TruckLocation[];
  loading: boolean;
  error: string | null;
  onFocus: (t: TruckLocation) => void;
}) {
  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => (a.truckNumber ?? "").localeCompare(b.truckNumber ?? ""));
  }, [positions]);

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase">Live Fleet</span>
        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{sorted.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-3 py-6 text-center text-xs font-mono text-muted-foreground">Loading…</div>
        )}
        {error && (
          <div className="px-3 py-6 text-center text-xs font-mono text-red-400">{error}</div>
        )}
        {!loading && !error && sorted.length === 0 && (
          <div className="px-3 py-6 text-center text-xs font-mono text-muted-foreground">
            No trucks are reporting locations right now.
          </div>
        )}
        {sorted.map(t => (
          <button
            key={t.truckId}
            onClick={() => onFocus(t)}
            className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Navigation size={11} className="text-primary flex-shrink-0" />
              <span className="text-xs font-mono text-primary font-semibold truncate">{t.truckNumber ?? `#${t.truckId}`}</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{timeAgo(t.time)}</span>
            </div>
            <div className="text-xs text-foreground truncate mt-0.5">{t.driverName ?? "Unassigned"}</div>
            {(t.location || t.state) && (
              <div className="text-[11px] font-mono text-muted-foreground truncate">
                {[t.location, t.state].filter(Boolean).join(", ")}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Not-connected placeholder ───────────────────────────────────────────────

function NotConnected({ isOwner }: { isOwner: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="w-full h-full flex items-center justify-center bg-card border border-border rounded-lg">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm px-6">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <MapPin size={20} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">Google Maps not connected</p>
        <p className="text-xs font-mono text-muted-foreground leading-relaxed">
          {isOwner
            ? "Connect your Google Maps API key in Integrations to see live fleet locations here."
            : "Ask an owner to connect Google Maps in Integrations to enable this view."}
        </p>
        {isOwner && (
          <Btn variant="primary" onClick={() => navigate("/integrations")}>
            <Plug size={11} className="inline mr-1.5" />Go to Integrations
          </Btn>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const isOwner = !!user?.roles?.includes("ROLE_OWNER");

  const [status,   setStatus]   = useState<"loading" | "connected" | "not-connected" | "error">("loading");
  const [apiKey,   setApiKey]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [positions,    setPositions]    = useState<TruckLocation[]>([]);
  const [posLoading,   setPosLoading]   = useState(true);
  const [posError,     setPosError]     = useState<string | null>(null);
  const mapInstanceRef = useRef<GMap | null>(null);

  // Google Maps API key check.
  useEffect(() => {
    let cancelled = false;
    apiGetIntegrationConfig<GoogleMapsConfig>("google_maps")
      .then(cfg => {
        if (cancelled) return;
        if (cfg && cfg.apiKey) {
          setApiKey(cfg.apiKey);
          setStatus("connected");
        } else {
          setStatus("not-connected");
        }
      })
      .catch(e => {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(e instanceof ApiError ? e.message : "Failed to check Google Maps status");
      });
    return () => { cancelled = true; };
  }, []);

  // Live location polling — fetches immediately then every LOCATIONS_POLL_MS.
  // Doesn't depend on the Google Maps key: the aside list still works even if
  // the map isn't connected, so users see fleet status either way.
  useEffect(() => {
    let cancelled = false;
    async function pull() {
      try {
        const items = await apiGetFleetLocations();
        if (!cancelled) { setPositions(items); setPosError(null); }
      } catch (e) {
        if (!cancelled) setPosError(e instanceof ApiError ? e.message : "Failed to load fleet locations");
      } finally {
        if (!cancelled) setPosLoading(false);
      }
    }
    pull();
    const iv = window.setInterval(pull, LOCATIONS_POLL_MS);
    return () => { cancelled = true; window.clearInterval(iv); };
  }, []);

  function focusTruck(t: TruckLocation) {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setCenter({ lat: t.lat, lng: t.lng });
    map.setZoom(9);
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground leading-none">Dashboard</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Fleet overview</p>
        </div>
      </div>

      <div className="grid grid-cols-3 grid-rows-[2fr_1fr] gap-4 flex-1 min-h-[600px]">
        {/* Map — spans 2 of 3 columns (top row, 2/3 width) */}
        <div className="col-span-2 min-h-0">
          {status === "loading" && (
            <div className="w-full h-full flex items-center justify-center bg-card border border-border rounded-lg text-xs font-mono text-muted-foreground">
              Loading…
            </div>
          )}
          {status === "error" && (
            <div className="w-full h-full flex items-center justify-center bg-card border border-border rounded-lg text-xs font-mono text-red-400">
              {errorMsg}
            </div>
          )}
          {status === "not-connected" && <NotConnected isOwner={isOwner} />}
          {status === "connected" && apiKey && (
            <GoogleMap
              apiKey={apiKey}
              positions={positions}
              onMapReady={m => { mapInstanceRef.current = m; }}
            />
          )}
        </div>

        {/* Right column — live truck list */}
        <TruckListAside positions={positions} loading={posLoading} error={posError} onFocus={focusTruck} />

        {/* Second row placeholders — three across */}
        <div className="bg-card border border-border rounded-lg" />
        <div className="bg-card border border-border rounded-lg" />
        <div className="bg-card border border-border rounded-lg" />
      </div>
    </div>
  );
}
