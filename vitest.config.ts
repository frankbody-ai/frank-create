// Vitest runs on its own config: the Lovable wrapper in vite.config.ts returns a config
// function and carries no `test` field.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Resolves the "@/" imports the app uses, so a test can render App.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
