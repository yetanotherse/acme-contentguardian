import { FileText, Info } from "lucide-react";

import {
  getChangeEventsForVersions,
  getSourceVersions,
  listSources,
} from "@/db/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DiffView } from "@/components/diff-view";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { changeTypeColor, formatDate, pct, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  exam_guide: "Exam Guide",
  documentation: "Documentation",
  best_practices: "Best Practices",
};

export default function SourcesPage() {
  const sources = listSources();

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Sources
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          The authoritative materials the content is grounded in, with version
          history and detected changes.
        </p>
      </header>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          In this demo, new source versions are introduced via{" "}
          <span className="font-medium">Simulate Cloud Next Update</span> (top
          bar), which inserts a v2 of each source and runs change detection.
        </AlertDescription>
      </Alert>

      <div className="space-y-5">
        {sources.map((source) => {
          const versions = getSourceVersions(source.id);
          const latest = versions[0];
          const previous = versions[1];
          const changes = latest
            ? getChangeEventsForVersions([latest.id])
            : [];
          return (
            <Card key={source.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{source.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {KIND_LABEL[source.kind] ?? source.kind}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* version list */}
                <div className="flex flex-wrap gap-2">
                  {versions.map((v, i) => (
                    <div
                      key={v.id}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs",
                        i === 0 && "border-primary/40 bg-primary/5",
                      )}
                    >
                      <span className="font-medium">v{v.version}</span>{" "}
                      <span className="text-muted-foreground">
                        · {formatDate(v.createdAt)}
                      </span>
                      {i === 0 && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[9px] py-0"
                        >
                          latest
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {/* detected changes */}
                {changes.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Detected changes
                    </div>
                    {changes.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-md border px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              changeTypeColor(c.changeType),
                            )}
                          >
                            {titleCase(c.changeType)} · sev {pct(c.severity)}
                          </Badge>
                          <span className="font-medium">{c.summary}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {c.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* textual diff */}
                {previous && latest ? (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      v{previous.version} → v{latest.version} diff
                    </div>
                    <DiffView original={previous.body} proposed={latest.body} />
                  </div>
                ) : (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      View source text (v{latest?.version})
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
                      {latest?.body}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
