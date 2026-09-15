import { Truck, Container, User } from "lucide-react";
import { SectionCard, captionCls } from "../../lib/cells";

/**
 * Section 5 — Assignment (Dispatch) placeholder.
 *
 * Rendered as a full-width card matching the other section chrome so the
 * numbering stays consistent in the Load form. The Smart Dispatch panel
 * (nearest-driver suggestions, best-match ranking, one-click dispatch)
 * lands in a follow-up.
 */
export default function AssignmentSectionPlaceholder() {
  return (
    <SectionCard
      n={5}
      color="#8b5cf6"
      title="Assignment (Dispatch)"
      meta={<span className={`${captionCls} flex-shrink-0`}>Coming soon</span>}
    >
      <div className="px-4 py-5 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-muted-foreground/60">
          <Truck size={16} />
          <span className="text-muted-foreground/40">·</span>
          <Container size={16} />
          <span className="text-muted-foreground/40">·</span>
          <User size={16} />
        </div>
        <p className="text-[11px] font-mono text-muted-foreground max-w-md leading-snug">
          Smart Dispatch will match a truck, trailer, and driver against this load
          and let dispatchers send the assignment in one click.
        </p>
      </div>
    </SectionCard>
  );
}
