"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  FileText,
  GitBranch,
  LayoutDashboard,
  Library,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/healing", label: "Healing Center", icon: ShieldCheck },
  { href: "/content", label: "Content Library", icon: Library },
  { href: "/knowledge-graph", label: "Knowledge Graph", icon: GitBranch },
  { href: "/sources", label: "Sources", icon: FileText },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

interface NavSidebarProps {
  pendingReviews: number;
}

export function NavSidebar({ pendingReviews }: NavSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center gap-2 px-5 h-16 border-b">
        <Activity className="h-5 w-5 text-primary" />
        <div className="leading-tight">
          <div className="font-semibold text-sm">ContentGuardian</div>
          <div className="text-[11px] text-muted-foreground">
            Auto-Healing Content
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              {href === "/healing" && pendingReviews > 0 && (
                <span className="rounded-full bg-amber-500 text-white text-[10px] font-semibold px-1.5 py-0.5 min-w-5 text-center">
                  {pendingReviews}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t text-[11px] text-muted-foreground">
        Google Cloud PCA · Demo
      </div>
    </aside>
  );
}
