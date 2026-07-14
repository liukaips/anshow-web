import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import {
  permissions,
  rolePermissions,
  roles,
} from "../db/schema/index.js";
import { PERMISSION_KEYS } from "./permissions.js";
import { ROLE_PRESETS, roleIdForName, seedRbac } from "./seed-rbac.js";

describe("RBAC presets", () => {
  it("seeds every role and permission idempotently", () => {
    const testDatabase = createTestDatabase();

    try {
      seedRbac(testDatabase.db);
      seedRbac(testDatabase.db);

      expect(testDatabase.db.select().from(roles).all()).toHaveLength(
        Object.keys(ROLE_PRESETS).length,
      );
      expect(testDatabase.db.select().from(permissions).all()).toHaveLength(
        PERMISSION_KEYS.length,
      );
      expect(
        testDatabase.db.select().from(rolePermissions).all(),
      ).toHaveLength(
        Object.values(ROLE_PRESETS).reduce(
          (total, permissionKeys) => total + permissionKeys.length,
          0,
        ),
      );
    } finally {
      testDatabase.close();
    }
  });

  it("rebuilds managed grants without changing custom role grants", () => {
    const testDatabase = createTestDatabase();

    try {
      seedRbac(testDatabase.db);
      const publisherRoleId = roleIdForName("Publisher");
      testDatabase.db
        .insert(rolePermissions)
        .values({ roleId: publisherRoleId, permissionId: "audit.read" })
        .run();
      testDatabase.db
        .insert(roles)
        .values({ id: "custom-role", name: "Custom Role" })
        .run();
      testDatabase.db
        .insert(rolePermissions)
        .values({ roleId: "custom-role", permissionId: "audit.read" })
        .run();

      seedRbac(testDatabase.db);

      expect(
        testDatabase.db
          .select()
          .from(rolePermissions)
          .where(
            and(
              eq(rolePermissions.roleId, publisherRoleId),
              eq(rolePermissions.permissionId, "audit.read"),
            ),
          )
          .all(),
      ).toEqual([]);
      expect(
        testDatabase.db
          .select()
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, "custom-role"))
          .all(),
      ).toEqual([
        { roleId: "custom-role", permissionId: "audit.read" },
      ]);
    } finally {
      testDatabase.close();
    }
  });
});
