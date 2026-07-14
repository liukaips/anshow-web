import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const executeFile = promisify(execFile);

async function runPnpm(arguments_: string[], root: string) {
  return executeFile("pnpm", arguments_, {
    cwd: root,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function listFiles(directory: string, prefix = ""): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(prefix, entry.name);
      if (entry.isDirectory()) {
        return listFiles(path.join(directory, entry.name), relativePath);
      }
      return [relativePath];
    }),
  );
  return files.flat().sort();
}

async function assertSameFile(expected: string, actual: string) {
  const [expectedBytes, actualBytes] = await Promise.all([
    fs.readFile(expected),
    fs.readFile(actual),
  ]);
  assert.deepEqual(actualBytes, expectedBytes, `${actual} is stale`);
}

async function assertSameDirectory(expected: string, actual: string) {
  const [expectedFiles, actualFiles] = await Promise.all([
    listFiles(expected),
    listFiles(actual),
  ]);
  assert.deepEqual(actualFiles, expectedFiles, "Database migration files drifted");
  await Promise.all(
    expectedFiles.map((file) =>
      assertSameFile(path.join(expected, file), path.join(actual, file)),
    ),
  );
}

async function main() {
  const root = process.cwd();
  const backend = path.join(root, "backend");
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "anshow-db-"));
  const generatedAuthSchema = path.join(temporaryRoot, "auth.ts");
  const generatedMigrations = path.join(temporaryRoot, "migrations");
  const temporaryDrizzleConfig = path.join(
    temporaryRoot,
    "drizzle.config.ts",
  );
  const committedMigrations = path.join(backend, "migrations");

  try {
    await runPnpm(
      [
        "--filter",
        "@anshow/backend",
        "exec",
        "better-auth",
        "generate",
        "--config",
        "src/auth/schema-config.ts",
        "--output",
        generatedAuthSchema,
        "--yes",
      ],
      root,
    );
    await assertSameFile(
      path.join(backend, "src", "db", "schema", "auth.ts"),
      generatedAuthSchema,
    );

    await fs.cp(committedMigrations, generatedMigrations, { recursive: true });
    await fs.writeFile(
      temporaryDrizzleConfig,
      `export default ${JSON.stringify({
        dialect: "sqlite",
        schema: path.join(backend, "src", "db", "schema", "index.ts"),
        out: generatedMigrations,
        dbCredentials: { url: ":memory:" },
      })};\n`,
    );
    await runPnpm(
      [
        "--filter",
        "@anshow/backend",
        "exec",
        "drizzle-kit",
        "generate",
        "--config",
        temporaryDrizzleConfig,
      ],
      root,
    );
    await assertSameDirectory(committedMigrations, generatedMigrations);
    console.info("Database schemas and migrations are current.");
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
