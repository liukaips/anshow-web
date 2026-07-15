import type { paths } from "../generated/api";

import { ApiError, getEnvelope } from "./http";

type ListOperation = paths["/api/admin/media"]["get"];
type UploadOperation = paths["/api/admin/media"]["post"];
type MetadataOperation = paths["/api/admin/media/{id}"]["put"];
type DeleteOperation = paths["/api/admin/media/{id}"]["delete"];
type ReplaceOperation = paths["/api/admin/media/{id}/replacement"]["post"];
type RetryCleanupOperation = paths["/api/admin/media/cleanup/retry"]["post"];

export type AdminMediaAsset = NonNullable<
  ListOperation["responses"][200]["content"]["application/json"]["data"]
>[number];
export type AdminMediaMetadataInput =
  MetadataOperation["requestBody"]["content"]["application/json"];
export type AdminMediaUploadInput = AdminMediaMetadataInput & { file: File };

export type MediaUploadProgress = Readonly<{
  onUploadProgress?: (percent: number) => void;
  onUploadComplete?: () => void;
}>;

const segment = (value: string) => encodeURIComponent(value);

function multipartBody(input: AdminMediaUploadInput) {
  const form = new FormData();
  form.set("file", input.file);
  form.set("altEn", input.alt.en);
  form.set("altZh", input.alt.zh);
  form.set("altRu", input.alt.ru);
  form.set("focalX", String(input.focalX));
  form.set("focalY", String(input.focalY));
  return form;
}

function uploadRequest<T>(
  path: string,
  input: AdminMediaUploadInput,
  progress: MediaUploadProgress = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", path);
    request.withCredentials = true;
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        progress.onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.upload.addEventListener("load", () => progress.onUploadComplete?.());
    request.addEventListener("error", () =>
      reject(new ApiError({ status: 0, code: "NETWORK_ERROR", message: "Media upload failed." })),
    );
    request.addEventListener("load", () => {
      let payload: {
        data?: T | null;
        error?: { code?: string; message?: string; fields?: Record<string, string[]>; details?: Record<string, unknown> } | null;
        requestId?: string;
      } = {};
      try {
        payload = JSON.parse(request.responseText) as typeof payload;
      } catch {
        // The structured fallback below avoids exposing an HTML proxy response.
      }
      if (request.status < 200 || request.status >= 300 || payload.error || !payload.data) {
        reject(
          new ApiError({
            status: request.status,
            code: payload.error?.code ?? "API_REQUEST_FAILED",
            message: payload.error?.message ?? "Media upload failed.",
            requestId: payload.requestId,
            fields: payload.error?.fields,
            details: payload.error?.details,
          }),
        );
        return;
      }
      resolve(payload.data);
    });
    request.send(multipartBody(input));
  });
}

export function uploadAdminMedia(
  input: AdminMediaUploadInput,
  progress?: MediaUploadProgress,
): Promise<AdminMediaAsset> {
  return uploadRequest<
    NonNullable<UploadOperation["responses"][201]["content"]["application/json"]["data"]>
  >("/api/admin/media", input, progress);
}

export function replaceAdminMedia(
  id: string,
  input: AdminMediaUploadInput,
  progress?: MediaUploadProgress,
): Promise<AdminMediaAsset> {
  return uploadRequest<
    NonNullable<ReplaceOperation["responses"][200]["content"]["application/json"]["data"]>
  >(`/api/admin/media/${segment(id)}/replacement`, input, progress);
}

export function updateAdminMediaMetadata(
  id: string,
  input: AdminMediaMetadataInput,
): Promise<AdminMediaAsset> {
  return getEnvelope<AdminMediaAsset>(`/api/admin/media/${segment(id)}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteAdminMedia(id: string): Promise<void> {
  await getEnvelope<
    NonNullable<DeleteOperation["responses"][200]["content"]["application/json"]["data"]>
  >(`/api/admin/media/${segment(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
}

export function retryAdminMediaCleanup(): Promise<
  NonNullable<
    RetryCleanupOperation["responses"][200]["content"]["application/json"]["data"]
  >
> {
  return getEnvelope("/api/admin/media/cleanup/retry", {
    method: "POST",
    credentials: "same-origin",
  });
}
