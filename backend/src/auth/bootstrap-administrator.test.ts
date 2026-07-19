import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { account, user, userRoles } from "../db/schema/index.js";
import { createTestDatabase } from "../db/test-db.js";
import { ensureBootstrapAdministrator } from "./bootstrap-administrator.js";
import { verifyCredentialPassword } from "./credential-password.js";
import { roleIdForName, seedRbac } from "./seed-rbac.js";

describe("bootstrap administrator", () => {
  it("creates the deploy-ready liukai administrator and removes the old test login", async () => {
    const testDatabase = createTestDatabase();

    try {
      seedRbac(testDatabase.db);
      testDatabase.db
        .insert(user)
        .values({
          id: "legacy-admin",
          name: "Test Admin",
          email: "admin@example.test",
          emailVerified: true,
          createdAt: new Date("2026-07-18T12:00:00.000Z"),
          updatedAt: new Date("2026-07-18T12:00:00.000Z"),
        })
        .run();

      const result = await ensureBootstrapAdministrator(testDatabase.db);

      expect(result).toMatchObject({
        created: true,
        email: "liukai@anshow.local",
      });
      const created = testDatabase.db
        .select()
        .from(user)
        .where(eq(user.email, "liukai@anshow.local"))
        .get();
      expect(created).toMatchObject({
        name: "liukai",
        emailVerified: true,
      });
      const credential = testDatabase.db
        .select({ password: account.password })
        .from(account)
        .where(eq(account.userId, result.id))
        .get();
      expect(credential?.password).toBeTruthy();
      await expect(
        verifyCredentialPassword({
          hash: credential!.password!,
          password: "liukaiok",
        }),
      ).resolves.toBe(true);
      expect(
        testDatabase.db
          .select({ roleId: userRoles.roleId })
          .from(userRoles)
          .where(eq(userRoles.userId, result.id))
          .all(),
      ).toEqual([{ roleId: roleIdForName("Super Administrator") }]);
      expect(
        testDatabase.db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, "admin@example.test"))
          .all(),
      ).toEqual([]);
    } finally {
      testDatabase.close();
    }
  });
});
