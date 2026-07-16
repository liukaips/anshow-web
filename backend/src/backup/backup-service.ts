import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export type BackupEntry = {
  path: string;
  size: number;
  sha256: string;
  data: string;
};
export type BackupManifest = {
  version: 1;
  createdAt: string;
  entries: Array<Omit<BackupEntry, "data">>;
};

type BackupEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  payload: string;
};

export const BACKUP_VALIDATION_ERROR_CODES = [
  "BACKUP_FORMAT_UNSUPPORTED",
  "BACKUP_DECRYPT_FAILED",
  "BACKUP_MANIFEST_INVALID",
  "BACKUP_CHECKSUM_MISMATCH",
  "BACKUP_PATH_UNSAFE",
] as const;

export class BackupValidationError extends Error {
  constructor(
    readonly code: (typeof BACKUP_VALIDATION_ERROR_CODES)[number],
    message: string,
  ) {
    super(message);
    this.name = "BackupValidationError";
  }
}

function digest(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function keyFrom(value: string | Buffer): Buffer {
  const key = Buffer.isBuffer(value) ? value : Buffer.from(value, "hex");
  if (key.length !== 32) {
    throw new Error("备份加密密钥必须是 32 字节（64 位十六进制字符）");
  }
  return key;
}

async function files(root: string, current = root): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(current, { withFileTypes: true })) {
    const path = join(current, item.name);
    if (item.isDirectory()) {
      result.push(...(await files(root, path)));
    } else if (item.isFile()) {
      result.push(path);
    }
  }
  return result;
}

function parseEnvelope(raw: string): BackupEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new BackupValidationError(
      "BACKUP_FORMAT_UNSUPPORTED",
      "不支持的备份文件格式",
    );
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 1 ||
    !("algorithm" in value) ||
    value.algorithm !== "aes-256-gcm" ||
    !("iv" in value) ||
    typeof value.iv !== "string" ||
    !("tag" in value) ||
    typeof value.tag !== "string" ||
    !("payload" in value) ||
    typeof value.payload !== "string"
  ) {
    throw new BackupValidationError(
      "BACKUP_FORMAT_UNSUPPORTED",
      "不支持的备份文件格式",
    );
  }
  return value as BackupEnvelope;
}

function parsePayload(value: Buffer): {
  manifest: BackupManifest;
  entries: BackupEntry[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.toString());
  } catch {
    throw new BackupValidationError(
      "BACKUP_MANIFEST_INVALID",
      "备份清单无效",
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("manifest" in parsed) ||
    typeof parsed.manifest !== "object" ||
    parsed.manifest === null ||
    !("version" in parsed.manifest) ||
    parsed.manifest.version !== 1 ||
    !("createdAt" in parsed.manifest) ||
    typeof parsed.manifest.createdAt !== "string" ||
    !("entries" in parsed.manifest) ||
    !Array.isArray(parsed.manifest.entries) ||
    !("entries" in parsed) ||
    !Array.isArray(parsed.entries)
  ) {
    throw new BackupValidationError(
      "BACKUP_MANIFEST_INVALID",
      "备份清单无效",
    );
  }
  return parsed as { manifest: BackupManifest; entries: BackupEntry[] };
}

function validEntry(entry: unknown, withData: boolean): entry is BackupEntry {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "path" in entry &&
    typeof entry.path === "string" &&
    "size" in entry &&
    Number.isInteger(entry.size) &&
    Number(entry.size) >= 0 &&
    "sha256" in entry &&
    typeof entry.sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(entry.sha256) &&
    (!withData ||
      ("data" in entry && typeof entry.data === "string"))
  );
}

