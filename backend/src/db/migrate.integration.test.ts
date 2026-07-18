import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { LOCALES, type Locale } from "../content/types.js";
import * as schema from "./schema/index.js";
import {
  services,
  serviceTranslations,
} from "./schema/index.js";
import { migrateAndInitializeDatabase } from "./migration-runner.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../../migrations");
const LEGACY_SEEDED_AT = new Date("2026-07-14T12:00:00.000Z");

type OpenedDatabase = ReturnType<typeof openDatabase>;

function openDatabase(databasePath: string) {
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return {
    db: drizzle(sqlite, { schema }),
    close: () => sqlite.close(),
  };
}

function withTemporaryDirectory(run: (directory: string) => void | Promise<void>) {
  const directory = mkdtempSync(join(tmpdir(), "anshow-migrate-"));
  return Promise.resolve(run(directory)).finally(() => {
    rmSync(directory, { recursive: true, force: true });
  });
}

function withTemporaryDatabase(run: (databasePath: string) => void | Promise<void>) {
  return withTemporaryDirectory((directory) => run(join(directory, "anshow.db")));
}

function runtimeEnvironment(databasePath: string) {
  return {
    NODE_ENV: "test",
    SITE_URL: "http://anshow.test",
    SITE_HOST: "anshow.test",
    DATABASE_PATH: databasePath,
    BETTER_AUTH_SECRET: "a".repeat(32),
    RATE_LIMIT_SECRET: "b".repeat(32),
  };
}

function tableCounts(databasePath: string) {
  const sqlite = new Database(databasePath, { readonly: true });
  try {
    const count = (table: string) =>
      (sqlite.prepare(`select count(*) as count from ${table}`).get() as { count: number })
        .count;
    return {
      heroes: count("hero_slides"),
      heroTranslations: count("hero_slide_translations"),
      services: count("services"),
      serviceTranslations: count("service_translations"),
      lanes: count("trade_lanes"),
      laneTranslations: count("trade_lane_translations"),
      cargo: count("cargo_types"),
      cargoTranslations: count("cargo_type_translations"),
      pages: count("pages"),
      pageTranslations: count("page_translations"),
      cases: count("case_studies"),
      caseTranslations: count("case_study_translations"),
      articles: count("articles"),
      articleTranslations: count("article_translations"),
      certs: count("certificates"),
      certTranslations: count("certificate_translations"),
      proof: count("proof_metrics"),
      proofTranslations: count("proof_metric_translations"),
      nav: count("navigation_items"),
      navTranslations: count("navigation_item_translations"),
      revisions: count("content_seed_revisions"),
    };
  } finally {
    sqlite.close();
  }
}

function seededSnapshot(databasePath: string) {
  const sqlite = new Database(databasePath, { readonly: true });
  try {
    return {
      revisions: sqlite
        .prepare(
          "select collection, owner_id, locale, seed_version, applied_fingerprint, applied_at from content_seed_revisions order by collection, owner_id, locale",
        )
        .all(),
      timestamps: sqlite
        .prepare(
          "select id, updated_at from case_studies order by id",
        )
        .all(),
    };
  } finally {
    sqlite.close();
  }
}

type LegacyCopy = {
  title: string;
  slug: string;
  summary: string;
};

