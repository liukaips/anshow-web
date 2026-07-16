import { copyFile, mkdir, rename, rm } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

import {
  assertSafeBackupStorageKey,
  type BackupStorage,
} from "./backup-storage.js";

function targetBelow(root: string, key: string): string {
  const target = resolve(root, ...assertSafeBackupStorageKey(key).split("/"));
  const fromRoot = relative(root, target);
  if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) {
    throw new Error("备份存储路径无效");
  }
  return target;
}

export function createLocalBackupStorage(options: {
  root: string;
}): BackupStorage {
  const root = resolve(options.root);
  return {
    async put(key, sourceFile) {
      const target = targetBelow(root, key);
      await mkdir(dirname(target), { recursive: true });
      const temporary = `${target}.${crypto.randomUUID()}.tmp`;
      try {
        await copyFile(sourceFile, temporary);
        await rename(temporary, target);
      } catch (error) {
        await rm(temporary, { force: true }).catch(() => undefined);
        throw error;
      }
    },
    async download(key, destinationFile) {
      const source = targetBelow(root, key);
      await mkdir(dirname(destinationFile), { recursive: true });
      await copyFile(source, destinationFile);
    },
    async delete(key) {
      await rm(targetBelow(root, key), { force: true });
    },
  };
}
