import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import {
  permissions,
  rolePermissions,
  roles,
} from "../db/schema/index.js";
import { PERMISSION_KEYS } from "./permissions.js";
import { ROLE_PRESETS, seedRbac } from "./seed-rbac.js";

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
});
