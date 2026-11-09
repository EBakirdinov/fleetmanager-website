import type { EffectivePermissions } from "./permissions";

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
  /**
   * Resolved permissions for this user, present only on your own record from
   * /api/session/me. See lib/permissions.ts for how to read it — prefer
   * can()/levelOf() over touching this directly.
   */
  effectivePermissions?: EffectivePermissions | null;
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

/**
 * The most useful sentence an error body has to offer.
 *
 * Two shapes reach us. The BFF's own routes answer `{error}`, while anything
 * proxied to the API answers FOSRest's `{code, message}` — and we only ever
 * read `error`, so every upstream message (a rejected password, a duplicate
 * email, a validation failure) was arriving as "Request failed (400)".
 */
function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    for (const key of ["error", "message"] as const) {
      const value = (body as Record<string, unknown>)[key];
      if (typeof value === "string" && value !== "") return value;
    }
  }
  return `Request failed (${status})`;
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
    throw new ApiError(response.status, errorMessage(body, response.status), body);
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

/**
 * POST a prepared FormData through the proxy.
 *
 * Kept separate from apiJson because the body must stay a FormData — setting
 * Content-Type ourselves would strip the boundary the browser generates.
 * Returns the parsed body untouched: most endpoints wrap their result in
 * `{outcome, data}`, but the image ones answer with a bare array, so the
 * caller decides how to read it.
 */
async function apiUploadForm<T = unknown>(path: string, fd: FormData): Promise<T> {
  const res = await fetch(`/api/proxy/${path.replace(/^\/+/, "")}`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });

  const raw = await res.text();
  const body = raw ? JSON.parse(raw) : null;

  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(body, res.status), body);
  }

  return body as T;
}

/** POST a single file as multipart/form-data under field `file`. */
async function apiUpload(path: string, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append("file", file);

  return apiUploadForm(path, fd);
}

export async function apiUpdateProfile(data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
  dayOff?: string[];
  /** null removes the avatar — there is no DELETE route for it. */
  imageHash?: string | null;
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
  /** null removes the logo — there is no DELETE route for it. */
  imageHash?: string | null;
}): Promise<void> {
  await apiProxy<unknown>(`company/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Avatar, logo and password ───────────────────────────────────────────────

/**
 * Pull the hash out of an image-upload response.
 *
 * `/self/image` and `/company/image` predate the {outcome, data} envelope the
 * rest of the API uses — they answer with a bare `[{image_hash}]`, one entry
 * per uploaded file. We only ever send one.
 */
function imageHashOf(body: unknown): string {
  const first = Array.isArray(body) ? body[0] : body;
  const hash = first && typeof first === "object"
    ? (first as { image_hash?: unknown }).image_hash
    : undefined;

  if (typeof hash !== "string" || hash === "") {
    throw new ApiError(200, "Upload succeeded but returned no image.", body);
  }
  return hash;
}

/** Upload the signed-in user's avatar. Returns the new image hash. */
export async function apiUploadSelfImage(file: File): Promise<string> {
  return imageHashOf(await apiUpload("self/image", file));
}

/** Upload the company logo. The API takes it from the caller's own company. */
export async function apiUploadCompanyImage(file: File): Promise<string> {
  return imageHashOf(await apiUpload("company/image", file));
}

/**
 * Change your own password. The API refuses this for anyone but yourself,
 * which is why it needs the current password rather than an admin check —
 * admin-initiated resets go through apiResetWorkerPassword instead.
 */
export async function apiChangeOwnPassword(
  userId: number | string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  await apiProxy<unknown>(`member/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ oldPassword, newPassword }),
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
  plate_expiration_date?: string | null;
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
  federal_inspection_interval?: number | null;
  state_inspection_interval?: number | null;
  oil_change_interval?: number | null;
  pm_service_interval?: number | null;
  tire_change_interval?: number | null;
  federal_inspection_date?: string | null;
  state_inspection_date?: string | null;
  current_location?: string | null;
  home_terminal?: string | null;
  assigned_driver?: { id: number; first_name: string; last_name: string; phone?: string | null } | null;
  assigned_trailer?: { id: number; trailer_number: string } | null;
  eld_source?: string | null;
  external_id?: string | null;
  exterior_image_hash?: string | null;
  federal_inspection_hash?: string | null;
  state_inspection_hash?: string | null;
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
  plate_expiration_date?: string | null;
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
  odometer?: number | null;
  tire_change_interval?: number | null;
  pm_service_interval?: number | null;
  federal_inspection_interval?: number | null;
  state_inspection_interval?: number | null;
  federal_inspection_date?: string | null;
  state_inspection_date?: string | null;
  home_location?: string | null;
  purchase_date?: string | null;
  /** Doctrine decimal comes across as a numeric string ("24500.00"). */
  purchase_price?: string | null;
  notes?: string | null;
  federal_inspection_hash?: string | null;
  state_inspection_hash?: string | null;
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

// ─── Workers (company members) ───────────────────────────────────────────────

/**
 * A person who can sign in to the company account, served by /api/member.
 *
 * Note the snake_case: JMS serializes with its default CamelCaseNamingStrategy,
 * so API responses use `first_name` even though the entity property is
 * `firstName`. The camelCase `User` interface above is the exception — the
 * Symfony session layer normalizes that one (see AccountService::getUserData).
 * Request bodies, however, bind to a Symfony form and must stay camelCase.
 */
export interface WorkerItem {
  id: number;
  /** 1 = active, 0 = disabled. */
  status: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  roles?: string[] | null;
  image_hash?: string | null;
  image?: { small?: string | null; medium?: string | null; large?: string | null } | null;
  [key: string]: unknown;
}

export interface WorkerFilters {
  /** "1" active only, "0" disabled only; omit for both. */
  status?: string;
  /** Searches first name, last name and email. */
  name?: string;
}

export async function apiListWorkers(filters: WorkerFilters = {}): Promise<WorkerItem[]> {
  const qs = new URLSearchParams({ count: "200" });
  if (filters.status) qs.set("status", filters.status);
  if (filters.name)   qs.set("name", filters.name);
  const res = await apiProxy<{ outcome: string; data: PaginatedData<WorkerItem> }>(`member?${qs}`);
  return pageItems(res);
}

