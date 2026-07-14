import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import { user, userRoles } from "../db/schema/index.js";
import { permissionsForUser } from "./permission-repository.js";
import { roleIdForName, seedRbac } from "./seed-rbac.js";

describe("permissionsForUser", () => {
  it("deduplicates permissions granted through overlapping roles", () => {
    const testDatabase = createTestDatabase();

    try {
      seedRbac(testDatabase.db);
      testDatabase.db
        .insert(user)
        .values({
          id: "user-overlap",
          name: "Pat Publisher",
          email: "pat@example.com",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
      testDatabase.db.insert(userRoles).values([
        {
          userId: "user-overlap",
          roleId: roleIdForName("Publisher"),
        },
        {
          userId: "user-overlap",
          roleId: roleIdForName("Content Editor"),
        },
      ]).run();

      const granted = permissionsForUser(testDatabase.db, "user-overlap");
      expect(granted).toHaveLength(new Set(granted).size);
      expect(granted).toEqual(
        expect.arrayContaining([
          "content.read",
          "content.write",
          "content.publish",
          "media.read",
          "media.write",
        ]),
      );
    } finally {
      testDatabase.close();
    }
  });
});
