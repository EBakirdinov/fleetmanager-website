export interface CompanyData {
  id?: number | string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  url?: string | null;
  hash?: string | null;
  imageHash?: string | null;
  plan?: string | null;
  validUntil?: string | null;
  image?: { small?: string | null; medium?: string | null; large?: string | null } | null;
  [key: string]: unknown;
}

export interface User {
  id?: number | string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  imageHash?: string | null;
  image?: { small?: string | null; medium?: string | null; large?: string | null } | null;
  roles?: string[];
  dayOff?: string[] | null;
  paymentSession?: string | null;
  company?: CompanyData | null;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try { body = JSON.parse(raw); } catch { body = raw; }
  }

  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string")
        ? (body as { error: string }).error
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message, body);
  }

  return body as T;
}

export async function apiMe(): Promise<User | null> {
  try {
    const { user } = await apiJson<{ user: User }>("/api/session/me");
    return user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export async function apiLogin(email: string, password: string): Promise<User> {
  const { user } = await apiJson<{ user: User }>("/api/session/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return user;
}

export async function apiRegister(email: string, password: string, companyName: string): Promise<User> {
  const { user } = await apiJson<{ user: User }>("/api/session/register", {
    method: "POST",
    body: JSON.stringify({ email, password, companyName }),
  });
  return user;
}

export async function apiLogout(): Promise<void> {
  await apiJson<{ ok: true }>("/api/session/logout", { method: "POST" });
}

/**
 * Wrapper around the Symfony proxy: `apiProxy('trucks')` → GET /api/proxy/trucks
 * which the backend forwards to `<API_URL>/api/trucks` with JWT injected.
 */
export function apiProxy<T>(path: string, init?: RequestInit): Promise<T> {
  const clean = path.replace(/^\/+/, "");
  return apiJson<T>(`/api/proxy/${clean}`, init);
}

export async function apiUpdateProfile(data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
  dayOff?: string[];
}): Promise<void> {
  await apiProxy<unknown>("self/info", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function apiUpdateCompany(id: number | string, data: {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  url?: string;
}): Promise<void> {
  await apiProxy<unknown>(`company/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Fleet resource types (API returns snake_case) ───────────────────────────

/**
 * Hateoas/PaginatedRepresentation envelope returned by the API's
 * `paginatedCgetGeneric` helper. Items live under `_embedded.items`.
 */
export interface PaginatedData<T> {
  page: number;
  limit: number;
  pages: number;
  total: number;
  _embedded?: { items?: T[] } | null;
}

/** Pull the item array out of the hateoas envelope, defensively. */
function pageItems<T>(res: { data?: PaginatedData<T> | null } | null | undefined): T[] {
  return res?.data?._embedded?.items ?? [];
}

interface NamedEntity { id: number; name: string; }

export interface TruckItem {
  id: number;
  status: number;
  truck_number?: string | null;
  make?: NamedEntity | null;
  model?: NamedEntity | null;
  year?: number | null;
  vin?: string | null;
  plate_number?: string | null;
  plate_state?: string | null;
  color?: string | null;
  bed_count?: number | null;
  cab_type?: string | null;
  sleeper_size?: string | null;
  engine_type?: string | null;
  engine_number?: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  axle_count?: number | null;
  gvwr?: number | null;
  current_mileage?: number | null;
  engine_hours?: number | null;
  fuel_capacity?: number | null;
  inspection_interval?: number | null;
  oil_change_interval?: number | null;
  pm_service_interval?: number | null;
  last_inspection_date?: string | null;
  current_location?: string | null;
  home_terminal?: string | null;
  assigned_driver?: { id: number; first_name: string; last_name: string; phone?: string | null } | null;
  assigned_trailer?: { id: number; trailer_number: string } | null;
  eld_source?: string | null;
  external_id?: string | null;
  exterior_image_hash?: string | null;
}

export interface TrailerItem {
  id: number;
  status: number;
  trailer_number?: string | null;
  type?: string | null;
  make?: NamedEntity | null;
  model?: NamedEntity | null;
  year?: number | null;
  vin?: string | null;
  plate_number?: string | null;
  color?: string | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  axle_count?: number | null;
  tire_size?: string | null;
  tire_count?: number | null;
  gvwr?: number | null;
  tare_weight?: number | null;
  payload_capacity?: number | null;
  door_type?: string | null;
  roof_type?: string | null;
  floor_type?: string | null;
  side_material?: string | null;
  front_material?: string | null;
  air_ride_suspension?: boolean;
  sliding_tandem?: boolean;
  ventilation?: boolean;
  abs_brakes?: boolean;
  e_track?: boolean;
  liftgate?: boolean;
  hazmat_certified?: boolean;
  thermo_king_unit?: boolean;
  assigned_truck?: { id: number; truck_number: string } | null;
}

export interface DriverItem {
  id: number;
  status: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  email?: string | null;
  ssn?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  driver_number?: string | null;
  hire_date?: string | null;
  driver_type?: string | null;
  home_terminal?: string | null;
  pay_type?: string | null;
  license_type?: string | null;
  license_number?: string | null;
  license_state?: string | null;
  license_issue_date?: string | null;
  license_expiration?: string | null;
  endorsement_doubles_triples?: boolean;
  endorsement_hazardous?: boolean;
  endorsement_tanker?: boolean;
  endorsement_passenger?: boolean;
  endorsement_school?: boolean;
  endorsement_tank?: boolean;
  medical_cert_number?: string | null;
  medical_cert_issue_date?: string | null;
  medical_cert_expiration_date?: string | null;
  years_of_experience?: number | null;
  cdl_school?: string | null;
  notes?: string | null;
  assigned_truck?: { id: number; truck_number: string } | null;
  eld_source?: string | null;
  external_id?: string | null;
  // Document hashes — thumbnails built via documentUrl().
  license_front_hash?:       string | null;
  license_back_hash?:        string | null;
  medical_certificate_hash?: string | null;
  ssn_card_hash?:            string | null;
  proof_of_address_hash?:    string | null;
  other_document_hash?:      string | null;
}

export async function apiListTrucks(): Promise<TruckItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<TruckItem> }>("truck?count=200");
  return pageItems(res);
}

/** Trucks with no assigned driver — for the Driver form's truck picker. */
export async function apiListAvailableTrucks(): Promise<TruckItem[]> {
  const res = await apiProxy<{ outcome: string; data: TruckItem[] }>("truck/available");
  return res?.data ?? [];
}

export async function apiCreateTruck(data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>("truck", { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateTruck(id: number, data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>(`truck/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteTruck(id: number): Promise<void> {
  await apiProxy<unknown>(`truck/${id}`, { method: "DELETE" });
}

export async function apiListTrailers(): Promise<TrailerItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<TrailerItem> }>("trailer?count=200");
  return pageItems(res);
}

export async function apiCreateTrailer(data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>("trailer", { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateTrailer(id: number, data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>(`trailer/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteTrailer(id: number): Promise<void> {
  await apiProxy<unknown>(`trailer/${id}`, { method: "DELETE" });
}

export async function apiListDrivers(): Promise<DriverItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<DriverItem> }>("driver?count=200");
  return pageItems(res);
}

export async function apiCreateDriver(data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>("driver", { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateDriver(id: number, data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>(`driver/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteDriver(id: number): Promise<void> {
  await apiProxy<unknown>(`driver/${id}`, { method: "DELETE" });
}

// ─── Driver documents (per-slot file uploads) ────────────────────────────────

/**
 * Slot identifiers matching DriverController::DOCUMENT_TYPE_SETTERS on the API.
 */
export type DriverDocumentType =
  | "license_front"
  | "license_back"
  | "medical_certificate"
  | "ssn_card"
  | "proof_of_address"
  | "other";

export interface DriverDocumentResult {
  documentType: DriverDocumentType;
  hash: string | null;
}

/**
 * Multipart upload for a driver document. Bypasses the JSON api client
 * (the endpoint takes a file, not JSON) but still routes through the
 * Symfony BFF so the caller's session/JWT is used.
 */
export async function apiUploadDriverDocument(
  id: number,
  type: DriverDocumentType,
  file: File,
): Promise<DriverDocumentResult> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/proxy/driver/${id}/document?documentType=${encodeURIComponent(type)}`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const raw = await res.text();
  const body = raw ? JSON.parse(raw) : null;
  if (!res.ok) {
    const msg = (body && typeof body === "object" && "error" in body && typeof body.error === "string")
      ? body.error
      : `Upload failed (${res.status})`;
    throw new ApiError(res.status, msg, body);
  }
  return body?.data as DriverDocumentResult;
}

export async function apiDeleteDriverDocument(
  id: number,
  type: DriverDocumentType,
): Promise<void> {
  await apiProxy<unknown>(`driver/${id}/document?documentType=${encodeURIComponent(type)}`, {
    method: "DELETE",
  });
}

/**
 * Build a thumbnail URL for a stored hash. `entity` is the folder prefix
 * used by the upload endpoint ("drivers", "trucks", …); `size` matches one
 * of the LiipImagine filters written at upload time.
 */
export function documentUrl(
  imagesHost: string,
  entity: "drivers" | "trucks",
  hash: string | null | undefined,
  size: "60x60" | "200x200" | "400x400" | "full" = "200x200",
): string | null {
  if (!hash || hash.length < 3) return null;
  const folder = `/${hash[0]}/${hash[1]}/${hash[2]}/`;
  const host = imagesHost.replace(/\/+$/, "");
  return `${host}/${entity}${folder}${hash}_${size}.jpg`;
}

// ─── Truck exterior image ────────────────────────────────────────────────────

export interface TruckImageResult {
  exteriorImageHash: string | null;
}

export async function apiUploadTruckImage(id: number, file: File): Promise<TruckImageResult> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/proxy/truck/${id}/image`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const raw = await res.text();
  const body = raw ? JSON.parse(raw) : null;
  if (!res.ok) {
    const msg = (body && typeof body === "object" && "error" in body && typeof body.error === "string")
      ? body.error
      : `Upload failed (${res.status})`;
    throw new ApiError(res.status, msg, body);
  }
  return body?.data as TruckImageResult;
}

export async function apiDeleteTruckImage(id: number): Promise<void> {
  await apiProxy<unknown>(`truck/${id}/image`, { method: "DELETE" });
}

export interface MakeItem { id: number; name: string; }
export interface ModelItem { id: number; name: string; make?: { id: number; name?: string } | null; }

// Catalog counts (as of 2026-07): trucks ~206 makes / 3.5k models, trailers ~3.7k
// makes / 7.5k models. `count=10000` returns each catalog in a single page.
const CATALOG_PAGE_SIZE = 10000;

export async function apiListTruckMakes(): Promise<MakeItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<MakeItem> }>(`truck-make?count=${CATALOG_PAGE_SIZE}`);
  return pageItems(res);
}

/** Fetches only the models belonging to the given make (server-side filter). */
export async function apiListTruckModels(makeId: number): Promise<ModelItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<ModelItem> }>(
    `truck-model?make=${makeId}&count=${CATALOG_PAGE_SIZE}`
  );
  return pageItems(res);
}

export async function apiListTrailerMakes(): Promise<MakeItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<MakeItem> }>(`trailer-make?count=${CATALOG_PAGE_SIZE}`);
  return pageItems(res);
}

export async function apiListTrailerModels(makeId: number): Promise<ModelItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<ModelItem> }>(
    `trailer-model?make=${makeId}&count=${CATALOG_PAGE_SIZE}`
  );
  return pageItems(res);
}

