import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertCircle, ArrowLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { Btn } from "../lib/ui";
import { captionCls } from "../lib/cells";
import {
  apiCreateLoad, apiAssignmentSuggestions, ApiError,
  type AssignmentSuggestionResponse,
} from "../lib/api";
import BasicInfoSection, { type StopWeather } from "../components/loads/BasicInfoSection";
import PickupDetailsSection from "../components/loads/PickupDetailsSection";
import DeliveryDetailsSection from "../components/loads/DeliveryDetailsSection";
import EquipmentSection, {
  emptyEquipmentForm, equipmentFormToPayload, type EquipmentFormState,
} from "../components/loads/EquipmentSection";
import RateCostSection, {
  emptyRateCostForm, rateCostFormToPayload, type RateCostFormState,
} from "../components/loads/RateCostSection";
import NotesSection, {
  emptyNotesForm, notesFormToPayload, type NotesFormState,
} from "../components/loads/NotesSection";
import AssignmentSection from "../components/loads/AssignmentSection";
import type { LoadMapPin, LoadMapStop } from "../components/loads/LoadMap";
import { useStopsWeather } from "../components/loads/weatherPreview";
import { toRouteKpis, useRouteSummary, useTruckPin } from "../components/loads/routeSummary";
import {
  addStop, canCreateLoad, canRemove, firstPickup, initialStops, lastDelivery,
  patchStopForm, removeStop, stopShortLabel, stopTitle, stopsToPayload,
  type StopEntry, type StopKind,
} from "../components/loads/stops";

/**
 * Load creation page — one column of stacked, foldable sections.
 *
 *   1. Route Overview   — map + weather + KPI strip (fed by the stops below)
 *   2… Stop Details     — one card per call on the run, pickups then drops,
 *                        with "Add a stop" on the seam between the two;
 *                        address → geocode → lettered pin → weather
 *   …  Assign Driver    — backend-ranked suggestions; the assigned driver's
 *                        truck becomes the deadhead origin for Section 1
 *   …  Equipment        — what the load needs hauled with
 *   …  Rate & Cost      — the money        ┐ side by side on a wide screen
 *   …  Notes            — free text        ┘
 *
 * The stop cards are a list, not a fixed pickup-and-delivery pair: a load can
 * be collected from two shippers or dropped at three stores, and the schema
 * has always allowed it. Section numbers are therefore computed rather than
 * written down — adding a stop pushes everything below it along. See stops.ts
 * for the list's rules; the short of it is that pickups precede deliveries
 * and the run's two ends can't be removed.
 *
 * Dispatch sits above Equipment rather than below it, even though equipment
 * requirements sharpen the ranking. A dispatcher's question on this page is
 * "who takes this load" — putting it straight after the stops keeps it near
 * the top, and the suggestion list re-ranks live as Equipment is filled in
 * underneath, so nothing is lost by asking the question before the inputs
 * are complete.
 *
 * The last two pair off because neither one fills a page-wide row on its own:
 * the ledger is a narrow column of figures with acres of empty band beside it,
 * and the notes are three boxes that only need to be wide enough to write in.
 */
