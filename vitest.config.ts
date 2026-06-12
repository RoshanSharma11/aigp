import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["packages/**/*.test.ts", "fixtures/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
