import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args) {
  const result = spawnSync(pnpm, args, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `OpenAPI generation command failed with exit code ${result.status ?? 1}.`,
    );
  }
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "anshow-openapi-"));

try {
  const generatedOpenApi = join(temporaryDirectory, "anshow.json");
  const generatedTypes = join(temporaryDirectory, "api.ts");

  run([
    "--filter",
    "@anshow/backend",
    "exec",
    "tsx",
    "scripts/export-openapi.ts",
    "--output",
    generatedOpenApi,
  ]);
  run([
    "exec",
    "openapi-typescript",
    generatedOpenApi,
    "-o",
    generatedTypes,
  ]);

  const contracts = [
    {
      generated: generatedOpenApi,
      tracked: resolve(repositoryRoot, "openapi/anshow.json"),
    },
    {
      generated: generatedTypes,
      tracked: resolve(repositoryRoot, "frontend/src/generated/api.ts"),
    },
  ];
  const staleContracts = [];

  for (const contract of contracts) {
    const [generated, tracked] = await Promise.all([
      readFile(contract.generated),
      readFile(contract.tracked),
    ]);

    if (!generated.equals(tracked)) {
      staleContracts.push(contract.tracked);
    }
  }

  if (staleContracts.length > 0) {
    console.error("OpenAPI contract is stale:");
    for (const contract of staleContracts) {
      console.error(`- ${contract}`);
    }
    console.error("Run `pnpm openapi:generate` and commit the generated files.");
    process.exitCode = 1;
  } else {
    console.info("OpenAPI contract is current.");
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
