import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db/client.js";
import { session, user } from "../../db/schema/auth.js";
import { auditLogs } from "../../db/schema/settings.js";
import { permissions, rolePermissions, roles, userRoles } from "../../db/schema/rbac.js";

export function createStaffRepository(database: AppDatabase) {
  const audit = (tx: any, actorId: string, action: string, entityId: string, detail: unknown = {}) =>
    tx.insert(auditLogs).values({ id: crypto.randomUUID(), actorId, action, entityType: "staff", entityId, detail: JSON.stringify(detail), createdAt: new Date() }).run();
  const revoke = (tx: any, userId: string) => tx.delete(session).where(eq(session.userId, userId)).run();

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
      return database.transaction((tx) => { tx.update(user).set({ emailVerified: false, updatedAt: new Date() }).where(eq(user.id, userId)).run(); revoke(tx, userId); audit(tx, actorId, "staff.disable", userId); });
    },
    enable(userId: string, actorId: string) {
      return database.transaction((tx) => { tx.update(user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(user.id, userId)).run(); audit(tx, actorId, "staff.enable", userId); });
    },
    setRoles(userId: string, roleIds: string[], actorId: string) {
      return database.transaction((tx) => { tx.delete(userRoles).where(eq(userRoles.userId, userId)).run(); if (roleIds.length) tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId }))).run(); revoke(tx, userId); audit(tx, actorId, "staff.roles.update", userId, { roleIds }); });
    },
    deleteSessions(userId: string) { return database.delete(session).where(eq(session.userId, userId)).run(); },
  };
}

export type StaffRepository = ReturnType<typeof createStaffRepository>;
