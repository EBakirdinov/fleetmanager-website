import { useState, useEffect } from "react";
import { apiProxy } from "./api";

export interface StateOption { value: string; label: string; }

export interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'checkbox';
  required: boolean;
  /**
   * Starting value for a field the company hasn't saved yet. Only meaningful
   * for checkbox — credentials always start empty.
   */
  default?: boolean;
  /** Shown under the field. Says what turning it off actually costs. */
  hint?: string;
}

// IntegrationProbeResult lives in ./api — this module imports from there, so
// the type has to sit on that side of the dependency to stay acyclic.

export interface IntegrationDef {
  slug: string;
  name: string;
  type: string;
  iconUrl?: string | null;
  fields: IntegrationField[];
  /**
   * Resources this integration can import (e.g. ["trucks", "drivers"]).
   * The catalog is the source of truth — ImportDropdown hides the button
   * on pages whose resource isn't in this list.
   */
  imports?: string[];
  /**
   * True when a company may hold only one connected provider of this `type`
   * (today: ELDs). Set by the API from its own list, so switching a type on
   * or off never needs a change here.
   */
  exclusive?: boolean;
}

export interface RefData {
  states: StateOption[];
  colors: string[];
  truckFuelTypes: string[];
  truckTransmissions: string[];
  truckCabTypes: string[];
  truckSleeperSizes: string[];
  truckEngineTypes: string[];
  loadTypes: string[];
  /**
   * broker / shipper / 3pl, from App\Entity\Broker::TYPES. Served rather
   * than restated here for the same reason as the ledger's sets below —
   * BrokerType coerces anything outside the list back to "broker", so a
   * local copy would silently offer a value the API throws away.
   */
  brokerTypes: string[];
  trailerTypes: string[];
  trailerDoorTypes: string[];
  trailerRoofTypes: string[];
  trailerFloorTypes: string[];
  trailerSideMaterials: string[];
  trailerFrontMaterials: string[];
  driverTypes: string[];
  driverPayTypes: string[];
  driverLicenseTypes: string[];
  /**
   * The ledger's closed sets, served by the API rather than restated here.
   * App\Entity\Expense is the authority on what a valid category is; a copy
   * in this file would drift the first time one is added and the API would
   * start rejecting values this UI had offered.
   */
  expenseCategories: string[];
  expensePaymentMethods: string[];
  expenseReviewStatuses: string[];
  maintenanceKinds: string[];
  maintenanceStates: string[];
  maintenanceServiceTypes: string[];
  /** Why a driver left, for the retention page's Past Drivers tab. */
  driverSeparationReasons: string[];
  communicationChannels: string[];
  communicationAudiences: string[];
  integrations: IntegrationDef[];
  /** CDN base for uploaded assets. Used to build thumbnail URLs from hashes. */
  imagesHost: string;
}

// Module-level cache — fetched once, shared across all hook instances
let cache: RefData | null = null;
let pending: Promise<RefData> | null = null;

export async function apiGetRefData(): Promise<RefData> {
  if (cache) return cache;
  if (!pending) {
    // API wraps everything in {outcome, data} — unwrap here.
    pending = apiProxy<{ outcome: string; data: RefData }>("data")
      .then(res => { cache = res.data; return res.data; })
      .catch(e => { pending = null; throw e; });
  }
  return pending;
}

export function useRefData(): { data: RefData | null; loading: boolean } {
  const [data, setData] = useState<RefData | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setData(cache); setLoading(false); return; }
    let cancelled = false;
    apiGetRefData()
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
