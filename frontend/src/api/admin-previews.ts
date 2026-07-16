import type { paths } from "../generated/api";
import { getEnvelope } from "./http";

type CreateOperation = paths["/api/admin/previews"]["post"];
export type CreateAdminPreviewInput = CreateOperation["requestBody"]["content"]["application/json"];
export type CreateAdminPreviewResult = NonNullable<CreateOperation["responses"][201]["content"]["application/json"]["data"]>;

export function createAdminPreview(input: CreateAdminPreviewInput): Promise<CreateAdminPreviewResult> {
  return getEnvelope<CreateAdminPreviewResult>("/api/admin/previews", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
