import { describe, expect, it } from "vitest";

import { createTestDatabase } from "./test-db.js";
import { roles, user, userRoles } from "./schema/index.js";

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
});
