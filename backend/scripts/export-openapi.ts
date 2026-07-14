import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createApp, OPENAPI_DOCUMENT_CONFIG } from "../src/app.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(currentDirectory, "../..");
const outputDirectory = resolve(repositoryRoot, "openapi");
const outputFile = resolve(outputDirectory, "anshow.json");

const document = createApp().getOpenAPIDocument(OPENAPI_DOCUMENT_CONFIG);

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputFile, `${JSON.stringify(document, null, 2)}\n`, "utf8");

console.info(`Wrote OpenAPI document to ${outputFile}`);
