import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  ListChecks,
} from "lucide-react";

import {
  dashboardMetrics,
  listReviewTasks,
  listWorkflowRuns,
  recentChangeEvents,
} from "@/db/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { StalenessChart } from "@/components/dashboard/staleness-chart";
import { changeTypeColor, pct, relativeTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { decodeJson } from "@/db/exec";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [metrics, allReviews, runs, changes] = await Promise.all([
    dashboardMetrics(),
    listReviewTasks("needs_human"),
    listWorkflowRuns(5),
    recentChangeEvents(5),
  ]);
  const reviews = allReviews.slice(0, 5);

  const chartData = [
    { status: "Fresh", count: metrics.statusCounts.fresh },
    { status: "Stale", count: metrics.statusCounts.stale },
    { status: "In review", count: metrics.statusCounts.in_review },
    { status: "Healing", count: metrics.statusCounts.healing },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Health of the Google Cloud PCA content library. Use the top-bar actions
          to simulate a Cloud Next update and watch the system heal.
        </p>
      </header>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          icon={CheckCircle2}
          label="Content up-to-date"
          value={pct(metrics.upToDatePct)}
          tone="emerald"
          sub={`${metrics.statusCounts.fresh}/${metrics.totalContent} items fresh`}
        />
        <Metric
          icon={ListChecks}
          label="Pending reviews"
          value={String(metrics.pendingReviews)}
          tone={metrics.pendingReviews > 0 ? "amber" : "slate"}
          sub="awaiting human approval"
          href="/healing"
        />
        <Metric
          icon={Clock}
          label="Items healed"
          value={String(metrics.recentHeals)}
          tone="blue"
          sub="versions promoted"
        />
        <Metric
          icon={Gauge}
          label="Avg confidence"
          value={pct(metrics.avgConfidence)}
          tone="slate"
          sub="across all content"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Staleness distribution */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Staleness distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <StalenessChart data={chartData} />
          </CardContent>
        </Card>

        {/* Pending reviews */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Needs review
              <Link
                href="/healing"
                className="text-xs font-normal text-primary hover:underline"
              >
                View all
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing awaiting review.
              </p>
            ) : (
              reviews.map(({ task, item }) => (
                <Link
                  key={task.id}
                  href={`/healing/${task.id}`}
                  className="block rounded-md border px-3 py-2 hover:border-primary/40"
                >
                  <div className="text-sm font-medium truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    confidence {pct(task.confidence)} ·{" "}
                    {relativeTime(task.createdAt)}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent runs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent workflow runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              runs.map((run) => {
                const summary = decodeJson<{ itemsImpacted?: number }>(
                  run.summaryJson,
                );
                return (
                  <Link
                    key={run.id}
                    href={`/workflows/${run.id}`}
                    className="flex items-center gap-3 rounded-md border px-3 py-2 hover:border-primary/40"
                  >
                    <StatusBadge status={run.status} />
                    <span className="text-sm flex-1 truncate">
                      {titleCase(run.kind)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {typeof summary.itemsImpacted === "number"
                        ? `${summary.itemsImpacted} impacted`
                        : ""}{" "}
                      · {relativeTime(run.startedAt)}
                    </span>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent changes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Recent source changes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No source changes detected. Simulate a Cloud Next update to begin.
              </p>
            ) : (
              changes.map((c) => (
                <div key={c.id} className="rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", changeTypeColor(c.changeType))}
                    >
                      {titleCase(c.changeType)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      sev {pct(c.severity)} · {relativeTime(c.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm mt-1">{c.summary}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  blue: "text-blue-600",
  slate: "text-slate-600",
};

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tone: keyof typeof TONE | string;
  href?: string;
}) {
  const inner = (
    <Card className={href ? "transition-colors hover:border-primary/40" : ""}>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={cn("h-4 w-4", TONE[tone])} />
          {label}
        </div>
        <div className="text-2xl font-semibold mt-1.5">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
