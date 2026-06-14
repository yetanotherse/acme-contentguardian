"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContentType } from "@/db/schema";
import type {
  ContentBody,
  LessonBody,
  QuestionBody,
} from "@/lib/content-types";

interface ReviewActionsProps {
  taskId: string;
  type: ContentType;
  proposedBody: ContentBody;
}

async function postReview(taskId: string, body: unknown): Promise<void> {
  const res = await fetch(`/api/review/${taskId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Request failed");
}

export function ReviewActions({
  taskId,
  type,
  proposedBody,
}: ReviewActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [edited, setEdited] = useState<ContentBody>(proposedBody);

  async function act(label: string, body: unknown, after: () => void) {
    setBusy(label);
    try {
      await postReview(taskId, body);
      after();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={busy !== null}
        onClick={() =>
          act("approve", { action: "approve" }, () => {
            toast.success("Approved — content is now live.");
            router.push("/healing");
            router.refresh();
          })
        }
      >
        {busy === "approve" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Approve
      </Button>

      {/* Edit & Approve */}
      <Button
        variant="secondary"
        disabled={busy !== null}
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="h-4 w-4" />
        Edit &amp; Approve
      </Button>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit proposed content</DialogTitle>
          </DialogHeader>
          {type === "question" ? (
            <QuestionEditor
              value={edited as QuestionBody}
              onChange={setEdited}
            />
          ) : (
            <LessonEditor value={edited as LessonBody} onChange={setEdited} />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy !== null}
              onClick={() =>
                act(
                  "edit",
                  { action: "approve", editedBody: edited },
                  () => {
                    toast.success("Edited and approved — content is live.");
                    setEditOpen(false);
                    router.push("/healing");
                    router.refresh();
                  },
                )
              }
            >
              {busy === "edit" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save &amp; Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject with feedback */}
      <Button
        variant="outline"
        disabled={busy !== null}
        onClick={() => setRejectOpen(true)}
      >
        <X className="h-4 w-4" />
        Reject &amp; Regenerate
      </Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject with feedback</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your feedback is fed back to the Regenerator agent, which produces a
            revised proposal for re-review.
          </p>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. The rationale should explicitly mention the Deployment Manager shutdown timeline and link migration guidance."
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null || feedback.trim().length < 4}
              onClick={() =>
                act("reject", { action: "reject", feedback }, () => {
                  toast.success("Regenerated with your feedback — re-review below.");
                  setRejectOpen(false);
                  router.refresh();
                })
              }
            >
              {busy === "reject" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Reject &amp; Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionEditor({
  value,
  onChange,
}: {
  value: QuestionBody;
  onChange: (b: QuestionBody) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Question stem</Label>
        <Textarea
          value={value.stem}
          rows={3}
          onChange={(e) => onChange({ ...value, stem: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Options (select the correct answer)</Label>
        {value.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              checked={value.answerIndex === i}
              onChange={() => onChange({ ...value, answerIndex: i })}
            />
            <Input
              value={opt}
              onChange={(e) => {
                const options = [...value.options];
                options[i] = e.target.value;
                onChange({ ...value, options });
              }}
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label>Rationale</Label>
        <Textarea
          value={value.rationale}
          rows={4}
          onChange={(e) => onChange({ ...value, rationale: e.target.value })}
        />
      </div>
    </div>
  );
}

function LessonEditor({
  value,
  onChange,
}: {
  value: LessonBody;
  onChange: (b: LessonBody) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>Lesson markdown</Label>
      <Textarea
        value={value.markdown}
        rows={16}
        className="font-mono text-xs"
        onChange={(e) => onChange({ markdown: e.target.value })}
      />
    </div>
  );
}
