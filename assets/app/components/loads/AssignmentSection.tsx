import { useMemo, useState } from "react";
import {
  Truck as TruckIcon, User as UserIcon, MapPin, Phone,
  CheckCircle2, X, AlertTriangle, Search, Info, Users,
} from "lucide-react";
import {
  SectionCard, captionCls, cellInputCls, cellLabelCls,
  fieldShellCls, fieldIconCls,
} from "../../lib/cells";
import { ScrollArea } from "../../lib/ui";
import type { AssignmentSuggestion, AssignmentVerdict } from "../../lib/api";

/**
 * Section 5 — Assignment (Dispatch). Dumb renderer.
 *
 * All ranking/filtering happens server-side; this component just paints
 * whatever the backend returned. `selected` is delivered separately so we
 * always show a full "Assigned" card even if the driver drops out of the
 * top N (e.g. their truck moved, or hazmat requirement was flipped on
 * after the pick).
 *
 * When Equipment (Section 4) marks the load as Hazmat, the backend hides
 * drivers without the endorsement — we surface the "Hazmat only" chip so
 * dispatchers know the pool was filtered.
 */

/**
 * Availability / equipment / location narrow the list the backend returned.
 * They filter rather than re-rank — the ranking is the backend's and stays
 * the backend's; these only decide which of its rows are worth showing.
 */
type Availability = "all" | "available" | "assigned";

export interface AssignmentSectionProps {
  /** Numbered by the page, which owns the sequence. */
  sectionNumber?:   number;
  suggestions:      AssignmentSuggestion[];
  selected:         AssignmentSuggestion | null;
  hazmatRequired:   boolean;
  /** True when Section 4 states anything about equipment. Gates what may call
   *  itself a "top match": with requirements on the table, a driver whose
   *  trailer nobody could verify is not a match, just the next name down. */
  equipmentRequired: boolean;
  /** True when pickup pin known — flips the sort label from name to distance. */
  sortByDistance:   boolean;
  loading?:         boolean;
  onSelectDriver:   (id: string) => void;
}

