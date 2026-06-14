"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ScanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "full_scan" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(
        `Full scan complete — ${json.data.itemsImpacted} impacted, ${json.data.autoApproved} auto-approved, ${json.data.needsReview} for review.`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={run} disabled={busy} size="sm">
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ScanSearch className="h-4 w-4" />
      )}
      Run Full Healing Scan
    </Button>
  );
}
