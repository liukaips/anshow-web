import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";

import { requirePermission, type PermissionMiddlewareDependencies } from "../../auth/permission-middleware.js";
import { envelope, errorEnvelopeSchema } from "../../content/public-contract.js";
import { workflowStates } from "../../db/schema/workflow.js";
import type { AppEnv } from "../../http/context.js";
import { adminContentCollectionSchema, adminContentIdSchema } from "../content/content-schema.js";
import type { ReviewRepository } from "../repositories/review-repository.js";

const reviewSchema = z.object({ id: z.string(), entityType: z.string(), entityId: z.string(), sourceVersion: z.number(), submittedBy: z.string(), reviewerId: z.string().nullable(), decision: z.enum(["pending", "approved", "changes_requested"]), reason: z.string().nullable(), submittedAt: z.coerce.date(), decidedAt: z.coerce.date().nullable() }).openapi("AdminContentReview");
const workflowSchema = z.object({ entityType: z.string(), entityId: z.string(), state: z.enum(workflowStates), ownerId: z.string().nullable(), version: z.number(), submittedAt: z.coerce.date().nullable(), updatedAt: z.coerce.date() }).openapi("AdminContentWorkflow");
const errorResponses = { 401: { description: "Authentication required.", content: { "application/json": { schema: errorEnvelopeSchema } } }, 403: { description: "Permission required.", content: { "application/json": { schema: errorEnvelopeSchema } } }, 409: { description: "Workflow version or state conflict.", content: { "application/json": { schema: errorEnvelopeSchema } } } } as const;

const listRoute = createRoute({ method: "get", path: "/api/admin/reviews/queue", operationId: "listAdminReviews", tags: ["Administration Review"], request: { query: z.object({ decision: z.enum(["pending", "approved", "changes_requested"]).optional() }) }, responses: { 200: { description: "Content review queue.", content: { "application/json": { schema: envelope("AdminReviewsResponse", z.array(reviewSchema)) } } }, ...errorResponses } });
const submitRoute = createRoute({ method: "post", path: "/api/admin/reviews/submit", operationId: "submitAdminContentReview", tags: ["Administration Review"], request: { body: { required: true, content: { "application/json": { schema: z.object({ collection: adminContentCollectionSchema, id: adminContentIdSchema, expectedVersion: z.number().int().positive() }).strict().openapi("SubmitAdminReviewInput") } } } }, responses: { 201: { description: "Content submitted for review.", content: { "application/json": { schema: envelope("SubmitAdminReviewResponse", reviewSchema) } } }, ...errorResponses } });
const decisionInput = z.object({ expectedVersion: z.number().int().positive() }).strict();
const decisionResponse = z.object({ review: reviewSchema, workflow: workflowSchema });
const approveRoute = createRoute({ method: "post", path: "/api/admin/reviews/{id}/approve", operationId: "approveAdminContentReview", tags: ["Administration Review"], request: { params: z.object({ id: z.string().min(1) }), body: { required: true, content: { "application/json": { schema: decisionInput.openapi("ApproveAdminReviewInput") } } } }, responses: { 200: { description: "Review approved.", content: { "application/json": { schema: envelope("ApproveAdminReviewResponse", decisionResponse) } } }, ...errorResponses } });
const rejectRoute = createRoute({ method: "post", path: "/api/admin/reviews/{id}/reject", operationId: "rejectAdminContentReview", tags: ["Administration Review"], request: { params: z.object({ id: z.string().min(1) }), body: { required: true, content: { "application/json": { schema: decisionInput.extend({ reason: z.string().trim().min(1).max(2000) }).strict().openapi("RejectAdminReviewInput") } } } }, responses: { 200: { description: "Changes requested.", content: { "application/json": { schema: envelope("RejectAdminReviewResponse", decisionResponse) } } }, ...errorResponses } });

export type ReviewRouteDependencies = PermissionMiddlewareDependencies & { reviewRepository: ReviewRepository };

const serializeReview = (review: ReturnType<ReviewRepository["list"]>[number]) => ({ ...review, submittedAt: review.submittedAt.toISOString(), decidedAt: review.decidedAt?.toISOString() ?? null });
const serializeDecision = (decision: ReturnType<ReviewRepository["approve"]>) => ({
  review: serializeReview(decision.review),
  workflow: { ...decision.workflow, submittedAt: decision.workflow.submittedAt?.toISOString() ?? null, updatedAt: decision.workflow.updatedAt.toISOString() },
});

export function registerReviewRoutes(app: OpenAPIHono<AppEnv>, dependencies: ReviewRouteDependencies): void {
  app.use("/api/admin/reviews/*", (context, next) =>
    requirePermission(
      context.req.path === "/api/admin/reviews/submit"
        ? "content.submit"
        : "content.review",
      dependencies,
    )(context, next),
  );
  app.openapi(listRoute, (context) => context.json({ data: dependencies.reviewRepository.list(context.req.valid("query")).map(serializeReview), error: null, requestId: context.get("requestId") }, 200));
  app.openapi(submitRoute, async (context) => { const actor = context.get("actor")!; const data = await dependencies.reviewRepository.submit({ ...context.req.valid("json"), submittedBy: actor.user.id }); return context.json({ data: serializeReview(data), error: null, requestId: context.get("requestId") }, 201); });
  app.openapi(approveRoute, (context) => { const data = dependencies.reviewRepository.approve({ reviewId: context.req.valid("param").id, reviewerId: context.get("actor")!.user.id, expectedVersion: context.req.valid("json").expectedVersion }); return context.json({ data: serializeDecision(data), error: null, requestId: context.get("requestId") }, 200); });
  app.openapi(rejectRoute, (context) => { const data = dependencies.reviewRepository.reject({ reviewId: context.req.valid("param").id, reviewerId: context.get("actor")!.user.id, ...context.req.valid("json") }); return context.json({ data: serializeDecision(data), error: null, requestId: context.get("requestId") }, 200); });
}
