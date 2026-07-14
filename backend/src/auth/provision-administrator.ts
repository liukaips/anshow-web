import type { AppDatabase } from "../db/client.js";
import { account, user, userRoles } from "../db/schema/index.js";
import { hashCredentialPassword } from "./credential-password.js";
import { roleIdForName } from "./seed-rbac.js";

export type AdministratorInput = Readonly<{
  email: string;
  name: string;
  password: string;
}>;

export type ProvisionedAdministrator = Readonly<{
  email: string;
  id: string;
  name: string;
}>;

export async function provisionAdministrator(
  database: AppDatabase,
  input: AdministratorInput,
): Promise<ProvisionedAdministrator> {
  const id = crypto.randomUUID();
  const normalizedEmail = input.email.trim().toLowerCase();
  const passwordHash = await hashCredentialPassword(input.password);
  const now = new Date();

  return database.transaction((transaction) => {
    transaction
      .insert(user)
      .values({
        id,
        name: input.name,
        email: normalizedEmail,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    transaction
      .insert(account)
      .values({
        id: crypto.randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    transaction
      .insert(userRoles)
      .values({
        userId: id,
        roleId: roleIdForName("Super Administrator"),
      })
      .run();

    return { id, email: normalizedEmail, name: input.name };
  });
}
