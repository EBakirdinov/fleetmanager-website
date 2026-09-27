import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { MapPin } from "lucide-react";
import { Link } from "react-router";
import {
  loadGoogleMapsScript, getGoogleNamespace,
  USA_CENTER, USA_ZOOM, DARK_MAP_STYLE, LIGHT_MAP_STYLE,
  type GMap, type GMarker, type GLatLngLit, type GDirectionsRenderer,
} from "../../lib/googleMaps";
import { useMapProvider } from "../../lib/mapProvider";

/**
 * Compact Load-detail map: renders the run's stops in order plus the truck,
 * and auto-fits bounds around whatever is present. When there are no pins
 * yet, shows an empty US-centered map so the frame doesn't collapse.
 *
 * Stops arrive as one ordered list rather than a named pickup and delivery:
 * a load may have several of each, and what the map draws is the sequence —
 * A, B, C… down the run — with colour carrying which kind each call is.
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

/** A pin that knows which end of the run it belongs to, for its colour. */
export interface LoadMapStop extends LoadMapPin {
  kind: "pickup" | "delivery";
}

export interface LoadMapProps {
  /** In travel order. Letters and the drawn route follow this order. */
  stops?:  LoadMapStop[];
  truck?:  LoadMapPin | null;
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

function GoogleLoadMap({ apiKey, stops = [], truck, className }: LoadMapProps & { apiKey: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<GMap | null>(null);
  const markersRef   = useRef<Record<string, GMarker>>({});
  const routeRef     = useRef<GDirectionsRenderer | null>(null);
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
          // Everything off, then back on only what the design shows: a zoom
          // pair and the expand button. Street View, map-type and the rest
          // have no job on a dispatch readout.
          disableDefaultUI:  true,
          zoomControl:       true,
          fullscreenControl: true,
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
    () => JSON.stringify({ stops, truck }),
    [stops, truck],
  );

  // Sync pins whenever the pin inputs change (or the map finishes booting).
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = getGoogleNamespace();
    if (!google) return;
    const map = mapRef.current;

    // A, B, C… name the calls of the run the way a rate confirmation does, in
    // travel order, green for a pickup and red for a drop. The truck is a
    // plain dot because it is a position, not a stop.
    const desired: Array<{ id: string; pin: LoadMapPin; icon: string }> = [];
    stops.forEach((stop, i) => {
      desired.push({
        id:   `stop-${i}`,
        pin:  stop,
        icon: pinSvg(stop.kind === "pickup" ? "#10b981" : "#ef4444", stopLetter(i)),
      });
    });
    if (truck) desired.push({ id: "truck", pin: truck, icon: dotSvg("#3b82f6") });

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
        // Position *and* icon: ids are positional, so removing a stop shifts
        // every later one up a slot and a pin that kept its old glyph would
        // be lettered for where it used to be in the run.
        existing.setPosition(pos);
        existing.setIcon({ url: icon });
        existing.setTitle(pin.label);
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

  /**
   * The driven route through the run, as a line.
   *
   * Drawn client-side from the already-loaded Maps SDK rather than from our
   * own route endpoint: Distance Matrix (what RoutingService calls) returns
   * distance and duration but no geometry, so there is nothing on the server
   * to draw. Stops between the ends go in as waypoints, so a multi-stop load
   * traces the order it will actually be run in instead of a straight shot
   * from first to last. Failures are silent by design — Directions is a
   * separately enabled API, and a missing line is not worth an error over a
   * map that still shows every pin.
   *
   * The strip above the map is a separate question and still measures the
   * loaded leg end to end; these waypoints change the drawing, not the miles.
   */
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = getGoogleNamespace();
    const Service  = google?.maps.DirectionsService;
    const Renderer = google?.maps.DirectionsRenderer;

    const clear = () => {
      routeRef.current?.setMap(null);
      routeRef.current = null;
    };

    if (stops.length < 2 || !Service || !Renderer) { clear(); return; }

    const first = stops[0];
    const last  = stops[stops.length - 1];

    let cancelled = false;
    try {
      new Service().route(
        {
          origin:      { lat: first.lat, lng: first.lng },
          destination: { lat: last.lat,  lng: last.lng },
          waypoints:   stops.slice(1, -1).map(s => ({
            location: { lat: s.lat, lng: s.lng },
            stopover: true,
          })),
          travelMode:  "DRIVING",
        },
        (result, status) => {
          if (cancelled || status !== "OK" || !mapRef.current) return;
          clear();
          const renderer = new Renderer({
            map: mapRef.current,
            directions: result,
            // Our own lettered pins already mark every call, and fitBounds
            // above has already framed the run.
            suppressMarkers:  true,
            preserveViewport: true,
            polylineOptions: { strokeColor: "#2563eb", strokeWeight: 4, strokeOpacity: 0.9 },
          });
          routeRef.current = renderer;
        },
      );
    } catch {
      clear();
    }

    return () => { cancelled = true; };
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
/** Teardrop pin carrying its letter. Baked into the SVG so the label needs
 *  no labelOrigin Point, which would mean widening the Maps type shim. */
function pinSvg(color: string, letter: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.8 0 1 5.8 1 13c0 9.2 11.4 21.6 12 22.3.3.4.9.4 1.2 0C14.6 34.6 27 22.2 27 13 27 5.8 21.2 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="14" y="18" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="white">${letter}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * A, B, C… for the run's calls. Past Z the letter stops being a label and
 * becomes a puzzle, so the number takes over — a 27-stop load is not a thing
 * anybody dispatches, but neither is a pin reading "[".
 */
function stopLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function dotSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="7" fill="${color}" stroke="white" stroke-width="2.5"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
