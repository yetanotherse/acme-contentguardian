import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ContentType } from "@/db/schema";
import {
  isQuestionBody,
  parseBody,
  type ContentBody,
} from "@/lib/content-types";
import { Markdown } from "@/components/markdown";

interface ContentBodyViewProps {
  type: ContentType;
  body: ContentBody | string;
}

export function ContentBodyView({ type, body }: ContentBodyViewProps) {
  const parsed = typeof body === "string" ? parseBody(body) : body;

  if (isQuestionBody(type, parsed)) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium leading-relaxed">{parsed.stem}</p>
        <ul className="space-y-1.5">
          {parsed.options.map((opt, i) => {
            const correct = i === parsed.answerIndex;
            return (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                  correct
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-border bg-background",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    correct
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-muted-foreground/40 text-muted-foreground",
                  )}
                >
                  {correct ? <Check className="h-3 w-3" /> : String.fromCharCode(65 + i)}
                </span>
                <span className={correct ? "font-medium" : ""}>{opt}</span>
              </li>
            );
          })}
        </ul>
        <div className="rounded-md bg-muted/50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Rationale
          </div>
          <p className="text-sm leading-relaxed">{parsed.rationale}</p>
        </div>
      </div>
    );
  }

  return <Markdown>{"markdown" in parsed ? parsed.markdown : ""}</Markdown>;
}
