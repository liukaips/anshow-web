import "server-only";

type Environment = Readonly<Record<string, string | undefined>>;

export type FrontendServerEnv = {
  BACKEND_INTERNAL_URL: string;
  SITE_URL: string;
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

  const rawSiteUrl =
    environment.SITE_URL ??
    (environment.NODE_ENV === "production"
      ? undefined
      : "http://localhost:3000");

  if (!rawSiteUrl) {
    throw new Error("SITE_URL is required in production.");
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

  let siteUrl: URL;
  try {
    siteUrl = new URL(rawSiteUrl);
  } catch {
    throw new Error("SITE_URL must be a valid absolute URL.");
  }

  const cleanSiteOrigin =
    !siteUrl.username &&
    !siteUrl.password &&
    !siteUrl.search &&
    !siteUrl.hash &&
    (siteUrl.pathname === "/" || siteUrl.pathname === "");
  const validSiteProtocol =
    environment.NODE_ENV === "production"
      ? siteUrl.protocol === "https:"
      : ["http:", "https:"].includes(siteUrl.protocol);

  if (!cleanSiteOrigin || !validSiteProtocol) {
    throw new Error(
      "SITE_URL must be an HTTPS origin without credentials, query, hash, or path in production.",
    );
  }

  return {
    BACKEND_INTERNAL_URL: backendUrl.origin,
    SITE_URL: siteUrl.origin,
  };
}

export function getFrontendServerEnv(): FrontendServerEnv {
  return parseFrontendServerEnv(process.env);
}
