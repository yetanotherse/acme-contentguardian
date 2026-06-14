import { Library } from "lucide-react";

import { getContentCandidates } from "@/db/queries";
import {
  ContentLibrary,
  type LibraryItem,
} from "@/components/content/content-library";

export const dynamic = "force-dynamic";

export default async function ContentLibraryPage() {
  const items: LibraryItem[] = (await getContentCandidates()).map((c) => ({
    id: c.item.id,
    title: c.item.title,
    type: c.item.type,
    status: c.item.status,
    confidence: c.item.confidence,
    lastHealedAt: c.item.lastHealedAt,
    topics: c.topicSlugs,
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          Content Library
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every practice question and lesson, with live status, linked topics,
          and full version provenance.
        </p>
      </header>
      <ContentLibrary items={items} />
    </div>
  );
}
