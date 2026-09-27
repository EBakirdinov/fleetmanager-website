import { useEffect, useState } from "react";
import { apiWeather, type WeatherForecast, type WeatherBucket as ApiBucket } from "../../lib/api";
import type { WeatherPreview, WeatherBucket as PreviewBucket } from "./BasicInfoSection";
import type { LoadMapPin } from "./LoadMap";
import type { StopEntry } from "./stops";

/**
 * Adapt the backend WeatherForecast into the shape BasicInfoSection's weather
 * card consumes — mostly formatting, plus condensing the location so it fits
 * the card header.
 *
 * Shared by the Add page and the control page: both show the same two cards
 * from the same endpoint, and a second copy of this would be a second place
 * for the formatting to drift.
 */
export function toWeatherPreview(
  w: WeatherForecast | null,
  loc: string | undefined,
): WeatherPreview | null {
  if (!w) return null;

  return {
    loc:  condenseAddress(loc ?? ""),
    // Optional: a response cached before these fields existed still renders,
    // just without the detail column.
    high: w.high_f == null ? null : `${Math.round(w.high_f)}°`,
    low:  w.low_f  == null ? null : `${Math.round(w.low_f)}°`,
    // Both go through the same formatter: an outlook day and the appointment
    // reading differ in which optional fields they carry, not in how any one
    // of them is written.
    window:  w.window ? toBucket(w.window) : null,
    buckets: w.buckets.map(toBucket),
  };
}

function toBucket(b: ApiBucket): PreviewBucket {
  return {
    label:      b.label,
    // Outlook days carry their own date and high/low; the window reading
    // carries neither and leans on the preview's top-level pair instead.
    date:       b.date ?? null,
    dateShort:  shortDate(b.date),
    temp:       `${Math.round(b.temp_f)}°F`,
    high:       b.high_f == null ? null : `${Math.round(b.high_f)}°`,
    low:        b.low_f  == null ? null : `${Math.round(b.low_f)}°`,
    desc:       b.description,
    code:       b.code,
    rainChance: b.rain_chance,
    wind:       b.wind_mph == null ? null : `${b.wind_mph} mph${b.wind_dir ? ` ${b.wind_dir}` : ""}`,
    humidity:   b.humidity == null ? null : `${b.humidity}%`,
  };
}

/**
 * "2026-09-28" → "9/28". Split rather than parsed: `new Date("2026-09-28")`
 * reads as UTC midnight, which is the day before in every US timezone, and a
 * weekday cell captioned with the wrong date is worse than none.
 *
 * No year — the cells span four days, so the month and day settle it.
 */
function shortDate(iso?: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");

  return m ? `${Number(m[2])}/${Number(m[3])}` : null;
}

/**
 * Pull "City, State" out of a typical formatted address ending in
 * "…, City, State ZIP, USA". Falls back to the raw string when the pattern
 * doesn't match — a hand-typed address is better shown whole than mangled.
 */
export function condenseAddress(loc: string): string {
  const parts = loc.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[parts.length - 3]}, ${parts[parts.length - 2].split(" ")[0]}`;
  }

  return loc;
}

// ─── Fetching ────────────────────────────────────────────────────────────────

/** What one stop needs asked of the weather endpoint. */
interface StopWeatherRequest {
  key:  string;
  lat:  number;
  lng:  number;
  date: string;
  from: string;
  to:   string;
  /** The caption the card shows — the typed address, or the geocoded one. */
  loc:  string;
}

/**
 * A forecast per stop, keyed by the stop's client key.
 *
 * One hook over the whole list rather than an effect per stop: the list is
 * variable-length now, and a loop of useEffect is not something React allows.
 * Requests are described first and serialized into the dependency, so the
 * effect re-runs when a stop's place, day or window actually changes and not
 * when something else on the page does.
 *
 * A stop only asks a question once it has both a pin and a date — the
 * endpoint answers a place on a day. Readings resolve independently rather
 * than through one Promise.all: a four-stop load shows each card as it lands
 * instead of all four after the slowest.
 *
 * Failures land as null, which the card reads as "nothing to show". Weather
 * is a garnish on a form the user is still filling in; it is not worth an
 * error banner.
 */
export function useStopsWeather(
  stops: StopEntry[],
  pins:  Record<string, LoadMapPin | null>,
): Record<string, WeatherPreview | null> {
  const [weather, setWeather] = useState<Record<string, WeatherPreview | null>>({});

  const requests: StopWeatherRequest[] = [];
  for (const stop of stops) {
    const pin = pins[stop.key];
    if (!pin || !stop.form.date) continue;
    requests.push({
      key:  stop.key,
      lat:  pin.lat,
      lng:  pin.lng,
      date: stop.form.date,
      from: stop.form.windowStart,
      to:   stop.form.windowEnd,
      loc:  stop.form.address || pin.label || "",
    });
  }
  const requestsKey = JSON.stringify(requests);

  useEffect(() => {
    let cancelled = false;
    const list: StopWeatherRequest[] = JSON.parse(requestsKey);
    const wanted = new Set(list.map(r => r.key));

    // Forget stops that have stopped asking — one removed from the run, or
    // one whose address was cleared — before the new answers arrive, so a
    // card doesn't go on showing a forecast for somewhere it no longer is.
    setWeather(prev => {
      const keys = Object.keys(prev);
      if (keys.every(k => wanted.has(k))) return prev;

      const kept: Record<string, WeatherPreview | null> = {};
      for (const k of keys) if (wanted.has(k)) kept[k] = prev[k];

      return kept;
    });

    for (const r of list) {
      apiWeather(r.lat, r.lng, r.date, r.from, r.to)
        .then(w => {
          if (!cancelled) setWeather(prev => ({ ...prev, [r.key]: toWeatherPreview(w, r.loc) }));
        })
        .catch(() => {
          if (!cancelled) setWeather(prev => ({ ...prev, [r.key]: null }));
        });
    }

    return () => { cancelled = true; };
  }, [requestsKey]);

  return weather;
}
