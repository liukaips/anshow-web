import { parseCreateAdminArguments } from "../src/auth/create-admin-arguments.js";
import { provisionAdministrator } from "../src/auth/provision-administrator.js";
import { seedRbac } from "../src/auth/seed-rbac.js";
import { db } from "../src/db/client.js";

const { email, name } = parseCreateAdminArguments(process.argv.slice(2));

async function readPassword(): Promise<string> {
  if (process.env.ANSHOW_ADMIN_PASSWORD) {
    return process.env.ANSHOW_ADMIN_PASSWORD;
  }

  if (process.stdin.isTTY) {
    throw new Error(
      "Set ANSHOW_ADMIN_PASSWORD or pipe the password to standard input.",
    );
  }

  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  const password = input.replace(/[\r\n]+$/, "");
  if (!password) throw new Error("Administrator password is required.");
  return password;
}

const password = await readPassword();
seedRbac(db);
const result = await provisionAdministrator(db, { email, name, password });

console.info(`Created administrator ${result.email}`);
