import { z } from "zod";

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

const AdministratorInputSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1),
  password: z.string().min(8).max(128),
});

function validateAdministratorInput(
  input: AdministratorInput,
): AdministratorInput {
  const result = AdministratorInputSchema.safeParse({
    ...input,
    email: input.email.trim().toLowerCase(),
  });
  if (!result.success) {
    const field = result.error.issues[0]?.path[0] ?? "input";
    throw new Error(`Invalid administrator ${String(field)}`);
  }

  return result.data;
}

export async function provisionAdministrator(
  database: AppDatabase,
  input: AdministratorInput,
): Promise<ProvisionedAdministrator> {
  const validatedInput = validateAdministratorInput(input);
  const id = crypto.randomUUID();
  const passwordHash = await hashCredentialPassword(validatedInput.password);
  const now = new Date();

  return database.transaction((transaction) => {
    transaction
      .insert(user)
      .values({
        id,
        name: validatedInput.name,
        email: validatedInput.email,
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

    return {
      id,
      email: validatedInput.email,
      name: validatedInput.name,
    };
  });
}
