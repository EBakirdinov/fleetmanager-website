import { CreditCard } from "lucide-react";
import { Cell, Row, SectionCard, bandCls, formMetrics } from "../../lib/cells";
import { useAuth } from "../../lib/auth";
import { formatDate } from "../../lib/validators";

/** Whole days from today until `iso`, negative once it has passed. */
function daysUntil(iso: string): number | null {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;

  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);
}

function expiryNote(validUntil: string | null | undefined): string | null {
  if (!validUntil) return null;

  const days = daysUntil(validUntil);
  if (days === null) return null;
  if (days < 0)  return "Expired";
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

/**
 * Billing.
 *
 * Read-only on purpose: `plan` and `validUntil` are stamped once at
 * registration and are not in CompanyType, and the API has no billing,
 * subscription or payment endpoints at all. An Upgrade button here would be
 * a button that cannot do anything.
 */
export default function BillingSettings() {
  const { user } = useAuth();
  const company = user?.company;

  const note = expiryNote(company?.validUntil);
  const expired = note === "Expired";

  return (
    <SectionCard icon={CreditCard} title="Subscription" style={formMetrics}>
      <Row>
        <Cell label="Current plan" as="div" boxed={false}>
          <span className="text-[length:var(--cell-fs)] text-foreground capitalize">
            {company?.plan ?? "—"}
          </span>
        </Cell>
        <Cell label="Valid until" as="div" hint={note ?? undefined} boxed={false}>
          <span className={`text-[length:var(--cell-fs)] ${expired ? "text-red-400" : "text-foreground"}`}>
            {company?.validUntil ? formatDate(company.validUntil) : "—"}
          </span>
        </Cell>
      </Row>
      <div className={bandCls}>
        <p className="text-[length:var(--cell-hint-fs)] font-mono text-muted-foreground/75">
          Contact support to change your subscription.
        </p>
      </div>
    </SectionCard>
  );
}
