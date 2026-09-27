import type { ElementType } from "react";
import { WORKER_ADMIN_ROLES } from "./roles";
import {
  Home, Truck, Container, Users, Package, Fuel, BarChart3, FileText,
  Building2, User2, Plug, UserCog, Settings, Lock, CreditCard,
} from "lucide-react";

export interface NavEntry {
  path: string;
  label: string;
  title: string;
  sub: string;
  icon: ElementType;
  badge?: number;
  /** Roles allowed to see this entry. Omit to show it to everyone. */
  roles?: string[];
}

export interface NavSection {
  label: string;
  items: NavEntry[];
}

export const navSections: NavSection[] = [
  {
    label: "Fleet",
    items: [
      { path: "/dashboard", label: "Dashboard", title: "Dashboard",  sub: "Fleet overview and key metrics",                          icon: Home    },
      { path: "/drivers",   label: "Drivers",   title: "Drivers",    sub: "Manage your drivers and keep all information up to date",  icon: Users   },
      { path: "/trucks",    label: "Trucks",    title: "Trucks",     sub: "Manage your trucks and keep all information up to date",   icon: Truck   },
      { path: "/trailers",  label: "Trailers",  title: "Trailers",   sub: "Manage your trailers and keep all information up to date", icon: Container },
      { path: "/loads",     label: "Loads",     title: "Loads",      sub: "Track loads and assign them to drivers",                  icon: Package },
    ],
  },
  // {
  //   label: "Operations",
  //   items: [
  //     { path: "/fuel",      label: "Fuel",      title: "Fuel",       sub: "Track fuel usage and expenses across the fleet",           icon: Fuel      },
  //     { path: "/reports",   label: "Reports",   title: "Reports",    sub: "Generate and download fleet reports",                      icon: BarChart3 },
  //     { path: "/documents", label: "Documents", title: "Documents",  sub: "Manage fleet documents, permits and compliance files",     icon: FileText  },
  //   ],
  // },
  {
    label: "Manage",
    items: [
      { path: "/workers",  label: "Users & Access",  title: "Users & Access",  sub: "Manage who can access your account and what they can do", icon: UserCog, roles: WORKER_ADMIN_ROLES },
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
  { path: "/settings/company",      label: "Company",      title: "Company",      sub: "Organization profile, contact details and address",     icon: Building2, roles: WORKER_ADMIN_ROLES },
  { path: "/settings/integrations", label: "Integrations", title: "Integrations", sub: "Connect Google Maps, ELD providers, and other services", icon: Plug,     roles: ["ROLE_OWNER"] },
  { path: "/settings/billing",      label: "Billing",      title: "Billing",      sub: "Your current plan and when it renews",                   icon: CreditCard, roles: WORKER_ADMIN_ROLES },
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
