import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config terpisah untuk E2E live (menyentuh DB produksi via JWT user asli).
// Jalankan eksplisit: npm run test:e2e — TIDAK ikut `npm run test:unit`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
