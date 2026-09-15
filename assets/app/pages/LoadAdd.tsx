import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { Btn } from "../lib/ui";
import {
  apiWeather, apiAssignmentSuggestions,
  type WeatherForecast, type AssignmentSuggestionResponse,
} from "../lib/api";
import BasicInfoSection, { type WeatherPreview } from "../components/loads/BasicInfoSection";
import PickupDetailsSection, {
  emptyPickupForm, type PickupFormState,
} from "../components/loads/PickupDetailsSection";
import DeliveryDetailsSection, {
  emptyDeliveryForm, type DeliveryFormState,
} from "../components/loads/DeliveryDetailsSection";
import EquipmentSection, {
  emptyEquipmentForm, type EquipmentFormState,
} from "../components/loads/EquipmentSection";
import RateCostSection, {
  emptyRateCostForm, type RateCostFormState,
} from "../components/loads/RateCostSection";
import NotesSection, {
  emptyNotesForm, type NotesFormState,
} from "../components/loads/NotesSection";
import AssignmentSection from "../components/loads/AssignmentSection";
import type { LoadMapPin } from "../components/loads/LoadMap";
import { toWeatherPreview } from "../components/loads/weatherPreview";

/**
 * Load creation page — built up section-by-section per the spec.
 *
 * Sections wired:
 *   1. Basic Info      — map + weather + KPI (receives pickup/delivery pins & weather)
 *   2. Pickup Details  — controlled; address → geocode → pickup pin → weather
 *   3. Delivery Details — controlled; address → geocode → delivery pin → weather
 *
 * Sections 4–7 & 9 land in follow-up rounds.
 */
export default function LoadAdd() {
  const navigate = useNavigate();

  const [pickupForm,     setPickupForm]     = useState<PickupFormState>(emptyPickupForm());
  const [pickupPin,      setPickupPin]      = useState<LoadMapPin | null>(null);
  const [pickupWeather,  setPickupWeather]  = useState<WeatherPreview | null>(null);

  const [deliveryForm,    setDeliveryForm]    = useState<DeliveryFormState>(emptyDeliveryForm());
  const [deliveryPin,     setDeliveryPin]     = useState<LoadMapPin | null>(null);
  const [deliveryWeather, setDeliveryWeather] = useState<WeatherPreview | null>(null);

  const [equipmentForm, setEquipmentForm] = useState<EquipmentFormState>(emptyEquipmentForm());
  const [rateCostForm,  setRateCostForm]  = useState<RateCostFormState>(emptyRateCostForm());
  const [notesForm,     setNotesForm]     = useState<NotesFormState>(emptyNotesForm());

  // Assignment (Section 5) — backend-driven suggestions.
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [suggestions,      setSuggestions]      = useState<AssignmentSuggestionResponse>({ items: [], selected: null });
  const [suggestLoading,   setSuggestLoading]   = useState(false);

  const hazmatRequired = equipmentForm.hazmat === "yes";

  // Does Section 4 say anything the backend can check a trailer against? Drives
  // how strict "Top matches" is allowed to be.
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
        pickupDate:     pickupForm.date,
        deliveryDate:   deliveryForm.date,
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
    pickupForm.date, deliveryForm.date,
    hazmatRequired,
    equipmentForm.trailerType, equipmentForm.temperature,
    equipmentForm.weightLbs, equipmentForm.strapsLoadBars,
    selectedDriverId,
  ]);

  // Weather fetch — fires whenever a pin lands, the date changes, OR the
  // time window changes. When both window bounds are set, the backend
  // returns a single window-aggregated bucket; otherwise 4 time-of-day
  // buckets. Cached server-side per (lat, lng, date, window) for 1h.
  useEffect(() => {
    if (!pickupPin || !pickupForm.date) { setPickupWeather(null); return; }
    let cancelled = false;
    apiWeather(
      pickupPin.lat, pickupPin.lng, pickupForm.date,
      pickupForm.windowStart, pickupForm.windowEnd,
    ).then(w => {
      if (!cancelled) setPickupWeather(toWeatherPreview(w, pickupForm.address || pickupPin.label));
    });
    return () => { cancelled = true; };
  }, [pickupPin, pickupForm.date, pickupForm.address, pickupForm.windowStart, pickupForm.windowEnd]);

  useEffect(() => {
    if (!deliveryPin || !deliveryForm.date) { setDeliveryWeather(null); return; }
    let cancelled = false;
    apiWeather(
      deliveryPin.lat, deliveryPin.lng, deliveryForm.date,
      deliveryForm.windowStart, deliveryForm.windowEnd,
    ).then(w => {
      if (!cancelled) setDeliveryWeather(toWeatherPreview(w, deliveryForm.address || deliveryPin.label));
    });
    return () => { cancelled = true; };
  }, [deliveryPin, deliveryForm.date, deliveryForm.address, deliveryForm.windowStart, deliveryForm.windowEnd]);

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
          <Btn variant="outline" onClick={() => navigate("/loads")}>Cancel</Btn>
          <Btn variant="primary" disabled>
            <Plus size={11} className="inline mr-1" /> Create Load
          </Btn>
        </div>
      </div>

      {/* Row 1: Section 1 (Basic Info) — full width. */}
      <BasicInfoSection
        pickup={pickupPin}
        delivery={deliveryPin}
        pickupWeather={pickupWeather}
        deliveryWeather={deliveryWeather}
      />

      {/* Row 2: Pickup, Delivery, Equipment side by side. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
        <PickupDetailsSection
          value={pickupForm}
          onChange={patch => setPickupForm(prev => ({ ...prev, ...patch }))}
          onGeocode={setPickupPin}
        />
        <DeliveryDetailsSection
          value={deliveryForm}
          onChange={patch => setDeliveryForm(prev => ({ ...prev, ...patch }))}
          onGeocode={setDeliveryPin}
        />
        <EquipmentSection
          value={equipmentForm}
          onChange={patch => setEquipmentForm(prev => ({ ...prev, ...patch }))}
        />
      </div>

      {/* Row 3: Section 5 spans 2/3 (listings on left, assigned + top matches on right)
          Section 6 takes the remaining 1/3. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
        <div className="xl:col-span-2">
          <AssignmentSection
            suggestions={suggestions.items}
            selected={suggestions.selected}
            hazmatRequired={hazmatRequired}
            equipmentRequired={equipmentRequired}
            sortByDistance={!!pickupPin}
            loading={suggestLoading}
            onSelectDriver={setSelectedDriverId}
          />
        </div>
        <RateCostSection
          value={rateCostForm}
          onChange={patch => setRateCostForm(prev => ({ ...prev, ...patch }))}
          totalMiles={null}
        />
      </div>

      {/* Row 4: Notes full width. */}
      <NotesSection
        value={notesForm}
        onChange={patch => setNotesForm(prev => ({ ...prev, ...patch }))}
      />
    </div>
  );
}

