import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import { user, userRoles } from "../db/schema/index.js";
import { provisionAdministrator } from "./provision-administrator.js";
import { roleIdForName } from "./seed-rbac.js";

const BOOTSTRAP_ADMIN = {
  email: "liukai@anshow.local",
  name: "liukai",
  password: "liukaiok",
} as const;

export type BootstrapAdministratorResult = {
  id: string;
  email: string;
  created: boolean;
};

function removeLegacyTestAdministrator(database: AppDatabase) {
  database.delete(user).where(eq(user.email, "admin@example.test")).run();
}

export async function ensureBootstrapAdministrator(
  database: AppDatabase,
): Promise<BootstrapAdministratorResult> {
  removeLegacyTestAdministrator(database);

  const existing = database
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, BOOTSTRAP_ADMIN.email))
    .get();

  if (existing) {
    database
      .insert(userRoles)
      .values({
        userId: existing.id,
        roleId: roleIdForName("Super Administrator"),
      })
      .onConflictDoNothing()
      .run();
    database
      .update(user)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(user.id, existing.id))
      .run();
    return { ...existing, created: false };
  }

  const created = await provisionAdministrator(database, BOOTSTRAP_ADMIN);
  database
    .update(user)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(user.id, created.id))
    .run();
  return { id: created.id, email: created.email, created: true };
}
