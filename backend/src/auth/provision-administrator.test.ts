import { describe, expect, it } from "vitest";

import { account, user, userRoles } from "../db/schema/index.js";
import { createTestDatabase } from "../db/test-db.js";
import { roleIdForName, seedRbac } from "./seed-rbac.js";
import { provisionAdministrator } from "./provision-administrator.js";

const administrator = {
  email: "admin@anshow.example",
  name: "Administrator",
  password: "correct-horse-battery-staple",
};

describe("administrator provisioning", () => {
  it("creates a credential account and assigns the super administrator role", async () => {
    const testDatabase = createTestDatabase();

    try {
      seedRbac(testDatabase.db);
      const result = await provisionAdministrator(testDatabase.db, administrator);

      expect(result.email).toBe(administrator.email);
      expect(testDatabase.db.select().from(user).all()).toHaveLength(1);
      expect(testDatabase.db.select().from(account).all()).toEqual([
        expect.objectContaining({
          accountId: result.id,
          providerId: "credential",
          userId: result.id,
          password: expect.stringMatching(
            /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/,
          ),
        }),
      ]);
      expect(testDatabase.db.select().from(userRoles).all()).toEqual([
        {
          userId: result.id,
          roleId: roleIdForName("Super Administrator"),
        },
      ]);
    } finally {
      testDatabase.close();
    }
  });

  it("rolls back the user and credential when role assignment fails", async () => {
    const testDatabase = createTestDatabase();

    try {
      await expect(
        provisionAdministrator(testDatabase.db, administrator),
      ).rejects.toThrow();

      expect(testDatabase.db.select().from(user).all()).toEqual([]);
      expect(testDatabase.db.select().from(account).all()).toEqual([]);
      expect(testDatabase.db.select().from(userRoles).all()).toEqual([]);
    } finally {
      testDatabase.close();
    }
  });

  it.each([
    ["invalid email", { email: "not-an-email" }],
    ["short password", { password: "x" }],
    ["long password", { password: "x".repeat(129) }],
    ["blank name", { name: "   " }],
  ])("rejects an %s without persisting auth data", async (_case, override) => {
    const testDatabase = createTestDatabase();

    try {
      seedRbac(testDatabase.db);

      await expect(
        provisionAdministrator(testDatabase.db, {
          ...administrator,
          ...override,
        }),
      ).rejects.toThrow();
      expect(testDatabase.db.select().from(user).all()).toEqual([]);
      expect(testDatabase.db.select().from(account).all()).toEqual([]);
      expect(testDatabase.db.select().from(userRoles).all()).toEqual([]);
    } finally {
      testDatabase.close();
    }
  });
});
