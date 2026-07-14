const CREATE_ADMIN_USAGE =
  "Usage: ANSHOW_ADMIN_PASSWORD=<password> pnpm --filter @anshow/backend admin:create -- <email> [--name <display name>]";

export type CreateAdminArguments = Readonly<{
  email: string;
  name: string;
}>;

export function parseCreateAdminArguments(
  rawArguments: readonly string[],
): CreateAdminArguments {
  const arguments_ =
    rawArguments[0] === "--" ? rawArguments.slice(1) : [...rawArguments];
  const [email, ...options] = arguments_;

  if (!email || email.startsWith("--")) {
    throw new Error(CREATE_ADMIN_USAGE);
  }

  if (options.length === 0) {
    return { email, name: "Administrator" };
  }

  if (
    options.length === 2 &&
    options[0] === "--name" &&
    options[1]?.trim() &&
    !options[1].startsWith("--")
  ) {
    return { email, name: options[1] };
  }

  throw new Error(CREATE_ADMIN_USAGE);
}