const legacyServices = [
  {
    code: "ocean-freight",
    sortOrder: 0,
    processStageId: "transit" as const,
    translations: {
      en: {
        title: "Ocean Freight",
        slug: "ocean-freight",
        summary: "Forwarding support for containerized, consolidated, and specialist ocean cargo.",
      },
      zh: {
        title: "海运服务",
        slug: "hai-yun-fu-wu",
        summary: "为整箱、拼箱及专业海运货物提供货运代理支持。",
      },
      ru: {
        title: "Морские перевозки",
        slug: "morskie-perevozki",
        summary: "Экспедирование контейнерных, сборных и специализированных морских грузов.",
      },
    } satisfies Record<Locale, LegacyCopy>,
  },
  {
    code: "air-freight",
    sortOrder: 1,
    processStageId: "transit" as const,
    translations: {
      en: {
        title: "Air Freight",
        slug: "air-freight",
        summary: "Air forwarding for priority, controlled, and schedule-sensitive cargo.",
      },
      zh: {
        title: "空运服务",
        slug: "kong-yun-fu-wu",
        summary: "为优先、受控及对时效敏感的货物提供空运代理。",
      },
      ru: {
        title: "Авиаперевозки",
        slug: "aviaperevozki",
        summary: "Авиаэкспедирование приоритетных, контролируемых и срочных грузов.",
      },
    } satisfies Record<Locale, LegacyCopy>,
  },
  {
    code: "multimodal",
    sortOrder: 4,
    processStageId: "route" as const,
    translations: {
      en: {
        title: "Multimodal Transport",
        slug: "multimodal-transport",
        summary: "Combine ocean, air, rail, and road legs under one coordinated plan.",
      },
      zh: {
        title: "多式联运",
        slug: "duo-shi-lian-yun",
        summary: "在统一方案下衔接海运、空运、铁路和公路运输。",
      },
      ru: {
        title: "Мультимодальные перевозки",
        slug: "multimodalnye-perevozki",
        summary: "Объединяйте морские, авиационные, железнодорожные и автомобильные этапы в одном плане.",
      },
    } satisfies Record<Locale, LegacyCopy>,
  },
] as const;

function insertLegacyServices(database: OpenedDatabase["db"]) {
  for (const service of legacyServices) {
    database
      .insert(services)
      .values({
        id: service.code,
        code: service.code,
        sortOrder: service.sortOrder,
        mediaId: null,
        processStageId: service.processStageId,
        createdAt: LEGACY_SEEDED_AT,
        updatedAt: LEGACY_SEEDED_AT,
      })
      .run();
    for (const locale of LOCALES) {
      const copy = service.translations[locale];
      database
        .insert(serviceTranslations)
        .values({
          ownerId: service.code,
          locale,
          status: "published",
          scheduledAt: null,
          publishedAt: LEGACY_SEEDED_AT,
          title: copy.title,
          slug: copy.slug,
          summary: copy.summary,
          body: copy.summary,
          seoTitle: `${copy.title} | AnShow`,
          seoDescription: copy.summary,
          altText: `${copy.title}${locale === "zh" ? "：" : ": "}${copy.summary}`,
          updatedAt: LEGACY_SEEDED_AT,
        })
        .run();
    }
  }
}

