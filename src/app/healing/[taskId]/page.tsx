import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getReviewTaskDetail } from "@/db/queries";
import { bodyToText, parseBody } from "@/lib/content-types";
import { decodeJson } from "@/db/exec";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { DiffView } from "@/components/diff-view";
import { ScorePanel } from "@/components/score-panel";
import { TraceViewer } from "@/components/trace-viewer";
import { ContentBodyView } from "@/components/content-body-view";
import { ReviewActions } from "@/components/healing/review-actions";
import { ReviewReasonBanner } from "@/components/healing/review-reason-banner";
import { changeTypeColor, pct, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const detail = await getReviewTaskDetail(taskId);
  if (!detail) notFound();

  const { task, item, baseVersion, proposedVersion, changeEvent, runSteps } =
    detail;
  const evalScores = decodeJson<Record<string, unknown>>(task.evalScores);
  const impact = decodeJson<{
    impactScore?: number;
    staleReason?: string;
    affectedAspects?: string[];
  }>(task.impact);
  const reviewReason = decodeJson<Record<string, unknown>>(task.reviewReason);
  const affectedAspects: string[] = Array.isArray(impact.affectedAspects)
    ? impact.affectedAspects
    : [];

  const baseBody = baseVersion ? parseBody(baseVersion.bodyJson) : null;
  const proposedBody = proposedVersion
    ? parseBody(proposedVersion.bodyJson)
    : null;
  const originalText = baseBody ? bodyToText(item.type, baseBody) : "";
  const proposedText = proposedBody ? bodyToText(item.type, proposedBody) : "";
  const isOpen = task.status === "needs_human";
  const wasApplied =
    task.status === "auto_approved" || task.status === "approved";

  return (
    <div className="space-y-5 max-w-6xl">
      <Link
        href="/healing"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Healing Center
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status} />
            <span className="text-xs text-muted-foreground capitalize">
              {item.type}
            </span>
          </div>
          <h1 className="text-xl font-semibold mt-1.5">{item.title}</h1>
        </div>
      </div>

      <ReviewReasonBanner reason={reviewReason} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {changeEvent && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  Triggering change
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      changeTypeColor(changeEvent.changeType),
                    )}
                  >
                    {titleCase(changeEvent.changeType)} · severity{" "}
                    {pct(changeEvent.severity)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{changeEvent.summary}</p>
                <p className="text-muted-foreground">{changeEvent.detail}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Impact analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Impact score:</span>
                <span className="font-semibold">
                  {typeof impact.impactScore === "number"
                    ? pct(impact.impactScore)
                    : "—"}
                </span>
              </div>
              {impact.staleReason && (
                <p className="text-sm text-muted-foreground">
                  {impact.staleReason}
                </p>
              )}
              {affectedAspects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {affectedAspects.map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px]">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <Tabs defaultValue="diff">
                <TabsList>
                  <TabsTrigger value="diff">Side-by-side diff</TabsTrigger>
                  <TabsTrigger value="proposed">Proposed</TabsTrigger>
                  <TabsTrigger value="trace">
                    Reasoning trace ({runSteps.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="diff" className="pt-4">
                  <DiffView
                    original={originalText}
                    proposed={proposedText}
                    leftLabel={wasApplied ? "Previous version" : "Current (live)"}
                    rightLabel={wasApplied ? "Published update" : "Proposed update"}
                  />
                </TabsContent>
                <TabsContent value="proposed" className="pt-4">
                  {proposedBody && (
                    <ContentBodyView type={item.type} body={proposedBody} />
                  )}
                </TabsContent>
                <TabsContent value="trace" className="pt-4">
                  <TraceViewer steps={runSteps} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Evaluator scores</CardTitle>
            </CardHeader>
            <CardContent>
              <ScorePanel evaluation={evalScores} confidence={task.confidence} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Decision</CardTitle>
            </CardHeader>
            <CardContent>
              {isOpen && proposedBody ? (
                <ReviewActions
                  taskId={task.id}
                  type={item.type}
                  proposedBody={proposedBody}
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  This proposal is{" "}
                  <span className="font-medium">{titleCase(task.status)}</span>.
                  {task.status === "auto_approved" &&
                    " It cleared the auto-approve gate and was published automatically."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
