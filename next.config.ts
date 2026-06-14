import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / heavy server-only packages must not be bundled by Next's
  // server compiler. better-sqlite3 is a native addon; @mastra/core pulls in
  // Node-only dependencies. Keep them external so they load at runtime.
  serverExternalPackages: ["better-sqlite3", "postgres", "@mastra/core"],
};

export default nextConfig;
