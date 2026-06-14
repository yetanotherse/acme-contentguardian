import Link from "next/link";
import { ChevronRight, Workflow as WorkflowIcon } from "lucide-react";

import { listWorkflowRuns, getRunSteps } from "@/db/queries";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ScanButton } from "@/components/workflows/scan-button";
import { formatDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  healing: "Source-change healing",
  full_scan: "Full healing scan",
  feedback_loop: "Feedback incorporation",
};

export default function WorkflowsPage() {
  const runs = listWorkflowRuns();

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <WorkflowIcon className="h-5 w-5 text-primary" />
            Workflow Control Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every healing run is recorded with a step-by-step agent trace for
            full observability.
          </p>
        </div>
        <ScanButton />
      </header>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No workflow runs yet. Use{" "}
            <span className="font-medium">Run Full Healing Scan</span> or the
            top-bar actions.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const summary = JSON.parse(run.summaryJson || "{}");
            const stepCount = getRunSteps(run.id).length;
            return (
              <Link key={run.id} href={`/workflows/${run.id}`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex items-center gap-4 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={run.status} />
                        <span className="text-sm font-medium">
                          {KIND_LABEL[run.kind] ?? titleCase(run.kind)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDate(run.startedAt)} · {stepCount} steps
                        {typeof summary.itemsImpacted === "number" &&
                          ` · ${summary.itemsImpacted} impacted, ${summary.autoApproved ?? 0} auto-approved, ${summary.needsReview ?? 0} for review`}
                      </div>
                    </div>
                    <code className="text-[11px] text-muted-foreground hidden sm:block">
                      {run.id}
                    </code>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
