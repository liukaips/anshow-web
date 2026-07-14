import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "./test-db.js";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

function insertServiceBase(db: TestDatabase) {
  db.run(
    sql.raw(
      "INSERT INTO services (id, code) VALUES ('service-1', 'service-1')",
    ),
  );
}

function translationInsert(options: {
  locale?: string;
  status?: string;
  scheduledAt?: string;
  publishedAt?: string;
}) {
  const locale = options.locale ?? "en";
  const status = options.status ?? "draft";
  const scheduledAt = options.scheduledAt ?? "NULL";
  const publishedAt = options.publishedAt ?? "NULL";
  return sql.raw(`
    INSERT INTO service_translations (
      service_id, locale, status, scheduled_at, published_at, slug, title,
      summary, body, seo_title, seo_description, alt_text
    ) VALUES (
      'service-1', '${locale}', '${status}', ${scheduledAt}, ${publishedAt},
      'service-slug', 'Title', 'Summary', 'Body', 'SEO title',
      'SEO description', 'Alt text'
    )
  `);
}

function insertMediaBase(db: TestDatabase) {
  db.run(
    sql.raw(`
      INSERT INTO media_assets (
        id, storage_key, mime_type, width, height, dominant_color, focal_x,
        focal_y
      ) VALUES (
        'media-1', 'media-1.jpg', 'image/jpeg', 100, 100, '#ffffff', 0.5, 0.5
      )
    `),
  );
}

describe("content schema constraints", () => {
  it("rejects a locale outside en, zh, and ru", () => {
    const testDatabase = createTestDatabase();

    try {
      insertServiceBase(testDatabase.db);
      expect(() =>
        testDatabase.db.run(translationInsert({ locale: "de" })),
      ).toThrow();
    } finally {
      testDatabase.close();
    }
  });

  it("rejects an unknown publication status", () => {
    const testDatabase = createTestDatabase();

    try {
      insertServiceBase(testDatabase.db);
      expect(() =>
        testDatabase.db.run(translationInsert({ status: "review" })),
      ).toThrow();
    } finally {
      testDatabase.close();
    }
  });

  it("rejects an unsupported media translation locale", () => {
    const testDatabase = createTestDatabase();

    try {
      insertMediaBase(testDatabase.db);
      expect(() =>
        testDatabase.db.run(
          sql.raw(`
            INSERT INTO media_asset_translations (media_id, locale, alt_text)
            VALUES ('media-1', 'de', 'Alt text')
          `),
        ),
      ).toThrow();
    } finally {
      testDatabase.close();
    }
  });

  it("rejects an unknown process stage", () => {
    const testDatabase = createTestDatabase();

    try {
      expect(() =>
        testDatabase.db.run(
          sql.raw(
            "INSERT INTO services (id, code, process_stage_id) VALUES ('service-1', 'service-1', 'unknown')",
          ),
        ),
      ).toThrow();
    } finally {
      testDatabase.close();
    }
  });

  it.each([
    ["draft with a schedule", { status: "draft", scheduledAt: "1" }],
    ["draft with a publication time", { status: "draft", publishedAt: "1" }],
    ["scheduled without a schedule", { status: "scheduled" }],
    [
      "scheduled with a publication time",
      { status: "scheduled", scheduledAt: "1", publishedAt: "1" },
    ],
    ["published without a publication time", { status: "published" }],
  ])("rejects invalid publication tuple: %s", (_name, values) => {
    const testDatabase = createTestDatabase();

    try {
      insertServiceBase(testDatabase.db);
      expect(() =>
        testDatabase.db.run(translationInsert(values)),
      ).toThrow();
    } finally {
      testDatabase.close();
    }
  });

  it.each([
    ["non-positive width", "0", "100", "0.5", "0.5"],
    ["non-positive height", "100", "0", "0.5", "0.5"],
    ["focal x below zero", "100", "100", "-0.1", "0.5"],
    ["focal x above one", "100", "100", "1.1", "0.5"],
    ["focal y below zero", "100", "100", "0.5", "-0.1"],
    ["focal y above one", "100", "100", "0.5", "1.1"],
  ])(
    "rejects invalid media dimensions or focal point: %s",
    (_name, width, height, focalX, focalY) => {
      const testDatabase = createTestDatabase();

      try {
        expect(() =>
          testDatabase.db.run(
            sql.raw(`
              INSERT INTO media_assets (
                id, storage_key, mime_type, width, height, dominant_color,
                focal_x, focal_y
              ) VALUES (
                'media-1', 'media-1.jpg', 'image/jpeg', ${width}, ${height},
                '#ffffff', ${focalX}, ${focalY}
              )
            `),
          ),
        ).toThrow();
      } finally {
        testDatabase.close();
      }
    },
  );

  it.each([
    ["unknown format", "'jpeg'", "100", "100", "1000"],
    ["non-positive width", "'avif'", "0", "100", "1000"],
    ["non-positive height", "'avif'", "100", "0", "1000"],
    ["non-positive byte size", "'avif'", "100", "100", "0"],
  ])(
    "rejects an invalid media derivative: %s",
    (_name, format, width, height, byteSize) => {
      const testDatabase = createTestDatabase();

      try {
        insertMediaBase(testDatabase.db);
        expect(() =>
          testDatabase.db.run(
            sql.raw(`
              INSERT INTO media_derivatives (
                id, media_id, format, width, height, byte_size, url
              ) VALUES (
                'derivative-1', 'media-1', ${format}, ${width}, ${height},
                ${byteSize}, '/media-1.avif'
              )
            `),
          ),
        ).toThrow();
      } finally {
        testDatabase.close();
      }
    },
  );
});
