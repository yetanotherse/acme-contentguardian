"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { pct, relativeTime, scoreColor } from "@/lib/format";

export interface LibraryItem {
  id: string;
  title: string;
  type: string;
  status: string;
  confidence: number;
  lastHealedAt: string | null;
  topics: string[];
}

const STATUS_FILTERS = ["all", "fresh", "stale", "in_review"] as const;
const TYPE_FILTERS = ["all", "question", "lesson"] as const;

export function ContentLibrary({ items }: { items: LibraryItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (status !== "all" && it.status !== status) return false;
      if (type !== "all" && it.type !== type) return false;
      if (q && !it.title.toLowerCase().includes(q) && !it.topics.some((t) => t.includes(q)))
        return false;
      return true;
    });
  }, [items, query, status, type]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search content or topics…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <FilterGroup
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
        />
        <FilterGroup options={TYPE_FILTERS} value={type} onChange={setType} />
      </div>

      <div className="text-xs text-muted-foreground">
        {filtered.length} of {items.length} items
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((it) => (
          <Link key={it.id} href={`/content/${it.id}`}>
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="py-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm leading-snug">
                    {it.title}
                  </span>
                  <StatusBadge status={it.status} />
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {it.type}
                  </Badge>
                  {it.topics.slice(0, 3).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    confidence{" "}
                    <span className={cn("font-medium", scoreColor(it.confidence))}>
                      {pct(it.confidence)}
                    </span>
                  </span>
                  <span>
                    {it.lastHealedAt
                      ? `healed ${relativeTime(it.lastHealedAt)}`
                      : "original"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FilterGroup({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-md border bg-background p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded px-2.5 py-1 text-xs capitalize transition-colors",
            value === opt
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.replace("_", " ")}
        </button>
      ))}
    </div>
  );
}
