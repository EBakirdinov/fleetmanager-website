/**
 * Shared Google Maps JS SDK plumbing — script loader, constants, styles, and
 * the minimal TypeScript surface we use. Multiple map-owning components
 * (Dashboard fleet map, Load detail map, etc.) share this so the SDK
 * <script> is injected exactly once per page load.
 *
 * Feature-specific bits (custom overlays, marker classes, layout) stay in
 * the consumer component.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Center of the contiguous US — safe default when we have no pins to fit. */
export const USA_CENTER = { lat: 39.8283, lng: -98.5795 };
export const USA_ZOOM   = 4;

// ─── Minimal TypeScript surface ──────────────────────────────────────────────
// Full types would mean pulling `@types/google.maps` — overkill for what we
// touch. Extend as new call-sites need more.

export type GLatLng     = { lat: () => number; lng: () => number };
export type GLatLngLit  = { lat: number; lng: number };
export type GPoint      = { x: number; y: number };
export type GProjection = { fromLatLngToDivPixel: (ll: GLatLng) => GPoint | null };
export type GLatLngBounds = { extend: (ll: GLatLng | GLatLngLit) => void };

export type GMap = {
  setCenter:    (c: GLatLngLit) => void;
  setZoom:      (z: number) => void;
  setOptions:   (opts: object) => void;
  setMapTypeId: (id: string) => void;
  fitBounds:    (bounds: GLatLngBounds, padding?: number | { top: number; right: number; bottom: number; left: number }) => void;
};

/** Bare minimum of google.maps.OverlayView we lean on. */
export interface GOverlayInstance {
  setMap(m: GMap | null): void;
  getPanes(): { overlayMouseTarget: HTMLElement };
  getProjection(): GProjection | null;
}
export interface GOverlayCtor {
  new (): GOverlayInstance;
  prototype: {
    onAdd?:    () => void;
    draw?:     () => void;
    onRemove?: () => void;
  };
}

export interface GMarker {
  setMap(m: GMap | null): void;
  setPosition(pos: GLatLngLit | GLatLng): void;
}
export interface GMarkerCtor {
  new (opts: {
    map?:      GMap;
    position:  GLatLngLit | GLatLng;
    title?:    string;
    label?:    string | { text: string; color?: string; fontSize?: string; fontWeight?: string };
    icon?:     string | { url?: string; scaledSize?: unknown };
  }): GMarker;
}

export interface GoogleNamespace {
  maps: {
    Map:          new (el: HTMLElement, opts: object) => GMap;
    LatLng:       new (lat: number, lng: number) => GLatLng;
    LatLngBounds: new () => GLatLngBounds;
    OverlayView:  GOverlayCtor;
    Marker:       GMarkerCtor;
  };
}

// ─── Script loader (idempotent) ──────────────────────────────────────────────

/** Global promise cache so multiple mounts don't re-inject the script. */
let mapsScriptPromise: Promise<void> | null = null;

export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as unknown as { google?: { maps?: unknown } };
  if (w.google && w.google.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload  = () => resolve();
    script.onerror = () => {
      mapsScriptPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return mapsScriptPromise;
}

export function getGoogleNamespace(): GoogleNamespace | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { google?: GoogleNamespace };
  return w.google ?? null;
}

// ─── Map styles ──────────────────────────────────────────────────────────────
// Consistent light/dark palette across every map instance in the app. Hides
// POI/road/transit/water labels so wider views stay readable; keeps admin
// labels (states, localities) which auto-abbreviate at low zoom.

export const DARK_MAP_STYLE: object[] = [
  { elementType: "geometry",           stylers: [{ color: "#1d2a3a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f1923" }] },
  { elementType: "labels.text.fill",   stylers: [{ color: "#8a9bb0" }] },

  { featureType: "poi",     elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road",    elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "water",   elementType: "labels", stylers: [{ visibility: "off" }] },

  { featureType: "administrative",          elementType: "labels.text.fill", stylers: [{ color: "#d4e0ea" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d4e0ea" }] },
  { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#e8eaed" }] },
  { featureType: "administrative.country",  elementType: "labels.text.fill", stylers: [{ color: "#e8eaed" }] },

  { featureType: "road",         elementType: "geometry",        stylers: [{ color: "#293848" }] },
  { featureType: "road",         elementType: "geometry.stroke", stylers: [{ color: "#1d2a3a" }] },
  { featureType: "road.highway", elementType: "geometry",        stylers: [{ color: "#3a4d63" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1d2a3a" }] },
  { featureType: "transit",      elementType: "geometry",        stylers: [{ color: "#2c3e50" }] },
  { featureType: "poi.park",     elementType: "geometry",        stylers: [{ color: "#1a3d2f" }] },
  { featureType: "water",        elementType: "geometry",        stylers: [{ color: "#0f1923" }] },
];

export const LIGHT_MAP_STYLE: object[] = [
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
