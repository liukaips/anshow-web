import COS from "cos-nodejs-sdk-v5";

import type { MediaStorage } from "./storage.js";

export type CosClient = Pick<COS, "putObject" | "deleteObject">;

export type CosMediaStorageOptions = Readonly<{
  client: CosClient;
  bucket: string;
  region: string;
  publicBaseUrl: string;
}>;

function safeKey(key: string): string {
  if (!key || key.includes("\0") || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Invalid media storage key");
  }
  const segments = key.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid media storage key");
  }
  return key;
}

function callbackResult<T>(
  operation: (callback: (error: unknown, data: T) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    operation((error, data) => (error ? reject(error) : resolve(data)));
  });
}

export class CosStorage implements MediaStorage {
  private readonly publicBaseUrl: string;

  constructor(private readonly config: CosMediaStorageOptions) {
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/+$/, "");
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<string> {
    const safe = safeKey(key);
    await callbackResult((callback) =>
      this.config.client.putObject(
        {
          Bucket: this.config.bucket,
          Region: this.config.region,
          Key: safe,
          Body: Buffer.from(bytes),
          ContentType: contentType,
          CacheControl: "public,max-age=31536000,immutable",
        },
        callback,
      ),
    );
    return `${this.publicBaseUrl}/${safe.split("/").map(encodeURIComponent).join("/")}`;
  }

  async delete(key: string): Promise<void> {
    const safe = safeKey(key);
    await callbackResult((callback) =>
      this.config.client.deleteObject(
        { Bucket: this.config.bucket, Region: this.config.region, Key: safe },
        callback,
      ),
    );
  }
}

export function createCosMediaStorage(options: {
  bucket: string;
  region: string;
  publicBaseUrl: string;
  secretId: string;
  secretKey: string;
}): MediaStorage {
  return new CosStorage({
    client: new COS({ SecretId: options.secretId, SecretKey: options.secretKey }),
    bucket: options.bucket,
    region: options.region,
    publicBaseUrl: options.publicBaseUrl,
  });
}
