import { BarChart3 } from "lucide-react";

import {
  contentStatusCounts,
  countReviewTasksByStatus,
  listWorkflowRuns,
} from "@/db/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ContentHealthChart,
  ReviewOutcomesChart,
} from "@/components/analytics/analytics-charts";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const status = contentStatusCounts();
  const reviews = countReviewTasksByStatus();
  const runs = listWorkflowRuns(100);

  const totalProposals = Object.values(reviews).reduce((a, b) => a + b, 0);
  const autoApproved = reviews.auto_approved ?? 0;
  const humanHandled =
    (reviews.approved ?? 0) +
    (reviews.rejected ?? 0) +
    (reviews.needs_human ?? 0);
  const autoApprovalRate = totalProposals ? autoApproved / totalProposals : 0;
  const interventionRate = totalProposals ? humanHandled / totalProposals : 0;
  const totalContent = Object.values(status).reduce((a, b) => a + b, 0);

  const contentHealth = [
    { name: "Fresh", value: status.fresh, color: "#10b981" },
    { name: "Stale", value: status.stale, color: "#f43f5e" },
    { name: "In review", value: status.in_review, color: "#f59e0b" },
    { name: "Healing", value: status.healing, color: "#3b82f6" },
  ].filter((d) => d.value > 0);

  const reviewOutcomes = [
    { name: "Auto-approved", value: reviews.auto_approved ?? 0, color: "#10b981" },
    { name: "Approved", value: reviews.approved ?? 0, color: "#22c55e" },
    { name: "Needs human", value: reviews.needs_human ?? 0, color: "#f59e0b" },
    { name: "Rejected", value: reviews.rejected ?? 0, color: "#f43f5e" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Healing throughput and human-oversight metrics.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total content" value={String(totalContent)} />
        <Stat label="Proposals generated" value={String(totalProposals)} />
        <Stat
          label="Auto-approval rate"
          value={pct(autoApprovalRate)}
          tone="text-emerald-600"
        />
        <Stat
          label="Human intervention"
          value={pct(interventionRate)}
          tone="text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Content health</CardTitle>
          </CardHeader>
          <CardContent>
            {contentHealth.length > 0 ? (
              <ContentHealthChart data={contentHealth} />
            ) : (
              <Empty />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Healing outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {reviewOutcomes.length > 0 ? (
              <ReviewOutcomesChart data={reviewOutcomes} />
            ) : (
              <Empty />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Workflow activity</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <Stat
            label="Total runs"
            value={String(runs.length)}
            inline
          />
          <Stat
            label="Completed"
            value={String(runs.filter((r) => r.status === "completed").length)}
            inline
          />
          <Stat
            label="Failed"
            value={String(runs.filter((r) => r.status === "failed").length)}
            inline
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  inline,
}: {
  label: string;
  value: string;
  tone?: string;
  inline?: boolean;
}) {
  const content = (
    <>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${tone ?? ""}`}>{value}</div>
    </>
  );
  if (inline) return <div>{content}</div>;
  return (
    <Card>
      <CardContent className="py-4">{content}</CardContent>
    </Card>
  );
}

function Empty() {
  return (
    <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
      No data yet — run a healing workflow.
    </div>
  );
}
