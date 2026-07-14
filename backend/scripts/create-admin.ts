import { provisionAdministrator } from "../src/auth/provision-administrator.js";
import { seedRbac } from "../src/auth/seed-rbac.js";
import { db } from "../src/db/client.js";

const arguments_ = process.argv.slice(2);
if (arguments_[0] === "--") arguments_.shift();
const [email, name = "Administrator", ...unexpectedArguments] = arguments_;

if (!email || unexpectedArguments.length > 0) {
  throw new Error(
    "Usage: ANSHOW_ADMIN_PASSWORD=<password> pnpm --filter @anshow/backend admin:create -- <email> [name]",
  );
}

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
