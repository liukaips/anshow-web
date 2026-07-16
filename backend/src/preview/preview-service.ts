import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { homeSchema, publicItemSchema, sitemapItemSchema } from "../content/public-contract.js";
import type { PublicContentRepository } from "../content/public-repository.js";
import { LOCALES, PUBLIC_COLLECTIONS } from "../content/types.js";
import type { AppDatabase } from "../db/client.js";
import { contentWorkflow, previewSnapshots, previewTokens } from "../db/schema/workflow.js";

const localeCollectionsSchema = z.object({
  en: z.array(publicItemSchema),
  zh: z.array(publicItemSchema),
  ru: z.array(publicItemSchema),
});

export const previewPayloadSchema = z.object({
  homes: z.object({ en: homeSchema, zh: homeSchema, ru: homeSchema }),
  collections: z.object(Object.fromEntries(PUBLIC_COLLECTIONS.map((collection) => [collection, localeCollectionsSchema])) as Record<(typeof PUBLIC_COLLECTIONS)[number], typeof localeCollectionsSchema>),
  sitemap: z.array(sitemapItemSchema),
}).strict();

export type PreviewPayload = z.infer<typeof previewPayloadSchema>;

type PreviewServiceOptions = {
  createId?: () => string;
  now?: () => Date;
  token?: () => string;
};

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function createPreviewService(database: AppDatabase, content: PublicContentRepository, options: PreviewServiceOptions = {}) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const createToken = options.token ?? (() => randomBytes(32).toString("base64url"));

  async function buildPayload(): Promise<PreviewPayload> {
    const homes = Object.fromEntries(await Promise.all(LOCALES.map(async (locale) => [locale, await content.getHome(locale)]))) as PreviewPayload["homes"];
    const collections = Object.fromEntries(await Promise.all(PUBLIC_COLLECTIONS.map(async (collection) => [
      collection,
      Object.fromEntries(await Promise.all(LOCALES.map(async (locale) => [locale, await content.listCollection(collection, locale)]))),
    ]))) as PreviewPayload["collections"];
    return previewPayloadSchema.parse({ homes, collections, sitemap: await content.listSitemap() });
  }

  return {
    async createSnapshot(input: { createdBy: string; expiresInHours: number }) {
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + input.expiresInHours * 3_600_000);
      const payload = await buildPayload();
      const serialized = JSON.stringify(payload);
      const contentHash = hash(serialized);
      const snapshotId = createId();
      const tokenId = createId();
      const rawToken = createToken();
      const sourceVersions = database.select({ entityType: contentWorkflow.entityType, entityId: contentWorkflow.entityId, version: contentWorkflow.version }).from(contentWorkflow).all();
      database.transaction((transaction) => {
        transaction.insert(previewSnapshots).values({
          id: snapshotId,
          payload: payload as unknown as Record<string, unknown>,
          contentHash,
          sourceVersions,
          createdBy: input.createdBy,
          createdAt,
          expiresAt,
        }).run();
        transaction.insert(previewTokens).values({
          id: tokenId,
          snapshotId,
          tokenHash: hash(rawToken),
          createdBy: input.createdBy,
          createdAt,
          expiresAt,
        }).run();
      });
      return { snapshotId, tokenId, rawToken, contentHash, sourceVersions, createdAt, expiresAt };
    },
    readSnapshot(rawToken: string) {
      const candidateHash = hash(rawToken);
      const token = database.select().from(previewTokens).where(eq(previewTokens.tokenHash, candidateHash)).get();
      if (!token || token.revokedAt || token.expiresAt <= now()) return null;
      const expected = Buffer.from(token.tokenHash, "hex");
      const candidate = Buffer.from(candidateHash, "hex");
      if (expected.length !== candidate.length || !timingSafeEqual(expected, candidate)) return null;
      const snapshot = database.select().from(previewSnapshots).where(eq(previewSnapshots.id, token.snapshotId)).get();
      if (!snapshot || (snapshot.expiresAt && snapshot.expiresAt <= now())) return null;
      return { ...snapshot, payload: previewPayloadSchema.parse(snapshot.payload) };
    },
    revoke(tokenId: string) {
      database.update(previewTokens).set({ revokedAt: now() }).where(eq(previewTokens.id, tokenId)).run();
    },
    list() {
      return database.select().from(previewSnapshots).orderBy(desc(previewSnapshots.createdAt)).all();
    },
  };
}

export type PreviewService = ReturnType<typeof createPreviewService>;
