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
 * POST a file as multipart/form-data under field `file`.
 *
 * Kept separate from apiJson because the body must stay a FormData — setting
 * Content-Type ourselves would strip the boundary the browser generates.
 * Returns the parsed body untouched: most endpoints wrap their result in
 * `{outcome, data}`, but the image ones answer with a bare array, so the
 * caller decides how to read it.
 */
async function apiUpload(path: string, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append("file", file);

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

  return body;
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

// ─── Loads ───────────────────────────────────────────────────────────────────

export interface LoadItem {
  id: number;
  status: string;
  reference_number?: string | null;
  origin?:           string | null;
  destination?:      string | null;
  pickup_date?:      string | null;
  delivery_date?:    string | null;
  /** Doctrine decimal comes across as a numeric string ("1250.00"). */
  rate?:             string | null;
  driver?: { id: number; first_name?: string | null; last_name?: string | null; phone?: string | null } | null;

  // Section 4 — Equipment Requirements
  trailer_type?:      string | null;
  temperature?:       string | null;
  weight_lbs?:        number | null;
  pallets_pieces?:    string | null;
  commodity?:         string | null;
  hazmat?:            boolean | null;
  seal_required?:     boolean | null;
  straps_load_bars?:  string | null;

  // Section 6 — Rate & Cost Breakdown (Doctrine decimals arrive as numbers via `float` serializer)
  line_haul_rate?:    number | null;
  fuel_surcharge?:    number | null;
  accessorials?:      number | null;
  detention?:         number | null;
  estimated_cost?:    number | null;

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
  window_start?:   string | null;  // HH:MM
  window_end?:     string | null;
  contact_person?: string | null;
  phone?:          string | null;
  hours_start?:    string | null;
  hours_end?:      string | null;
  scheduling_type?: string | null;
  reference?:      string | null;
  confirmed_on?:   string | null;  // ISO datetime
  confirmed_by?:   string | null;
  instructions?:   string | null;
  eta?:            string | null;  // ISO datetime
  pod_required?:   boolean | null;
  store_dc?:       string | null;
  latitude?:       number | null;
  longitude?:      number | null;
}

export async function apiGetLoad(id: number | string): Promise<LoadItem> {
  const res = await apiProxy<{ outcome: string; data: LoadItem }>(`load/${id}`);

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
}

/**
 * A single time-slice of weather. Returned as an array in WeatherForecast:
 *   • 1 bucket  — window-specific reading (when the caller passed window
 *                 start + end) with label like "08:00–12:00".
 *   • 4 buckets — Morning / Afternoon / Evening / Night breakdown.
 */
export interface WeatherBucket {
  label:       string;
  temp_f:      number;
  description: string;
  code:        number;
  rain_chance: number; // 0–100
}

export interface WeatherForecast {
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

export function apiRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  truck?: { lat: number; lng: number } | null,
): Promise<RouteSummary | null> {
  return nullOn404(() => apiProxy<RouteSummary>("route", {
    method: "POST",
    body:   JSON.stringify({ origin, destination, truck: truck ?? undefined }),
  }));
}

/**
 * `date` is `YYYY-MM-DD`. When both `windowStart` and `windowEnd` (each
 * `HH:MM`) are provided, the response contains a single window-aggregated
 * bucket; otherwise 4 time-of-day buckets covering the day.
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
 * Info about the local record a Quantum candidate matches:
 *   - "imported" — already linked to this ELD (nothing to do).
 *   - "vin"      — a local Truck exists with the same VIN (offer to link).
 *   - "license"  — same for Driver by license number.
 */
export interface EldImportMatch {
  type:       "imported" | "vin" | "license";
  localId:    number;
  localLabel: string;
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
   * Trucks import may auto-import (and auto-assign) drivers Quantum reports
   * as assigned to each vehicle. Absent / 0 when nothing was auto-imported.
   */
  driversAutoImported?: number;
  /**
   * Trucks import also reconciles already-imported trucks: if the driver
   * Quantum reports on a known truck has changed, the previous ELD-sourced
   * driver is unassigned and the new one is attached. Counts trucks touched
   * that way. Absent / 0 for the drivers import endpoint.
   */
  driversReassigned?: number;
  /**
   * Already-imported trucks whose ELD-managed fields (plate, year, make/model,
   * mileage, truck number) were refreshed to match Quantum's current state.
   * Only meaningful on the trucks import endpoint.
   */
  trucksRefreshed?: number;
  /**
   * Already-imported drivers whose ELD-managed fields (name, license state /
   * type / expiry, email, phone) were refreshed to match Quantum's state.
   * Applies to both endpoints.
   */
  driversRefreshed?: number;
  /**
   * ELD-imported trucks that were present in a prior sync but missing from
   * the current Quantum roster — soft-deactivated (status → inactive) rather
   * than deleted so history stays intact. Only meaningful on trucks import.
   */
  trucksInactivated?: number;
  /**
   * ELD-imported drivers missing from the current Quantum roster — flipped
   * to `terminated`. Only meaningful on drivers import.
   */
  driversTerminated?: number;
  /**
   * True when Quantum's paginated roster hit our safety cap and we can't
   * tell whether we saw the whole list. The removal / termination pass is
   * skipped in that case to avoid falsely marking real records inactive.
   */
  rosterIncomplete?: boolean;
  errors:   Array<{ externalId: string; reason: string }>;
}

export async function apiQuantumPreviewTrucks(): Promise<EldImportPreview> {
  return apiProxy<EldImportPreview>("quantum/import/trucks");
}

export async function apiQuantumImportTrucks(actions: EldImportActions): Promise<EldImportResult> {
  return apiProxy<EldImportResult>("quantum/import/trucks", {
    method: "POST",
    body: JSON.stringify(actions),
  });
}

export async function apiQuantumPreviewDrivers(): Promise<EldImportPreview> {
  return apiProxy<EldImportPreview>("quantum/import/drivers");
}

export async function apiQuantumImportDrivers(actions: EldImportActions): Promise<EldImportResult> {
  return apiProxy<EldImportResult>("quantum/import/drivers", {
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
