"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Busy = "simulate" | "heal" | "reset" | null;

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

export function GlobalActions() {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function run(action: Busy, fn: () => Promise<string>) {
    setBusy(action);
    try {
      const message = await fn();
      toast.success(message);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="default"
        disabled={busy !== null}
        onClick={() =>
          run("simulate", async () => {
            const data = await postJson("/api/simulate/gcp-next");
            return data.message as string;
          })
        }
      >
        {busy === "simulate" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Simulate Cloud Next Update
      </Button>

      <Button
        size="sm"
        variant="secondary"
        disabled={busy !== null}
        onClick={() =>
          run("heal", async () => {
            const data = await postJson("/api/workflows/run", {
              kind: "healing",
            });
            return `Healing complete — ${data.itemsImpacted} impacted, ${data.autoApproved} auto-approved, ${data.needsReview} for review.`;
          })
        }
      >
        {busy === "heal" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="h-4 w-4" />
        )}
        Run Healing
      </Button>

      <Button
        size="sm"
        variant="ghost"
        disabled={busy !== null}
        onClick={() =>
          run("reset", async () => {
            await postJson("/api/demo/reset");
            return "Demo reset to initial seeded state.";
          })
        }
      >
        {busy === "reset" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        Reset Demo
      </Button>
    </div>
  );
}
