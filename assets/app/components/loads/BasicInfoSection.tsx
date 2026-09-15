import type { ElementType, ReactNode } from "react";
import {
  Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog, Sun,
  Droplets, Route, Truck, Clock, ArrowRight,
} from "lucide-react";
import LoadMap, { type LoadMapPin } from "./LoadMap";
import { SectionNum, captionCls } from "../../lib/cells";

/**
 * Section 1 (Basic Info) on Load Add / Edit pages.
 *
 * Layout B:
 *   ┌─────────────────────────────┬──────────────────┐
 *   │                             │  Pickup weather  │
 *   │       LoadMap  (8/12)       ├──────────────────┤
 *   │                             │  Delivery wxr    │
 *   ├─────────────────────────────┴──────────────────┤
 *   │   6-cell KPI strip                             │
 *   └────────────────────────────────────────────────┘
 *
 * Weather cards render two ways depending on the number of buckets in the
 * WeatherPreview:
 *   • 1 bucket — a single window-aggregated reading (temp, condition, rain%).
 *   • >1 bucket — a horizontal strip of time-of-day slots.
 *
 * Blur/dim rules (per spec):
 *   Empty miles  — dim if no truck OR no pickup pin
 *   Loaded miles — dim if no pickup OR no delivery pin
 */
export interface BasicInfoSectionProps {
  pickup?:   LoadMapPin | null;
  delivery?: LoadMapPin | null;
  truck?:    LoadMapPin | null;

  pickupWeather?:   WeatherPreview | null;
  deliveryWeather?: WeatherPreview | null;

  /**
   * Optional right-hand panel. The control page puts the status rail here so
   * the map, the weather and the load's progress read as one "state of this
   * run" band, instead of the rail sitting alone as its own numbered section.
   */
  aside?: ReactNode;

  /** KPI values — all optional, render as "—" when absent. */
  emptyMiles?:    string | null;
  loadedMiles?:   string | null;
  totalMiles?:    string | null;
  totalDuration?: string | null;
  etaToPickup?:   string | null;
  etaToDelivery?: string | null;
}

/** Compact weather bucket used by WeatherCard. Mirror of the backend shape. */
export interface WeatherBucket {
  label:       string;
  temp:        string; // "72°F"
  desc:        string; // "Overcast"
  code:        number;
  rainChance:  number; // 0..100
}

export interface WeatherPreview {
  loc:     string;         // Short location caption
  buckets: WeatherBucket[]; // 1 for window, 4 for day breakdown
}

