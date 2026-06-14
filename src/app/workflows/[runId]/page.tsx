import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getWorkflowRun, getRunSteps } from "@/db/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { TraceViewer } from "@/components/trace-viewer";
import { formatDate, titleCase } from "@/lib/format";
import { decodeJson } from "@/db/exec";

export const dynamic = "force-dynamic";

export default async function WorkflowRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getWorkflowRun(runId);
  if (!run) notFound();
  const steps = await getRunSteps(runId);
  const summary = decodeJson<{
    changesDetected?: number;
    itemsImpacted?: number;
    autoApproved?: number;
    needsReview?: number;
  }>(run.summaryJson);
  const input = decodeJson<{ trigger?: string; provider?: string }>(
    run.inputJson,
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <Link
        href="/workflows"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workflows
      </Link>

      <div className="flex items-center gap-3">
        <StatusBadge status={run.status} />
        <h1 className="text-lg font-semibold">{titleCase(run.kind)} run</h1>
        <code className="text-xs text-muted-foreground">{run.id}</code>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Run summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Meta label="Started" value={formatDate(run.startedAt)} />
          <Meta label="Finished" value={formatDate(run.finishedAt)} />
          <Meta label="Trigger" value={input.trigger ?? "—"} />
          <Meta label="Provider" value={input.provider ?? "—"} />
          {typeof summary.changesDetected === "number" && (
            <Meta label="Changes" value={String(summary.changesDetected)} />
          )}
          {typeof summary.itemsImpacted === "number" && (
            <Meta label="Impacted" value={String(summary.itemsImpacted)} />
          )}
          {typeof summary.autoApproved === "number" && (
            <Meta label="Auto-approved" value={String(summary.autoApproved)} />
          )}
          {typeof summary.needsReview === "number" && (
            <Meta label="For review" value={String(summary.needsReview)} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Agent reasoning trace ({steps.length} steps)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TraceViewer steps={steps} />
        </CardContent>
      </Card>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-medium mt-0.5 break-words">{value}</div>
    </div>
  );
}
