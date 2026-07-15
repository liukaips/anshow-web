import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { requirePermission } from "../../auth/permission-middleware.js";
import type { PermissionMiddlewareDependencies } from "../../auth/permission-middleware.js";
import type { AppEnv } from "../../http/context.js";
import type { StaffRepository } from "../repositories/staff-repository.js";

const envelope = <T extends z.ZodType>(data: T) => z.object({ data, error: z.null(), requestId: z.string() });
const error = z.object({ data: z.null(), error: z.object({ code: z.string(), message: z.string() }), requestId: z.string() });
const idParam = z.object({ id: z.string().min(1) });
const listRoute = createRoute({ method: "get", path: "/api/admin/staff", operationId: "listStaff", responses: { 200: { description: "Staff", content: { "application/json": { schema: envelope(z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), createdAt: z.coerce.date(), roles: z.string().nullable() })) ) } } }, 401: { description: "Unauthenticated", content: { "application/json": { schema: error } } }, 403: { description: "Forbidden", content: { "application/json": { schema: error } } } } });
const detailRoute = createRoute({ method: "get", path: "/api/admin/staff/{id}", operationId: "getStaff", request: { params: idParam }, responses: { 200: { description: "Staff detail", content: { "application/json": { schema: envelope(z.object({ id: z.string(), name: z.string(), email: z.string(), createdAt: z.coerce.date(), roles: z.array(z.object({ id: z.string(), name: z.string() })) })) } } }, 404: { description: "Not found", content: { "application/json": { schema: error } } } } });
const rolesRoute = createRoute({ method: "get", path: "/api/admin/staff-roles", operationId: "listStaffRoles", responses: { 200: { description: "Roles", content: { "application/json": { schema: envelope(z.array(z.object({ id: z.string(), name: z.string(), permissions: z.array(z.string()) }))) } } } } });
const mutation = (operationId: string, action: "disable" | "enable") => createRoute({ method: "post", path: `/api/admin/staff/{id}/${action}`, operationId, request: { params: idParam }, responses: { 200: { description: "Updated", content: { "application/json": { schema: envelope(z.object({ updated: z.literal(true) })) } } }, 409: { description: "Conflict", content: { "application/json": { schema: error } } } } });
const rolesMutation = createRoute({ method: "post", path: "/api/admin/staff/{id}/roles", operationId: "updateStaffRoles", request: { params: idParam, body: { content: { "application/json": { schema: z.object({ roleIds: z.array(z.string()).max(20) }) } } } }, responses: { 200: { description: "Updated", content: { "application/json": { schema: envelope(z.object({ updated: z.literal(true) })) } } } } });

export function registerStaffRoutes(app: OpenAPIHono<AppEnv>, repository: StaffRepository, permissions: PermissionMiddlewareDependencies) {
  app.use("/api/admin/staff/*", requirePermission("staff.manage", permissions));
  app.use("/api/admin/staff", requirePermission("staff.manage", permissions));
  app.use("/api/admin/staff-roles", requirePermission("staff.manage", permissions));
  app.openapi(listRoute, (c) => c.json({ data: repository.list(), error: null, requestId: c.get("requestId") }, 200));
  app.openapi(detailRoute, (c) => { const value = repository.get(c.req.valid("param").id); return value ? c.json({ data: value, error: null, requestId: c.get("requestId") }, 200) : c.json({ data: null, error: { code: "NOT_FOUND", message: "Staff member not found" }, requestId: c.get("requestId") }, 404); });
  app.openapi(rolesRoute, (c) => c.json({ data: repository.listRoles(), error: null, requestId: c.get("requestId") }, 200));
  app.openapi(mutation("disableStaff", "disable"), (c) => { const id = c.req.valid("param").id; repository.disable(id, c.get("actor")!.user.id); return c.json({ data: { updated: true as const }, error: null, requestId: c.get("requestId") }, 200); });
  app.openapi(mutation("enableStaff", "enable"), (c) => { const id = c.req.valid("param").id; repository.enable(id, c.get("actor")!.user.id); return c.json({ data: { updated: true as const }, error: null, requestId: c.get("requestId") }, 200); });
  app.openapi(rolesMutation, (c) => { const { id } = c.req.valid("param"); repository.setRoles(id, c.req.valid("json").roleIds, c.get("actor")!.user.id); return c.json({ data: { updated: true as const }, error: null, requestId: c.get("requestId") }, 200); });
}
