/**
 * Effective permissions for the signed-in user.
 *
 * Mirrors App\Security\Permission\PermissionCatalog in the API the way
 * roles.ts mirrors App\Entity\User — keep the module list in sync.
 *
 * The payload arrives on the user from GET /api/session/me, which the BFF
 * fills from the API's /self/info. Note the BFF camelizes object keys on the
 * way through (snakeToCamelKeys), which is why the API sends `modules` as a
 * list carrying its module name in a `key` field: as a value it survives, as a
 * map key "rate_analytics" would have arrived as "rateAnalytics".
 *
 * The API is the enforcement point. Everything here is about not showing
 * people doors that will not open.
 */

import type { User } from "./api";

/** Page access levels, least to most privileged. */
export type Level = "none" | "view" | "manage" | "full" | "custom";

/** Row-level reach. Only "all" is meaningful until the driver portal exists. */
export type Scope = "all" | "assigned" | "own";

export interface ModulePermissions {
  key: string;
  level: Level;
  scope: Scope;
  /** Action and field keys held, without the module prefix. */
  actions: string[];
}

export interface EffectivePermissions {
  modules: ModulePermissions[];
  /** Every key held, module-prefixed: "loads.delete". */
  keys: string[];
}

/** Module keys, matching PermissionCatalog::MODULES. */
export const MODULES = {
  dashboard: "dashboard",
  loads: "loads",
  dispatch: "dispatch",
  brokers: "brokers",
  drivers: "drivers",
  trucks: "trucks",
  trailers: "trailers",
  maintenance: "maintenance",
  expenses: "expenses",
  compliance: "compliance",
  documents: "documents",
  rateAnalytics: "rate_analytics",
  reports: "reports",
  billing: "billing",
  settlements: "settlements",
  employeePayments: "employee_payments",
  employeeRetention: "employee_retention",
  users: "users",
  settings: "settings",
  integrations: "integrations",
} as const;

const LEVEL_RANK: Record<string, number> = {
  none: 0,
  view: 1,
  manage: 2,
  full: 3,
  // A customised module has at least something; ranking it with view keeps
  // "can they open the page" true while leaving individual actions to can().
  custom: 1,
};

function permissionsOf(user: User | null): EffectivePermissions | null {
  const raw = (user as { effectivePermissions?: EffectivePermissions } | null)?.effectivePermissions;
  if (!raw || !Array.isArray(raw.modules) || !Array.isArray(raw.keys)) return null;
  return raw;
}

/** Super admins bypass the permission set entirely, as they do server-side. */
function isSuperAdmin(user: User | null): boolean {
  return (user?.roles ?? []).includes("ROLE_SUPER_ADMIN");
}

/**
 * Whether the user holds a permission, named either module-prefixed
 * ("loads.delete") or as a module plus action (can(user, "loads", "delete")).
 */
export function can(user: User | null, key: string, action?: string): boolean {
  if (isSuperAdmin(user)) return true;

  const permissions = permissionsOf(user);
  if (!permissions) return false;

  const full = action ? `${key}.${action}` : key;
  return permissions.keys.includes(full);
}

export function moduleOf(user: User | null, module: string): ModulePermissions | null {
  const permissions = permissionsOf(user);
  if (!permissions) return null;
  return permissions.modules.find(m => m.key === module) ?? null;
}

export function levelOf(user: User | null, module: string): Level {
  if (isSuperAdmin(user)) return "full";
  return moduleOf(user, module)?.level ?? "none";
}

export function scopeOf(user: User | null, module: string): Scope {
  if (isSuperAdmin(user)) return "all";
  return moduleOf(user, module)?.scope ?? "all";
}

/** True when the module's level is at or above `level`. */
export function atLeast(user: User | null, module: string, level: Level): boolean {
  if (isSuperAdmin(user)) return true;
  return (LEVEL_RANK[levelOf(user, module)] ?? 0) >= (LEVEL_RANK[level] ?? 0);
}

/**
 * Whether a page should be hidden outright — the spec's "No Access — page is
 * hidden completely", as opposed to a page that opens read-only.
 *
 * Keyed off whether the module grants anything at all rather than off the
 * level, so a single per-user grant reaching into an otherwise-hidden module
 * reveals the page instead of hiding something the API would allow.
 */
export function isHidden(user: User | null, module: string): boolean {
  if (isSuperAdmin(user)) return false;

  const entry = moduleOf(user, module);
  if (!entry) return true;
  return entry.actions.length === 0;
}

/**
 * True once the permission payload has arrived.
 *
 * Distinguishes "this user genuinely has no access" from "we have not loaded
 * yet", so the navigation can avoid flashing an empty sidebar.
 */
export function hasPermissions(user: User | null): boolean {
  return isSuperAdmin(user) || permissionsOf(user) !== null;
}
