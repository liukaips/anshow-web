import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "db/migrate": "src/db/migrate.ts",
    "scripts/create-admin": "scripts/create-admin.ts",
    server: "src/server.ts",
    "worker/index": "src/worker/index.ts",
  },
  clean: true,
  dts: false,
  format: ["esm"],
  outDir: "dist",
  platform: "node",
  sourcemap: true,
  splitting: false,
  target: "node20",
});
