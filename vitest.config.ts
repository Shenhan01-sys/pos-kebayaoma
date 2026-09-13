import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "store/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
