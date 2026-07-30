/**
 * Input masks. Each function takes an arbitrary string (raw or partially
 * formatted) and returns the display value. They strip everything that isn't
 * a digit, then reinsert delimiters — so they're idempotent and safe to apply
 * both on keystroke and on load.
 */

/** `(555) 123-4567` — US phone. Caps at 10 digits. */
export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** `123-45-6789` — SSN. Caps at 9 digits. */
export function maskSSN(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** `12345` or `12345-6789` — auto-inserts the dash once user types past 5 digits. */
export function maskZip(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 9);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
