import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-4xl font-semibold text-muted-foreground/40">404</div>
      <h2 className="text-lg font-semibold mt-2">Not found</h2>
      <p className="text-sm text-muted-foreground mt-1">
        That page or record doesn&apos;t exist.
      </p>
      <Button render={<Link href="/" />} className="mt-4">
        Back to Overview
      </Button>
    </div>
  );
}
