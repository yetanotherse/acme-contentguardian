/** Small presentation helpers shared across UI components. */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Tailwind classes for a content/review/version status badge. */
export function statusClasses(status: string): string {
  switch (status) {
    case "fresh":
    case "approved":
    case "auto_approved":
    case "live":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "stale":
    case "rejected":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "in_review":
    case "needs_human":
    case "proposed":
    case "regenerating":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "healing":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "superseded":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function scoreColor(value: number, invert = false): string {
  const v = invert ? 1 - value : value;
  if (v >= 0.85) return "text-emerald-600";
  if (v >= 0.7) return "text-amber-600";
  return "text-rose-600";
}

export function changeTypeColor(type: string): string {
  switch (type) {
    case "deprecation":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "addition":
      return "bg-violet-100 text-violet-700 border-violet-200";
    case "emphasis":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "wording":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
