import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import { account, user } from "../db/schema/index.js";
import { provisionAdministrator } from "./provision-administrator.js";
import { seedRbac } from "./seed-rbac.js";
import { createAuth, createAuthHandler } from "./server.js";

const siteUrl = "https://anshow.example";
const secret = "test-only-secret-with-at-least-32-characters";

function signUp(
  handleAuthRequest: (request: Request) => Promise<Response>,
  origin: string,
  email: string,
) {
  return handleAuthRequest(
    new Request(`${siteUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
      },
      body: JSON.stringify({
        email,
        name: "Ada Admin",
        password: "correct-horse-battery-staple",
      }),
    }),
  );
}

function signIn(
  handleAuthRequest: (request: Request) => Promise<Response>,
  email: string,
) {
  return handleAuthRequest(
    new Request(`${siteUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: siteUrl,
      },
      body: JSON.stringify({
        email,
        password: "correct-horse-battery-staple",
      }),
    }),
  );
}

describe("Better Auth production configuration", () => {
  it("rejects public email and password sign-up", async () => {
    const testDatabase = createTestDatabase();

    try {
      const auth = createAuth(testDatabase.db, {
        production: true,
        secret,
        siteUrl,
      });
      const handleAuthRequest = createAuthHandler(auth, siteUrl);
      const response = await signUp(
        handleAuthRequest,
        siteUrl,
        "ada@example.com",
      );
      expect(response.status).toBe(400);
      expect(testDatabase.db.select().from(user).all()).toHaveLength(0);
      expect(testDatabase.db.select().from(account).all()).toHaveLength(0);
    } finally {
      testDatabase.close();
    }
  });

  it("rejects requests from an arbitrary origin", async () => {
    const testDatabase = createTestDatabase();

    try {
      const auth = createAuth(testDatabase.db, {
        production: true,
        secret,
        siteUrl,
      });
      const handleAuthRequest = createAuthHandler(auth, siteUrl);
      const response = await signUp(
        handleAuthRequest,
        "https://attacker.example",
        "blocked@example.com",
      );

      expect(response.status).toBe(403);
      expect(testDatabase.db.select().from(account).all()).toHaveLength(0);
    } finally {
      testDatabase.close();
    }
  });

  it("signs in a privately provisioned administrator with hardened cookies", async () => {
    const testDatabase = createTestDatabase();

    try {
      seedRbac(testDatabase.db);
      await provisionAdministrator(testDatabase.db, {
        email: "provisioned@example.com",
        name: "Provisioned Administrator",
        password: "correct-horse-battery-staple",
      });
      const auth = createAuth(testDatabase.db, {
        production: true,
        secret,
        siteUrl,
      });
      const response = await signIn(
        createAuthHandler(auth, siteUrl),
        "provisioned@example.com",
      );
      const sessionCookie = response.headers.get("set-cookie");

      expect(response.status).toBe(200);
      expect(sessionCookie).toContain("Secure");
      expect(sessionCookie).toContain("HttpOnly");
      expect(sessionCookie).toContain("SameSite=Lax");
      expect(sessionCookie).toContain("__Secure-");
      expect(sessionCookie).not.toContain("Domain=");
    } finally {
      testDatabase.close();
    }
  });
});