export default function LoadAdd() {
  const navigate = useNavigate();

  // The run. Pins are held beside it rather than inside a stop, because a pin
  // is the geocoder's answer about an address, not something the dispatcher
  // typed — it is dropped when the stop goes and refreshed when it moves.
  const [stops, setStops] = useState<StopEntry[]>(initialStops);
  const [pins,  setPins]  = useState<Record<string, LoadMapPin | null>>({});

  const [equipmentForm, setEquipmentForm] = useState<EquipmentFormState>(emptyEquipmentForm());
  const [rateCostForm,  setRateCostForm]  = useState<RateCostFormState>(emptyRateCostForm());
  const [notesForm,     setNotesForm]     = useState<NotesFormState>(emptyNotesForm());

  // Assignment — backend-driven suggestions.
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [suggestions,      setSuggestions]      = useState<AssignmentSuggestionResponse>({ items: [], selected: null });
  const [suggestLoading,   setSuggestLoading]   = useState(false);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const weather = useStopsWeather(stops, pins);

  /**
   * The two ends of the run — the dates the load is booked against, and what
   * the dispatch panel ranks drivers on, since a call in the middle changes
   * neither the deadhead nor which drivers are near the start.
   *
   * The mileage is a different question: see routePins.
   */
  const from = firstPickup(stops);
  const to   = lastDelivery(stops);

  // Only the pickup pin is read on its own — it is what the dispatch panel
  // ranks drivers by distance from. The delivery end reaches the route
  // through routePins with every other stop.
  const pickupPin    = from ? pins[from.key] ?? null : null;
  const pickupDate   = from?.form.date ?? "";
  const deliveryDate = to?.form.date   ?? "";

  // Every stop in travel order, which is the trip the truck actually drives.
  // Holes are left in rather than filtered out: a stop still waiting on its
  // address means the route is not measurable yet, not that it is shorter.
  const routePins = useMemo(
    () => stops.map(stop => pins[stop.key] ?? null),
    [stops, pins],
  );

  // What the map draws: the stops that have actually landed somewhere, in
  // travel order, so the letters run A, B, C… down the page.
  const mapStops: LoadMapStop[] = useMemo(
    () => stops.flatMap(stop => {
      const pin = pins[stop.key];

      return pin ? [{ ...pin, kind: stop.kind }] : [];
    }),
    [stops, pins],
  );

  // One weather card per stop whether or not it has a forecast yet — an empty
  // card says "awaiting date & address", which is the instruction.
  const weatherCards: StopWeather[] = stops.map((stop, i) => ({
    label: stopShortLabel(stops, i),
    kind:  stop.kind,
    data:  weather[stop.key] ?? null,
  }));

  // Assigning a driver puts their truck on the map, which is what turns the
  // strip's Deadhead and ETA-to-Pickup cells from dimmed to answered.
  const truckPin = useTruckPin(suggestions.selected?.truck_number);
  const route    = useRouteSummary(routePins, truckPin);
  const kpis     = toRouteKpis(route);

  const hazmatRequired = equipmentForm.hazmat === "yes";

  // Does the Equipment section say anything the backend can check a trailer
  // against? Drives how strict "Top matches" is allowed to be.
  const equipmentRequired = hazmatRequired
    || [equipmentForm.trailerType, equipmentForm.temperature,
        equipmentForm.weightLbs, equipmentForm.strapsLoadBars]
       .some(v => v.trim() !== "");

  // Refetch suggestions whenever anything that could sharpen the ranking
  // changes. Nothing here is a prerequisite — the form is fed in whatever
  // state it is in, and the backend evaluates only the fields it was given.
  // A page with just a pickup pin still ranks by distance; adding a trailer
  // type or a date window only adds detail on top.
  //
  // Debounced 250ms so typing a weight is one request, not six.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setSuggestLoading(true);
      apiAssignmentSuggestions({
        pickupLat:      pickupPin?.lat,
        pickupLng:      pickupPin?.lng,
        pickupDate,
        deliveryDate,
        hazmat:         hazmatRequired,
        trailerType:    equipmentForm.trailerType,
        temperature:    equipmentForm.temperature,
        weightLbs:      equipmentForm.weightLbs,
        strapsLoadBars: equipmentForm.strapsLoadBars,
        limit:          200,
        selected:       selectedDriverId ? parseInt(selectedDriverId) : null,
      })
        .then(r => { if (!cancelled) setSuggestions(r); })
        .catch(() => { if (!cancelled) setSuggestions({ items: [], selected: null }); })
        .finally(() => { if (!cancelled) setSuggestLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [
    pickupPin?.lat, pickupPin?.lng,
    pickupDate, deliveryDate,
    hazmatRequired,
    equipmentForm.trailerType, equipmentForm.temperature,
    equipmentForm.weightLbs, equipmentForm.strapsLoadBars,
    selectedDriverId,
  ]);

  // ─── Stop list handlers ───────────────────────────────────────────────────

  const setPin = (key: string, pin: LoadMapPin | null) =>
    setPins(prev => ({ ...prev, [key]: pin }));

  const onAddStop = (kind: StopKind) => setStops(prev => addStop(prev, kind));

  const onRemoveStop = (key: string) => {
    setStops(prev => removeStop(prev, key));
    setPins(prev => {
      const next = { ...prev };
      delete next[key];

      return next;
    });
  };

  // ─── Save ─────────────────────────────────────────────────────────────────

  const canCreate = canCreateLoad(stops);

  /**
   * One POST for the whole page. Stops and rate lines are nested collections
   * on LoadType, so the load and its children save in a single transaction
   * and there is no half-created load to clean up if something fails.
   *
   * `status` is left out — the entity defaults to pending, and the form
   * submits with clearMissing off, so an omitted key keeps the default.
   * `company` is stamped server-side from the signed-in user.
   */
  async function createLoad() {
    setSaving(true);
    setError(null);
    try {
      const created = await apiCreateLoad({
        ...equipmentFormToPayload(equipmentForm),
        ...rateCostFormToPayload(rateCostForm),
        ...notesFormToPayload(notesForm),
        stops: stopsToPayload(stops, pins),
        ...(selectedDriverId ? { driver: Number(selectedDriverId) } : {}),
      });
      navigate(`/loads/${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create this load.");
      setSaving(false);
    }
  }

  // §1 is Route Overview and the stops run from §2, so everything below them
  // starts here and shifts as stops are added or dropped.
  const nextSection = stops.length + 2;

  /**
   * Where the run grows, and where it belongs: on the seam between the last
   * pickup and the first delivery.
   *
   * Under the whole list it read as a footer to the stops and sat against
   * Assign Driver, which is a different question. On the seam it is the one
   * place in the page where the run visibly changes from collecting to
   * dropping, so the offer to add a call is next to the break it would go
   * into — and "Pickup" then inserts directly above the control while
   * "Delivery" extends the block below it.
   *
   * Dashed rather than carded: it is the gap between two sections offering to
   * become one, not a section of its own.
   */
  const addStopBar = (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5">
      <span className={`${captionCls} hidden sm:block mr-1`}>Add a stop</span>
      <Btn variant="outline" onClick={() => onAddStop("pickup")}>
        <Plus size={11} className="inline mr-1" /> Pickup
      </Btn>
      <Btn variant="outline" onClick={() => onAddStop("delivery")}>
        <Plus size={11} className="inline mr-1" /> Delivery
      </Btn>
    </div>
  );

  // The last pickup. Falling back to the end of the list keeps the control on
  // screen in the state the list rules don't allow anyway — no pickups at all
  // — rather than having it quietly vanish.
  const lastPickupAt = stops.reduce((at, s, i) => (s.kind === "pickup" ? i : at), -1);
  const addStopBarAfter = lastPickupAt >= 0 ? lastPickupAt : stops.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-mono text-primary flex items-center gap-1.5">
            <Link to="/loads" className="hover:underline flex items-center gap-1">
              <ArrowLeft size={11} /> Loads
            </Link>
            <ChevronRight size={12} className="text-muted-foreground" />
            <span className="text-foreground">New</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground mt-1">New Load</h1>
        </div>
        <div className="flex items-center gap-2">
          {!canCreate && (
            <span className={`${captionCls} hidden sm:block`}>Pickup &amp; delivery address required</span>
          )}
          <Btn variant="outline" onClick={() => navigate("/loads")} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" disabled={!canCreate || saving} onClick={createLoad}>
            {saving
              ? <><Loader2 size={11} className="inline mr-1 animate-spin" /> Creating…</>
              : <><Plus size={11} className="inline mr-1" /> Create Load</>}
          </Btn>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 rounded px-3 py-2 text-xs font-mono text-red-400">
          <AlertCircle size={13} className="flex-shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}

      {/* §1 — always open: it is the readout the sections below feed. */}
      <BasicInfoSection
        stops={mapStops}
        truck={truckPin}
        weather={weatherCards}
        stopsAwaitingAddress={routePins.filter(p => !p).length}
        {...kpis}
      />

      {/* §2… — the run, one card per call, with the grow control sitting on
          the seam between collecting and dropping. */}
      {stops.map((stop, i) => {
        const shared = {
          sectionNumber: i + 2,
          title:         stopTitle(stops, i),
          onGeocode:     (pin: LoadMapPin | null) => setPin(stop.key, pin),
          onRemove:      canRemove(stops, stop.key) ? () => onRemoveStop(stop.key) : undefined,
        };

        return (
          <Fragment key={stop.key}>
            {stop.kind === "pickup" ? (
              <PickupDetailsSection
                value={stop.form}
                onChange={patch => setStops(prev => patchStopForm(prev, stop.key, patch))}
                {...shared}
              />
            ) : (
              <DeliveryDetailsSection
                value={stop.form}
                onChange={patch => setStops(prev => patchStopForm(prev, stop.key, patch))}
                {...shared}
              />
            )}
            {i === addStopBarAfter && addStopBar}
          </Fragment>
        );
      })}

      <AssignmentSection
        sectionNumber={nextSection}
        suggestions={suggestions.items}
        selected={suggestions.selected}
        hazmatRequired={hazmatRequired}
        equipmentRequired={equipmentRequired}
        sortByDistance={!!pickupPin}
        loading={suggestLoading}
        onSelectDriver={setSelectedDriverId}
      />

      <EquipmentSection
        sectionNumber={nextSection + 1}
        value={equipmentForm}
        onChange={patch => setEquipmentForm(prev => ({ ...prev, ...patch }))}
      />

      {/* Half each. items-start so the collapsed ledger keeps its own height
          instead of stretching to match the notes beside it. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <RateCostSection
          sectionNumber={nextSection + 2}
          value={rateCostForm}
          onChange={patch => setRateCostForm(prev => ({ ...prev, ...patch }))}
          totalMiles={route?.total_miles ?? null}
          milesSource={route?.source ?? null}
        />

        <NotesSection
          sectionNumber={nextSection + 3}
          value={notesForm}
          onChange={patch => setNotesForm(prev => ({ ...prev, ...patch }))}
          columns={1}
        />
      </div>
    </div>
  );
}
