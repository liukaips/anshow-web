export interface BackupStorage {
  put(key: string, sourceFile: string): Promise<void>;
  download(key: string, destinationFile: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export function assertSafeBackupStorageKey(key: string): string {
  if (
    key.length === 0 ||
    key.includes("\0") ||
    key.includes("\\") ||
    key.startsWith("/")
  ) {
    throw new Error("备份存储路径无效");
  }
  const segments = key.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("备份存储路径无效");
  }
  return key;
}
