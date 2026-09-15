import type { WeatherForecast } from "../../lib/api";
import type { WeatherPreview } from "./BasicInfoSection";

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
    loc: condenseAddress(loc ?? ""),
    buckets: w.buckets.map(b => ({
      label:      b.label,
      temp:       `${Math.round(b.temp_f)}°F`,
      desc:       b.description,
      code:       b.code,
      rainChance: b.rain_chance,
    })),
  };
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
