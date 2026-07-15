import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db/client.js";
import { session, user } from "../../db/schema/auth.js";
import { auditLogs } from "../../db/schema/settings.js";
import { permissions, rolePermissions, roles, userRoles } from "../../db/schema/rbac.js";

export const STAFF_REPOSITORY_ERROR_CODES = ["SELF_DISABLE", "LAST_SUPER_ADMIN", "SUPER_ADMIN_REQUIRED", "STAFF_NOT_FOUND"] as const;
export class StaffRepositoryError extends Error {
  constructor(readonly code: (typeof STAFF_REPOSITORY_ERROR_CODES)[number], message: string) { super(message); this.name = "StaffRepositoryError"; }
}

export function createStaffRepository(database: AppDatabase) {
  const audit = (tx: any, actorId: string, action: string, entityId: string, detail: unknown = {}) =>
    tx.insert(auditLogs).values({ id: crypto.randomUUID(), actorId, action, entityType: "staff", entityId, detail: JSON.stringify(detail), createdAt: new Date() }).run();
  const revoke = (tx: any, userId: string) => tx.delete(session).where(eq(session.userId, userId)).run();
  const isSuperAdmin = (tx: any, userId: string) => tx.select({ id: userRoles.userId, name: roles.name }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, userId)).all().some((r: any) => r.name === "Super Administrator");
  const activeSuperAdminCount = (tx: any) => tx.select({ id: user.id }).from(user).innerJoin(userRoles, eq(userRoles.userId, user.id)).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(roles.name, "Super Administrator")).all().filter((r: any) => Boolean(tx.select({ verified: user.emailVerified }).from(user).where(eq(user.id, r.id)).get()?.verified)).length;

  return {
    list() {
      return database.select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, roles: roles.name })
        .from(user).leftJoin(userRoles, eq(userRoles.userId, user.id)).leftJoin(roles, eq(roles.id, userRoles.roleId)).all();
    },
    get(id: string) {
      const staff = database.select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
        .from(user).where(eq(user.id, id)).get();
      if (!staff) return null;
      const assigned = database.select({ id: roles.id, name: roles.name }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, id)).all();
      return { ...staff, roles: assigned };
    },
    listRoles() {
      return database.select({ id: roles.id, name: roles.name }).from(roles).all().map((role) => ({ ...role, permissions: database.select({ key: permissions.key }).from(rolePermissions).innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId)).where(eq(rolePermissions.roleId, role.id)).all().map((p) => p.key) }));
    },
    disable(userId: string, actorId: string) {
      return database.transaction((tx) => { if (userId === actorId) throw new StaffRepositoryError("SELF_DISABLE", "You cannot disable your own account"); if (!tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).get()) throw new StaffRepositoryError("STAFF_NOT_FOUND", "Staff member not found"); if (isSuperAdmin(tx, userId) && activeSuperAdminCount(tx) <= 1) throw new StaffRepositoryError("LAST_SUPER_ADMIN", "At least one active super administrator is required"); tx.update(user).set({ emailVerified: false, updatedAt: new Date() }).where(eq(user.id, userId)).run(); revoke(tx, userId); audit(tx, actorId, "staff.disable", userId); });
    },
    enable(userId: string, actorId: string) {
      return database.transaction((tx) => { tx.update(user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(user.id, userId)).run(); audit(tx, actorId, "staff.enable", userId); });
    },
    setRoles(userId: string, roleIds: string[], actorId: string) {
      return database.transaction((tx) => { if (!tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).get()) throw new StaffRepositoryError("STAFF_NOT_FOUND", "Staff member not found"); const targetSuper = isSuperAdmin(tx, userId); const nextSuper = tx.select({ id: roles.id }).from(roles).where(eq(roles.name, "Super Administrator")).all().some((r: any) => roleIds.includes(r.id)); if (targetSuper && !nextSuper && activeSuperAdminCount(tx) <= 1) throw new StaffRepositoryError("LAST_SUPER_ADMIN", "At least one super administrator is required"); if (targetSuper && userId === actorId && !nextSuper) throw new StaffRepositoryError("SUPER_ADMIN_REQUIRED", "You cannot remove your own super administrator role"); if (targetSuper && actorId !== userId && !isSuperAdmin(tx, actorId)) throw new StaffRepositoryError("SUPER_ADMIN_REQUIRED", "Only a super administrator can modify another super administrator"); tx.delete(userRoles).where(eq(userRoles.userId, userId)).run(); if (roleIds.length) tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId }))).run(); revoke(tx, userId); audit(tx, actorId, "staff.roles.update", userId, { roleIds, highRisk: targetSuper }); });
    },
    deleteSessions(userId: string) { return database.delete(session).where(eq(session.userId, userId)).run(); },
  };
}

export type StaffRepository = ReturnType<typeof createStaffRepository>;
