import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

export type BackupEntry = { path: string; size: number; sha256: string; data: string };
export type BackupManifest = { version: 1; createdAt: string; entries: Array<Omit<BackupEntry, "data">> };

function digest(value: Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function keyFrom(value: string | Buffer): Buffer {
  const key = Buffer.isBuffer(value) ? value : Buffer.from(value, "hex");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  return key;
}

async function files(root: string, current = root): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(current, { withFileTypes: true })) {
    const path = join(current, item.name);
    if (item.isDirectory()) result.push(...await files(root, path));
    else if (item.isFile()) result.push(path);
  }
  return result;
}

export async function createEncryptedBackup(options: {
  databasePath: string;
  mediaDir?: string;
  outputDir: string;
  encryptionKey: string | Buffer;
}): Promise<{ file: string; manifest: BackupManifest }> {
  const entries: BackupEntry[] = [];
  const sourcePaths = [options.databasePath];
  if (options.mediaDir) sourcePaths.push(...await files(options.mediaDir));
  for (const source of sourcePaths) {
    const data = await readFile(source);
    const path = options.mediaDir && source.startsWith(resolve(options.mediaDir))
      ? `media/${relative(options.mediaDir, source)}`
      : "anshow.db";
    entries.push({ path, size: data.length, sha256: digest(data), data: data.toString("base64") });
  }
  const manifest: BackupManifest = { version: 1, createdAt: new Date().toISOString(), entries: entries.map(({ data, ...entry }) => entry) };
  const payload = Buffer.from(JSON.stringify({ manifest, entries }));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(options.encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const envelope = Buffer.from(JSON.stringify({ version: 1, algorithm: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), payload: encrypted.toString("base64") }));
  await mkdir(options.outputDir, { recursive: true });
  const file = join(options.outputDir, `anshow-${manifest.createdAt.replace(/[:.]/g, "-")}.backup`);
  await writeFile(file, envelope, { mode: 0o600 });
  return { file, manifest };
}

export async function verifyAndRestoreBackup(options: { backupFile: string; encryptionKey: string | Buffer; restoreDir: string }): Promise<BackupManifest> {
  const envelope = JSON.parse(await readFile(options.backupFile, "utf8")) as { iv: string; tag: string; payload: string };
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(options.encryptionKey), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const payload = Buffer.concat([decipher.update(Buffer.from(envelope.payload, "base64")), decipher.final()]);
  const parsed = JSON.parse(payload.toString()) as { manifest: BackupManifest; entries: BackupEntry[] };
  if (parsed.manifest.version !== 1 || parsed.entries.length !== parsed.manifest.entries.length) throw new Error("Invalid backup manifest");
  await mkdir(options.restoreDir, { recursive: true });
  for (const entry of parsed.entries) {
    const data = Buffer.from(entry.data, "base64");
    if (data.length !== entry.size || digest(data) !== entry.sha256) throw new Error(`Backup checksum mismatch: ${entry.path}`);
    const destination = resolve(options.restoreDir, entry.path);
    if (!destination.startsWith(resolve(options.restoreDir) + "/")) throw new Error("Unsafe backup path");
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFile(destination, data, { mode: 0o600 });
  }
  return parsed.manifest;
}

export async function assertBackupFile(path: string): Promise<void> { const info = await stat(path); if (!info.isFile() || info.size === 0) throw new Error("Backup file is empty"); }
