import { useMemo, useState } from "react";
import {
  Truck as TruckIcon, User as UserIcon, MapPin, Phone,
  CheckCircle2, X, AlertTriangle, Search,
} from "lucide-react";
import { SectionCard, captionCls, cellInputCls } from "../../lib/cells";
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

export interface AssignmentSectionProps {
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
  suggestions, selected, hazmatRequired, equipmentRequired, sortByDistance,
  loading, onSelectDriver,
}: AssignmentSectionProps) {
  const [query, setQuery] = useState("");
  // `eligible === false` rather than `!eligible`: a response without the
  // field (stale cache, half-rolled deploy) must read as "no verdict", not
  // as "everything is blocked".
  const selectedBlocked = selected?.eligible === false;

  // Client-side filter — cheap since the backend already caps the list at
  // 200 and pre-ranks it. Search matches driver name OR truck number,
  // case-insensitive. Selected card ignores the filter (always visible).
  const shownList = useMemo(() => {
    const withoutSelected = selected
      ? suggestions.filter(s => s.driver_id !== selected.driver_id)
      : suggestions;
    const q = query.trim().toLowerCase();
    if (!q) return withoutSelected;
    return withoutSelected.filter(s => {
      const name  = s.driver_name.toLowerCase();
      const truck = (s.truck_number  ?? "").toLowerCase();
      const loc   = (s.location_text ?? "").toLowerCase();
      return name.includes(q) || truck.includes(q) || loc.includes(q);
    });
  }, [suggestions, selected, query]);

  const totalCandidates = selected ? suggestions.length - 1 : suggestions.length;
  const filterActive    = query.trim().length > 0;

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
      n={5}
      color="#8b5cf6"
      title="Assignment (Dispatch)"
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
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 md:h-[520px]">
        {/* LEFT — searchable full listings */}
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between">
            <span className={captionCls}>
              All drivers
            </span>
            {filterActive && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {shownList.length} / {totalCandidates}
              </span>
            )}
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter by name, truck #, or location"
              className={`${cellInputCls} w-full border-b border-border rounded-none pl-7 pr-7 py-1.5 focus:border-primary transition-colors`}
            />
            {filterActive && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear filter"
              >
                <X size={12} />
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
            <EmptyHint>No drivers match “{query}”.</EmptyHint>
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
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <EmptyHint>
                  {rankingActive
                    ? "No driver's equipment matches this load yet."
                    : "Add a pickup address or equipment requirements to rank suggestions."}
                </EmptyHint>
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
  // Blocked candidates stay clickable — a dispatcher overriding a rule is a
  // normal Tuesday — but the frame says plainly that a rule is being broken.
  const blocked = item.eligible === false;
  return (
    <div
      onClick={onAssign}
      className={`border rounded-md p-2.5 transition-colors cursor-pointer group ${
        blocked
          ? "border-red-500/30 bg-red-500/[0.03] hover:border-red-500/50"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      }`}
    >
      <CardBody item={item} />
      <div className="mt-1.5 flex justify-end">
        <span className={`text-[11px] font-mono group-hover:underline ${blocked ? "text-red-500" : "text-primary"}`}>
          {blocked ? "Assign anyway →" : "Assign →"}
        </span>
      </div>
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

function formatMiles(m: number): string {
  return m < 10 ? `${m.toFixed(1)} mi` : `${Math.round(m).toLocaleString()} mi`;
}
