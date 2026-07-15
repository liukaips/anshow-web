import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createEncryptedBackup, verifyAndRestoreBackup } from "./backup-service.js";

const cleanup: string[] = [];
afterEach(async () => { await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe("encrypted backups", () => {
  it("creates an encrypted manifest and verifies checksums on isolated restore", async () => {
    const root = await mkdtemp(join(tmpdir(), "anshow-backup-")); cleanup.push(root);
    const media = join(root, "media"); await mkdir(media); await writeFile(join(root, "anshow.db"), "sqlite"); await writeFile(join(media, "hero.jpg"), "image");
    const { file, manifest } = await createEncryptedBackup({ databasePath: join(root, "anshow.db"), mediaDir: media, outputDir: join(root, "backups"), encryptionKey: "a".repeat(64) });
    expect(manifest.entries).toHaveLength(2); expect((await readFile(file, "utf8"))).not.toContain("sqlite");
    const restored = join(root, "restore"); const result = await verifyAndRestoreBackup({ backupFile: file, encryptionKey: "a".repeat(64), restoreDir: restored });
    expect(result.entries).toHaveLength(2); expect(await readFile(join(restored, "anshow.db"), "utf8")).toBe("sqlite");
  });
});
