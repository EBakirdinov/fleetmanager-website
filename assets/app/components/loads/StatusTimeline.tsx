import { captionCls } from "../../lib/cells";
import { LOAD_STATUS_LABEL } from "../../lib/loads";

/**
 * Where the load has got to, as a rail.
 *
 * Status is one field, but a dispatcher reads it as a journey: what has
 * happened, what is happening, what is still ahead. A single chip answers
 * none of that.
 *
 * Rendered as a bare panel rather than a numbered section — it lives inside
 * Route Overview, alongside the map and weather, because it belongs with the
 * other "state of this run right now" readouts rather than among the sections
 * you fill in. It reports; it does not steer. Advancing a load happens from
 * the status control, which is why there is nothing to edit here.
 */

/**
 * Ordered as the load actually moves. These are the backend's own statuses
 * (Load::STATUS_*), not a mockup's — inventing stages here would put the rail
 * out of step with the value every other screen reads.
 *
 * `cancelled` is deliberately absent: it ends the journey rather than sitting
 * on it, and is called out separately below.
 */
const STAGES = ["pending", "assigned", "in_transit", "delivered"] as const;

export default function StatusTimeline({ status }: { status?: string | null }) {
  const cancelled = status === "cancelled";
  const current   = STAGES.indexOf((status ?? "") as typeof STAGES[number]);

  return (
    <div className="flex flex-col h-full p-[var(--cell-px)]">
      {/* "Progress", not "Status": the summary strip directly below already
          carries a Status pill, and two captions reading STATUS in the same
          band look like a duplicated element rather than two useful views —
          the pill says which state, this says how far along. */}
      <div className={`${captionCls} flex-shrink-0`}>Timeline / Status Tracking</div>

      {cancelled && (
        <div className="mt-2 px-2 py-1.5 rounded bg-red-500/[0.09] flex-shrink-0">
          <div className="text-[length:var(--cell-fs)] font-semibold text-red-500">Cancelled</div>
          <div className={`${captionCls} mt-0.5`}>No longer running</div>
        </div>
      )}

      {/* The rail fills the panel: stages spread over the available height and
          the connectors take up the slack, so the last stage lands at the
          bottom instead of the whole thing bunching under the caption. */}
      <ol className={`flex flex-col flex-1 min-h-0 mt-3 ${cancelled ? "opacity-40" : ""}`}>
        {STAGES.map((stage, i) => {
          const done    = current > -1 && i < current;
          const active  = i === current;
          const pending = !done && !active;

          return (
            <li
              key={stage}
              className={`flex gap-2.5 ${
                // Every stage but the last grows; the last is content-height
                // so its dot sits on the floor of the panel.
                i < STAGES.length - 1 ? "flex-1 min-h-[2.75rem]" : ""
              }`}
            >
              {/* Rail: the dot, plus the connector down to the next stage. */}
              <div className="flex flex-col items-center flex-shrink-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full border-2 mt-1 ${
                    done     ? "bg-emerald-500 border-emerald-500"
                    : active ? "bg-primary border-primary"
                    : "bg-transparent border-border"
                  }`}
                />
                {i < STAGES.length - 1 && (
                  <span className={`w-px flex-1 my-1 ${done ? "bg-emerald-500/40" : "bg-border"}`} />
                )}
              </div>

              <div className="min-w-0 pb-2">
                <div className={`text-[length:var(--cell-fs)] leading-none ${
                  active    ? "font-semibold text-foreground"
                  : pending ? "text-muted-foreground/60"
                  : "text-foreground"
                }`}>
                  {LOAD_STATUS_LABEL[stage] ?? stage}
                </div>
                {active && (
                  <div className={`${captionCls} text-primary mt-1`}>Current</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
