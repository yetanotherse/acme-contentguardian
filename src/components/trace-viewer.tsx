import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { RunStep } from "@/db/schema";

const AGENT_DOT: Record<string, string> = {
  "Change Detector": "bg-rose-500",
  "Impact Analyzer": "bg-amber-500",
  "Content Regenerator": "bg-blue-500",
  "Content Evaluator": "bg-violet-500",
  Triage: "bg-emerald-500",
  Orchestrator: "bg-slate-500",
};

export function TraceViewer({ steps }: { steps: RunStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No trace steps recorded.</p>
    );
  }
  return (
    <Accordion className="w-full">
      {steps.map((step) => (
        <AccordionItem key={step.id} value={step.id}>
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  AGENT_DOT[step.agent] ?? "bg-slate-400",
                  step.status === "error" && "bg-rose-600",
                )}
              />
              <span className="text-xs font-mono text-muted-foreground w-6">
                #{step.seq}
              </span>
              <div>
                <div className="text-sm font-medium">{step.agent}</div>
                <div className="text-xs text-muted-foreground">{step.step}</div>
              </div>
              {step.durationMs != null && (
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                  {step.durationMs}ms
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pl-8">
              {step.reasoning && (
                <p className="text-sm leading-relaxed">{step.reasoning}</p>
              )}
              <details className="group">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  View input / output payload
                </summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <TracePayload label="Input" json={step.inputJson} />
                  <TracePayload label="Output" json={step.outputJson} />
                </div>
              </details>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function TracePayload({ label, json }: { label: string; json: string }) {
  let pretty = json;
  try {
    pretty = JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    // keep raw
  }
  return (
    <div className="rounded-md border bg-muted/40">
      <div className="border-b px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-56 overflow-auto p-2 text-[11px] leading-relaxed">
        {pretty}
      </pre>
    </div>
  );
}
