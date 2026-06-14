import { GitBranch } from "lucide-react";

import {
  contentCountByTopic,
  contentItemsForTopic,
  listTopics,
} from "@/db/queries";
import {
  KGExplorer,
  type KGContentItem,
  type KGTopic,
} from "@/components/kg/kg-explorer";

export const dynamic = "force-dynamic";

export default async function KnowledgeGraphPage() {
  const [counts, allTopics] = await Promise.all([
    contentCountByTopic(),
    listTopics(),
  ]);
  const topics: KGTopic[] = allTopics.map((t) => ({
    id: t.id,
    parentId: t.parentId,
    name: t.name,
    slug: t.slug,
    description: t.description,
    count: counts[t.id] ?? 0,
  }));

  const contentByTopic: Record<string, KGContentItem[]> = {};
  for (const t of topics) {
    contentByTopic[t.id] = (await contentItemsForTopic(t.id)).map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      status: c.status,
    }));
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          Knowledge Graph Explorer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          The hierarchy of certification topics. Impact analysis uses these links
          to find content affected by a source change. Select a topic to see its
          linked content.
        </p>
      </header>
      <KGExplorer topics={topics} contentByTopic={contentByTopic} />
    </div>
  );
}
