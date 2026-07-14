import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createApp, OPENAPI_DOCUMENT_CONFIG } from "../src/app.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(currentDirectory, "../..");
const outputFlagIndex = process.argv.indexOf("--output");
const requestedOutput =
  outputFlagIndex === -1 ? undefined : process.argv[outputFlagIndex + 1];

if (outputFlagIndex !== -1 && !requestedOutput) {
  throw new Error("The --output option requires a file path.");
}

const outputFile = requestedOutput
  ? resolve(process.cwd(), requestedOutput)
  : resolve(repositoryRoot, "openapi/anshow.json");
const outputDirectory = dirname(outputFile);

const document = createApp().getOpenAPIDocument(OPENAPI_DOCUMENT_CONFIG);

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputFile, `${JSON.stringify(document, null, 2)}\n`, "utf8");

console.info(`Wrote OpenAPI document to ${outputFile}`);
