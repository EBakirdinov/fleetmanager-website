import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Btn } from "../lib/ui";
import { captionCls } from "../lib/cells";
import {
  apiGetLoad, apiUpdateLoad, apiUpdateLoadStop, apiWeather, ApiError,
  type LoadItem, type LoadStopItem,
} from "../lib/api";
import { driverLabel } from "../lib/loads";

import BasicInfoSection, { type WeatherPreview } from "../components/loads/BasicInfoSection";
import EditableSection from "../components/EditableSection";
import LoadSummaryStrip from "../components/loads/LoadSummaryStrip";
import PickupDetailsSection, {
  emptyPickupForm, pickupFormToStopPayload, type PickupFormState,
} from "../components/loads/PickupDetailsSection";
import DeliveryDetailsSection, {
  emptyDeliveryForm, deliveryFormToStopPayload, type DeliveryFormState,
} from "../components/loads/DeliveryDetailsSection";
import EquipmentSection, {
  emptyEquipmentForm, equipmentFormToPayload, type EquipmentFormState,
} from "../components/loads/EquipmentSection";
import RateCostSection, {
  emptyRateCostForm, rateCostFormToPayload, type RateCostFormState,
} from "../components/loads/RateCostSection";
import NotesSection, {
  emptyNotesForm, notesFormToPayload, type NotesFormState,
} from "../components/loads/NotesSection";
import StatusTimeline from "../components/loads/StatusTimeline";
import AdditionalInfoSection from "../components/loads/AdditionalInfoSection";
import type { LoadMapPin } from "../components/loads/LoadMap";
import { toWeatherPreview } from "../components/loads/weatherPreview";

/**
 * Load control page — the detail view and the edit form in one.
 *
 * Sections run 1–7 here. The numbering is the page's, not the components':
 * Assignment (5 on the Add page) has no place on this page yet, and the
 * status rail is part of Route Overview rather than a section of its own, so
 * what remains closes up instead of leaving holes in the sequence.
 *
 * There is no separate read-only page. Each section renders the very same
 * component the Add page uses, wrapped in an EditableSection that holds a
 * draft and flips the section between reading and editing. Two consequences
 * worth stating, because they are the reason for the shape:
 *
 *   • A field added to a section shows up here, correctly, with no work.
 *   • Saves are per section and go to the endpoint that owns those fields —
 *     the stop sections PATCH their stop, everything else PATCHes the load.
 *     A dispatcher fixing a phone number never risks overwriting the rate
 *     someone else changed while the page was open.
 */
