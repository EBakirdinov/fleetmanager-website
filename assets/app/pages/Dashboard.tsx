import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { MapPin, Plug, Search, Truck, ArrowRight } from "lucide-react";
import { Btn } from "../lib/ui";
import { useAuth } from "../lib/auth";
import { apiGetIntegrationConfig, apiGetFleetLocations, apiListTrucks, ApiError, type TruckLocation, type TruckItem } from "../lib/api";

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

// ─── Map component with live markers ─────────────────────────────────────────

/**
 * Minimal typing for the bits of the Google Maps API we touch. Full types would
 * mean pulling `@types/google.maps` — overkill for this surface.
 */
type GMap     = { setCenter: (c: { lat: number; lng: number }) => void; setZoom: (z: number) => void; setOptions: (opts: object) => void; setMapTypeId: (id: string) => void };
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
  };
}

// ─── Per-truck color + overlay factory ───────────────────────────────────────

/** Inline truck SVG rendered inside every marker pin. Lucide `Truck` glyph. */
const TRUCK_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

/**
 * Injects the truck-marker CSS once per document. Each marker is a flex row:
 * a colored circular pin (truck icon inside) at the geographic anchor, and a
 * white label card to its right showing the truck number.
 */
function ensureTruckOverlayStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("truck-overlay-styles")) return;
  const style = document.createElement("style");
  style.id = "truck-overlay-styles";
  style.textContent = `
    .truck-overlay {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 4px;
      /* Pin (32x32) is the first child — shifting the container 16px in each
         direction places the pin's center exactly on the geo anchor. */
      transform: translate(-16px, -16px);
      pointer-events: none;
      z-index: 1;
    }
    .truck-overlay-pin {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.95);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      flex-shrink: 0;
    }
    .truck-overlay-sign {
      background: rgba(255, 255, 255, 0.95);
      color: #0f1923;
      border-radius: 6px;
      padding: 3px 7px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Custom map marker: a colored circular pin containing a truck icon, plus a
 * white "sign" label to the right with the truck number. Built on OverlayView
 * so we can compose real HTML + SVG — Google's native Marker only supports
 * static images.
 */
interface TruckOverlay extends GOverlayInstance {
  setPosition(latLng: GLatLng): void;
  getPosition(): GLatLng;
  setColor(color: string): void;
  setLabel(label: string): void;
}

function createTruckOverlayClass(google: GoogleNamespace): new (position: GLatLng, color: string, label: string) => TruckOverlay {
  return class extends google.maps.OverlayView implements TruckOverlay {
    private position: GLatLng;
    private color: string;
    private label: string;
    private div: HTMLDivElement | null = null;
    private pinEl: HTMLDivElement | null = null;
    private signEl: HTMLDivElement | null = null;

    constructor(position: GLatLng, color: string, label: string) {
      super();
      this.position = position;
      this.color    = color;
      this.label    = label;
    }

    onAdd() {
      const div = document.createElement("div");
      div.className = "truck-overlay";

      const pin = document.createElement("div");
      pin.className = "truck-overlay-pin";
      pin.style.background = this.color;
      pin.innerHTML = TRUCK_ICON_SVG;

      const sign = document.createElement("div");
      sign.className = "truck-overlay-sign";
      sign.textContent = this.label;

      div.appendChild(pin);
      div.appendChild(sign);

      this.div = div;
      this.pinEl = pin;
      this.signEl = sign;
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
      this.div = this.pinEl = this.signEl = null;
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
      if (this.pinEl) this.pinEl.style.background = color;
    }

    setLabel(label: string) {
      this.label = label;
      if (this.signEl) this.signEl.textContent = label;
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
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const mapRef        = useRef<GMap | null>(null);
  const overlaysRef   = useRef<Map<number, TruckOverlay>>(new Map());
  const overlayCtorRef = useRef<ReturnType<typeof createTruckOverlayClass> | null>(null);
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
          // Strip every default control (zoom, pan, streetview, fullscreen,
          // maptype, rotate). The Google logo + "Terms" attribution stay —
          // Google Maps ToS forbids hiding those.
          disableDefaultUI: true,
          keyboardShortcuts: false,
          clickableIcons: false,
          styles: isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
        });
        mapRef.current = map;
        // OverlayView subclasses can only be defined after the Maps script
        // has provided the base class.
        overlayCtorRef.current = createTruckOverlayClass(google);
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

  // Push the map-type toggle down into the Maps instance.
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(mapType);
  }, [mapType]);

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
      const label  = t.truckNumber ?? `#${t.truckId}`;

      const existing = overlaysRef.current.get(t.truckId);
      if (existing) {
        existing.setPosition(latLng);
        existing.setColor(color);
        existing.setLabel(label);
      } else {
        const overlay = new OverlayCtor(latLng, color, label);
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

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden bg-muted" />
      <div className="absolute top-3 right-3 flex bg-card/90 backdrop-blur border border-border rounded-md p-0.5 shadow-lg">
        {(["roadmap", "hybrid"] as const).map(t => {
          const active = mapType === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setMapType(t)}
              className={
                "text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-sm transition-colors " +
                (active
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t === "roadmap" ? "Map" : "Satellite"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Aside: right-column truck list ──────────────────────────────────────────

/**
 * Deterministic per-truck color that mirrors the backend's `colorForTruck()`
 * in LocationsSyncer.php — so a truck without a live position still gets the
 * same color it would get once its GPS starts reporting.
 */
function colorForTruck(id: number): string {
  const hue = (id * 137) % 360;
  return `hsl(${hue}, 75%, 55%)`;
}

function TruckListAside({ trucks, positions, loading, error, onFocus }: {
  trucks: TruckItem[];
  positions: TruckLocation[];
  loading: boolean;
  error: string | null;
  onFocus: (t: TruckLocation) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const posByTruckId = useMemo(() => {
    const m = new Map<number, TruckLocation>();
    positions.forEach(p => m.set(p.truckId, p));
    return m;
  }, [positions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = trucks;
    if (q) {
      list = list.filter(t => {
        const driver = t.assigned_driver
          ? `${t.assigned_driver.first_name} ${t.assigned_driver.last_name}`.toLowerCase()
          : "";
        const pos = posByTruckId.get(t.id);
        return (
          (t.truck_number ?? "").toLowerCase().includes(q) ||
          driver.includes(q) ||
          (pos?.location ?? "").toLowerCase().includes(q) ||
          (pos?.state    ?? "").toLowerCase().includes(q)
        );
      });
    }
    return [...list].sort((a, b) =>
      (a.truck_number ?? "").localeCompare(b.truck_number ?? "")
    );
  }, [trucks, search, posByTruckId]);

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">
          All Trucks{" "}
          <span className="text-muted-foreground font-mono font-normal">({trucks.length})</span>
        </h2>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <div className="relative">
          <Search
            size={11}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search trucks..."
            className="w-full pl-7 pr-2 py-1.5 bg-muted/50 border border-border rounded text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="px-3 py-6 text-center text-xs font-mono text-muted-foreground">Loading…</div>
        )}
        {error && (
          <div className="px-3 py-6 text-center text-xs font-mono text-red-400">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs font-mono text-muted-foreground">
            {trucks.length === 0 ? "No trucks yet." : "No trucks match."}
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <table className="w-full text-[11px] font-mono border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left font-normal px-2 py-1.5 border-b border-border">Truck</th>
                <th className="text-left font-normal px-2 py-1.5 border-b border-border">Driver</th>
                <th className="text-left font-normal px-2 py-1.5 border-b border-border">Location</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const pos    = posByTruckId.get(t.id);
                const color  = pos?.color ?? colorForTruck(t.id);
                const hasDriver = !!t.assigned_driver;
                const driver = hasDriver
                  ? `${t.assigned_driver!.first_name} ${t.assigned_driver!.last_name}`
                  : "—";
                const focusable = !!pos;
                return (
                  <tr
                    key={t.id}
                    onClick={() => { if (pos) onFocus(pos); }}
                    className={
                      "border-b border-border/50 " +
                      (focusable ? "cursor-pointer hover:bg-white/[0.03]" : "")
                    }
                  >
                    <td className="px-2 py-1.5 border-b border-border/50">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: color, opacity: focusable ? 1 : 0.5 }}
                          aria-hidden="true"
                        >
                          <Truck size={10} className="text-white" />
                        </div>
                        <span
                          className="font-semibold whitespace-nowrap"
                          style={{ color, opacity: focusable ? 1 : 0.5 }}
                        >
                          {t.truck_number ?? `#${t.id}`}
                        </span>
                      </div>
                    </td>
                    <td
                      className={
                        "px-2 py-1.5 border-b border-border/50 max-w-[110px] truncate " +
                        (hasDriver ? "text-foreground" : "text-muted-foreground")
                      }
                    >
                      {driver}
                    </td>
                    <td className="px-2 py-1.5 border-b border-border/50 text-muted-foreground max-w-[110px] truncate">
                      {pos && (pos.location || pos.state)
                        ? [pos.location, pos.state].filter(Boolean).join(", ")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate("/trucks")}
          className="w-full flex items-center justify-center gap-1 text-xs font-mono text-foreground/70 hover:text-foreground transition-colors"
        >
          View All Trucks
          <ArrowRight size={11} />
        </button>
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
  const [trucks,       setTrucks]       = useState<TruckItem[]>([]);
  const [trucksLoading, setTrucksLoading] = useState(true);
  const [trucksError,   setTrucksError]   = useState<string | null>(null);
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

  // Fetch the full truck list once — used to render every truck in the aside,
  // whether it's currently reporting a location or not.
  useEffect(() => {
    let cancelled = false;
    apiListTrucks()
      .then(list => { if (!cancelled) { setTrucks(list); setTrucksError(null); } })
      .catch(e => {
        if (!cancelled) setTrucksError(e instanceof ApiError ? e.message : "Failed to load trucks");
      })
      .finally(() => { if (!cancelled) setTrucksLoading(false); });
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

        {/* Right column — full truck list, merged with live locations */}
        <TruckListAside
          trucks={trucks}
          positions={positions}
          loading={trucksLoading}
          error={trucksError ?? posError}
          onFocus={focusTruck}
        />

        {/* Second row placeholders — three across */}
        <div className="bg-card border border-border rounded-lg" />
        <div className="bg-card border border-border rounded-lg" />
        <div className="bg-card border border-border rounded-lg" />
      </div>
    </div>
  );
}
