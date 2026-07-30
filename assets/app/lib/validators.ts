/**
 * Small validation helpers. Each returns `null` on success or a short
 * error message string. Empty input returns `null` (use `validateRequired`
 * for presence checks).
 */

type Validator = (v: string) => string | null;

const CURRENT_YEAR = new Date().getFullYear();

// VIN: 17 alphanumeric characters, excluding I, O, and Q (per ISO 3779).
export const validateVIN: Validator = (v) => {
  if (!v) return null;
  const s = v.toUpperCase();
  if (s.length !== 17) return "VIN must be exactly 17 characters";
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(s)) return "VIN contains invalid characters (no I, O, Q)";
  return null;
};

export const validateEmail: Validator = (v) => {
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address";
  return null;
};

// Lenient US phone: 10 digits after stripping non-digits.
export const validatePhone: Validator = (v) => {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) return "Enter a valid phone number";
  return null;
};

// 5 digits or 5+4 (e.g. 12345 or 12345-6789).
export const validateZip: Validator = (v) => {
  if (!v) return null;
  if (!/^\d{5}(-\d{4})?$/.test(v)) return "Enter a valid ZIP (12345 or 12345-6789)";
  return null;
};

// SSN: 9 digits, with or without dashes.
export const validateSSN: Validator = (v) => {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length !== 9) return "SSN must be 9 digits";
  return null;
};

export const validateUrl: Validator = (v) => {
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "URL must start with http:// or https://";
    return null;
  } catch {
    return "Enter a valid URL";
  }
};

export const validatePositiveInt: Validator = (v) => {
  if (!v) return null;
  if (!/^\d+$/.test(v)) return "Enter a whole number";
  if (parseInt(v, 10) < 0) return "Must be zero or greater";
  return null;
};

// Year: 1900 through current year + 2 (allow near-future model years).
export const validateYear: Validator = (v) => {
  if (!v) return null;
  if (!/^\d{4}$/.test(v)) return "Enter a 4-digit year";
  const y = parseInt(v, 10);
  if (y < 1900 || y > CURRENT_YEAR + 2) return `Year must be between 1900 and ${CURRENT_YEAR + 2}`;
  return null;
};

// Date (YYYY-MM-DD from <input type="date">) that is today or later.
export const validateFutureDate: Validator = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Enter a valid date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return "Date must be today or later";
  return null;
};

export const validateRequired: Validator = (v) => {
  if (!v || !v.trim()) return "Required";
  return null;
};

// Compose multiple validators; returns the first non-null result.
export function combineValidators(...validators: Validator[]): Validator {
  return (v: string) => {
    for (const fn of validators) {
      const err = fn(v);
      if (err) return err;
    }
    return null;
  };
}

// Convenience: uppercase transform for VIN inputs.
export function upperCaseTransform(v: string): string {
  return v.toUpperCase();
}
