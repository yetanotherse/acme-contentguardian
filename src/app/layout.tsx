import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { NavSidebar } from "@/components/nav-sidebar";
import { GlobalActions } from "@/components/global-actions";
import { Toaster } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { isMockMode } from "@/lib/providers";
import { countReviewTasksByStatus } from "@/db/queries";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ContentGuardian — Auto-Healing Learning Content",
  description:
    "Keeps generated certification content accurate as source materials evolve, with human-in-the-loop governance.",
};

// The dashboard is DB-backed and inherently dynamic; never statically prerender
// (this also keeps the build from touching the database, e.g. for /_not-found).
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const mock = isMockMode();
  const pendingReviews = (await countReviewTasksByStatus()).needs_human ?? 0;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-muted/30">
        <div className="flex h-screen overflow-hidden">
          <NavSidebar pendingReviews={pendingReviews} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Google Cloud Professional Cloud Architect
                </span>
                <Badge
                  variant={mock ? "secondary" : "default"}
                  className="text-[10px]"
                >
                  {mock ? "MOCK MODE (no API key)" : "GEMINI (live)"}
                </Badge>
              </div>
              <GlobalActions />
            </header>
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
