import { and, asc, eq } from "drizzle-orm";

import type { AppDatabase } from "../../db/client.js";
import { session, user } from "../../db/schema/auth.js";
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
} from "../../db/schema/rbac.js";
import { auditLogs } from "../../db/schema/settings.js";

export const STAFF_REPOSITORY_ERROR_CODES = [
  "SELF_DISABLE",
  "LAST_SUPER_ADMIN",
  "SUPER_ADMIN_REQUIRED",
  "STAFF_NOT_FOUND",
  "INVALID_ROLE",
] as const;

type StaffRepositoryErrorCode =
  (typeof STAFF_REPOSITORY_ERROR_CODES)[number];
type StaffTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

export class StaffRepositoryError extends Error {
  constructor(
    readonly code: StaffRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StaffRepositoryError";
  }
}

function audit(
  transaction: StaffTransaction,
  actorId: string,
  action: string,
  entityId: string,
  detail: unknown = {},
): void {
  transaction
    .insert(auditLogs)
    .values({
      id: crypto.randomUUID(),
      actorId,
      action,
      entityType: "staff",
      entityId,
      detail: JSON.stringify(detail),
      createdAt: new Date(),
    })
    .run();
}

function revokeSessions(transaction: StaffTransaction, userId: string): void {
  transaction.delete(session).where(eq(session.userId, userId)).run();
}

function requireStaff(transaction: StaffTransaction, userId: string) {
  const staff = transaction
    .select({ id: user.id, enabled: user.emailVerified })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  if (!staff) {
    throw new StaffRepositoryError("STAFF_NOT_FOUND", "未找到该员工账号");
  }
  return staff;
}

function isSuperAdmin(transaction: StaffTransaction, userId: string): boolean {
  return Boolean(
    transaction
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(roles.name, "Super Administrator"),
        ),
      )
      .get(),
  );
}

function activeSuperAdminCount(transaction: StaffTransaction): number {
  return transaction
    .select({ id: user.id })
    .from(user)
    .innerJoin(userRoles, eq(userRoles.userId, user.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(roles.name, "Super Administrator"),
        eq(user.emailVerified, true),
      ),
    )
    .all().length;
}

function assertSuperAdminActor(
  transaction: StaffTransaction,
  actorId: string,
): void {
  if (!isSuperAdmin(transaction, actorId)) {
    throw new StaffRepositoryError(
      "SUPER_ADMIN_REQUIRED",
      "只有超级管理员可以修改其他超级管理员",
    );
  }
}

