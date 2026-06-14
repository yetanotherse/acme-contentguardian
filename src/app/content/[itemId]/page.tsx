import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  getContentItem,
  getContentVersion,
  getContentVersions,
  getSourceVersionsByIds,
  getTopicSlugsForItem,
} from "@/db/queries";
import { bodyToText, parseBody } from "@/lib/content-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { ContentBodyView } from "@/components/content-body-view";
import { DiffView } from "@/components/diff-view";
import { Provenance, type ProvenanceData } from "@/components/content/provenance";
import { decodeJson } from "@/db/exec";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const item = await getContentItem(itemId);
  if (!item) notFound();

  const versions = await getContentVersions(itemId);
  const current = item.currentVersionId
    ? await getContentVersion(item.currentVersionId)
    : versions[0];
  const topicSlugs = await getTopicSlugsForItem(itemId);

  // Diff: current live vs the version immediately before it (if any).
  const liveIndex = versions.findIndex((v) => v.id === current?.id);
  const previous = liveIndex >= 0 ? versions[liveIndex + 1] : versions[1];

  const currentBody = current ? parseBody(current.bodyJson) : null;
  const agentContext: ProvenanceData["agentContext"] = current
    ? decodeJson<ProvenanceData["agentContext"]>(current.agentContext)
    : {};
  const kgSnapshot = current
    ? decodeJson<{ topics?: unknown[] }>(current.kgSnapshot)
    : {};
  const kgTopics: string[] = Array.isArray(kgSnapshot.topics)
    ? kgSnapshot.topics.map((t: unknown) =>
        typeof t === "string" ? t : (t as { name?: string }).name ?? "",
      )
    : topicSlugs;
  const sourceVersionIds: string[] = current
    ? decodeJson<string[]>(current.sourceVersionIds)
    : [];
  const sourceVersions = await getSourceVersionsByIds(sourceVersionIds);

  return (
    <div className="space-y-5 max-w-6xl">
      <Link
        href="/content"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Content Library
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} />
          <span className="text-xs text-muted-foreground capitalize">
            {item.type}
          </span>
        </div>
        <h1 className="text-xl font-semibold mt-1.5">{item.title}</h1>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {topicSlugs.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Current content (v{current?.version ?? 1})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentBody && (
                <ContentBodyView type={item.type} body={currentBody} />
              )}
            </CardContent>
          </Card>

          {previous && current && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  What changed (v{previous.version} → v{current.version})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DiffView
                  original={bodyToText(item.type, parseBody(previous.bodyJson))}
                  proposed={bodyToText(item.type, parseBody(current.bodyJson))}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Provenance</CardTitle>
            </CardHeader>
            <CardContent>
              <Provenance
                data={{ sourceVersions, kgTopics, agentContext }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Version history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    v.id === current?.id && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">v{v.version}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDate(v.createdAt)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
