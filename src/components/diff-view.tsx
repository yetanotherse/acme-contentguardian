import { diffWords } from "diff";

import { cn } from "@/lib/utils";

interface DiffViewProps {
  original: string;
  proposed: string;
  leftLabel?: string;
  rightLabel?: string;
}

/**
 * Word-level side-by-side diff. Left column shows the original content with
 * removed text struck through; right column shows the new content with additions
 * highlighted.
 */
export function DiffView({
  original,
  proposed,
  leftLabel = "Before",
  rightLabel = "Proposed update",
}: DiffViewProps) {
  const parts = diffWords(original, proposed);

  if (original.trim() === proposed.trim()) {
    return (
      <p className="text-sm text-muted-foreground">
        No textual differences between the two versions.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <DiffColumn label={leftLabel} tone="removed" parts={parts} />
      <DiffColumn label={rightLabel} tone="added" parts={parts} />
    </div>
  );
}

interface Part {
  value: string;
  added?: boolean;
  removed?: boolean;
}

function DiffColumn({
  label,
  tone,
  parts,
}: {
  label: string;
  tone: "added" | "removed";
  parts: Part[];
}) {
  return (
    <div className="rounded-lg border bg-background">
      <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="p-3 text-sm leading-relaxed whitespace-pre-wrap break-words font-mono">
        {parts.map((part, i) => {
          if (tone === "removed") {
            if (part.added) return null;
            return (
              <span
                key={i}
                className={cn(
                  part.removed &&
                    "bg-rose-100 text-rose-700 line-through decoration-rose-400",
                )}
              >
                {part.value}
              </span>
            );
          }
          // proposed column
          if (part.removed) return null;
          return (
            <span
              key={i}
              className={cn(part.added && "bg-emerald-100 text-emerald-800")}
            >
              {part.value}
            </span>
          );
        })}
      </div>
    </div>
  );
}
