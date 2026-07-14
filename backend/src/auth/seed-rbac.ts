import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import {
  permissions,
  rolePermissions,
  roles,
} from "../db/schema/rbac.js";
import { PERMISSION_KEYS, type PermissionKey } from "./permissions.js";

export const ROLE_PRESETS: Readonly<
  Record<string, readonly PermissionKey[]>
> = {
  "Super Administrator": PERMISSION_KEYS,
  Publisher: [
    "content.read",
    "content.write",
    "content.publish",
    "media.read",
    "media.write",
  ],
  "Content Editor": [
    "content.read",
    "content.write",
    "media.read",
    "media.write",
  ],
  Sales: [
    "inquiry.read",
    "inquiry.assign",
    "inquiry.status",
    "inquiry.note",
    "inquiry.retry",
    "inquiry.export",
  ],
  Viewer: ["content.read", "media.read", "inquiry.read", "audit.read"],
};

export function roleIdForName(name: string): string {
  return name.toLowerCase().replaceAll(" ", "-");
}

export function seedRbac(database: AppDatabase): void {
  database.transaction((transaction) => {
    for (const name of Object.keys(ROLE_PRESETS)) {
      const roleId = roleIdForName(name);
      const roleWithReservedId = transaction
        .select()
        .from(roles)
        .where(eq(roles.id, roleId))
        .get();
      if (roleWithReservedId && roleWithReservedId.name !== name) {
        throw new Error(
          `Reserved role id "${roleId}" belongs to preset "${name}", but is used by "${roleWithReservedId.name}"`,
        );
      }

      const roleWithReservedName = transaction
        .select()
        .from(roles)
        .where(eq(roles.name, name))
        .get();
      if (roleWithReservedName && roleWithReservedName.id !== roleId) {
        throw new Error(
          `Reserved role name "${name}" requires id "${roleId}", but is used by "${roleWithReservedName.id}"`,
        );
      }
    }

    for (const key of PERMISSION_KEYS) {
      transaction
        .insert(permissions)
        .values({ id: key, key })
        .onConflictDoNothing()
        .run();
    }

    for (const [name, grantedPermissions] of Object.entries(ROLE_PRESETS)) {
      const roleId = roleIdForName(name);
      transaction
        .insert(roles)
        .values({ id: roleId, name })
        .onConflictDoNothing()
        .run();
      transaction
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId))
        .run();

      for (const permissionId of grantedPermissions) {
        transaction
          .insert(rolePermissions)
          .values({ roleId, permissionId })
          .onConflictDoNothing()
          .run();
      }
    }
  });
}