export default function AssignmentSection({
  sectionNumber = 5,
  suggestions, selected, hazmatRequired, equipmentRequired, sortByDistance,
  loading, onSelectDriver,
}: AssignmentSectionProps) {
  const [query,        setQuery]        = useState("");
  const [availability, setAvailability] = useState<Availability>("all");
  const [equipment,    setEquipment]    = useState("");
  const [location,     setLocation]     = useState("");
  // `eligible === false` rather than `!eligible`: a response without the
  // field (stale cache, half-rolled deploy) must read as "no verdict", not
  // as "everything is blocked".
  const selectedBlocked = selected?.eligible === false;

  // Client-side filter — cheap since the backend already caps the list at
  // 200 and pre-ranks it. Search matches driver name OR truck number,
  // case-insensitive. Selected card ignores the filter (always visible).
  // Menus are built from the rows the backend actually returned, so they can
  // never offer a trailer type or a city that would filter the list to empty.
  const equipmentOptions = useMemo(
    () => uniqueSorted(suggestions.map(s => s.trailer_type)),
    [suggestions],
  );
  const locationOptions = useMemo(
    () => uniqueSorted(suggestions.map(s => s.location_text)),
    [suggestions],
  );

  const shownList = useMemo(() => {
    const withoutSelected = selected
      ? suggestions.filter(s => s.driver_id !== selected.driver_id)
      : suggestions;
    const q = query.trim().toLowerCase();

    return withoutSelected.filter(s => {
      if (availability === "available" && s.eligible === false) return false;
      if (availability === "assigned"  && s.eligible !== false) return false;
      if (equipment && s.trailer_type  !== equipment) return false;
      if (location  && s.location_text !== location)  return false;
      if (!q) return true;
      const name  = s.driver_name.toLowerCase();
      const truck = (s.truck_number  ?? "").toLowerCase();
      const loc   = (s.location_text ?? "").toLowerCase();
      return name.includes(q) || truck.includes(q) || loc.includes(q);
    });
  }, [suggestions, selected, query, availability, equipment, location]);

  const totalCandidates = selected ? suggestions.length - 1 : suggestions.length;
  const filterActive    = query.trim().length > 0 || availability !== "all" || !!equipment || !!location;

  function clearFilters() {
    setQuery("");
    setAvailability("all");
    setEquipment("");
    setLocation("");
  }

  // Top matches is meaningful as soon as *any* ranking criterion is active.
  // A pickup pin drives distance ranking; equipment requirements rank on
  // their own — pick "Lowboy" with no address yet and the driver pulling the
  // Lowboy is still the answer. Without either, "top" would just be the head
  // of an alphabetical list, which tells a dispatcher nothing.
  const rankingActive = sortByDistance
    || suggestions.some(s => (s.matches?.length ?? 0) > 0);

  const topMatches = useMemo(() => {
    if (!rankingActive) return [];
    const pool = selected
      ? suggestions.filter(s => s.driver_id !== selected.driver_id)
      : suggestions;

    return pool
      // Blocked drivers rank last by construction; never let one into a list
      // headed "Top matches".
      .filter(s => s.eligible !== false)
      // Earning a slot takes a positive reason, not merely the absence of a
      // problem. Once the load names its equipment, that reason has to be a
      // verified trailer — otherwise the pane pads itself out to three with
      // whoever sorts next, and a driver bobtailing with no trailer at all
      // gets presented as a match for a Lowboy.
      // `equipment_confirmed` alone would still admit a trailer whose type
      // nobody recorded — present, but not a match for anything.
      .filter(s => equipmentRequired
        ? s.equipment_confirmed === true && (s.matches?.length ?? 0) > 0
        : (s.matches?.length ?? 0) > 0 || s.distance_mi != null)
      .slice(0, 3);
  }, [suggestions, selected, rankingActive, equipmentRequired]);

  return (
    <SectionCard
      n={sectionNumber}
      color="#8b5cf6"
      title="Assign Driver (Dispatch)"
      icon={Users}
      bare
      collapsible
      meta={
        <div className="flex items-center gap-3 flex-shrink-0">
          {hazmatRequired && (
            <span className={`${captionCls} text-amber-500 flex items-center gap-1`}>
              <AlertTriangle size={11} /> Hazmat only
            </span>
          )}
          <span className={captionCls}>
            {sortByDistance ? "By distance" : rankingActive ? "By match" : "By name"}
          </span>
        </div>
      }
    >
      {/* Filter bar — spans the panel, because it narrows the listing on the
          left and, through it, what can be assigned on the right. */}
      <div className="px-[var(--cell-px)] py-[var(--cell-py)] border-b border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
        <FilterField label="Search & filter">
          <Search size={14} className={fieldIconCls} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Name, truck #, or location"
            className={`${cellInputCls} flex-1 min-w-0`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </FilterField>

        <FilterField label="Availability">
          <FilterSelect
            value={availability}
            onChange={v => setAvailability(v as Availability)}
            options={[
              { value: "all",       label: "All drivers" },
              { value: "available", label: "Available only" },
              { value: "assigned",  label: "Has conflicts" },
            ]}
          />
        </FilterField>

        <FilterField label="Equipment type">
          <FilterSelect
            value={equipment}
            onChange={setEquipment}
            options={[
              { value: "", label: "All equipment" },
              ...equipmentOptions.map(o => ({ value: o, label: o })),
            ]}
          />
        </FilterField>

        <FilterField label="Location">
          <FilterSelect
            value={location}
            onChange={setLocation}
            options={[
              { value: "", label: "All locations" },
              ...locationOptions.map(o => ({ value: o, label: o })),
            ]}
          />
        </FilterField>
      </div>

      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 md:h-[520px]">
        {/* LEFT — searchable full listings */}
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between">
            <span className={captionCls}>
              Available drivers ({filterActive ? `${shownList.length} of ${totalCandidates}` : totalCandidates})
            </span>
            {filterActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[10px] font-mono text-primary hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>

          {loading && shownList.length === 0 && (
            <EmptyHint>Loading suggestions…</EmptyHint>
          )}
          {!loading && shownList.length === 0 && !filterActive && (
            <EmptyHint>
              {hazmatRequired
                ? "No active drivers with hazmat endorsement."
                : "No active drivers with assigned trucks yet."}
            </EmptyHint>
          )}
          {!loading && shownList.length === 0 && filterActive && (
            <EmptyHint>No drivers match these filters.</EmptyHint>
          )}

          {shownList.length > 0 && (
            <ScrollArea className="-mx-1 px-1">
              <div className="space-y-2 pb-1">
                {shownList.map(item => (
                  <SuggestionCard
                    key={item.driver_id}
                    item={item}
                    onAssign={() => onSelectDriver(String(item.driver_id))}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* RIGHT — two equal 50%/50% rows on md+: assigned + top matches */}
        <div className="grid grid-cols-1 md:grid-rows-2 gap-3 md:h-full min-h-0">
          {/* Top row: current assignment */}
          <div className="flex flex-col gap-2 min-h-0">
            <span className={`${captionCls} flex-shrink-0`}>
              Current assignment
            </span>
            {selected ? (
              <ScrollArea className="-mx-1 px-1" fadeHeight={16}>
                <div className="pb-1">
                  <SelectedCard
                    item={selected}
                    blocked={selectedBlocked}
                    onUnassign={() => onSelectDriver("")}
                  />
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <EmptyHint>No driver assigned yet.</EmptyHint>
              </div>
            )}
          </div>

          {/* Bottom row: top matches */}
          <div className="flex flex-col gap-2 min-h-0">
            <span className={`${captionCls} flex-shrink-0`}>
              Top matches
            </span>
            {topMatches.length === 0 ? (
              <div className="flex-1 min-h-0">
                <InfoPanel>
                  {rankingActive
                    ? "No driver's equipment matches this load yet."
                    : "Add a pickup address and equipment requirements to get driver suggestions."}
                </InfoPanel>
              </div>
            ) : (
              <ScrollArea className="-mx-1 px-1">
                <div className="space-y-2 pb-1">
                  {topMatches.map(item => (
                    <SuggestionCard
                      key={item.driver_id}
                      item={item}
                      onAssign={() => onSelectDriver(String(item.driver_id))}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Cards ──────────────────────────────────────────────────────────────────

function SelectedCard({ item, blocked, onUnassign }: {
  item: AssignmentSuggestion;
  blocked: boolean;
  onUnassign: () => void;
}) {
  // The specific reasons are spelled out by the verdict strip in the body, so
  // the header only has to say whether there are any.
  const count = item.blockers?.length ?? 0;
  return (
    <div className={`border rounded-md p-2.5 ${blocked ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold flex items-center gap-1 ${blocked ? "text-amber-500" : "text-emerald-500"}`}>
          {blocked ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
          {blocked ? `Assigned — ${count} issue${count === 1 ? "" : "s"}` : "Assigned"}
        </span>
        <button
          type="button"
          onClick={onUnassign}
          className="text-[11px] font-mono text-red-500 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <X size={11} /> Unassign
        </button>
      </div>
      <CardBody item={item} />
    </div>
  );
}

function SuggestionCard({ item, onAssign }: {
  item: AssignmentSuggestion;
  onAssign: () => void;
}) {
  // Blocked candidates stay assignable — a dispatcher overriding a rule is a
  // normal Tuesday — but the frame says plainly that a rule is being broken.
  const blocked = item.eligible === false;

  // The row is a button as well as containing one: the whole card stays
  // clickable for anyone who aims at the name, while the button on the right
  // is what makes the action findable at a glance in a scrolling list.
  return (
    <div
      onClick={onAssign}
      className={`border rounded-md p-2.5 flex items-center gap-3 transition-colors cursor-pointer group ${
        blocked
          ? "border-red-500/30 bg-red-500/[0.03] hover:border-red-500/50"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      }`}
    >
      <div className="flex-1 min-w-0">
        <CardBody item={item} />
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onAssign(); }}
        className={`flex-shrink-0 rounded-md border px-3 py-1.5 text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
          blocked
            ? "border-red-500/40 text-red-500 hover:bg-red-500 hover:text-white"
            : "border-primary/40 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary"
        }`}
      >
        {blocked ? "Assign anyway" : "Assign"}
      </button>
    </div>
  );
}

function CardBody({ item }: { item: AssignmentSuggestion }) {
  const truckLabel = item.truck_number ?? "no truck";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <UserIcon size={13} className="text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-semibold text-foreground truncate">{item.driver_name}</span>
        {item.phone && (
          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            <Phone size={10} /> {item.phone}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <TruckIcon size={13} className="text-muted-foreground flex-shrink-0" />
        <span className="text-[11px] font-mono text-muted-foreground truncate">
          {truckLabel}{item.truck_spec && ` · ${item.truck_spec}`}
        </span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <MapPin size={13} className="text-muted-foreground flex-shrink-0" />
        <span className="text-[11px] font-mono text-muted-foreground truncate flex-1">
          {item.location_text ?? "Location unknown"}
        </span>
        {item.distance_mi != null && (
          <span className={`text-[11px] font-mono font-semibold flex-shrink-0 ${
            item.location_stale ? "text-muted-foreground line-through decoration-1" : "text-foreground"
          }`}>
            {formatMiles(item.distance_mi)}
          </span>
        )}
      </div>
      <VerdictList
        blockers={item.blockers ?? []}
        warnings={item.warnings ?? []}
        matches={item.matches ?? []}
        blocked={item.eligible === false}
      />
    </div>
  );
}

/**
 * Why this driver is ranked where they are, as one wrapped row of chips:
 * green for requirements met, red for what blocks them, amber for what merely
 * wants a look. Chips rather than lines because a card can carry six of them,
 * and six sentences would bury the driver's name.
 *
 * Renders nothing when the backend had nothing to say, the common case on a
 * half-filled form.
 */
function VerdictList({ blockers, warnings, matches, blocked }: {
  blockers: AssignmentVerdict[];
  warnings: AssignmentVerdict[];
  matches:  AssignmentVerdict[];
  blocked:  boolean;
}) {
  if (blockers.length === 0 && warnings.length === 0 && matches.length === 0) return null;

  const green = matches.map(v  => <Chip key={v.code} tone="green" label={v.label} />);
  const red   = blockers.map(v => <Chip key={v.code} tone="red"   label={v.label} />);
  const amber = warnings.map(v => <Chip key={v.code} tone="amber" label={v.label} />);

  // A blocked card leading with green reads as approval, so what blocks it
  // goes first there.
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {blocked ? <>{red}{amber}{green}</> : <>{green}{red}{amber}</>}
    </div>
  );
}

const CHIP_TONES = {
  green: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  red:   "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/25",
  amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",
} as const;

function Chip({ tone, label }: { tone: keyof typeof CHIP_TONES; label: string }) {
  const Icon = tone === "green" ? CheckCircle2 : AlertTriangle;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]
                  font-mono border ${CHIP_TONES[tone]}`}
    >
      <Icon size={9} className="flex-shrink-0" />
      {label}
    </span>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-mono text-muted-foreground text-center py-4">{children}</div>
  );
}

/**
 * An empty Top Matches pane is not a failure, it's an instruction: the panel
 * is telling the dispatcher which field to fill in to make it work. A tinted
 * panel with an icon reads as guidance; centred grey text reads as "broken".
 */
function InfoPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-sky-500/25 bg-sky-500/[0.07] p-3">
      <Info size={14} className="text-sky-500 flex-shrink-0 mt-px" />
      <p className="text-[11px] font-mono text-sky-700 dark:text-sky-300 leading-snug">{children}</p>
    </div>
  );
}

/** A labelled control in the filter bar — the form kit's shell, minus Cell. */
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="group/cell block min-w-0 cursor-text">
      <div className={`${cellLabelCls} mb-1.5`}>{label}</div>
      <div className={fieldShellCls}>{children}</div>
    </label>
  );
}

function FilterSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`${cellInputCls} w-full cursor-pointer truncate [&>option]:bg-popover [&>option]:text-popover-foreground`}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Distinct, non-empty, alphabetical — the menu for a filter built from data. */
function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim() !== ""))).sort();
}

function formatMiles(m: number): string {
  return m < 10 ? `${m.toFixed(1)} mi` : `${Math.round(m).toLocaleString()} mi`;
}
