import type { ElementType } from "react";
import { Home, Truck, Container, Users, Fuel, BarChart3, FileText, Building2, User2, Plug } from "lucide-react";

export interface NavEntry {
  path: string;
  label: string;
  title: string;
  sub: string;
  icon: ElementType;
  badge?: number;
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
    label: "Settings",
    items: [
      { path: "/company",      label: "Company",      title: "Company",      sub: "Organization settings — owner access only",                             icon: Building2 },
      { path: "/integrations", label: "Integrations", title: "Integrations", sub: "Connect Google Maps, ELD providers, and other services",                icon: Plug      },
      { path: "/account",      label: "Account",      title: "Account",      sub: "Your profile, security and role settings",                              icon: User2     },
    ],
  },
];

export const navItems: NavEntry[] = navSections.flatMap(s => s.items);
