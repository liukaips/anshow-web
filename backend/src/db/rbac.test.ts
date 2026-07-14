import { describe, expect, it } from "vitest";

import { createTestDatabase } from "./test-db.js";
import {
  permissions,
  rolePermissions,
  roles,
  user,
  userRoles,
} from "./schema/index.js";

describe("rbac schema", () => {
  it("rejects assigning the same role to a user twice", () => {
    const testDatabase = createTestDatabase();

    try {
      testDatabase.db.insert(user).values({
        id: "user-1",
        name: "Ada Admin",
        email: "ada@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run();
      testDatabase.db.insert(roles).values({ id: "role-1", name: "Editor" }).run();

      const assignment = { userId: "user-1", roleId: "role-1" };
      testDatabase.db.insert(userRoles).values(assignment).run();

      expect(testDatabase.db.select().from(userRoles).all()).toEqual([assignment]);
      expect(() => testDatabase.db.insert(userRoles).values(assignment).run()).toThrow();
    } finally {
      testDatabase.close();
    }
  });

  it("enforces foreign keys and cascades role assignments", () => {
    const testDatabase = createTestDatabase();

    try {
      expect(() =>
        testDatabase.db
          .insert(userRoles)
          .values({ userId: "missing-user", roleId: "missing-role" })
          .run(),
      ).toThrow();

      testDatabase.db
        .insert(user)
        .values({
          id: "user-2",
          name: "Rita Reviewer",
          email: "rita@example.com",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
      testDatabase.db
        .insert(roles)
        .values({ id: "role-2", name: "Publisher" })
        .run();
      testDatabase.db
        .insert(permissions)
        .values({ id: "content.publish", key: "content.publish" })
        .run();

      testDatabase.db
        .insert(userRoles)
        .values({ userId: "user-2", roleId: "role-2" })
        .run();
      const rolePermission = {
        roleId: "role-2",
        permissionId: "content.publish",
      };
      testDatabase.db.insert(rolePermissions).values(rolePermission).run();

      expect(() =>
        testDatabase.db.insert(rolePermissions).values(rolePermission).run(),
      ).toThrow();

      testDatabase.db.delete(roles).run();
      expect(testDatabase.db.select().from(userRoles).all()).toEqual([]);
      expect(testDatabase.db.select().from(rolePermissions).all()).toEqual([]);
    } finally {
      testDatabase.close();
    }
  });
});