export function createStaffRepository(database: AppDatabase) {
  const assignedRoles = (userId: string) =>
    database
      .select({ id: roles.id, name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId))
      .orderBy(asc(roles.name))
      .all();

  return {
    list() {
      return database
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          enabled: user.emailVerified,
          createdAt: user.createdAt,
        })
        .from(user)
        .orderBy(asc(user.createdAt), asc(user.id))
        .all()
        .map((staff) => {
          const assigned = assignedRoles(staff.id);
          const roleNames = assigned.map((role) => role.name);
          return {
            ...staff,
            roles: roleNames.join("、") || null,
            roleIds: assigned.map((role) => role.id),
            roleNames,
            isSuperAdmin: roleNames.includes("Super Administrator"),
          };
        });
    },

    get(id: string) {
      const staff = database
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          enabled: user.emailVerified,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.id, id))
        .get();
      if (!staff) return null;
      const assigned = assignedRoles(id);
      return {
        ...staff,
        roles: assigned,
        isSuperAdmin: assigned.some(
          (role) => role.name === "Super Administrator",
        ),
      };
    },

    listRoles() {
      return database
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .orderBy(asc(roles.name))
        .all()
        .map((role) => ({
          ...role,
          permissions: database
            .select({ key: permissions.key })
            .from(rolePermissions)
            .innerJoin(
              permissions,
              eq(permissions.id, rolePermissions.permissionId),
            )
            .where(eq(rolePermissions.roleId, role.id))
            .orderBy(asc(permissions.key))
            .all()
            .map((permission) => permission.key),
        }));
    },

    disable(userId: string, actorId: string) {
      return database.transaction((transaction) => {
        if (userId === actorId) {
          throw new StaffRepositoryError(
            "SELF_DISABLE",
            "不能停用当前登录账号",
          );
        }
        requireStaff(transaction, userId);
        if (isSuperAdmin(transaction, userId)) {
          if (activeSuperAdminCount(transaction) <= 1) {
            throw new StaffRepositoryError(
              "LAST_SUPER_ADMIN",
              "系统必须保留至少一名正常使用的超级管理员",
            );
          }
          assertSuperAdminActor(transaction, actorId);
        }
        transaction
          .update(user)
          .set({ emailVerified: false, updatedAt: new Date() })
          .where(eq(user.id, userId))
          .run();
        revokeSessions(transaction, userId);
        audit(transaction, actorId, "staff.disable", userId);
      });
    },

    enable(userId: string, actorId: string) {
      return database.transaction((transaction) => {
        requireStaff(transaction, userId);
        if (isSuperAdmin(transaction, userId) && userId !== actorId) {
          assertSuperAdminActor(transaction, actorId);
        }
        transaction
          .update(user)
          .set({ emailVerified: true, updatedAt: new Date() })
          .where(eq(user.id, userId))
          .run();
        audit(transaction, actorId, "staff.enable", userId);
      });
    },

    setRoles(userId: string, roleIds: string[], actorId: string) {
      return database.transaction((transaction) => {
        const staff = requireStaff(transaction, userId);
        const normalizedRoleIds = [...new Set(roleIds)];
        const availableRoles = transaction
          .select({ id: roles.id, name: roles.name })
          .from(roles)
          .all();
        const availableRoleIds = new Set(availableRoles.map((role) => role.id));
        if (normalizedRoleIds.some((roleId) => !availableRoleIds.has(roleId))) {
          throw new StaffRepositoryError(
            "INVALID_ROLE",
            "选择的角色不存在，请刷新后重试",
          );
        }

        const targetIsSuperAdmin = isSuperAdmin(transaction, userId);
        const superAdminRoleId = availableRoles.find(
          (role) => role.name === "Super Administrator",
        )?.id;
        const remainsSuperAdmin = superAdminRoleId
          ? normalizedRoleIds.includes(superAdminRoleId)
          : false;

        if (!targetIsSuperAdmin && remainsSuperAdmin) {
          assertSuperAdminActor(transaction, actorId);
        } else if (targetIsSuperAdmin && !remainsSuperAdmin) {
          if (staff.enabled && activeSuperAdminCount(transaction) <= 1) {
            throw new StaffRepositoryError(
              "LAST_SUPER_ADMIN",
              "系统必须保留至少一名正常使用的超级管理员",
            );
          }
          assertSuperAdminActor(transaction, actorId);
        } else if (
          targetIsSuperAdmin &&
          userId !== actorId &&
          !isSuperAdmin(transaction, actorId)
        ) {
          assertSuperAdminActor(transaction, actorId);
        }

        transaction
          .delete(userRoles)
          .where(eq(userRoles.userId, userId))
          .run();
        if (normalizedRoleIds.length > 0) {
          transaction
            .insert(userRoles)
            .values(
              normalizedRoleIds.map((roleId) => ({ userId, roleId })),
            )
            .run();
        }
        revokeSessions(transaction, userId);
        audit(transaction, actorId, "staff.roles.update", userId, {
          roleIds: normalizedRoleIds,
          highRisk: targetIsSuperAdmin || remainsSuperAdmin,
        });
      });
    },

    revokeSessions(userId: string, actorId: string) {
      return database.transaction((transaction) => {
        requireStaff(transaction, userId);
        if (isSuperAdmin(transaction, userId) && userId !== actorId) {
          assertSuperAdminActor(transaction, actorId);
        }
        revokeSessions(transaction, userId);
        audit(transaction, actorId, "staff.sessions.revoke", userId);
      });
    },
  };
}

export type StaffRepository = ReturnType<typeof createStaffRepository>;
