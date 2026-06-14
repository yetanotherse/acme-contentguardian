import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    // Force MOCK mode + an isolated test database so tests never touch the
    // demo DB or call external services.
    env: {
      DATABASE_PATH: "./.test.db",
      GOOGLE_GENERATIVE_AI_API_KEY: "",
    },
  },
});
