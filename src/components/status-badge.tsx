import { cn } from "@/lib/utils";
import { statusClasses, titleCase } from "@/lib/format";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        statusClasses(status),
        className,
      )}
    >
      {titleCase(status)}
    </span>
  );
}