export default function BasicInfoSection(props: BasicInfoSectionProps) {
  const hasTruck    = !!props.truck;
  const hasPickup   = !!props.pickup;
  const hasDelivery = !!props.delivery;

  const emptyDim  = !hasTruck  || !hasPickup;
  const loadedDim = !hasPickup || !hasDelivery;

  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-12">
        {/* Map area — hosts the floating section label. */}
        <div className={`relative ${props.aside ? "col-span-6" : "col-span-8"} min-h-[260px] border-r border-border`}>
          {/* Floating "① Route Overview" chip over the map's top-left. */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-sm border border-border shadow-sm">
            <SectionNum n={1} />
            <span className="font-semibold text-foreground text-[length:var(--cell-title-fs)]">Route Overview</span>
          </div>
          <LoadMap pickup={props.pickup} delivery={props.delivery} truck={props.truck} />
        </div>

        {/* Weather stack */}
        <div className={`${props.aside ? "col-span-3" : "col-span-4"} flex flex-col divide-y divide-border`}>
          <WeatherCard label="Pickup"   accent="text-emerald-500" data={props.pickupWeather   ?? null} awaitingHint="Awaiting pickup date & address" />
          <WeatherCard label="Delivery" accent="text-red-500"     data={props.deliveryWeather ?? null} awaitingHint="Awaiting delivery date & address" />
        </div>

        {props.aside && (
          <div className="col-span-3 border-l border-border">{props.aside}</div>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-6 border-t border-border">
        <Kpi icon={Route}    dot="#3b82f6" label="Empty Miles"     value={props.emptyMiles}    dim={emptyDim}  hint={emptyDim  ? "Truck & pickup required" : undefined} />
        <Kpi icon={Route}    dot="#10b981" label="Loaded Miles"    value={props.loadedMiles}   dim={loadedDim} hint={loadedDim ? "Pickup & delivery required" : undefined} />
        <Kpi icon={Route}    dot="#a855f7" label="Total Miles"     value={props.totalMiles} />
        <Kpi icon={Clock}    dot="#f59e0b" label="Total Duration"  value={props.totalDuration} />
        <Kpi icon={ArrowRight} dot="#0ea5e9" label="ETA to Pickup"   value={props.etaToPickup} />
        <Kpi icon={Truck}    dot="#ef4444" label="ETA to Delivery" value={props.etaToDelivery} />
      </div>
    </section>
  );
}

// ─── Weather card (single-reading OR mini-strip) ─────────────────────────────

function WeatherCard({ label, accent, data, awaitingHint }: {
  label: string;
  accent: string;
  data: WeatherPreview | null;
  awaitingHint: string;
}) {
  return (
    <div className="flex-1 p-3 flex flex-col justify-center min-h-[128px]">
      <div className="flex items-center justify-between mb-2">
        <div className={`${captionCls} ${accent}`}>
          {label} Weather
        </div>
        {data && data.loc && (
          <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground truncate ml-2 max-w-[60%]" title={data.loc}>
            {data.loc}
          </div>
        )}
      </div>

      {!data
        ? <div className="text-xs text-muted-foreground opacity-70">{awaitingHint}</div>
        : data.buckets.length === 1
          ? <SingleReading b={data.buckets[0]} />
          : <BucketStrip buckets={data.buckets} />}
    </div>
  );
}

function SingleReading({ b }: { b: WeatherBucket }) {
  const Icon = iconForCode(b.code);
  return (
    <div className="flex items-center gap-3">
      <Icon size={32} className={iconColorForCode(b.code)} />
      <div className="min-w-0">
        <div className="text-lg font-semibold text-foreground leading-none">{b.temp}</div>
        <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground mt-0.5 truncate">{b.desc}</div>
        {b.label && (
          <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/80 mt-0.5">{b.label}</div>
        )}
        {b.rainChance > 0 && (
          <div className="text-[10px] font-mono text-sky-500 mt-0.5 flex items-center gap-1">
            <Droplets size={10} /> {b.rainChance}%
          </div>
        )}
      </div>
    </div>
  );
}

function BucketStrip({ buckets }: { buckets: WeatherBucket[] }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>
      {buckets.map(b => {
        const Icon = iconForCode(b.code);
        return (
          <div key={b.label} className="flex flex-col items-center gap-0.5 rounded border border-border/60 bg-muted/20 py-1.5 px-1">
            <div className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-[0.08em] truncate max-w-full" title={b.label}>{b.label}</div>
            <Icon size={16} className={iconColorForCode(b.code)} />
            <div className="text-[11px] font-mono font-semibold text-foreground">{b.temp}</div>
            {b.rainChance > 0 && (
              <div className="text-[9px] font-mono text-sky-500 leading-none">💧{b.rainChance}%</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Map an Open-Meteo WMO weather code to a lucide icon. Descriptions map is
 * on the backend; the frontend just picks the visual.
 */
function iconForCode(code: number): ElementType {
  if (code === 0)                    return Sun;
  if (code >= 1 && code <= 2)        return CloudSun;
  if (code === 3)                    return Cloud;
  if (code === 45 || code === 48)    return CloudFog;
  if (code >= 51 && code <= 67)      return CloudRain;
  if (code >= 71 && code <= 77)      return CloudSnow;
  if (code >= 80 && code <= 82)      return CloudRain;
  if (code >= 85 && code <= 86)      return CloudSnow;
  if (code >= 95)                    return CloudLightning;
  return Cloud;
}

function iconColorForCode(code: number): string {
  if (code === 0)                    return "text-amber-400";
  if (code >= 1 && code <= 2)        return "text-amber-400";
  if (code === 3)                    return "text-slate-400";
  if (code === 45 || code === 48)    return "text-slate-400";
  if (code >= 51 && code <= 67)      return "text-sky-500";
  if (code >= 71 && code <= 77)      return "text-sky-300";
  if (code >= 80 && code <= 82)      return "text-sky-500";
  if (code >= 85 && code <= 86)      return "text-sky-300";
  if (code >= 95)                    return "text-purple-500";
  return "text-muted-foreground";
}

function Kpi({ icon: Icon, dot, label, value, dim, hint }: {
  icon: ElementType;
  dot:  string;
  label: string;
  value?: string | null;
  dim?:   boolean;
  hint?:  string;
}) {
  return (
    <div className={`px-[var(--cell-px)] py-[var(--cell-py)] border-l border-border first:border-l-0 ${dim ? "opacity-40" : ""}`}>
      <div className={`${captionCls} flex items-center gap-1.5`}>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
        <Icon size={11} className="text-muted-foreground flex-shrink-0" />
        {label}
      </div>
      <div className="text-[length:var(--cell-fs)] font-semibold text-foreground font-mono mt-1">
        {value ?? "—"}
      </div>
      {hint && <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/70 mt-0.5">{hint}</div>}
    </div>
  );
}