describe("migrateAndInitializeDatabase", () => {
  it("migrates an empty database and installs the current multilingual baseline", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const result = await migrateAndInitializeDatabase({
        environment: runtimeEnvironment(databasePath),
        migrationsFolder,
        openDatabase: () => openDatabase(databasePath),
      });

      expect(result.seed).toMatchObject({
        inserted: 162,
        upgraded: 0,
        archived: 0,
        preserved: [],
      });
      expect(tableCounts(databasePath)).toEqual({
        heroes: 4,
        heroTranslations: 12,
        services: 7,
        serviceTranslations: 21,
        lanes: 4,
        laneTranslations: 12,
        cargo: 4,
        cargoTranslations: 12,
        pages: 7,
        pageTranslations: 21,
        cases: 8,
        caseTranslations: 24,
        articles: 3,
        articleTranslations: 9,
        certs: 4,
        certTranslations: 12,
        proof: 4,
        proofTranslations: 12,
        nav: 9,
        navTranslations: 27,
        revisions: 162,
      });

      const sqlite = new Database(databasePath, { readonly: true });
      try {
        const body = sqlite
          .prepare(
            "select body from case_study_translations where case_study_id = ? and locale = ?",
          )
          .get("un1263-hamburg", "en") as { body: string };
        expect(JSON.parse(body.body)).toMatchObject({
          sections: expect.arrayContaining([
            expect.objectContaining({ type: "fact-list" }),
          ]),
        });
      } finally {
        sqlite.close();
      }
    });
  });

  it("is idempotent after the baseline has been initialized", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      await migrateAndInitializeDatabase({
        environment: runtimeEnvironment(databasePath),
        migrationsFolder,
        openDatabase: () => openDatabase(databasePath),
      });
      const before = seededSnapshot(databasePath);

      const result = await migrateAndInitializeDatabase({
        environment: runtimeEnvironment(databasePath),
        migrationsFolder,
        openDatabase: () => openDatabase(databasePath),
      });

      expect(result.seed).toEqual({
        inserted: 0,
        upgraded: 0,
        archived: 0,
        preserved: [],
      });
      expect(seededSnapshot(databasePath)).toEqual(before);
    });
  });

  it("uses the supplied validated database path instead of the ambient client path", async () => {
    await withTemporaryDirectory(async (directory) => {
      const ambientPath = join(directory, "ambient.db");
      const requestedPath = join(directory, "requested.db");
      const originalDatabasePath = process.env.DATABASE_PATH;

      try {
        process.env.DATABASE_PATH = ambientPath;
        await migrateAndInitializeDatabase({
          environment: runtimeEnvironment(requestedPath),
          migrationsFolder,
        });

        expect(existsSync(requestedPath)).toBe(true);
        expect(existsSync(ambientPath)).toBe(false);
        expect(tableCounts(requestedPath)).toMatchObject({ heroes: 4, revisions: 162 });
      } finally {
        if (originalDatabasePath === undefined) {
          delete process.env.DATABASE_PATH;
        } else {
          process.env.DATABASE_PATH = originalDatabasePath;
        }
      }
    });
  });

  it("upgrades generic legacy rows while preserving editorial state and archiving retired rows", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      const opened = openDatabase(databasePath);
      try {
        migrate(opened.db, { migrationsFolder });
        insertLegacyServices(opened.db);
        opened.db
          .update(services)
          .set({ sortOrder: 99 })
          .where(eq(services.id, "ocean-freight"))
          .run();
      } finally {
        opened.close();
      }

      const result = await migrateAndInitializeDatabase({
        environment: runtimeEnvironment(databasePath),
        migrationsFolder,
        openDatabase: () => openDatabase(databasePath),
      });
      const inspected = openDatabase(databasePath);
      try {
        expect(result.seed).toMatchObject({ inserted: 156, upgraded: 3, archived: 3 });
        expect(result.seed.preserved).toContainEqual({
          collection: "services",
          code: "ocean-freight",
          locale: "en",
        });
        expect(
          inspected.db
            .select({ title: serviceTranslations.title })
            .from(serviceTranslations)
            .where(
              and(
                eq(serviceTranslations.ownerId, "air-freight"),
                eq(serviceTranslations.locale, "en"),
              ),
            )
            .get(),
        ).toEqual({ title: "Air Freight for Time-Critical Cargo" });
        expect(
          inspected.db
            .select({ sortOrder: services.sortOrder })
            .from(services)
            .where(eq(services.id, "ocean-freight"))
            .get(),
        ).toEqual({ sortOrder: 99 });
        expect(
          inspected.db
            .select({ archivedAt: services.archivedAt })
            .from(services)
            .where(eq(services.id, "multimodal"))
            .get()?.archivedAt,
        ).not.toBeNull();
        expect(tableCounts(databasePath)).toMatchObject({ cases: 8, certs: 4, proof: 4 });
      } finally {
        inspected.close();
      }
    });
  });

  it("closes its owned database after a migration failure", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      let closed = false;

      await expect(
        migrateAndInitializeDatabase({
          environment: runtimeEnvironment(databasePath),
          migrationsFolder,
          openDatabase: () => {
            const opened = openDatabase(databasePath);
            return { ...opened, close: () => { closed = true; opened.close(); } };
          },
          migrate: () => {
            throw new Error("test migration failure");
          },
        }),
      ).rejects.toThrow("test migration failure");

      expect(closed).toBe(true);
    });
  });

  it("closes its owned database after an initialization failure without persisting partial seed work", async () => {
    await withTemporaryDatabase(async (databasePath) => {
      let closed = false;

      await expect(
        migrateAndInitializeDatabase({
          environment: runtimeEnvironment(databasePath),
          migrationsFolder,
          openDatabase: () => {
            const opened = openDatabase(databasePath);
            return { ...opened, close: () => { closed = true; opened.close(); } };
          },
          seed: (database) => {
            return database.transaction((transaction) => {
              transaction
                .insert(services)
                .values({
                  id: "partial-service",
                  code: "partial-service",
                  sortOrder: 0,
                  mediaId: null,
                  processStageId: null,
                })
                .run();
              throw new Error("test seed failure");
            });
          },
        }),
      ).rejects.toThrow("test seed failure");

      expect(closed).toBe(true);
      expect(tableCounts(databasePath)).toMatchObject({ heroes: 0, services: 0, revisions: 0 });
    });
  });
});
