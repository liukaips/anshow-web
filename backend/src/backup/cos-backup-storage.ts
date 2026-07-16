import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { finished } from "node:stream/promises";

import COS from "cos-nodejs-sdk-v5";

import {
  assertSafeBackupStorageKey,
  type BackupStorage,
} from "./backup-storage.js";

type Callback = (error: unknown, data: unknown) => void;

export type CosBackupClient = {
  uploadFile(input: {
    Bucket: string;
    Region: string;
    Key: string;
    FilePath: string;
  }, callback: Callback): void;
  getObject(input: {
    Bucket: string;
    Region: string;
    Key: string;
    Output: WriteStream;
  }, callback: Callback): void;
  deleteObject(input: {
    Bucket: string;
    Region: string;
    Key: string;
  }, callback: Callback): void;
};

type CosBackupStorageOptions = {
  client: CosBackupClient;
  bucket: string;
  region: string;
};

function callbackOperation(
  operation: (callback: Callback) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    operation((error) => (error ? reject(error) : resolve()));
  });
}

export class CosBackupStorage implements BackupStorage {
  constructor(private readonly options: CosBackupStorageOptions) {}

  async put(key: string, sourceFile: string): Promise<void> {
    const safe = assertSafeBackupStorageKey(key);
    await callbackOperation((callback) =>
      this.options.client.uploadFile(
        {
          Bucket: this.options.bucket,
          Region: this.options.region,
          Key: safe,
          FilePath: sourceFile,
        },
        callback,
      ),
    );
  }

  async download(key: string, destinationFile: string): Promise<void> {
    const safe = assertSafeBackupStorageKey(key);
    await mkdir(dirname(destinationFile), { recursive: true });
    const output = createWriteStream(destinationFile, { mode: 0o600 });
    try {
      await callbackOperation((callback) =>
        this.options.client.getObject(
          {
            Bucket: this.options.bucket,
            Region: this.options.region,
            Key: safe,
            Output: output,
          },
          (error, data) => {
            if (error) output.destroy();
            callback(error, data);
          },
        ),
      );
      await finished(output);
    } catch (error) {
      output.destroy();
      await finished(output).catch(() => undefined);
      await rm(destinationFile, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const safe = assertSafeBackupStorageKey(key);
    await callbackOperation((callback) =>
      this.options.client.deleteObject(
        {
          Bucket: this.options.bucket,
          Region: this.options.region,
          Key: safe,
        },
        callback,
      ),
    );
  }
}

export function createCosBackupStorage(options: {
  bucket: string;
  region: string;
  secretId: string;
  secretKey: string;
}): BackupStorage {
  return new CosBackupStorage({
    client: new COS({
      SecretId: options.secretId,
      SecretKey: options.secretKey,
    }) as unknown as CosBackupClient,
    bucket: options.bucket,
    region: options.region,
  });
}