export async function createEncryptedBackup(options: {
  databasePath: string;
  mediaDir?: string;
  outputDir: string;
  encryptionKey: string | Buffer;
}): Promise<{ file: string; manifest: BackupManifest }> {
  const entries: BackupEntry[] = [];
  const sourcePaths = [options.databasePath];
  if (options.mediaDir) {
    sourcePaths.push(...(await files(options.mediaDir)));
  }
  for (const source of sourcePaths) {
    const data = await readFile(source);
    const path =
      options.mediaDir && source !== options.databasePath
        ? `media/${relative(options.mediaDir, source)}`
        : "anshow.db";
    entries.push({
      path,
      size: data.length,
      sha256: digest(data),
      data: data.toString("base64"),
    });
  }
  const manifest: BackupManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    entries: entries.map((entry) => ({
      path: entry.path,
      size: entry.size,
      sha256: entry.sha256,
    })),
  };
  const payload = Buffer.from(JSON.stringify({ manifest, entries }));
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    keyFrom(options.encryptionKey),
    iv,
  );
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const envelope: BackupEnvelope = {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    payload: encrypted.toString("base64"),
  };
  await mkdir(options.outputDir, { recursive: true });
  const file = join(
    options.outputDir,
    `anshow-${manifest.createdAt.replace(/[:.]/g, "-")}.backup`,
  );
  await writeFile(file, JSON.stringify(envelope), { mode: 0o600 });
  return { file, manifest };
}

export async function verifyAndRestoreBackup(options: {
  backupFile: string;
  encryptionKey: string | Buffer;
  restoreDir: string;
}): Promise<BackupManifest> {
  const envelope = parseEnvelope(await readFile(options.backupFile, "utf8"));
  let decrypted: Buffer;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFrom(options.encryptionKey),
      Buffer.from(envelope.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    decrypted = Buffer.concat([
      decipher.update(Buffer.from(envelope.payload, "base64")),
      decipher.final(),
    ]);
  } catch (error) {
    if (error instanceof BackupValidationError) throw error;
    throw new BackupValidationError(
      "BACKUP_DECRYPT_FAILED",
      "无法解密备份文件，请检查密钥和文件完整性",
    );
  }

  const parsed = parsePayload(decrypted);
  if (
    parsed.entries.length !== parsed.manifest.entries.length ||
    !parsed.entries.every((entry) => validEntry(entry, true)) ||
    !parsed.manifest.entries.every((entry) => validEntry(entry, false))
  ) {
    throw new BackupValidationError(
      "BACKUP_MANIFEST_INVALID",
      "备份清单无效",
    );
  }

  const restoreRoot = resolve(options.restoreDir);
  const seenPaths = new Set<string>();
  const verifiedEntries = parsed.entries.map((entry, index) => {
    const manifestEntry = parsed.manifest.entries[index];
    if (
      !manifestEntry ||
      manifestEntry.path !== entry.path ||
      manifestEntry.size !== entry.size ||
      manifestEntry.sha256 !== entry.sha256 ||
      seenPaths.has(entry.path)
    ) {
      throw new BackupValidationError(
        "BACKUP_MANIFEST_INVALID",
        "备份清单无效",
      );
    }
    seenPaths.add(entry.path);

    const data = Buffer.from(entry.data, "base64");
    if (data.length !== entry.size || digest(data) !== entry.sha256) {
      throw new BackupValidationError(
        "BACKUP_CHECKSUM_MISMATCH",
        `备份文件校验失败：${entry.path}`,
      );
    }
    const destination = resolve(restoreRoot, entry.path);
    const relativeDestination = relative(restoreRoot, destination);
    if (
      relativeDestination === "" ||
      relativeDestination.startsWith("..") ||
      isAbsolute(relativeDestination)
    ) {
      throw new BackupValidationError(
        "BACKUP_PATH_UNSAFE",
        "备份文件包含不安全路径",
      );
    }
    return { data, destination };
  });

  await mkdir(restoreRoot, { recursive: true });
  for (const entry of verifiedEntries) {
    await mkdir(dirname(entry.destination), { recursive: true });
    await writeFile(entry.destination, entry.data, { mode: 0o600 });
  }
  return parsed.manifest;
}

export async function assertBackupFile(path: string): Promise<void> {
  const info = await stat(path);
  if (!info.isFile() || info.size === 0) {
    throw new Error("备份文件为空");
  }
}
