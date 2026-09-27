import type { ElementType, ReactNode } from "react";
import {
  Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog, Sun,
} from "lucide-react";
import LoadMap, { type LoadMapPin, type LoadMapStop } from "./LoadMap";
import { ESTIMATED_NOTE } from "./routeSummary";
import { SectionNum, captionCls } from "../../lib/cells";
import { ScrollArea } from "../../lib/ui";

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
 * A weather card stacks up to two blocks, and a stop with an appointment
 * window shows both:
 *   • the window reading — one aggregate over the appointment hours, with the
 *     detail (precipitation, wind, humidity) that only those hours have;
 *   • the outlook — a horizontal strip of days, one cell per weekday.
 *
 * Blur/dim rules (per spec):
 *   Deadhead     — dim if no truck OR no pickup pin
 *   Loaded miles — dim if no pickup OR no delivery pin
 *
 * Stops and their forecasts arrive as matched lists rather than a named
 * pickup and delivery: a load may have several of each, and the map letters
 * them in travel order while the column beside it stacks one card per stop.
 * The strip underneath is unchanged either way — it measures the run end to
 * end, and a call in the middle is not a figure it reports.
 */
export interface BasicInfoSectionProps {
  /** Geocoded stops only, in travel order. A stop with no pin isn't drawn. */
  stops?: LoadMapStop[];
  truck?: LoadMapPin | null;

  /**
   * How many stops are still waiting on an address. The mileage covers every
   * stop, so one unplaced call in the middle leaves the whole route
   * unmeasurable — and a three-stop load missing its middle would otherwise
   * look exactly like a finished two-stop one.
   */
  stopsAwaitingAddress?: number;

  /** One weather card per stop, in the order they should be stacked. */
  weather?: StopWeather[];

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

  /**
   * Second lines under the figures: each leg's share of the trip, and the
   * clock time an ETA lands on. A duration answers "how long", and the next
   * question is always "so what time" — the pair belongs in one cell.
   */
  emptyShare?:    string | null;
  loadedShare?:   string | null;
  etaPickupAt?:   string | null;
  etaDeliveryAt?: string | null;

  /**
   * How the figures were measured, or null while there are none.
   */
  source?: "routed" | "estimated" | null;

  /**
   * Display name of the provider that measured them, as the pin shows it.
   * Comes from the integration catalog by way of the API, so a provider
   * added later names itself here without touching this component. Null
   * under the estimate — nothing answered, so there is nothing to credit.
   */
  provider?: string | null;
}

/** Compact weather bucket used by WeatherCard. Mirror of the backend shape. */
export interface WeatherBucket {
  label:       string;      // "Mon" for a day, "08:00–12:00" for a window
  /** Day buckets only — `YYYY-MM-DD`, for the cell's tooltip. */
  date?:       string | null;
  /** The same date as "9/28", for the cell caption beside the weekday. */
  dateShort?:  string | null;
  temp:        string; // "72°F"
  desc:        string; // "Overcast"
  code:        number;
  rainChance:  number; // 0..100
  /** Day buckets only: that day's own pair, not the whole preview's. */
  high?:       string | null; // "78°"
  low?:        string | null; // "56°"
  /** Preformatted; null on forecasts cached before these were collected. */
  wind?:       string | null; // "8 mph W"
  humidity?:   string | null; // "42%"
}

/** A weather card's worth of input: who it is for, and the reading itself. */
export interface StopWeather {
  /** "Pickup", "Delivery 2" — the stop's short label. */
  label: string;
  kind:  "pickup" | "delivery";
  data:  WeatherPreview | null;
}

export interface WeatherPreview {
  loc:     string;         // Short location caption
  /** The stop day's high and low — what the window reading is qualified by. */
  high?:   string | null;  // "78°"
  low?:    string | null;  // "56°"
  /** The appointment-hours reading; absent when the stop has no window. */
  window?: WeatherBucket | null;
  buckets: WeatherBucket[]; // the outlook, up to 4 days
}