export async function apiCreateWorker(data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>("member", { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateWorker(id: number, data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>(`member/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

/** Enable (1) or disable (0). Disabling blocks sign-in but keeps the record. */
export async function apiSetWorkerStatus(id: number, status: 0 | 1): Promise<void> {
  await apiProxy<unknown>(`member/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

/** Admin-initiated reset — no current password needed, returns no token. */
export async function apiResetWorkerPassword(id: number, password: string): Promise<void> {
  await apiProxy<unknown>(`member/${id}/reset_password`, { method: "PATCH", body: JSON.stringify({ password }) });
}

// ─── Permissions ─────────────────────────────────────────────────────────────

/** One action or field, with the access level that grants it by default. */
export interface CatalogEntry {
  key: string;
  /** Display name from the API's catalog — render this, never `key`. */
  label: string;
  min_level: string;
}

export interface CatalogModule {
  key: string;
  label: string;
  actions: CatalogEntry[];
  fields: CatalogEntry[];
}

export interface PermissionCatalog {
  levels: string[];
  scopes: string[];
  roles: { role: string; label: string }[];
  modules: CatalogModule[];
}

/** The grant/revoke diff stored against one user. */
export interface PermissionOverrides {
  grant: string[];
  revoke: string[];
}

export interface MemberPermissions {
  role: string | null;
  overrides: PermissionOverrides;
  effective: EffectivePermissions;
}

/**
 * The permission vocabulary, so the override editor renders from the API's
 * catalog rather than a hardcoded copy of it.
 *
 * Goes through the proxy, which does not camelize keys — hence `min_level`.
 */
export async function apiPermissionCatalog(): Promise<PermissionCatalog> {
  const res = await apiProxy<{ outcome: string; data: PermissionCatalog }>("permissions/catalog");
  return res.data;
}

export async function apiGetMemberPermissions(id: number): Promise<MemberPermissions> {
  const res = await apiProxy<{ outcome: string; data: MemberPermissions }>(`member/${id}/permissions`);
  return res.data;
}

/**
 * Replaces both lists outright, so the editor can send the state of its
 * checkboxes without diffing.
 */
export async function apiSetMemberPermissions(
  id: number,
  overrides: PermissionOverrides,
): Promise<MemberPermissions> {
  const res = await apiProxy<{ outcome: string; data: MemberPermissions }>(
    `member/${id}/permissions`,
    { method: "PATCH", body: JSON.stringify(overrides) },
  );
  return res.data;
}

// ─── Loads ───────────────────────────────────────────────────────────────────

/**
 * A broker, direct shipper or 3PL — whoever tendered the freight.
 *
 * Every member past `id` is optional because the serializer omits nulls, and
 * because two of them are permission-gated: `credit_limit` and `days_to_pay`
 * live outside [Default] and are **absent**, not null, for a caller without
 * `brokers.view_credit`. Check presence, never truthiness, before rendering
 * them — the same way Expenses reads `amount`.
 */
export interface BrokerItem {
  id: number;
  status?: number;
  type?: string | null;
  name?: string | null;
  dba?: string | null;
  /** "Name (DBA)", built server-side by Broker::getDisplayName(). */
  display_name?: string | null;
  mc_number?: string | null;
  dot_number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  bill_to_name?: string | null;
  bill_to_address?: string | null;
  billing_email?: string | null;
  payment_terms_days?: number | null;
  quick_pay_available?: boolean | null;
  /** Doctrine decimal, so a numeric string ("3.00"). */
  quick_pay_fee_percent?: string | null;
  /** Gated behind brokers.view_credit — absent, not null, without it. */
  credit_limit?: string | null;
  /** Gated behind brokers.view_credit. */
  days_to_pay?: number | null;
  carrier_packet_signed_on?: string | null;
  insurance_cert_on_file?: boolean | null;
  /** Who to call first. The opposite pole to do_not_load, and independent of it. */
  is_preferred?: boolean | null;
  do_not_load?: boolean | null;
  do_not_load_reason?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * One broker's track record, from GET broker/summary.
 *
 * `revenue` and `rate_per_mile` ride `loads.view_rate` rather than a broker
 * key of its own — these figures *are* load rate, aggregated — so they are
 * absent for a caller who may not see a single load's rate. `loads` and
 * `miles` always come through.
 *
 * `rate_per_mile` is null rather than "0.00" when nothing has been priced or
 * nothing has been routed; $0.00/mi beside real mileage reads as a loss
 * rather than as missing data.
 */
export interface BrokerSummaryRow {
  broker_id: number;
  loads: number;
  miles?: string | null;
  revenue?: string | null;
  rate_per_mile?: string | null;
  last_delivery?: string | null;
  /**
   * Share of deliveries that landed on or before the due date, over the
   * `on_time_of` loads carrying both a recorded delivery and a due date.
   * Absent until at least one such load exists — every load booked before
   * `load.delivered_at` was introduced has none, so the figure accrues
   * forward rather than starting at a fabricated 100%.
   */
  on_time_pct?: number | null;
  on_time_of?: number;
  /**
   * Accounts receivable. These four ride `billing.view_invoices`, a separate
   * gate from `loads.view_rate` — "may they see what a load was worth" and
   * "may they see the books" are different questions — and are **absent, not
   * null**, without it.
   */
  invoices?: number;
  total_paid?: string | null;
  outstanding?: string | null;
  avg_pay_days?: number | null;
}

export async function apiListBrokers(): Promise<BrokerItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<BrokerItem> }>(
    "broker?count=200&sort=name:asc",
  );
  return pageItems(res);
}

/** Performance for every broker at once, keyed by broker id. */
export async function apiBrokerSummary(year?: number): Promise<Record<string, BrokerSummaryRow>> {
  const qs = year ? `?year=${year}` : "";
  const res = await apiProxy<{ outcome: string; data: Record<string, BrokerSummaryRow> | [] }>(
    `broker/summary${qs}`,
  );
  const data = res?.data;
  // An empty rollup serializes as [] rather than {} — PHP cannot tell an
  // empty map from an empty list.
  return Array.isArray(data) || !data ? {} : data;
}

/**
 * One row of the directory's "Recent Loads Booked" panel.
 *
 * A purpose-built projection, not a `LoadItem`: `booked_by` is a plain
 * "First Last" string because the API deliberately refuses to nest the User
 * behind `load.created_by_id`. `rate` rides `loads.view_rate` and is
 * **absent, not null**, without it — check presence, never truthiness.
 */
export interface RecentBookedLoad {
  id: number;
  reference_number?: string | null;
  broker_load_number?: string | null;
  origin?: string | null;
  destination?: string | null;
  /** The requirement recorded on the load, not the trailer currently hooked up. */
  trailer_type?: string | null;
  load_type?: string | null;
  status: string;
  rate?: string | null;
  booked_on?: string | null;
  broker_id: number;
  broker_name?: string | null;
  booked_by?: string | null;
}

export async function apiBrokerRecentLoads(brokerId?: number, limit = 10): Promise<RecentBookedLoad[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (brokerId) qs.set("broker", String(brokerId));

  const res = await apiProxy<{ outcome: string; data: RecentBookedLoad[] }>(`broker/recent-loads?${qs}`);
  return res?.data ?? [];
}

/** One lane of the "Top Lanes by Broker" donut. */
export interface LaneRow {
  /** "Dallas, TX" — the first pickup's city and state. */
  origin: string;
  /** "Memphis, TN" — the last delivery's. */
  destination: string;
  loads: number;
}

/**
 * The lane rollup.
 *
 * `unmapped` is loads with a broker that no lane could be built for, because
 * a stop has no geocoded city. The panel has to show it: a donut that totals
 * less than the fleet hauled, without saying so, is worse than no donut.
 */
export interface LaneRollup {
  lanes: LaneRow[];
  mapped: number;
  unmapped: number;
}

export async function apiBrokerLanes(brokerId?: number, limit = 5): Promise<LaneRollup> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (brokerId) qs.set("broker", String(brokerId));

  const res = await apiProxy<{ outcome: string; data: LaneRollup }>(`broker/lanes?${qs}`);
  return res?.data ?? { lanes: [], mapped: 0, unmapped: 0 };
}

export async function apiCreateBroker(data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>("broker", { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateBroker(id: number, data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>(`broker/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteBroker(id: number): Promise<void> {
  await apiProxy<unknown>(`broker/${id}`, { method: "DELETE" });
}

export interface LoadItem {
  id: number;
  status: string;
  reference_number?: string | null;
  origin?:           string | null;
  destination?:      string | null;
  pickup_date?:      string | null;
  delivery_date?:    string | null;
  /**
   * Load.yml declares this `type: float`, so it arrives as a JSON **number**
   * (`620.0`), not the string the other money fields use. Gated behind
   * `loads.view_rate` — absent, not null, without it.
   */
  rate?:             number | null;

  /**
   * Who tendered the load. Nested rather than an id so the Load form can
   * show the terms and the do-not-load warning without a second request.
   * Its own credit fields stay gated inside this object.
   */
  broker?: BrokerItem | null;
  /** The broker's own number for this load, off their rate confirmation. */
  broker_load_number?: string | null;

  /**
   * The assigned driver. `email` and `assigned_truck` were always in the
   * payload — Driver.yml exposes both — but went undeclared here until the
   * send-to-driver dialog needed somewhere to read the driver's contact
   * details and equipment from. The serializer omits null fields rather than
   * sending them as null, hence every member being optional.
   */
  driver?: {
    id: number;
    first_name?: string | null;
    last_name?:  string | null;
    phone?:      string | null;
    email?:      string | null;
    assigned_truck?: {
      id: number;
      truck_number?: string | null;
      assigned_trailer?: { id: number; trailer_number?: string | null; type?: string | null } | null;
    } | null;
  } | null;

  /**
   * The server's cached route figures, refreshed when stops change. The load
   * page re-routes live for its map, but anything that only needs the numbers
   * — the send preview, for one — reads them from here rather than paying for
   * a provider call. `miles_source` says whether they were measured
   * ("routed") or estimated from straight-line distance ("estimated").
   */
  total_miles?:  number | null;
  loaded_miles?: number | null;
  empty_miles?:  number | null;
  miles_source?: "routed" | "estimated" | null;

  /**
   * Truck and trailer, flattened by the server. A load carries no equipment
   * of its own — it is reached through the driver's truck — and that relation
   * loops back on itself, so the serializer's depth limit cuts the trailer off
   * before `driver.assigned_truck` can carry it. Read equipment from here.
   */
  equipment?: {
    truck_number?:   string | null;
    trailer_number?: string | null;
    trailer_type?:   string | null;
  } | null;

  // Section 4 — Equipment Requirements
  load_type?:         string | null;
  trailer_type?:      string | null;
  temperature?:       string | null;
  weight_lbs?:        number | null;
  pallets_pieces?:    string | null;
  commodity?:         string | null;
  hazmat?:            boolean | null;
  seal_required?:     boolean | null;
  straps_load_bars?:  string | null;

  /**
   * Section 6 — Rate & Cost Breakdown. One row per line; the five decimal
   * columns this section used to be are gone. `rate` above is the server's
   * cache of these lines' revenue total.
   */
  accessorial_lines?: LoadAccessorialItem[] | null;

  // Section 9 — Notes
  special_instructions?: string | null;
  broker_notes?:         string | null;
  internal_comments?:    string | null;

  /** Sections 2 + 3 live here — one row per stop, ordered by sequence. */
  stops?: LoadStopItem[] | null;

  company?:    { id: number; name?: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** One pickup or delivery on a load. `type` is "pickup" | "delivery". */
export interface LoadStopItem {
  id:              number;
  type:            string;
  sequence?:       number | null;
  facility_name?:  string | null;
  address?:        string | null;
  date?:           string | null;  // YYYY-MM-DD
  /** HH:MM. The appointment time when scheduling_type is "appointment". */
  window_start?:   string | null;
  /** Null when scheduling_type is "appointment" — an appointment has no end bound. */
  window_end?:     string | null;
  contact_person?: string | null;
  phone?:          string | null;
  hours_start?:    string | null;
  hours_end?:      string | null;
  scheduling_type?: string | null;
  reference?:      string | null;
  instructions?:   string | null;
  eta?:            string | null;  // ISO datetime
  pod_required?:   boolean | null;
  store_dc?:       string | null;
  latitude?:       number | null;
  longitude?:      number | null;
  /**
   * Structured geography, filled from the geocode — not typed by anyone.
   * `address` stays the raw string the dispatcher or Google's autocomplete
   * left behind; these are what the lane is built from. Absent on stops that
   * were never geocoded.
   */
  city?:           string | null;
  state?:          string | null;
  zip?:            string | null;
}

/**
 * One line of a load's rate & cost breakdown.
 *
 * `type` is a preset from the catalog in components/loads/accessorials.ts
 * ("line_haul", "detention", …) or "custom" for a line the dispatcher named
 * themselves — the only type that carries `custom_name` and the only one
 * that may appear more than once on a load. `category` decides which block
 * it renders in and which side of the ledger it counts on; the server
 * derives it from `type` for presets, so it is not worth setting by hand.
 */
export interface LoadAccessorialItem {
  id?:            number;
  category:       string;
  type:           string;
  custom_name?:   string | null;
  amount?:        number | null;
  notes?:         string | null;
  include_in_rate_confirmation?: boolean | null;
  sequence?:      number | null;
}

export async function apiGetLoad(id: number | string): Promise<LoadItem> {
  const res = await apiProxy<{ outcome: string; data: LoadItem }>(`load/${id}`);

  return res.data;
}

/**
 * Create a load, stops and all, in one request.
 *
 * `stops` and `accessorialLines` go in nested — LoadType declares both as
 * collections with cascade persist, so the whole record saves in a single
 * transaction rather than a POST followed by a stop call per stop.
 *
 * Returns the created load rather than void, unlike apiCreateTruck and its
 * neighbours: the API answers 201 with the serialized entity, and the Add
 * page needs the new id to send the user on to it.
 */
export async function apiCreateLoad(data: Record<string, unknown>): Promise<LoadItem> {
  const res = await apiProxy<{ outcome: string; data: LoadItem }>("load", {
    method: "POST",
    body:   JSON.stringify(data),
  });

  return res.data;
}

/** Patch one section's worth of load fields. Untouched fields stay untouched. */
export async function apiUpdateLoad(id: number | string, patch: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>(`load/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

/** Patch a pickup or delivery stop in place. */
export async function apiUpdateLoadStop(
  loadId: number | string,
  stopId: number | string,
  patch: Record<string, unknown>,
): Promise<void> {
  await apiProxy<unknown>(`load/${loadId}/stop/${stopId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function apiListLoads(): Promise<LoadItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<LoadItem> }>("load?count=200");
  return pageItems(res);
}

export async function apiDeleteLoad(id: number): Promise<void> {
  await apiProxy<unknown>(`load/${id}`, { method: "DELETE" });
}

// ─── Sending a load to its driver ────────────────────────────────────────────

/** How one channel went. Both are always present in a 200. */
export interface SendChannelResult {
  ok: boolean;
  message: string;
}

export interface SendLoadResult {
  sent: { email: SendChannelResult; sms: SendChannelResult };
  sentAt: string;
}

export interface SendLoadPayload {
  /** Defaults to the load's assigned driver when omitted. */
  driverId?: number | null;
  notes?: string;
  sendEmail: boolean;
  sendSms: boolean;
  /** Whether to attach the generated load confirmation. */
  includeConfirmation: boolean;
  /** Extra addresses to copy; sent as one comma-separated field. */
  cc?: string[];
  /** Documents to attach alongside the confirmation. */
  files?: File[];
}

/**
 * Send a load to its driver by email and/or SMS.
 *
 * A 200 does **not** mean both channels worked — the two are independent, and
 * email landing while SMS did not is a normal outcome the dialog has to show.
 * Read `sent.email.ok` and `sent.sms.ok` separately. Only a request that could
 * not be attempted at all (no driver, nothing selected) throws.
 *
 * Multipart rather than JSON because of the attachments; the Symfony proxy
 * rebuilds the multipart body and forwards it upstream with the JWT attached.
 */
export async function apiSendLoadToDriver(
  id: number | string,
  payload: SendLoadPayload,
): Promise<SendLoadResult> {
  const fd = new FormData();
  if (payload.driverId != null) fd.append("driverId", String(payload.driverId));
  if (payload.notes) fd.append("notes", payload.notes);
  fd.append("sendEmail", payload.sendEmail ? "1" : "0");
  fd.append("sendSms", payload.sendSms ? "1" : "0");
  fd.append("includeConfirmation", payload.includeConfirmation ? "1" : "0");
  if (payload.cc?.length) fd.append("cc", payload.cc.join(","));
  // Field name is not read by the server — it walks everything in $request->files
  // — but keeping them distinct avoids any proxy collapsing same-named parts.
  payload.files?.forEach((file, i) => fd.append(`document${i}`, file, file.name));

  return apiUploadForm<SendLoadResult>(`load/${id}/send`, fd);
}

/**
 * URL of the generated load confirmation, for the preview pane.
 *
 * Same-origin through the proxy, so the browser sends the session cookie and
 * can render it in an <object> without us fetching the bytes ourselves.
 */
export function loadConfirmationUrl(id: number | string): string {
  return `/api/proxy/load/${id}/confirmation.pdf`;
}

// ─── Geocoding / Routing / Weather ───────────────────────────────────────────
// Thin JSON wrappers over the backend services. All three return null when
// the backend answers 404 (integration not connected, no result, etc.) so
// callers can render a fallback instead of throwing.

export interface GeocodeResult {
  lat:       number;
  lng:       number;
  formatted: string;
}

export interface RouteSummary {
  loaded_miles:      number;
  empty_miles:       number | null;
  total_miles:       number;
  duration_sec:      number;
  eta_pickup_sec:    number | null;
  eta_delivery_sec:  number;

  /**
   * How the figures were arrived at.
   *
   * `routed` came from the map provider and is what the load is billed on.
   * `estimated` is straight-line distance, used when the company has no
   * Routes API or Google refused the request — it runs 15–25% under real
   * road miles, and its durations assume a flat average speed. Anything
   * showing an estimate has to say so.
   */
  source:            "routed" | "estimated";

  /**
   * Display name of the map provider that answered, straight from the
   * integration catalog — "Google Maps" today, whatever is added tomorrow
   * without a change here. Null when `source` is `estimated`: nothing
   * external was consulted, the distance was computed locally.
   */
  provider:          string | null;
}


/**
 * A single time-slice of weather. Two flavours share this shape:
 *   • an outlook day in `WeatherForecast.buckets` — labelled by weekday
 *     ("Mon"), carrying its own `date` and `high_f`/`low_f`;
 *   • the appointment reading in `WeatherForecast.window` — labelled with the
 *     hours ("08:00–12:00"), carrying `humidity` instead.
 */
export interface WeatherBucket {
  label:       string;
  /** `YYYY-MM-DD`, day buckets only — the window reading covers one date. */
  date?:       string;
  temp_f:      number;
  description: string;
  code:        number;
  rain_chance: number; // 0–100
  /** Day buckets only: that day's own high and low, not the request date's. */
  high_f?:     number | null;
  low_f?:      number | null;
  /** Averaged over the bucket's hours; direction is a vector mean. */
  wind_mph?:   number;
  wind_dir?:   string; // "N" | "NE" | … | "NW"
  humidity?:   number; // 0–100
}

export interface WeatherForecast {
  /** The stop date's high and low — what the window reading is qualified by. */
  high_f?: number | null;
  low_f?:  number | null;
  /**
   * The appointment-hours reading. Present only when the caller passed both
   * window bounds and the forecast actually covered those hours.
   */
  window?: WeatherBucket | null;
  /** The day-by-day outlook. Always present, window or not. */
  buckets: WeatherBucket[];
}

async function nullOn404<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function apiGeocode(address: string): Promise<GeocodeResult | null> {
  return nullOn404(() => apiProxy<GeocodeResult>("geocode", {
    method: "POST",
    body:   JSON.stringify({ address }),
  }));
}

// ─── Assignment (Dispatch) suggestions ──────────────────────────────────────

/**
 * One reason for or against a driver taking the load.
 *
 * `label` is a chip, never a sentence — "Lowboy", "Over by 6,000 lbs",
 * "CDL expired Mar 4, 2026". A driver card can carry half a dozen of these
 * and still be readable at a glance, which prose would not be.
 */
export interface AssignmentVerdict {
  /** Stable machine code, e.g. "trailer_type_match", "driver_busy", "overweight". */
  code:  string;
  label: string;
}

/** A commitment the driver already has — what a `driver_busy` blocker points at. */
export interface AssignmentActiveLoad {
  load_id:          number;
  reference_number: string | null;
  status:           string;
  pickup_date:      string | null;
  delivery_date:    string | null;
}

/** Flat DTO from /api/assignment/suggestions — one entry per suggested driver. */
export interface AssignmentSuggestion {
  driver_id:             number;
  driver_name:           string;
  phone:                 string | null;
  endorsement_hazardous: boolean;
  truck_number:          string | null;
  truck_spec:            string | null;
  trailer_number:        string | null;
  trailer_type:          string | null;
  location_text:         string | null;
  /** Raw timestamp of the last GPS fix, in whatever format the ELD reported. */
  location_time:         string | null;
  /** Minutes since that fix; null when it carried no usable timestamp. */
  location_age_min:      number | null;
  /** Fix too old to rank on. The mileage is still shown — a parked truck's
   *  old fix is accurate — it just stops outranking known-current positions. */
  location_stale:        boolean;
  /** Straight-line miles to pickup; null when pickup coords or truck location unknown. */
  distance_mi:           number | null;
  /** False when at least one blocker applies. Blocked drivers are ranked last, not hidden. */
  eligible:              boolean;
  /** The trailer was actually inspected against a stated requirement. Drives a
   *  ranking tier of its own: confirmed equipment outranks unverified, even at
   *  a much greater distance. */
  equipment_confirmed:   boolean;
  blockers:              AssignmentVerdict[];
  warnings:              AssignmentVerdict[];
  /** Which of the load's stated requirements this driver meets. */
  matches:               AssignmentVerdict[];
  active_loads:          AssignmentActiveLoad[];
}

export interface AssignmentSuggestionResponse {
  items:    AssignmentSuggestion[];
  /** Always present when the caller passed `selected` — whether or not they
   *  survived the filters, and whether or not they also appear in `items`. */
  selected: AssignmentSuggestion | null;
}

/**
 * Fetch driver suggestions ranked against whatever the load form knows so far.
 *
 * Every field is optional and nothing is a prerequisite: the backend checks
 * what it was given and stays quiet about what it wasn't. Pass the form's
 * current state as-is — blanks are dropped here rather than being sent as
 * empty requirements, so a half-filled form still produces a useful ranking.
 */
export async function apiAssignmentSuggestions(opts: {
  pickupLat?:      number | null;
  pickupLng?:      number | null;
  /** YYYY-MM-DD. With a window, conflicts with a driver's other loads become blockers. */
  pickupDate?:     string | null;
  deliveryDate?:   string | null;
  hazmat?:         boolean;
  trailerType?:    string | null;
  /** Any non-empty value marks the freight temperature-controlled. */
  temperature?:    string | null;
  weightLbs?:      string | number | null;
  strapsLoadBars?: string | null;
  /** Fills in anything omitted from the saved load, and stops that load from
   *  counting as a conflict with itself when re-assigning. */
  loadId?:         number | null;
  /** Drop blocked candidates instead of ranking them last. */
  strict?:         boolean;
  limit?:          number;
  selected?:       number | null;
}): Promise<AssignmentSuggestionResponse> {
  const q = new URLSearchParams();

  // Blank, whitespace and null all mean "the dispatcher hasn't said" — never
  // "requirement is empty string". Dropping them here is what keeps every
  // field optional end-to-end.
  const put = (key: string, v: string | number | null | undefined): void => {
    if (v == null) return;
    const s = String(v).trim();
    if (s !== "") q.set(key, s);
  };

  put("pickup_lat",       opts.pickupLat);
  put("pickup_lng",       opts.pickupLng);
  put("pickup_date",      opts.pickupDate);
  put("delivery_date",    opts.deliveryDate);
  put("trailer_type",     opts.trailerType);
  put("temperature",      opts.temperature);
  put("weight_lbs",       opts.weightLbs);
  put("straps_load_bars", opts.strapsLoadBars);
  put("load_id",          opts.loadId);
  put("limit",            opts.limit);
  put("selected",         opts.selected);
  if (opts.hazmat) q.set("hazmat", "1");
  if (opts.strict) q.set("strict", "1");

  return apiProxy<AssignmentSuggestionResponse>(`assignment/suggestions?${q.toString()}`);
}

export interface AddressSuggestion {
  description: string;
  place_id:    string;
}

/** Address-fragment autocomplete via the connected map provider. Empty
 *  array when nothing's connected or query is too short. */
export async function apiAddressSuggest(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await apiProxy<{ predictions: AddressSuggestion[] }>(
    `geocode/suggest?q=${encodeURIComponent(q)}`,
  );
  return res.predictions ?? [];
}

/**
 * Route the whole trip. `stops` is every stop in sequence, not just the ends
 * — a load that calls somewhere in the middle does not drive the direct line,
 * and the miles it is paid on are the ones it covers.
 */
export function apiRoute(
  stops: { lat: number; lng: number }[],
  truck?: { lat: number; lng: number } | null,
): Promise<RouteSummary | null> {
  return nullOn404(() => apiProxy<RouteSummary>("route", {
    method: "POST",
    body:   JSON.stringify({ stops, truck: truck ?? undefined }),
  }));
}

/**
 * `date` is `YYYY-MM-DD`. The response always carries a 4-day outlook in
 * `buckets`, one per day from `date` on; passing both `windowStart` and
 * `windowEnd` (each `HH:MM`) adds a `window` reading for those hours.
 */
export function apiWeather(
  lat: number, lng: number, date: string,
  windowStart?: string | null, windowEnd?: string | null,
): Promise<WeatherForecast | null> {
  const q = new URLSearchParams({ lat: String(lat), lng: String(lng), date });
  if (windowStart && windowEnd) {
    q.set("window_start", windowStart);
    q.set("window_end",   windowEnd);
  }
  return nullOn404(() => apiProxy<WeatherForecast>(`weather?${q.toString()}`));
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
  const body = await apiUpload(
    `driver/${id}/document?documentType=${encodeURIComponent(type)}`,
    file,
  ) as { data?: DriverDocumentResult } | null;
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
  entity: "drivers" | "trucks" | "trailers" | "users" | "companies",
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
  const body = await apiUpload(`truck/${id}/image`, file) as { data?: TruckImageResult } | null;
  return body?.data as TruckImageResult;
}

export async function apiDeleteTruckImage(id: number): Promise<void> {
  await apiProxy<unknown>(`truck/${id}/image`, { method: "DELETE" });
}

// ─── Inspection documents (truck + trailer) ──────────────────────────────────

export type InspectionType = "federal" | "state";

export interface InspectionDocumentResult {
  inspectionType: InspectionType;
  hash: string | null;
}

async function postInspectionUpload(
  entity: "truck" | "trailer",
  id: number,
  type: InspectionType,
  file: File,
): Promise<InspectionDocumentResult> {
  const body = await apiUpload(
    `${entity}/${id}/inspection?inspectionType=${encodeURIComponent(type)}`,
    file,
  ) as { data?: InspectionDocumentResult } | null;
  return body?.data as InspectionDocumentResult;
}

export function apiUploadTruckInspection(id: number, type: InspectionType, file: File): Promise<InspectionDocumentResult> {
  return postInspectionUpload("truck", id, type, file);
}

export function apiDeleteTruckInspection(id: number, type: InspectionType): Promise<void> {
  return apiProxy<unknown>(`truck/${id}/inspection?inspectionType=${encodeURIComponent(type)}`, { method: "DELETE" }).then(() => undefined);
}

export function apiUploadTrailerInspection(id: number, type: InspectionType, file: File): Promise<InspectionDocumentResult> {
  return postInspectionUpload("trailer", id, type, file);
}

export function apiDeleteTrailerInspection(id: number, type: InspectionType): Promise<void> {
  return apiProxy<unknown>(`trailer/${id}/inspection?inspectionType=${encodeURIComponent(type)}`, { method: "DELETE" }).then(() => undefined);
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

/** One capability's verdict from POST /integration/{slug}/test. */
export interface IntegrationProbeResult {
  ok:      boolean;
  message: string;
}

/**
 * Fields are merged over what is stored, so sending a subset keeps the rest —
 * which is what lets the drawer say "leave a field blank to keep the current
 * value" and still post checkbox state on every save.
 */
export async function apiSaveIntegration(
  slug: string,
  config: Record<string, string | boolean | number>,
): Promise<void> {
  await apiProxy<{ slug: string; connected: true }>(`integration/${slug}`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

/**
 * Ask the provider what these credentials can actually do, per capability.
 * `config` may carry unsaved edits; anything omitted falls back to what is
 * stored, so the button works before a save.
 */
export async function apiTestIntegration(
  slug: string,
  config?: Record<string, string | boolean | number>,
): Promise<Record<string, IntegrationProbeResult>> {
  const res = await apiProxy<{ results: Record<string, IntegrationProbeResult> }>(
    `integration/${slug}/test`,
    { method: "POST", body: JSON.stringify(config ?? {}) },
  );

  return res.results ?? {};
}

/** How many local records an ELD currently owns, from GET /integration/{slug}/linked. */
export interface IntegrationLinkedCounts {
  trucks:  number;
  drivers: number;
}

/**
 * How many trucks and drivers this ELD imported. Zeros for an integration
 * that imports nothing, so the caller doesn't have to know which types do.
 *
 * Asked before offering a disconnect: the provenance on these records is what
 * makes the next ELD refuse them, so the warning has to name a number.
 */
export async function apiGetIntegrationLinked(slug: string): Promise<IntegrationLinkedCounts> {
  return apiProxy<IntegrationLinkedCounts>(`integration/${slug}/linked`);
}

/**
 * `unlink` releases the provider's claim on the trucks and drivers it
 * imported — the difference between disconnecting an ELD and switching to a
 * different one. Without it the records keep the old provenance and the next
 * ELD refuses them with "Already linked to …".
 */
export async function apiDeleteIntegration(slug: string, unlink = false): Promise<void> {
  await apiProxy<{ ok: true; unlinked?: IntegrationLinkedCounts }>(
    `integration/${slug}${unlink ? "?unlink=1" : ""}`,
    { method: "DELETE" },
  );
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
 * Info about the local record an ELD candidate matches:
 *   - "imported" — already linked to this ELD (nothing to do).
 *   - "vin"      — a local Truck exists with the same VIN (offer to link).
 *   - "license"  — same for Driver by license number.
 *   - "name"     — Driver only: no license match, but the name matches.
 */
export interface EldImportMatch {
  type:       "imported" | "vin" | "license" | "name";
  localId:    number;
  localLabel: string;
  /**
   * Which ELD owns the matched record, on "vin"/"license"/"name" matches only.
   * Null means nobody does — a manually-created record, free to link. A slug
   * means another ELD already manages it and the API will refuse the link
   * (linking would move the record's provenance and strand it on the other
   * provider), so offer an explanation rather than a button.
   */
  ownedBy?:   string | null;
}

/**
 * A single record fetched from an ELD (truck or driver). Field set varies
 * by resource; `externalId` is always present and is what we send back to
 * the API to complete the import.
 */
export interface EldImportCandidate {
  externalId: string;
  /** True for either an already-imported or a VIN/license match. */
  exists: boolean;
  /** Present when a local record was found — tells the UI how to act. */
  match: EldImportMatch | null;
  [key: string]: unknown;
}

export interface EldImportPreview {
  source:     string;
  resource:   "vehicles" | "drivers";
  total:      number;
  new:        number;
  existing:   number;
  /** Count of candidates the user could opt in to link to an existing record. */
  matchable:  number;
  candidates: EldImportCandidate[];
}

/** Request body for the two-mode import endpoint. */
export interface EldImportActions {
  create: string[];                                            // externalIds → new records
  link:   Array<{ externalId: string; localId: number }>;      // pairs → wire local to ELD
}

export interface EldImportResult {
  imported: number;
  /** Local records that got wired to the ELD via a link action. */
  linked:   number;
  skipped:  number;
  /**
   * Trucks import may auto-import (and auto-assign) the drivers the ELD
   * reports as assigned to each vehicle. Absent / 0 when nothing was auto-imported.
   */
  driversAutoImported?: number;
  /**
   * Trucks import also reconciles already-imported trucks: if the driver
   * the ELD reports on a known truck has changed, the previous ELD-sourced
   * driver is unassigned and the new one is attached. Counts trucks touched
   * that way. Absent / 0 for the drivers import endpoint.
   */
  driversReassigned?: number;
  /**
   * Already-imported trucks whose ELD-managed fields (plate, year, make/model,
   * mileage, truck number) were refreshed to match the ELD's current state.
   * Only meaningful on the trucks import endpoint.
   */
  trucksRefreshed?: number;
  /**
   * Already-imported drivers whose ELD-managed fields (name, license state /
   * type / expiry, email, phone) were refreshed to match the ELD's state.
   * Applies to both endpoints.
   */
  driversRefreshed?: number;
  /**
   * ELD-imported trucks that were present in a prior sync but missing from
   * the current ELD roster — soft-deactivated (status → inactive) rather
   * than deleted so history stays intact. Only meaningful on trucks import.
   */
  trucksInactivated?: number;
  /**
   * ELD-imported drivers missing from the current ELD roster — flipped
   * to `terminated`. Only meaningful on drivers import.
   */
  driversTerminated?: number;
  /**
   * True when we can't be sure we saw the provider's whole roster — a
   * paginated fetch hit our safety cap, or the roster came back empty while
   * records are still linked. The removal / termination pass is skipped in
   * that case rather than risk marking a live fleet inactive.
   */
  rosterIncomplete?: boolean;
  errors:   Array<{ externalId: string; reason: string }>;
}

/** What an ELD import can pull. Matches the catalog's `imports` entries. */
export type EldImportResource = "trucks" | "drivers";

/**
 * ELD import is slug-addressed: the provider is a path segment matching its
 * catalog entry, so connecting a new ELD needs no new function here — pass
 * the slug from `IntegrationDef.slug`.
 */
export async function apiEldImportPreview(
  slug: string,
  resource: EldImportResource,
): Promise<EldImportPreview> {
  return apiProxy<EldImportPreview>(`eld/${slug}/import/${resource}`);
}

export async function apiEldImportRun(
  slug: string,
  resource: EldImportResource,
  actions: EldImportActions,
): Promise<EldImportResult> {
  return apiProxy<EldImportResult>(`eld/${slug}/import/${resource}`, {
    method: "POST",
    body: JSON.stringify(actions),
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
  /** Deterministic per-truck color assigned server-side (CSS color string). */
  color:     string;
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

// ─── Expenses ────────────────────────────────────────────────────────────────
// The ledger. Unlike trucks or loads, this list is filtered and paged on the
// server: a fifty-truck fleet books thousands of fuel rows a month and keeps
// them forever, so `?count=200` and a client-side filter would stop working
// in the first quarter.
//
// Money fields are optional on every type below, and that is a real state
// rather than defensive typing: `expenses.view_amounts` is a field permission,
// and a caller without it gets the row with every figure *absent*. A
// Dispatcher can work the unassigned-purchase queue without being shown what
// the fleet spends.

export interface FuelDetailItem {
  id: number;
  quantity?: string;
  quantity_unit?: string;
  fuel_grade?: string;
  unit_price?: string;
  retail_unit_price?: string;
  savings_amount?: string;
  non_fuel_amount?: string;
}

export interface ExpenseItem {
  id: number;
  status: number;
  category: string;
  subcategory?: string;
  description?: string;
  occurred_at: string;
  occurred_on: string;
  posted_at?: string;
  amount?: string;
  currency?: string;
  tax_amount?: string;
  discount_amount?: string;
  vendor_name?: string;
  location_city?: string;
  location_state?: string;
  location_zip?: string;
  payment_method?: string;
  card_last4?: string;
  truck?: TruckItem | null;
  trailer?: { id: number; trailer_number?: string } | null;
  driver?: DriverItem | null;
  load?: { id: number; reference_number?: string } | null;
  odometer_miles?: number;
  billable?: boolean;
  review_status: string;
  receipt_hash?: string;
  notes?: string;
  /** Integration slug that produced the row; absent means somebody typed it. */
  source?: string;
  external_id?: string;
  imported_at?: string;
  fuel_detail?: FuelDetailItem | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExpenseSummary {
  total: string;
  count: number;
  by_category: Record<string, { amount: string; count: number }>;
}

export interface ExpensePage {
  items: ExpenseItem[];
  page: number;
  pages: number;
  total: number;
  limit: number;
}

export interface VendorTotal {
  vendor: string;
  amount: string;
  count: number;
}

/**
 * Filters accepted by the ledger endpoints. Repeated keys (category, and the
 * other set-valued ones) go out as `category[]=fuel&category[]=tolls`, which
 * is what Symfony's query parser reads back as an array.
 */
export interface ExpenseFilters {
  page?: number;
  count?: number;
  date_from?: string;
  date_to?: string;
  category?: string[];
  payment_method?: string[];
  review_status?: string[];
  source?: string[];
  vendor?: string;
  truck?: number;
  driver?: number;
  billable?: boolean;
  manual_only?: boolean;
  imported_only?: boolean;
  odometer_min?: number;
  odometer_max?: number;
  search?: string;
  sort?: string;
}

function expenseQuery(filters: ExpenseFilters): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;

    if (Array.isArray(value)) {
      // Empty array means "no filter", not "match nothing".
      for (const entry of value) params.append(`${key}[]`, String(entry));
    } else if (typeof value === "boolean") {
      if (value) params.set(key, "1");
    } else {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

export async function apiListExpenses(filters: ExpenseFilters = {}): Promise<ExpensePage> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<ExpenseItem> }>(
    `expense${expenseQuery(filters)}`,
  );
  const d = res?.data;
  return {
    items: pageItems(res),
    page:  d?.page  ?? 1,
    pages: d?.pages ?? 1,
    total: d?.total ?? 0,
    limit: d?.limit ?? 0,
  };
}

/**
 * Totals over the whole filtered set, not the current page — a headline
 * figure that changed when you paged forward would be worse than none.
 */
export async function apiExpenseSummary(filters: ExpenseFilters = {}): Promise<ExpenseSummary> {
  const res = await apiProxy<{ outcome: string; data: ExpenseSummary }>(
    `expense/summary${expenseQuery(filters)}`,
  );
  return res.data;
}

export async function apiExpenseVendors(filters: ExpenseFilters = {}): Promise<VendorTotal[]> {
  const res = await apiProxy<{ outcome: string; data: VendorTotal[] }>(
    `expense/vendors${expenseQuery(filters)}`,
  );
  return res.data ?? [];
}

export async function apiGetExpense(id: number): Promise<ExpenseItem> {
  const res = await apiProxy<{ outcome: string; data: ExpenseItem }>(`expense/${id}`);
  return res.data;
}

/** Request bodies are camelCase — they bind to Symfony forms. */
export async function apiCreateExpense(data: Record<string, unknown>): Promise<ExpenseItem> {
  const res = await apiProxy<{ outcome: string; data: ExpenseItem }>("expense", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function apiUpdateExpense(id: number, data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>(`expense/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteExpense(id: number): Promise<void> {
  await apiProxy<unknown>(`expense/${id}`, { method: "DELETE" });
}

export async function apiUploadExpenseReceipt(id: number, file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await apiUploadForm<{ outcome: string; data: { receiptHash: string } }>(
    `expense/${id}/receipt`,
    body,
  );
  return res.data.receiptHash;
}

// ─── Maintenance ─────────────────────────────────────────────────────────────

export interface MaintenanceItem {
  id: number;
  status: number;
  kind: string;
  state: string;
  service_type: string;
  truck?: TruckItem | null;
  trailer?: { id: number; trailer_number?: string } | null;
  description?: string;
  performed_on?: string;
  scheduled_for?: string;
  odometer_miles?: number;
  vendor_name?: string;
  work_order_number?: string;
  invoice_number?: string;
  estimated_cost?: string;
  cost?: string;
  notes?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MaintenanceScheduleItem {
  id: number;
  status: number;
  truck?: TruckItem | null;
  service_type: string;
  interval_miles?: number;
  interval_days?: number;
  last_service_on?: string;
  last_service_odometer?: number;
  alert_before_miles?: number;
  alert_before_days?: number;
}

/**
 * One computed due/overdue line. Every key is always present — the endpoint
 * serializes nulls deliberately so "no odometer reading" is distinguishable
 * from a field that was never sent.
 */
export interface MaintenanceDueItem {
  truck_id: number;
  truck_number: string | null;
  service_type: string;
  due_state: "on_track" | "due_soon" | "overdue";
  current_mileage: number | null;
  next_due_mileage: number | null;
  miles_until_due: number | null;
  next_due_on: string | null;
  days_until_due: number | null;
  interval_miles: number | null;
  interval_days: number | null;
  schedule_id: number;
  overridden: boolean;
}

export interface MaintenanceVendorRow {
  vendor: string;
  invoices: number;
  total: string;
  average: string;
  open_estimates: string;
}

export interface MaintenanceFilters {
  page?: number;
  count?: number;
  kind?: string[];
  state?: string[];
  service_type?: string[];
  truck?: number;
  date_from?: string;
  date_to?: string;
  vendor?: string;
  search?: string;
}

export async function apiListMaintenance(filters: MaintenanceFilters = {}): Promise<MaintenanceItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<MaintenanceItem> }>(
    `maintenance${expenseQuery(filters as ExpenseFilters)}`,
  );
  return pageItems(res);
}

export async function apiMaintenanceDue(state?: string): Promise<MaintenanceDueItem[]> {
  const res = await apiProxy<{ outcome: string; data: MaintenanceDueItem[] }>(
    `maintenance/due${state ? `?state=${encodeURIComponent(state)}` : ""}`,
  );
  return res.data ?? [];
}

export async function apiMaintenanceVendors(year?: number): Promise<MaintenanceVendorRow[]> {
  const res = await apiProxy<{ outcome: string; data: MaintenanceVendorRow[] }>(
    `maintenance/vendors${year ? `?year=${year}` : ""}`,
  );
  return res.data ?? [];
}

/**
 * One row of the per-truck rollup. Only trucks that have records appear, so
 * the By-truck table left-joins this onto the truck list rather than treating
 * it as the roster.
 *
 * `total` and `open_estimates` are absent for a caller without
 * `expenses.view_amounts`, the same way the vendor rollup drops them.
 */
export interface MaintenanceTruckRow {
  truck_id: number;
  truck_number: string | null;
  records: number;
  open_jobs: number;
  total?: string;
  open_estimates?: string;
  last_service_on: string | null;
}

export async function apiMaintenanceTrucks(): Promise<MaintenanceTruckRow[]> {
  const res = await apiProxy<{ outcome: string; data: MaintenanceTruckRow[] }>("maintenance/trucks");
  return res.data ?? [];
}

export async function apiCreateMaintenance(data: Record<string, unknown>): Promise<MaintenanceItem> {
  const res = await apiProxy<{ outcome: string; data: MaintenanceItem }>("maintenance", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function apiUpdateMaintenance(id: number, data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>(`maintenance/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteMaintenance(id: number): Promise<void> {
  await apiProxy<unknown>(`maintenance/${id}`, { method: "DELETE" });
}

export async function apiListMaintenanceSchedules(): Promise<MaintenanceScheduleItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<MaintenanceScheduleItem> }>(
    "maintenance/schedule?count=200",
  );
  return pageItems(res);
}

export async function apiCreateMaintenanceSchedule(data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>("maintenance/schedule", { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateMaintenanceSchedule(id: number, data: Record<string, unknown>): Promise<void> {
  await apiProxy<unknown>(`maintenance/schedule/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteMaintenanceSchedule(id: number): Promise<void> {
  await apiProxy<unknown>(`maintenance/schedule/${id}`, { method: "DELETE" });
}

/* ── Employee Retention ─────────────────────────────────────────────────── */

/**
 * The five headline metrics.
 *
 * Every figure here is nullable, and the page must render null as an
 * em-dash rather than a zero. Almost no driver on an ELD-imported roster has
 * a hire date, so "0.0 yrs average tenure" would be a lie that looks like a
 * fact. `data_gaps` says which field to go and fill in.
 */
export interface RetentionSummary {
  current_drivers: number;
  avg_tenure_years: number | null;
  retention_rate_12m: number | null;
  on_the_road: number;
  upcoming_reviews: number | null;
  past_drivers: number;
  hired_this_month: number;
  left_this_month: number;
  review_window_days: number;
  data_gaps: {
    total_drivers: number;
    current_drivers: number;
    missing_hire_date: number;
    missing_terminal: number;
    missing_email: number;
    missing_phone: number;
  };
}

export interface RetentionDriverRow {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  driver_number: string | null;
  status: string;
  truck: { id: number; number: string | null } | null;
  hire_date: string | null;
  terminated_at: string | null;
  separation_reason: string | null;
  tenure_days: number | null;
  home_terminal: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  on_the_road: boolean;
  active_load_count: number;
  last_active: string | null;
}

export interface RetentionDriverPage {
  items: RetentionDriverRow[];
  total: number;
  page: number;
  count: number;
}

export interface RetentionReview {
  driver_id: number;
  name: string;
  driver_number: string | null;
  home_terminal: string | null;
  hire_date: string | null;
  tenure_days: number | null;
  milestone: string;
  milestone_key: string;
  due_on: string;
  days_until: number;
}

export type CommunicationChannel = "email" | "sms" | "both";
export type CommunicationAudience = "current" | "past" | "all" | "custom";

export interface CommunicationRecipient {
  id: number;
  driver_id: number | null;
  driver_name: string;
  email_address: string | null;
  phone_number: string | null;
  email_state: "sent" | "failed" | "skipped" | null;
  sms_state: "sent" | "failed" | "skipped" | null;
  email_error: string | null;
  sms_error: string | null;
  created_at: string;
}

export interface CommunicationItem {
  id: number;
  channel: CommunicationChannel;
  audience: CommunicationAudience;
  subject: string | null;
  body: string;
  sent_at: string | null;
  recipient_count: number;
  email_sent: number;
  email_failed: number;
  sms_sent: number;
  sms_failed: number;
  /** Only on the detail route — the list deliberately leaves them out. */
  recipients?: CommunicationRecipient[];
}

/** How many of an audience can actually be reached on each channel. */
export interface AudienceReach {
  total: number;
  email: number;
  sms: number;
}

export interface RetentionDriverFilters {
  cohort?: "current" | "past";
  status?: string;
  terminal?: string;
  separation_reason?: string;
  search?: string;
  page?: number;
  count?: number;
}

function retentionQuery(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

export async function apiRetentionSummary(): Promise<RetentionSummary> {
  const res = await apiProxy<{ outcome: string; data: RetentionSummary }>("retention/summary");
  return res.data;
}

export async function apiRetentionDrivers(
  filters: RetentionDriverFilters = {},
): Promise<RetentionDriverPage> {
  const res = await apiProxy<{ outcome: string; data: RetentionDriverPage }>(
    `retention/drivers${retentionQuery(filters as Record<string, unknown>)}`,
  );
  return res.data ?? { items: [], total: 0, page: 1, count: 0 };
}

export async function apiRetentionTerminals(): Promise<string[]> {
  const res = await apiProxy<{ outcome: string; data: string[] }>("retention/terminals");
  return res.data ?? [];
}

export async function apiRetentionReviews(days?: number): Promise<RetentionReview[]> {
  const res = await apiProxy<{ outcome: string; data: RetentionReview[] }>(
    `retention/reviews${days ? `?days=${days}` : ""}`,
  );
  return res.data ?? [];
}

export async function apiRetentionAudience(
  audience: CommunicationAudience,
  driverIds: number[] = [],
): Promise<AudienceReach> {
  const res = await apiProxy<{ outcome: string; data: AudienceReach }>(
    `retention/communications/audience${retentionQuery({
      audience,
      driver_ids: driverIds.length ? driverIds.join(",") : "",
    })}`,
  );
  return res.data ?? { total: 0, email: 0, sms: 0 };
}

export async function apiListCommunications(count = 10): Promise<CommunicationItem[]> {
  const res = await apiProxy<{ outcome: string; data: PaginatedData<CommunicationItem> }>(
    `retention/communications?count=${count}`,
  );
  return pageItems(res);
}

export async function apiGetCommunication(id: number): Promise<CommunicationItem> {
  const res = await apiProxy<{ outcome: string; data: CommunicationItem }>(
    `retention/communications/${id}`,
  );
  return res.data;
}

/**
 * Composes and sends in one call — the API has no draft state.
 *
 * `idempotencyKey` is not optional in practice: it is what makes a
 * double-clicked Send bill once instead of twice. Generate one per compose.
 */
export async function apiSendCommunication(data: {
  channel: CommunicationChannel;
  audience: CommunicationAudience;
  subject?: string | null;
  body: string;
  driver_ids?: number[];
  idempotency_key: string;
}): Promise<CommunicationItem> {
  const res = await apiProxy<{ outcome: string; data: CommunicationItem }>(
    "retention/communications",
    { method: "POST", body: JSON.stringify(data) },
  );
  return res.data;
}

export async function apiDeleteCommunication(id: number): Promise<void> {
  await apiProxy<unknown>(`retention/communications/${id}`, { method: "DELETE" });
}
