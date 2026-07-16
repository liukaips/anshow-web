import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { roleIdForName, seedRbac } from "../../auth/seed-rbac.js";
import { createTestDatabase } from "../../db/test-db.js";
import { session, user } from "../../db/schema/auth.js";
import { auditLogs } from "../../db/schema/settings.js";
import { userRoles } from "../../db/schema/rbac.js";
import {
  createStaffRepository,
  StaffRepositoryError,
} from "./staff-repository.js";

function addUser(
  database: ReturnType<typeof createTestDatabase>["db"],
  input: { id: string; enabled?: boolean; roleNames?: string[] },
) {
  const now = new Date("2026-07-16T08:00:00.000Z");
  database
    .insert(user)
    .values({
      id: input.id,
      name: input.id,
      email: `${input.id}@example.test`,
      emailVerified: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const roleIds = (input.roleNames ?? []).map(roleIdForName);
  if (roleIds.length > 0) {
    database
      .insert(userRoles)
      .values(roleIds.map((roleId) => ({ userId: input.id, roleId })))
      .run();
  }
}

function addSession(
  database: ReturnType<typeof createTestDatabase>["db"],
  userId: string,
) {
  const now = new Date("2026-07-16T08:00:00.000Z");
  database
    .insert(session)
    .values({
      id: `session-${userId}`,
      token: `token-${userId}`,
      userId,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date("2026-07-17T08:00:00.000Z"),
    })
    .run();
}

describe("staff repository lifecycle", () => {
  it("returns one employee row with status and all assigned roles", () => {
    const testDatabase = createTestDatabase();
    try {
      seedRbac(testDatabase.db);
      addUser(testDatabase.db, {
        id: "editor-1",
        roleNames: ["Content Editor", "Viewer"],
      });

      expect(createStaffRepository(testDatabase.db).list()).toEqual([
        expect.objectContaining({
          id: "editor-1",
          enabled: true,
          roleIds: ["content-editor", "viewer"],
          roleNames: ["Content Editor", "Viewer"],
          isSuperAdmin: false,
        }),
      ]);
    } finally {
      testDatabase.close();
    }
  });

  it("revokes sessions and records an audit event when roles change", () => {
    const testDatabase = createTestDatabase();
    try {
      seedRbac(testDatabase.db);
      addUser(testDatabase.db, { id: "admin-1", roleNames: ["Super Administrator"] });
      addUser(testDatabase.db, { id: "editor-1", roleNames: ["Content Editor"] });
      addSession(testDatabase.db, "editor-1");

      createStaffRepository(testDatabase.db).setRoles(
        "editor-1",
        [roleIdForName("Content Reviewer")],
        "admin-1",
      );

      expect(
        testDatabase.db
          .select()
          .from(session)
          .where(eq(session.userId, "editor-1"))
          .all(),
      ).toEqual([]);
      expect(
        testDatabase.db.select().from(auditLogs).all(),
      ).toEqual([
        expect.objectContaining({
          actorId: "admin-1",
          action: "staff.roles.update",
          entityId: "editor-1",
        }),
      ]);
    } finally {
      testDatabase.close();
    }
  });

  it("does not allow a non-super administrator to disable a super administrator", () => {
    const testDatabase = createTestDatabase();
    try {
      seedRbac(testDatabase.db);
      addUser(testDatabase.db, { id: "super-1", roleNames: ["Super Administrator"] });
      addUser(testDatabase.db, { id: "super-2", roleNames: ["Super Administrator"] });
      addUser(testDatabase.db, { id: "system-1", roleNames: ["System Administrator"] });

      expect(() =>
        createStaffRepository(testDatabase.db).disable("super-1", "system-1"),
      ).toThrowError(
        expect.objectContaining<Partial<StaffRepositoryError>>({
          code: "SUPER_ADMIN_REQUIRED",
        }),
      );
      expect(
        testDatabase.db
          .select({ enabled: user.emailVerified })
          .from(user)
          .where(eq(user.id, "super-1"))
          .get(),
      ).toEqual({ enabled: true });
    } finally {
      testDatabase.close();
    }
  });

  it("protects the last enabled super administrator from disable and demotion", () => {
    const testDatabase = createTestDatabase();
    try {
      seedRbac(testDatabase.db);
      addUser(testDatabase.db, { id: "super-1", roleNames: ["Super Administrator"] });
      addUser(testDatabase.db, { id: "system-1", roleNames: ["System Administrator"] });
      const repository = createStaffRepository(testDatabase.db);

      expect(() => repository.disable("super-1", "system-1")).toThrowError(
        expect.objectContaining<Partial<StaffRepositoryError>>({
          code: "LAST_SUPER_ADMIN",
        }),
      );
      expect(() =>
        repository.setRoles(
          "super-1",
          [roleIdForName("Content Editor")],
          "super-1",
        ),
      ).toThrowError(
        expect.objectContaining<Partial<StaffRepositoryError>>({
          code: "LAST_SUPER_ADMIN",
        }),
      );
    } finally {
      testDatabase.close();
    }
  });

  it("prevents a system administrator from promoting anyone to super administrator", () => {
    const testDatabase = createTestDatabase();
    try {
      seedRbac(testDatabase.db);
      addUser(testDatabase.db, { id: "super-1", roleNames: ["Super Administrator"] });
      addUser(testDatabase.db, { id: "system-1", roleNames: ["System Administrator"] });
      const repository = createStaffRepository(testDatabase.db);

      expect(() =>
        repository.setRoles(
          "system-1",
          [
            roleIdForName("System Administrator"),
            roleIdForName("Super Administrator"),
          ],
          "system-1",
        ),
      ).toThrowError(
        expect.objectContaining<Partial<StaffRepositoryError>>({
          code: "SUPER_ADMIN_REQUIRED",
        }),
      );
      expect(
        testDatabase.db
          .select({ roleId: userRoles.roleId })
          .from(userRoles)
          .where(eq(userRoles.userId, "system-1"))
          .all(),
      ).toEqual([{ roleId: "system-administrator" }]);
    } finally {
      testDatabase.close();
    }
  });

  it("rejects unknown employees and role ids without partial writes", () => {
    const testDatabase = createTestDatabase();
    try {
      seedRbac(testDatabase.db);
      addUser(testDatabase.db, { id: "admin-1", roleNames: ["Super Administrator"] });
      addUser(testDatabase.db, { id: "editor-1", roleNames: ["Content Editor"] });
      const repository = createStaffRepository(testDatabase.db);

      expect(() => repository.enable("missing", "admin-1")).toThrowError(
        expect.objectContaining<Partial<StaffRepositoryError>>({
          code: "STAFF_NOT_FOUND",
        }),
      );
      expect(() =>
        repository.setRoles("editor-1", ["unknown-role"], "admin-1"),
      ).toThrowError(
        expect.objectContaining<Partial<StaffRepositoryError>>({
          code: "INVALID_ROLE",
        }),
      );
      expect(
        testDatabase.db
          .select({ roleId: userRoles.roleId })
          .from(userRoles)
          .where(eq(userRoles.userId, "editor-1"))
          .all(),
      ).toEqual([{ roleId: "content-editor" }]);
    } finally {
      testDatabase.close();
    }
  });

  it("supports an audited forced sign-out without disabling the employee", () => {
    const testDatabase = createTestDatabase();
    try {
      seedRbac(testDatabase.db);
      addUser(testDatabase.db, { id: "admin-1", roleNames: ["Super Administrator"] });
      addUser(testDatabase.db, { id: "editor-1", roleNames: ["Content Editor"] });
      addSession(testDatabase.db, "editor-1");

      createStaffRepository(testDatabase.db).revokeSessions(
        "editor-1",
        "admin-1",
      );

      expect(testDatabase.db.select().from(session).all()).toEqual([]);
      expect(
        testDatabase.db
          .select({ enabled: user.emailVerified })
          .from(user)
          .where(eq(user.id, "editor-1"))
          .get(),
      ).toEqual({ enabled: true });
      expect(testDatabase.db.select().from(auditLogs).all()).toEqual([
        expect.objectContaining({ action: "staff.sessions.revoke" }),
      ]);
    } finally {
      testDatabase.close();
    }
  });
});
