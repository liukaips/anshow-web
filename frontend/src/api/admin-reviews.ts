import type { paths } from "../generated/api";
import { getEnvelope } from "./http";

type ListOperation = paths["/api/admin/reviews/queue"]["get"];
type ApproveOperation = paths["/api/admin/reviews/{id}/approve"]["post"];
type RejectOperation = paths["/api/admin/reviews/{id}/reject"]["post"];
type SubmitOperation = paths["/api/admin/reviews/submit"]["post"];
export type AdminReview = NonNullable<ListOperation["responses"][200]["content"]["application/json"]["data"]>[number];
export type ApproveReviewInput = ApproveOperation["requestBody"]["content"]["application/json"];
export type RejectReviewInput = RejectOperation["requestBody"]["content"]["application/json"];
export type SubmitReviewInput = SubmitOperation["requestBody"]["content"]["application/json"];

const command = <T>(path: string, body: unknown) => getEnvelope<T>(path, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export function approveAdminReview(id: string, input: ApproveReviewInput) { return command<NonNullable<ApproveOperation["responses"][200]["content"]["application/json"]["data"]>>(`/api/admin/reviews/${encodeURIComponent(id)}/approve`, input); }
export function rejectAdminReview(id: string, input: RejectReviewInput) { return command<NonNullable<RejectOperation["responses"][200]["content"]["application/json"]["data"]>>(`/api/admin/reviews/${encodeURIComponent(id)}/reject`, input); }
export function submitAdminReview(input: SubmitReviewInput) { return command<NonNullable<SubmitOperation["responses"][201]["content"]["application/json"]["data"]>>("/api/admin/reviews/submit", input); }
