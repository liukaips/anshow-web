import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { MediaStorage } from "./storage.js";

type LocalMediaStorageOptions = Readonly<{ root?: string }>;

function safeTarget(root: string, key: string) {
  if (
    key.length === 0 ||
    key.includes("\0") ||
    key.includes("\\") ||
    isAbsolute(key)
  ) {
    throw new Error("Invalid media storage key");
  }

  const segments = key.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid media storage key");
  }

  const target = resolve(root, ...segments);
  const pathFromRoot = relative(root, target);
  if (!pathFromRoot || pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
    throw new Error("Invalid media storage key");
  }

  return { target, segments };
}

export function createLocalMediaStorage(
  options: LocalMediaStorageOptions = {},
): MediaStorage {
  const root = resolve(options.root ?? "/media");

  return {
    async put(key, bytes) {
      const { target, segments } = safeTarget(root, key);
      const directory = resolve(target, "..");
      await mkdir(directory, { recursive: true });

      const temporary = `${target}.${crypto.randomUUID()}.tmp`;
      try {
        await writeFile(temporary, bytes, { flag: "wx", mode: 0o640 });
        await rename(temporary, target);
      } catch (error) {
        await rm(temporary, { force: true }).catch(() => undefined);
        throw error;
      }

      return `/media/${segments.map(encodeURIComponent).join("/")}`;
    },

    async delete(key) {
      const { target } = safeTarget(root, key);
      await rm(target, { force: true });
    },
  };
}
