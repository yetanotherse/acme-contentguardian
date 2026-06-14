import Link from "next/link";
import { ChevronRight, Gavel, ShieldCheck } from "lucide-react";

import { listReviewTasks, type ReviewTaskRow } from "@/db/queries";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { pct, relativeTime, scoreColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { decodeJson } from "@/db/exec";

export const dynamic = "force-dynamic";

export default async function HealingCenterPage() {
  const tasks = await listReviewTasks();
  const needsHuman = tasks.filter((t) => t.task.status === "needs_human");
  const others = tasks.filter((t) => t.task.status !== "needs_human");

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Healing Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review agent-generated proposals. High-confidence fixes are
          auto-approved; substantive changes are routed here for human approval.
        </p>
      </header>

      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <Section
            title="Needs human review"
            count={needsHuman.length}
            tasks={needsHuman}
          />
          <Section
            title="Resolved & auto-approved"
            count={others.length}
            tasks={others}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  tasks,
}: {
  title: string;
  count: number;
  tasks: ReviewTaskRow[];
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} ({count})
      </h2>
      <div className="space-y-2">
        {tasks.map(({ task, item }) => {
          const evalScores = decodeJson<{ verdict?: string }>(task.evalScores);
          const impact = decodeJson<{ staleReason?: string }>(task.impact);
          const reviewReason = decodeJson<{ kind?: string }>(task.reviewReason);
          const showPolicy =
            task.status === "needs_human" && reviewReason.kind === "policy";
          return (
            <Link key={task.id} href={`/healing/${task.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={task.status} />
                      <span className="text-[11px] text-muted-foreground capitalize">
                        {item.type}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        · {relativeTime(task.createdAt)}
                      </span>
                    </div>
                    <div className="font-medium text-sm mt-1 truncate">
                      {item.title}
                    </div>
                    {impact.staleReason && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {impact.staleReason}
                      </div>
                    )}
                    {showPolicy && (
                      <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium">
                        <Gavel className="h-3 w-3" />
                        Governance policy: requires human approval
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={cn(
                        "text-lg font-semibold",
                        scoreColor(task.confidence),
                      )}
                    >
                      {pct(task.confidence)}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {evalScores.verdict ?? "confidence"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-medium">No healing proposals yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Run{" "}
          <span className="font-medium">Simulate Cloud Next Update</span> then{" "}
          <span className="font-medium">Run Healing</span> from the top bar to
          generate proposals.
        </p>
      </CardContent>
    </Card>
  );
}
