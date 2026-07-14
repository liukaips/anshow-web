import "server-only";

type Environment = Readonly<Record<string, string | undefined>>;

export type FrontendServerEnv = {
  BACKEND_INTERNAL_URL: string;
};

export function parseFrontendServerEnv(
  environment: Environment,
): FrontendServerEnv {
  const rawBackendUrl =
    environment.BACKEND_INTERNAL_URL ??
    (environment.NODE_ENV === "production"
      ? undefined
      : "http://localhost:4000");

  if (!rawBackendUrl) {
    throw new Error("BACKEND_INTERNAL_URL is required in production.");
  }

  let backendUrl: URL;
  try {
    backendUrl = new URL(rawBackendUrl);
  } catch {
    throw new Error("BACKEND_INTERNAL_URL must be a valid absolute URL.");
  }

  if (
    !["http:", "https:"].includes(backendUrl.protocol) ||
    backendUrl.username ||
    backendUrl.password ||
    backendUrl.search ||
    backendUrl.hash ||
    (backendUrl.pathname !== "/" && backendUrl.pathname !== "")
  ) {
    throw new Error(
      "BACKEND_INTERNAL_URL must be an HTTP(S) origin without credentials, query, hash, or path.",
    );
  }

  return { BACKEND_INTERNAL_URL: backendUrl.origin };
}

export function getFrontendServerEnv(): FrontendServerEnv {
  return parseFrontendServerEnv(process.env);
}
