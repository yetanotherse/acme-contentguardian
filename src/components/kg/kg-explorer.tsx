"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Hash } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

export interface KGTopic {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string;
  count: number;
}

export interface KGContentItem {
  id: string;
  title: string;
  type: string;
  status: string;
}

interface KGExplorerProps {
  topics: KGTopic[];
  contentByTopic: Record<string, KGContentItem[]>;
}

export function KGExplorer({ topics, contentByTopic }: KGExplorerProps) {
  const roots = topics.filter((t) => t.parentId === null);
  const childrenOf = (id: string) => topics.filter((t) => t.parentId === id);
  const [selected, setSelected] = useState<KGTopic>(roots[0]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Tree */}
      <Card>
        <CardContent className="py-4">
          <div className="space-y-1">
            {roots.map((root) => (
              <TopicNode
                key={root.id}
                topic={root}
                childTopics={childrenOf(root.id)}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detail */}
      <Card>
        <CardContent className="py-4 space-y-3">
          {selected ? (
            <>
              <div>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">{selected.name}</h2>
                </div>
                <code className="text-[11px] text-muted-foreground">
                  {selected.slug}
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  {selected.description}
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Linked content ({contentByTopic[selected.id]?.length ?? 0})
                </div>
                <div className="space-y-1.5">
                  {(contentByTopic[selected.id] ?? []).map((c) => (
                    <Link
                      key={c.id}
                      href={`/content/${c.id}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 hover:border-primary/40"
                    >
                      <span className="text-sm truncate">{c.title}</span>
                      <StatusBadge status={c.status} />
                    </Link>
                  ))}
                  {(contentByTopic[selected.id]?.length ?? 0) === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No content linked to this topic yet.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a topic.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TopicNode({
  topic,
  childTopics,
  selectedId,
  onSelect,
}: {
  topic: KGTopic;
  childTopics: KGTopic[];
  selectedId?: string;
  onSelect: (t: KGTopic) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = childTopics.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer text-sm",
          selectedId === topic.id
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted",
        )}
        onClick={() => onSelect(topic)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            className="p-0.5"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                open && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="flex-1">{topic.name}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {topic.count}
        </span>
      </div>
      {hasChildren && open && (
        <div className="ml-4 border-l pl-2 space-y-0.5 mt-0.5">
          {childTopics.map((child) => (
            <TopicNode
              key={child.id}
              topic={child}
              childTopics={[]}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
