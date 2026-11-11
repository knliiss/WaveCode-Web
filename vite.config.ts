import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const tunnelHostname = "wawecode.knalis.rest";

export default defineConfig({
  plugins: [react()],
  base: "./",
  worker: { format: "es" },
  server: {
    allowedHosts: [tunnelHostname],
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    allowedHosts: [tunnelHostname],
  },
  build: { target: "es2022", sourcemap: false },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
