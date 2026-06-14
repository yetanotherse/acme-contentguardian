import { CheckCircle2, Gavel, ShieldAlert, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ReviewReason {
  kind?: "policy" | "quality" | "guardrail" | "auto";
  title?: string;
  message?: string;
}

const STYLES: Record<
  string,
  { wrap: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }
> = {
  policy: {
    wrap: "border-amber-300 bg-amber-50",
    icon: Gavel,
    iconColor: "text-amber-600",
  },
  quality: {
    wrap: "border-amber-300 bg-amber-50",
    icon: TriangleAlert,
    iconColor: "text-amber-600",
  },
  guardrail: {
    wrap: "border-rose-300 bg-rose-50",
    icon: ShieldAlert,
    iconColor: "text-rose-600",
  },
  auto: {
    wrap: "border-emerald-300 bg-emerald-50",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
  },
};

/**
 * Prominent banner explaining the routing decision for a review task. The
 * governance-policy reason is the headline so high evaluator scores never read
 * as contradictory.
 */
export function ReviewReasonBanner({ reason }: { reason: ReviewReason }) {
  if (!reason.message) return null;
  const style = STYLES[reason.kind ?? "quality"] ?? STYLES.quality;
  const Icon = style.icon;

  return (
    <div className={cn("rounded-lg border p-4 flex gap-3", style.wrap)}>
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", style.iconColor)} />
      <div>
        <div className="text-sm font-semibold">
          {reason.title ?? "Review reason"}
        </div>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {reason.message}
        </p>
      </div>
    </div>
  );
}