export default function BasicInfoSection(props: BasicInfoSectionProps) {
  const stops   = props.stops   ?? [];
  const weather = props.weather ?? [];

  const hasTruck    = !!props.truck;
  const hasPickup   = stops.some(s => s.kind === "pickup");
  const hasDelivery = stops.some(s => s.kind === "delivery");
  const awaiting    = props.stopsAwaitingAddress ?? 0;
  const source      = props.source ?? null;
  const est         = source === "estimated";

  const emptyDim  = !hasTruck  || !hasPickup;
  const loadedDim = !hasPickup || !hasDelivery || awaiting > 0;

  // Name what is actually missing. "Pickup & delivery required" on a load that
  // has both, and is only short the address of the call between them, sends
  // the dispatcher to look at the wrong two sections.
  const loadedHint = awaiting > 0
    ? `${awaiting} stop${awaiting === 1 ? "" : "s"} awaiting address`
    : "Pickup & delivery required";

  // Map, weather and the strip are separate cards rather than panels of one
  // box: they answer different questions (where it goes, what it'll be like,
  // what it costs in miles and hours) and the gaps let each be read on its own.
  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Map card — hosts the floating section label. */}
        <div className={`relative ${props.aside ? "lg:col-span-6" : "lg:col-span-8"} min-h-[300px] bg-card border border-border rounded-lg overflow-hidden`}>
          {/* Floating "① Route Overview" chip over the map's top-left. */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card/95 backdrop-blur-sm border border-border shadow-sm">
            <SectionNum n={1} />
            <span className="font-semibold text-foreground text-[length:var(--cell-title-fs)]">Route Overview</span>
          </div>
          <LoadMap stops={stops} truck={props.truck} />
        </div>

        {/* Weather — one card per stop, so no two forecasts read as one.

            `h-0` with `min-h-full` is what keeps this column the same height
            as the map: zero height means it adds nothing to the row, so the
            row is sized by the map alone, and the minimum then stretches the
            column back over exactly that. It reads as a contradiction and is
            the standard way to say "match the row, never drive it".

            It replaced a fixed max-height, which had to guess the row and
            guessed low — two empty cards stopped short of the map and left a
            gap under them. Tying the cap to the real row removes the guess:
            however tall the map ends up, the cards fill it and no further.

            Past three or four stops the cards overrun that height and scroll
            rather than dragging the map up to a wall. Both only apply from
            lg, where the column sits beside the map; stacked on a narrow
            screen the cards run on and the page scrolls.

            ScrollArea for the edge fades — the same ones under the driver
            list — because a card clipped by a hard edge reads as a card that
            was laid out badly, where one fading out reads as a list with more
            in it. Fading into `background`, not `card`: this column is laid
            straight onto the page, with the cards as its contents. */}
        <div className={`${props.aside ? "lg:col-span-3" : "lg:col-span-4"} flex flex-col min-h-0 lg:h-0 lg:min-h-full`}>
          {/* The column lives on ScrollArea's own content wrapper, not on a
              div inside it. That wrapper has no height of its own, so a
              `min-h-full` one level further in measured against `auto` and
              collapsed — the cards kept their natural height and left a gap
              under them however tall the map got. Styling the wrapper puts
              the percentage against the scroller, which does have one. */}
          <ScrollArea
            fadeFrom="background"
            fadeHeight={20}
            contentClassName="flex flex-col gap-3 min-h-full"
          >
            {weather.map((w, i) => (
              <WeatherCard
                key={i}
                label={w.label}
                accent={w.kind === "pickup" ? "text-emerald-500" : "text-red-500"}
                data={w.data}
                awaitingHint={`Awaiting ${w.label.toLowerCase()} date & address`}
              />
            ))}
          </ScrollArea>
        </div>

        {props.aside && (
          <div className="lg:col-span-3 bg-card border border-border rounded-lg overflow-hidden">{props.aside}</div>
        )}
      </div>

      {/* KPI strip — its own full-width card under the three above.

          Every cell draws its own top and left rule and the grid is shifted a
          pixel up and left, so the card's own border clips the outermost ones.
          That way the dividers land correctly at six, three and two columns
          without a per-breakpoint nth-child rule for each wrap point. */}
      <div className="relative">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 -ml-px -mt-px">
            <Kpi dot="#3b82f6" label="Deadhead"        value={props.emptyMiles}    dim={emptyDim}  hint={emptyDim  ? "Truck & pickup required" : props.emptyShare} />
            <Kpi dot="#10b981" label="Loaded Miles"    value={props.loadedMiles}   dim={loadedDim} hint={loadedDim ? loadedHint : props.loadedShare} />
            <Kpi dot="#a855f7" label="Total Miles"     value={props.totalMiles} />
            <Kpi dot="#f59e0b" label="Total Duration"  value={props.totalDuration} />
            <Kpi dot="#0ea5e9" label="ETA to Pickup"   value={props.etaToPickup}   hint={props.etaPickupAt} />
            <Kpi dot="#ef4444" label="ETA to Delivery" value={props.etaToDelivery} hint={props.etaDeliveryAt} />
          </div>
        </div>

        {/* Where these six numbers came from, pinned to the card's top rule.
            A row of its own cost a band of height to carry one short phrase;
            straddling the border it reads as a tag on the strip and takes none.

            Outside the card because that clips its overflow — the pin has to
            hang half above the edge to sit on the line. */}
        {source && (
          <span
            // Typography copied off captionCls rather than reusing it: that
            // constant carries text-muted-foreground, and two colour
            // utilities on one element are settled by stylesheet order, not
            // by which is written last here.
            className={`absolute top-0 right-3 -translate-y-1/2 flex items-center gap-1.5
                        rounded-full border bg-card px-2 py-0.5
                        text-[length:var(--cell-label-fs)] font-mono font-medium uppercase tracking-[0.08em]
                        ${est ? "border-amber-500/40 text-amber-500" : "border-border text-emerald-400"}`}
            title={est ? ESTIMATED_NOTE : `Measured by ${props.provider}.`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: est ? "#f59e0b" : "#10b981" }}
            />
            {/* The provider names itself. Falling back to "Approximate"
                rather than to a provider name keeps the pin honest if a
                routed answer ever arrives without one. */}
            {!est && props.provider ? props.provider : "Approximate"}
          </span>
        )}
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
    // flex-auto, not flex-1: flex-1 bases the card at 0 and lets it shrink to
    // the min-height below, which a window reading stacked over the outlook
    // overruns — the strip spilled past the card and under its neighbour.
    // Basing on content means the card asks for the height it needs and the
    // grid row grows to it, and the card still stretches into spare space.
    <div className="flex-auto bg-card border border-border rounded-lg p-3.5 flex flex-col min-h-[140px]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className={`${captionCls} ${accent} flex items-center gap-1.5`}>
          <CloudSun size={13} className="flex-shrink-0" />
          {label} Weather
        </div>
        {data && data.loc && (
          <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground truncate max-w-[55%]" title={data.loc}>
            {data.loc}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {!data || (!data.window && data.buckets.length === 0)
          ? <div className="text-xs text-muted-foreground opacity-70">{awaitingHint}</div>
          : (
            <>
              {data.window && <SingleReading b={data.window} high={data.high} low={data.low} />}
              {data.buckets.length > 0 && (
                // The rule only earns its place when there is something above
                // it to separate; on a stop with no window the strip is the
                // whole card and a line across the top would be decoration.
                <div className={data.window ? "mt-3 pt-3 border-t border-border/60" : undefined}>
                  <DayStrip buckets={data.buckets} />
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}

/**
 * The headline reading on the left, the numbers that qualify it on the right.
 *
 * Temperature alone doesn't tell a dispatcher whether to worry — 72°F with a
 * 60% chance of rain and a 30 mph crosswind is a different day from 72°F and
 * clear. Each detail line renders only when the forecast carried it, so a
 * response cached before these were collected degrades to just the headline.
 */
function SingleReading({ b, high, low }: {
  b: WeatherBucket;
  high?: string | null;
  low?:  string | null;
}) {
  const Icon = iconForCode(b.code);
  const hiLo = high || low ? `H: ${high ?? "—"}   L: ${low ?? "—"}` : null;

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Headline: the glyph, the number, and the word for it. */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon size={38} className={`${iconColorForCode(b.code)} flex-shrink-0`} />
        <div className="min-w-0">
          <div className="text-2xl font-semibold text-foreground leading-none tracking-tight">{b.temp}</div>
          <div className="text-xs text-muted-foreground mt-1 truncate">{b.desc}</div>
          {b.label && (
            <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/70 mt-0.5 truncate">{b.label}</div>
          )}
        </div>
      </div>

      {/* The numbers that qualify it — left-aligned as a block so the labels
          line up with each other rather than with the card's edge. */}
      <div className="flex flex-col gap-1 text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground flex-shrink-0">
        {hiLo && <span className="text-foreground/80">{hiLo}</span>}
        <Detail label="Precipitation" value={`${b.rainChance}%`} tone={b.rainChance > 0 ? "text-sky-500" : undefined} />
        <Detail label="Wind"     value={b.wind} />
        <Detail label="Humidity" value={b.humidity} />
      </div>
    </div>
  );
}

function Detail({ label, value, tone }: {
  label: string;
  value?: string | null;
  tone?:  string;
}) {
  if (!value) return null;

  return (
    <span>
      {label}: <span className={tone ?? "text-foreground/80"}>{value}</span>
    </span>
  );
}

/**
 * The outlook — one cell per day, starting at the stop's own date.
 *
 * A stop is a day on a schedule, so what a dispatcher needs is which way the
 * weather is heading over the run: whether to move the appointment, or warn
 * the driver. Splitting the single stop day into morning and night could not
 * show that, because it never looked past the date.
 *
 * Four lines per cell, same as the strip it replaces, so the card keeps the
 * height it holds beside the map.
 */
function DayStrip({ buckets }: { buckets: WeatherBucket[] }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>
      {buckets.map(b => {
        const Icon = iconForCode(b.code);
        return (
          <div
            key={b.date ?? b.label}
            className="flex flex-col items-center gap-0.5 rounded border border-border/60 bg-muted/20 py-1.5 px-1"
            title={b.date ? `${b.label} ${b.date} — ${b.desc}` : b.desc}
          >
            {/* Weekday and date share a line: the card can now carry a window
                reading above the strip, so a fifth row per cell is height the
                section does not have to spend. */}
            <div className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-[0.08em] truncate max-w-full">
              {b.label}
              {b.dateShort && (
                <span className="ml-1 tracking-normal text-muted-foreground/60">{b.dateShort}</span>
              )}
            </div>
            <Icon size={16} className={iconColorForCode(b.code)} />
            {/* High leads — it's the figure read first — and the low trails it
                dimmed rather than on its own line, so the pair still fits the
                cell at its narrowest: the control page's 3-column rail. */}
            <div className="text-[11px] font-mono font-semibold text-foreground leading-none whitespace-nowrap">
              {b.high ?? b.temp}
              {b.low && <span className="text-muted-foreground font-normal">/{b.low}</span>}
            </div>
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

/**
 * One figure in the strip. The dot is the whole marker — an icon beside it
 * said the same thing twice, and six label rows each carrying two glyphs
 * crowded out the numbers they were labelling.
 */
function Kpi({ dot, label, value, dim, hint }: {
  dot:  string;
  label: string;
  value?: string | null;
  dim?:   boolean;
  hint?:  string | null;
}) {
  return (
    <div className={`px-[var(--cell-px)] py-3 border-l border-t border-border ${dim ? "opacity-40" : ""}`}>
      <div className={`${captionCls} flex items-center gap-1.5`}>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
        {label}
      </div>
      <div className="text-lg font-semibold text-foreground mt-1 leading-tight">
        {value ?? "—"}
      </div>
      {hint && <div className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/70 mt-0.5">{hint}</div>}
    </div>
  );
}
