import { cn } from "@/lib/utils";
import { pct, scoreColor } from "@/lib/format";
import type { Evaluation } from "@/mastra/schemas";

interface ScorePanelProps {
  evaluation: Partial<Evaluation> & Record<string, unknown>;
  confidence?: number;
}

const DIMENSIONS: Array<{
  key: keyof Evaluation;
  label: string;
  invert?: boolean;
}> = [
  { key: "groundedness", label: "Groundedness" },
  { key: "accuracy", label: "Accuracy" },
  { key: "pedagogicalQuality", label: "Pedagogical Quality" },
  { key: "hallucinationRisk", label: "Hallucination Risk", invert: true },
];

export function ScorePanel({ evaluation, confidence }: ScorePanelProps) {
  return (
    <div className="space-y-3">
      {typeof confidence === "number" && (
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Overall confidence</span>
          <span className={cn("text-2xl font-semibold", scoreColor(confidence))}>
            {pct(confidence)}
          </span>
        </div>
      )}
      <div className="space-y-2.5">
        {DIMENSIONS.map(({ key, label, invert }) => {
          const value = Number(evaluation[key] ?? 0);
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    scoreColor(value, invert),
                  )}
                >
                  {pct(value)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    invert
                      ? value <= 0.15
                        ? "bg-emerald-500"
                        : value <= 0.3
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      : value >= 0.85
                        ? "bg-emerald-500"
                        : value >= 0.7
                          ? "bg-amber-500"
                          : "bg-rose-500",
                  )}
                  style={{ width: `${Math.round(value * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {evaluation.rationale && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2">
          {String(evaluation.rationale)}
        </p>
      )}
    </div>
  );
}
