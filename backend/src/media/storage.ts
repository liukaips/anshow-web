export interface MediaStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
}