export default function LoadEdit() {
  const { id }   = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [load,    setLoad]    = useState<LoadItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  /**
   * Pins the user is producing right now by typing an address, before any
   * save. The saved stop's own coordinates are the fallback, so the map and
   * weather follow along while an address is being edited and snap back to
   * the record on refresh — the backend re-geocodes a stop when its address
   * changes, so after a save the two agree.
   */
  const [livePickupPin,   setLivePickupPin]   = useState<LoadMapPin | null>(null);
  const [liveDeliveryPin, setLiveDeliveryPin] = useState<LoadMapPin | null>(null);

  const [pickupWeather,   setPickupWeather]   = useState<WeatherPreview | null>(null);
  const [deliveryWeather, setDeliveryWeather] = useState<WeatherPreview | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setLoad(await apiGetLoad(id));
      // The record is the truth again; drop the typed-ahead pins.
      setLivePickupPin(null);
      setLiveDeliveryPin(null);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load this record.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  const pickupStop   = load ? findStop(load, "pickup")   : null;
  const deliveryStop = load ? findStop(load, "delivery") : null;

  const pickupPin   = livePickupPin   ?? pinOf(pickupStop);
  const deliveryPin = liveDeliveryPin ?? pinOf(deliveryStop);

  // Weather needs a place and a day. Window bounds sharpen it: with both set
  // the backend returns one window-aggregated reading, otherwise four
  // time-of-day buckets.
  const pickupDate   = pickupStop?.date   ?? null;
  const pickupFrom   = pickupStop?.window_start ?? "";
  const pickupTo     = pickupStop?.window_end   ?? "";
  const deliveryDate = deliveryStop?.date ?? null;
  const deliveryFrom = deliveryStop?.window_start ?? "";
  const deliveryTo   = deliveryStop?.window_end   ?? "";
  const pickupLabel   = pickupStop?.address   ?? pickupPin?.label;
  const deliveryLabel = deliveryStop?.address ?? deliveryPin?.label;

  useEffect(() => {
    if (!pickupPin || !pickupDate) { setPickupWeather(null); return; }
    let cancelled = false;
    apiWeather(pickupPin.lat, pickupPin.lng, pickupDate, pickupFrom, pickupTo)
      .then(w => { if (!cancelled) setPickupWeather(toWeatherPreview(w, pickupLabel)); })
      .catch(() => { if (!cancelled) setPickupWeather(null); });
    return () => { cancelled = true; };
  }, [pickupPin?.lat, pickupPin?.lng, pickupDate, pickupFrom, pickupTo, pickupLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!deliveryPin || !deliveryDate) { setDeliveryWeather(null); return; }
    let cancelled = false;
    apiWeather(deliveryPin.lat, deliveryPin.lng, deliveryDate, deliveryFrom, deliveryTo)
      .then(w => { if (!cancelled) setDeliveryWeather(toWeatherPreview(w, deliveryLabel)); })
      .catch(() => { if (!cancelled) setDeliveryWeather(null); });
    return () => { cancelled = true; };
  }, [deliveryPin?.lat, deliveryPin?.lng, deliveryDate, deliveryFrom, deliveryTo, deliveryLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <Centered>Loading load…</Centered>;
  }
  if (error || !load) {
    return (
      <Centered>
        <div className="text-center">
          <p className="text-sm text-foreground">{error ?? "Load not found."}</p>
          <div className="mt-3">
            <Btn variant="outline" onClick={() => navigate("/loads")}>Back to loads</Btn>
          </div>
        </div>
      </Centered>
    );
  }

  const pickup   = pickupStop;
  const delivery = deliveryStop;
  const label    = load.reference_number || `#${load.id}`;

  // Saving a section then refetching keeps the page honest: the summary strip
  // and Additional Information are derived, and would otherwise sit stale
  // behind a section that just changed the numbers they derive from.
  const saveLoad = async (patch: Record<string, unknown>) => {
    await apiUpdateLoad(load.id, patch);
    await refresh();
  };
  const saveStop = async (stop: LoadStopItem | null, patch: Record<string, unknown>) => {
    if (!stop) throw new Error("This load has no such stop yet — create it from the Add page.");
    await apiUpdateLoadStop(load.id, stop.id, patch);
    await refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-mono text-primary flex items-center gap-1.5">
            <Link to="/loads" className="hover:underline flex items-center gap-1">
              <ArrowLeft size={11} /> Loads
            </Link>
            <ChevronRight size={12} className="text-muted-foreground" />
            <span className="text-foreground">{label}</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground mt-1">Load Details — {label}</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`${captionCls} hidden sm:block`}>Sections save on their own</span>
          <Btn variant="outline" onClick={refresh}>
            <RefreshCw size={11} className="inline mr-1.5" /> Refresh
          </Btn>
        </div>
      </div>

      {/* §1 Route overview + the at-a-glance strip */}
      <div className="flex flex-col">
        <BasicInfoSection
          pickup={pickupPin}
          delivery={deliveryPin}
          pickupWeather={pickupWeather}
          deliveryWeather={deliveryWeather}
          aside={<StatusTimeline status={load.status} />}
        />
        <div className="bg-card border border-t-0 border-border rounded-b-lg -mt-px">
          <LoadSummaryStrip
            value={{
              reference:  load.reference_number,
              status:     load.status,
              rate:       load.rate === null || load.rate === undefined ? null : Number(load.rate),
              driverName: load.driver ? driverLabel(load.driver) : null,
            }}
          />
        </div>
      </div>

      {/* §2 §3 §4 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
        <EditableSection
          value={pickupFormOf(pickup)}
          onSave={draft => saveStop(pickup, pickupFormToStopPayload(draft))}
        >
          {(draft, patch) => (
            <PickupDetailsSection value={draft} onChange={patch} onGeocode={setLivePickupPin} />
          )}
        </EditableSection>

        <EditableSection
          value={deliveryFormOf(delivery)}
          onSave={draft => saveStop(delivery, deliveryFormToStopPayload(draft))}
        >
          {(draft, patch) => (
            <DeliveryDetailsSection value={draft} onChange={patch} onGeocode={setLiveDeliveryPin} />
          )}
        </EditableSection>

        <EditableSection
          value={equipmentFormOf(load)}
          onSave={draft => saveLoad(equipmentFormToPayload(draft))}
        >
          {(draft, patch) => <EquipmentSection value={draft} onChange={patch} />}
        </EditableSection>
      </div>

      {/* §5 §6 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
        <div className="xl:col-span-2">
          <EditableSection
            value={rateFormOf(load)}
            onSave={draft => saveLoad(rateCostFormToPayload(draft))}
          >
            {(draft, patch) => <RateCostSection value={draft} onChange={patch} sectionNumber={5} />}
          </EditableSection>
        </div>

        <EditableSection
          value={notesFormOf(load)}
          onSave={draft => saveLoad(notesFormToPayload(draft))}
        >
          {(draft, patch) => (
            <NotesSection value={draft} onChange={patch} sectionNumber={6} columns={1} />
          )}
        </EditableSection>
      </div>

      {/* §7 */}
      <AdditionalInfoSection
        sectionNumber={7}
        value={{
          origin:      load.origin,
          destination: load.destination,
          companyName: load.company?.name,
          createdAt:   load.created_at,
          updatedAt:   load.updated_at,
        }}
      />
    </div>
  );
}

