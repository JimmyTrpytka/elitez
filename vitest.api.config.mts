import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/** Kontrola dotazů proti skutečné databázi: npm run test:api (čte .env.local). */
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/api/**/*.api.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
