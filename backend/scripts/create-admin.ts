import { eq } from "drizzle-orm";

import { auth } from "../src/auth/runtime.js";
import { roleIdForName, seedRbac } from "../src/auth/seed-rbac.js";
import { db } from "../src/db/client.js";
import { userRoles } from "../src/db/schema/rbac.js";

const arguments_ = process.argv.slice(2);
if (arguments_[0] === "--") arguments_.shift();
const [email, password, name = "Administrator"] = arguments_;

if (!email || !password) {
  throw new Error(
    "Usage: pnpm --filter @anshow/backend admin:create -- <email> <password> [name]",
  );
}

seedRbac(db);

const result = await auth.api.signUpEmail({
  body: { email, password, name },
});

const superAdministratorRoleId = roleIdForName("Super Administrator");
db.insert(userRoles)
  .values({
    userId: result.user.id,
    roleId: superAdministratorRoleId,
  })
  .onConflictDoNothing()
  .run();

const assignment = db
  .select()
  .from(userRoles)
  .where(eq(userRoles.userId, result.user.id))
  .get();

if (!assignment) {
  throw new Error("Administrator role assignment failed");
}

console.info(`Created administrator ${result.user.email}`);
