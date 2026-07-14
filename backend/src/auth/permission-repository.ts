import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import {
  permissions,
  rolePermissions,
  userRoles,
} from "../db/schema/rbac.js";
import type { PermissionKey } from "./permissions.js";

export function permissionsForUser(
  database: AppDatabase,
  userId: string,
): PermissionKey[] {
  const rows = database
    .select({ key: permissions.key })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(
      permissions,
      eq(permissions.id, rolePermissions.permissionId),
    )
    .where(eq(userRoles.userId, userId))
    .all();

  return [...new Set(rows.map(({ key }) => key as PermissionKey))];
}