/**
 * Returns per-company connection state as `{ slug: true }` for connected slugs.
 * The integration catalog (name, type, fields) is served separately by /api/data
 * and consumed via `useRefData()`.
 */
export async function apiGetIntegrationStatus(): Promise<Record<string, boolean>> {
  return apiProxy<Record<string, boolean>>("integration");
}

export async function apiSaveIntegration(slug: string, config: Record<string, string>): Promise<void> {
  await apiProxy<{ slug: string; connected: true }>(`integration/${slug}`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function apiDeleteIntegration(slug: string): Promise<void> {
  await apiProxy<{ ok: true }>(`integration/${slug}`, { method: "DELETE" });
}

/**
 * Fetch the decrypted config for a connected integration. Returns null if
 * not connected. Used by features that need to consume credentials client-side
 * (e.g. Google Maps JS SDK).
 */
export async function apiGetIntegrationConfig<T = Record<string, string>>(slug: string): Promise<T | null> {
  try {
    return await apiProxy<T>(`integration/${slug}/config`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

// ─── ELD imports ─────────────────────────────────────────────────────────────

/**
 * A single record fetched from an ELD (truck or driver). Field set varies
 * by resource; `externalId` is always present and is what we send back to
 * the API to complete the import.
 */
export interface EldImportCandidate {
  externalId: string;
  exists: boolean;
  [key: string]: unknown;
}

export interface EldImportPreview {
  source:     string;
  resource:   "vehicles" | "drivers";
  total:      number;
  new:        number;
  existing:   number;
  candidates: EldImportCandidate[];
}

export interface EldImportResult {
  imported: number;
  skipped:  number;
  /**
   * Trucks import may auto-import (and auto-assign) drivers Quantum reports
   * as assigned to each vehicle. Absent / 0 when nothing was auto-imported.
   */
  driversAutoImported?: number;
  errors:   Array<{ externalId: string; reason: string }>;
}

export async function apiQuantumPreviewTrucks(): Promise<EldImportPreview> {
  return apiProxy<EldImportPreview>("quantum/import/trucks");
}

export async function apiQuantumImportTrucks(externalIds: string[]): Promise<EldImportResult> {
  return apiProxy<EldImportResult>("quantum/import/trucks", {
    method: "POST",
    body: JSON.stringify({ externalIds }),
  });
}

export async function apiQuantumPreviewDrivers(): Promise<EldImportPreview> {
  return apiProxy<EldImportPreview>("quantum/import/drivers");
}

export async function apiQuantumImportDrivers(externalIds: string[]): Promise<EldImportResult> {
  return apiProxy<EldImportResult>("quantum/import/drivers", {
    method: "POST",
    body: JSON.stringify({ externalIds }),
  });
}

// ─── Fleet cache reads (Redis-backed) ────────────────────────────────────────

/**
 * One record per truck as populated by App\Service\Fleet\LocationsSyncer.
 * Any resource cached under `GET /api/fleet/{resource}` follows the same
 * envelope; this type is specific to the "locations" payload.
 */
export interface TruckLocation {
  truckId: number;
  truckNumber: string | null;
  driverName:  string | null;
  lat: number;
  lng: number;
  state:     string | null;
  location:  string | null;
  direction: string | null;
  time:      string | null;
  source:    string;
}

interface FleetCacheEnvelope<T> {
  source:   string;
  resource: string;
  total:    number;
  items:    T[];
}

export async function apiGetFleetLocations(): Promise<TruckLocation[]> {
  const res = await apiProxy<FleetCacheEnvelope<TruckLocation>>("fleet/locations");
  return res.items ?? [];
}
