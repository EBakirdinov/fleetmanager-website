import type { ElementType } from "react";
import { MODULES } from "./permissions";
import {
  Home, Truck, Container, Users, Package, Fuel, BarChart3, FileText, Receipt, Wrench,
  Building2, User2, Plug, UserCog, UserCheck, Settings, Lock, CreditCard, Handshake,
} from "lucide-react";

export interface NavEntry {
  path: string;
  label: string;
  title: string;
  sub: string;
  icon: ElementType;
  badge?: number;
  /**
   * Permission module this page belongs to. Omit to show it to everyone.
   *
   * An entry is hidden when its module grants nothing at all, which is what
   * the spec means by "No Access — page is hidden completely". Replaces the
   * old `roles` list: access is a property of the page, not of a role name,
   * and a per-user grant has to be able to reveal a page without inventing a
   * new role.
   */
  module?: string;
}

export interface NavSection {
  label: string;
  items: NavEntry[];
}

export const navSections: NavSection[] = [
  {
    label: "Fleet",
    items: [
      { path: "/dashboard", label: "Dashboard", title: "Dashboard",  sub: "Fleet overview and key metrics",                          icon: Home, module: MODULES.dashboard    },
      { path: "/drivers",   label: "Drivers",   title: "Drivers",    sub: "Manage your drivers and keep all information up to date",  icon: Users, module: MODULES.drivers   },
      { path: "/trucks",    label: "Trucks",    title: "Trucks",     sub: "Manage your trucks and keep all information up to date",   icon: Truck, module: MODULES.trucks   },
      { path: "/trailers",  label: "Trailers",  title: "Trailers",   sub: "Manage your trailers and keep all information up to date", icon: Container, module: MODULES.trailers },
      { path: "/loads",     label: "Loads",     title: "Loads",      sub: "Track loads and assign them to drivers",                  icon: Package, module: MODULES.loads },
    ],
  },
  {
    label: "Operations",
    items: [
      { path: "/brokers",     label: "Brokers",     title: "Brokers & Customers", sub: "Who you haul for — contacts, terms, credit and performance", icon: Handshake, module: MODULES.brokers },
      { path: "/expenses",    label: "Expenses",    title: "Expenses",    sub: "Track and manage all expenses for your fleet",             icon: Receipt, module: MODULES.expenses },
      { path: "/maintenance", label: "Maintenance", title: "Maintenance", sub: "Service schedules, repair orders and vendor spend",        icon: Wrench, module: MODULES.maintenance },
      // Still stubs. Fuel is a category filter on Expenses for now; a
      // dedicated page earns its place once there is $/gal trend, MPG and
      // gallons-by-state to put on it.
      // { path: "/fuel",      label: "Fuel",      title: "Fuel",       sub: "Track fuel usage and expenses across the fleet",           icon: Fuel      },
      // { path: "/reports",   label: "Reports",   title: "Reports",    sub: "Generate and download fleet reports",                      icon: BarChart3 },
      // { path: "/documents", label: "Documents", title: "Documents",  sub: "Manage fleet documents, permits and compliance files",     icon: FileText  },
    ],
  },
  {
    label: "Manage",
    items: [
      { path: "/retention", label: "Retention", title: "Employee Retention", sub: "Keep your drivers, see who is leaving, and stay in touch", icon: UserCheck, module: MODULES.employeeRetention },
      { path: "/workers",  label: "Users & Access",  title: "Users & Access",  sub: "Manage who can access your account and what they can do", icon: UserCog, module: MODULES.users },
      { path: "/settings", label: "Settings", title: "Settings", sub: "Your account and your company",                           icon: Settings },
    ],
  },
];

/**
 * The Settings hub's own rail.
 *
 * Kept out of navSections because these are not sidebar destinations — the
 * sidebar carries one Settings entry and this is what sits inside it. They
 * share the NavEntry shape so TopBar can resolve a title from either list.
 */
export const settingsNav: NavEntry[] = [
  { path: "/settings/account",      label: "My account",   title: "My account",   sub: "Your name, photo and contact details",                  icon: User2     },
  { path: "/settings/security",     label: "Security",     title: "Security",     sub: "Change the password you sign in with",                  icon: Lock      },
  { path: "/settings/company",      label: "Company",      title: "Company",      sub: "Organization profile, contact details and address",     icon: Building2, module: MODULES.settings },
  { path: "/settings/integrations", label: "Integrations", title: "Integrations", sub: "Connect Google Maps, ELD providers, and other services", icon: Plug,     module: MODULES.integrations },
  { path: "/settings/billing",      label: "Billing",      title: "Billing",      sub: "Your current plan and when it renews",                   icon: CreditCard, module: MODULES.billing },
];

export const navItems: NavEntry[] = navSections.flatMap(s => s.items);

/**
 * Every addressable page, for title lookup.
 *
 * Longest path first so `/settings/company` resolves to the Company entry
 * rather than to the `/settings` entry it also prefix-matches.
 */
export const allNavEntries: NavEntry[] = [...navItems, ...settingsNav]
  .slice()
  .sort((a, b) => b.path.length - a.path.length);

/** The nav entry a pathname belongs to, or undefined for unknown routes. */
export function navEntryFor(pathname: string): NavEntry | undefined {
  return allNavEntries.find(n => pathname === n.path || pathname.startsWith(n.path + "/"));
}
