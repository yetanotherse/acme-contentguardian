import { Boxes, Bot, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { SourceVersion } from "@/db/schema";

export interface ProvenanceData {
  sourceVersions: SourceVersion[];
  kgTopics: string[];
  agentContext: {
    model?: string;
    mode?: string;
    changeNotes?: string;
    citations?: string[];
    humanEdited?: boolean;
    origin?: string;
    note?: string;
    staleReason?: string;
    regeneratedFromFeedback?: string;
  };
}

/**
 * Provenance panel: the full chain that produced a content version — which
 * source versions grounded it, the knowledge-graph snapshot at generation time,
 * and the agent context (model, change notes, citations, human edits).
 */
export function Provenance({ data }: { data: ProvenanceData }) {
  const { sourceVersions, kgTopics, agentContext } = data;
  return (
    <div className="space-y-4">
      <Section icon={FileText} title="Source versions used">
        {sourceVersions.length === 0 ? (
          <Empty>No linked source versions.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {sourceVersions.map((sv) => (
              <li
                key={sv.id}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <div className="font-medium">{sv.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  version {sv.version} · {sv.id}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Boxes} title="Knowledge-graph snapshot">
        {kgTopics.length === 0 ? (
          <Empty>No topic snapshot recorded.</Empty>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {kgTopics.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Bot} title="Agent context">
        <dl className="space-y-1.5 text-sm">
          {agentContext.origin === "initial_seed" ? (
            <Row label="Origin" value="Initial seed (authored from PCA sources)" />
          ) : (
            <>
              {agentContext.model && (
                <Row label="Model" value={agentContext.model} />
              )}
              {agentContext.mode && (
                <Row label="Mode" value={agentContext.mode} />
              )}
              {agentContext.staleReason && (
                <Row label="Trigger" value={agentContext.staleReason} />
              )}
              {agentContext.changeNotes && (
                <Row label="Change notes" value={agentContext.changeNotes} />
              )}
              {agentContext.regeneratedFromFeedback && (
                <Row
                  label="Reviewer feedback"
                  value={agentContext.regeneratedFromFeedback}
                />
              )}
              {agentContext.humanEdited && (
                <Row label="Human edited" value="Yes — edited before approval" />
              )}
            </>
          )}
          {agentContext.citations && agentContext.citations.length > 0 && (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Citations
              </dt>
              <dd className="mt-1 space-y-1">
                {agentContext.citations.map((c, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    • {c}
                  </div>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 leading-relaxed">{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
