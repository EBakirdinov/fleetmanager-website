/**
 * Single source of truth for role labels and colors.
 *
 * These mirror the constants in the API's `App\Entity\User` — keep the two in
 * sync. ROLE_SUPER_ADMIN is deliberately absent: it is internal and the API
 * refuses to assign it.
 */

export interface RoleDef {
  label: string;
  color: string;
}

export const ROLE_MAP: Record<string, RoleDef> = {
  ROLE_OWNER:      { label: "Owner",      color: "#f59e0b" },
  ROLE_MANAGER:    { label: "Manager",    color: "#0ea5e9" },
  ROLE_DISPATCHER: { label: "Dispatcher", color: "#14b8a6" },
  // Legacy — carried over from the original product. Still rendered so existing
  // rows read correctly, but no longer offered when assigning a role.
  ROLE_PARTNER:    { label: "Partner",    color: "#10b981" },
  ROLE_USER:       { label: "User",       color: "#8b5cf6" },
};

/** Assignable on the Workers page, most privileged first. Mirrors User::ASSIGNABLE_ROLES. */
export const ASSIGNABLE_ROLES = ["ROLE_OWNER", "ROLE_MANAGER", "ROLE_DISPATCHER"];

/** The role a new worker gets when none is chosen — the least privileged one. */
export const DEFAULT_ROLE = "ROLE_DISPATCHER";

/** A role still held by existing rows but no longer offered (ROLE_USER, ROLE_PARTNER). */
export function isLegacyRole(role: string): boolean {
  return role in ROLE_MAP && !ASSIGNABLE_ROLES.includes(role);
}

/** Who may open the Workers page and manage workers. */
export const WORKER_ADMIN_ROLES = ["ROLE_OWNER", "ROLE_MANAGER"];

/** The most privileged role a user holds, or null if they hold none we know. */
export function primaryRole(roles: string[] | null | undefined): string | null {
  if (!roles || roles.length === 0) return null;
  for (const role of ASSIGNABLE_ROLES) {
    if (roles.includes(role)) return role;
  }
  return roles.find(r => r in ROLE_MAP) ?? null;
}

export function roleLabel(roles: string[] | null | undefined): string {
  const role = primaryRole(roles);
  return role ? ROLE_MAP[role].label : "Member";
}
