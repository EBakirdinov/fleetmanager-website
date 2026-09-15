import { documentUrl, type CompanyData, type User } from "./api";

/**
 * How a person and their company are named and pictured across the app.
 *
 * These used to exist four times over — once each in Sidebar, TopBar, Account
 * and inline in Company — which is how the sidebar and the Account page ended
 * up deriving initials by different rules for the same user.
 */

/** Anything with a name, so the shell can call these before the session resolves. */
type Named = {
  firstName?: string | null;
  lastName?:  string | null;
  email?:     string | null;
} | null | undefined;

/** Two letters for an avatar: initials, or the first of the email, or "?". */
export function initialsOf(user: Named): string {
  if (!user) return "?";
  const first = (user.firstName ?? "").trim();
  const last  = (user.lastName  ?? "").trim();
  if (first || last) return (first.slice(0, 1) + last.slice(0, 1)).toUpperCase();
  const email = (user.email ?? "").trim();
  return email ? email.slice(0, 2).toUpperCase() : "?";
}

/** Full name, falling back to the email — never an empty string. */
export function displayName(user: Named): string {
  if (!user) return "Signed out";
  const name = [(user.firstName ?? "").trim(), (user.lastName ?? "").trim()]
    .filter(Boolean)
    .join(" ");
  return name || (user.email ?? "").trim() || "Signed in";
}

/** Up to two letters for a company tile, from its name. */
export function companyInitials(company: CompanyData | null | undefined): string {
  const initials = (company?.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "CO";
}

export type ImageSize = "60x60" | "200x200" | "400x400" | "full";

/** The user's uploaded avatar, or null when they have not set one. */
export function avatarUrl(
  user: User | null | undefined,
  imagesHost: string | null | undefined,
  size: ImageSize = "200x200",
): string | null {
  if (!imagesHost) return null;
  return documentUrl(imagesHost, "users", user?.imageHash, size);
}

/** The company's uploaded logo, or null when it has not set one. */
export function companyLogoUrl(
  company: CompanyData | null | undefined,
  imagesHost: string | null | undefined,
  size: ImageSize = "200x200",
): string | null {
  if (!imagesHost) return null;
  return documentUrl(imagesHost, "companies", company?.imageHash, size);
}