// ─── API shape → section form state ─────────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg py-16 flex items-center justify-center">
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function findStop(load: LoadItem, type: string): LoadStopItem | null {
  return (load.stops ?? []).find(s => s.type === type) ?? null;
}

function pinOf(stop: LoadStopItem | null): LoadMapPin | null {
  if (!stop || stop.latitude == null || stop.longitude == null) return null;

  return { lat: stop.latitude, lng: stop.longitude, label: stop.facility_name ?? "" };
}

/** "2026-05-04T14:15:00+00:00" → ["2026-05-04", "14:15"] */
function splitStamp(raw?: string | null): [string, string] {
  if (!raw) return ["", ""];
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(raw);

  return m ? [m[1], m[2]] : ["", ""];
}

function pickupFormOf(stop: LoadStopItem | null): PickupFormState {
  if (!stop) return emptyPickupForm();
  const [confirmedDate, confirmedTime] = splitStamp(stop.confirmed_on);

  return {
    facilityName:   stop.facility_name   ?? "",
    date:           stop.date            ?? "",
    address:        stop.address         ?? "",
    windowStart:    stop.window_start    ?? "",
    windowEnd:      stop.window_end      ?? "",
    contactPerson:  stop.contact_person  ?? "",
    hoursStart:     stop.hours_start     ?? "",
    hoursEnd:       stop.hours_end       ?? "",
    phone:          stop.phone           ?? "",
    schedulingType: stop.scheduling_type ?? "",
    reference:      stop.reference       ?? "",
    confirmedDate,
    confirmedTime,
    confirmedBy:    stop.confirmed_by    ?? "",
  };
}

function deliveryFormOf(stop: LoadStopItem | null): DeliveryFormState {
  if (!stop) return emptyDeliveryForm();
  const [etaDate, etaTime] = splitStamp(stop.eta);

  return {
    facilityName:  stop.facility_name  ?? "",
    date:          stop.date           ?? "",
    address:       stop.address        ?? "",
    windowStart:   stop.window_start   ?? "",
    windowEnd:     stop.window_end     ?? "",
    contactPerson: stop.contact_person ?? "",
    etaDate,
    etaTime,
    phone:         stop.phone          ?? "",
    instructions:  stop.instructions   ?? "",
    reference:     stop.reference      ?? "",
    podRequired:   stop.pod_required   ?? false,
    hoursStart:    stop.hours_start    ?? "",
    hoursEnd:      stop.hours_end      ?? "",
    storeDc:       stop.store_dc       ?? "",
  };
}

/** Booleans arrive as true/false/null; the form speaks "yes"/"no"/"". */
const yesNo = (v?: boolean | null): "" | "yes" | "no" =>
  v === true ? "yes" : v === false ? "no" : "";

function equipmentFormOf(load: LoadItem): EquipmentFormState {
  return {
    ...emptyEquipmentForm(),
    trailerType:    load.trailer_type      ?? "",
    temperature:    load.temperature       ?? "",
    weightLbs:      load.weight_lbs == null ? "" : String(load.weight_lbs),
    palletsPieces:  load.pallets_pieces    ?? "",
    commodity:      load.commodity         ?? "",
    hazmat:         yesNo(load.hazmat),
    sealRequired:   yesNo(load.seal_required),
    strapsLoadBars: load.straps_load_bars  ?? "",
  };
}

const moneyStr = (v?: number | null): string => (v == null ? "" : String(v));

function rateFormOf(load: LoadItem): RateCostFormState {
  return {
    ...emptyRateCostForm(),
    lineHaulRate:  moneyStr(load.line_haul_rate),
    fuelSurcharge: moneyStr(load.fuel_surcharge),
    accessorials:  moneyStr(load.accessorials),
    detention:     moneyStr(load.detention),
    estimatedCost: moneyStr(load.estimated_cost),
  };
}

function notesFormOf(load: LoadItem): NotesFormState {
  return {
    ...emptyNotesForm(),
    specialInstructions: load.special_instructions ?? "",
    brokerNotes:         load.broker_notes         ?? "",
    internalComments:    load.internal_comments    ?? "",
  };
}
