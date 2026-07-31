import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { MapPin, Plug } from "lucide-react";
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

/**
 * Light-mode counterpart — same structure (hides clutter labels, keeps
 * administrative labels) but with a bright palette that pairs with the
 * app's light theme.
 */
const LIGHT_MAP_STYLE: object[] = [
  { elementType: "geometry",           stylers: [{ color: "#f1f5f9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.fill",   stylers: [{ color: "#475569" }] },

  { featureType: "poi",     elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road",    elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "water",   elementType: "labels", stylers: [{ visibility: "off" }] },

  { featureType: "administrative",          elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
  { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#1e293b" }] },
  { featureType: "administrative.country",  elementType: "labels.text.fill", stylers: [{ color: "#1e293b" }] },

  { featureType: "road",         elementType: "geometry",        stylers: [{ color: "#ffffff" }] },
  { featureType: "road",         elementType: "geometry.stroke", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "road.highway", elementType: "geometry",        stylers: [{ color: "#ffe8a3" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#f5c85c" }] },
  { featureType: "transit",      elementType: "geometry",        stylers: [{ color: "#e2e8f0" }] },
  { featureType: "poi.park",     elementType: "geometry",        stylers: [{ color: "#d6ecd6" }] },
  { featureType: "water",        elementType: "geometry",        stylers: [{ color: "#c7dff2" }] },
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

// ─── Map component with live markers ─────────────────────────────────────────

/**
 * Minimal typing for the bits of the Google Maps API we touch. Full types would
 * mean pulling `@types/google.maps` — overkill for this surface.
 */
type GMap     = { setCenter: (c: { lat: number; lng: number }) => void; setZoom: (z: number) => void; setOptions: (opts: object) => void };
type GLatLng  = { lat: () => number; lng: () => number };
type GPoint      = { x: number; y: number };
type GProjection = { fromLatLngToDivPixel: (ll: GLatLng) => GPoint | null };

/** Bare minimum of google.maps.OverlayView we lean on. */
interface GOverlayCtor {
  new (): GOverlayInstance;
  prototype: {
    onAdd?:    () => void;
    draw?:     () => void;
    onRemove?: () => void;
  };
}
interface GOverlayInstance {
  setMap(m: GMap | null): void;
  getPanes(): { overlayMouseTarget: HTMLElement };
  getProjection(): GProjection | null;
}

interface GoogleNamespace {
  maps: {
    Map:          new (el: HTMLElement, opts: object) => GMap;
    LatLng:       new (lat: number, lng: number) => GLatLng;
    OverlayView:  GOverlayCtor;
    ControlPosition: Record<string, number>;
  };
}

// ─── Per-truck color + overlay factory ───────────────────────────────────────

/** Injects the pulsing-marker CSS keyframes once per document. */
function ensureTruckOverlayStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("truck-overlay-styles")) return;
  const style = document.createElement("style");
  style.id = "truck-overlay-styles";
  style.textContent = `
    .truck-overlay { position: absolute; transform: translate(-50%, -50%); pointer-events: none; width: 16px; height: 16px; }
    .truck-overlay-dot {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 2px solid rgba(15, 25, 35, 0.9);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
      z-index: 2;
    }
    .truck-overlay-pulse {
      position: absolute; inset: 0;
      border-radius: 50%;
      animation: truck-overlay-pulse 2.4s ease-out infinite;
      z-index: 1;
      opacity: 0;
    }
    @keyframes truck-overlay-pulse {
      0%   { transform: scale(1);   opacity: 0.6; }
      100% { transform: scale(3.6); opacity: 0;   }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Custom map marker: a colored dot with an outward-pulsing ring. Built on
 * OverlayView so we can use CSS animation — Google Maps native Marker /
 * Symbol don't support keyframe animations.
 */
interface PulsingOverlay extends GOverlayInstance {
  setPosition(latLng: GLatLng): void;
  getPosition(): GLatLng;
  setColor(color: string): void;
}

function createPulsingOverlayClass(google: GoogleNamespace): new (position: GLatLng, color: string) => PulsingOverlay {
  return class extends google.maps.OverlayView implements PulsingOverlay {
    private position: GLatLng;
    private color: string;
    private div: HTMLDivElement | null = null;
    private dotEl: HTMLDivElement | null = null;
    private pulseEl: HTMLDivElement | null = null;

    constructor(position: GLatLng, color: string) {
      super();
      this.position = position;
      this.color    = color;
    }

    onAdd() {
      const div = document.createElement("div");
      div.className = "truck-overlay";
      const pulse = document.createElement("div");
      pulse.className = "truck-overlay-pulse";
      pulse.style.background = this.color;
      const dot = document.createElement("div");
      dot.className = "truck-overlay-dot";
      dot.style.background = this.color;
      div.appendChild(pulse);
      div.appendChild(dot);

      this.div = div;
      this.dotEl = dot;
      this.pulseEl = pulse;
      this.getPanes().overlayMouseTarget.appendChild(div);
    }

    draw() {
      if (!this.div) return;
      const proj = this.getProjection();
      if (!proj) return;
      const p = proj.fromLatLngToDivPixel(this.position);
      if (!p) return;
      this.div.style.left = p.x + "px";
      this.div.style.top  = p.y + "px";
    }

    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
      }
      this.div = this.dotEl = this.pulseEl = null;
    }

    setPosition(latLng: GLatLng) {
      this.position = latLng;
      this.draw();
    }

    getPosition(): GLatLng {
      return this.position;
    }

    setColor(color: string) {
      this.color = color;
      if (this.dotEl)   this.dotEl.style.background   = color;
      if (this.pulseEl) this.pulseEl.style.background = color;
    }
  };
}

function GoogleMap({ apiKey, positions, onMapReady }: {
  apiKey: string;
  positions: TruckLocation[];
  /** Called once the map instance is created — parent uses it to pan/zoom externally. */
  onMapReady?: (map: GMap) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef        = useRef<GMap | null>(null);
  const overlaysRef   = useRef<Map<number, PulsingOverlay>>(new Map());
  const overlayCtorRef = useRef<ReturnType<typeof createPulsingOverlayClass> | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light"; // treat undefined/system-dark as dark; only "light" flips.

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
          styles: isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
        });
        mapRef.current = map;
        // OverlayView subclasses can only be defined after the Maps script
        // has provided the base class.
        overlayCtorRef.current = createPulsingOverlayClass(google);
        ensureTruckOverlayStyles();
        onMapReadyRef.current?.(map);
        // Flip state so the marker-sync effect re-runs with `positions` that
        // may have arrived before the map finished booting.
        setMapReady(true);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Map failed to load");
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Re-apply map style when the user toggles theme after the map has booted.
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({ styles: isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE });
  }, [isDark]);

  // Sync markers with the latest positions whenever the array changes OR
  // whenever the map finishes booting (which may happen after positions have
  // already arrived from the poll).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const OverlayCtor = overlayCtorRef.current;
    if (!map || !OverlayCtor || typeof window === "undefined") return;
    const google = (window as unknown as { google?: GoogleNamespace }).google;
    if (!google) return;

    const seen = new Set<number>();
    for (const t of positions) {
      seen.add(t.truckId);
      const latLng = new google.maps.LatLng(t.lat, t.lng);
      const color  = t.color;

      const existing = overlaysRef.current.get(t.truckId);
      if (existing) {
        existing.setPosition(latLng);
        existing.setColor(color);
      } else {
        const overlay = new OverlayCtor(latLng, color);
        overlay.setMap(map);
        overlaysRef.current.set(t.truckId, overlay);
      }
    }

    // Drop overlays for trucks the sync no longer reports.
    for (const [id, overlay] of overlaysRef.current) {
      if (!seen.has(id)) {
        overlay.setMap(null);
        overlaysRef.current.delete(id);
      }
    }
  }, [positions, mapReady]);

  // Detach overlays on unmount so they don't leak if the map is remounted.
  useEffect(() => () => {
    for (const overlay of overlaysRef.current.values()) overlay.setMap(null);
    overlaysRef.current.clear();
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
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-black/40"
                style={{ background: t.color, boxShadow: `0 0 6px ${t.color}66` }}
                aria-hidden="true"
              />
              <span className="text-xs font-mono font-semibold truncate" style={{ color: t.color }}>
                {t.truckNumber ?? `#${t.truckId}`}
              </span>
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
