# AnShow Public Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete multilingual public website, generated asset set, accessible carousels, five-stage logistics storytelling, SEO pages, and responsive performance behavior.

**Architecture:** The Hono backend exclusively owns content tables, multilingual publishing rules, Drizzle repositories, seed data, and `/api/public/content/*` OpenAPI routes. The Next.js frontend consumes only the generated OpenAPI types: server components call `BACKEND_INTERNAL_URL` over the Compose network, browser code calls same-origin `/api`, and interactive islands own Embla, GSAP, and capability-gated Three.js behavior without importing backend source.

**Tech Stack:** Next.js, Hono, TypeScript, next-intl, OpenAPI, Drizzle, SQLite, Tailwind CSS, Embla Carousel, GSAP ScrollTrigger, Three.js, Sharp, Vitest, Playwright, imagegen

---

## Execution Order and File Map

Run after the foundation plan.

- `backend/src/content/*`: content domain types, Drizzle repository, three-language seed catalog, and public-content service.
- `backend/src/public/content-routes.ts`: published-content OpenAPI endpoints and response schemas.
- `frontend/src/api/*`: generated-contract API clients; no handwritten backend DTOs.
- `frontend/src/app/[locale]/*`: public routes and metadata.
- `frontend/src/components/site/*`: header, footer, locale switcher, enquiry CTA.
- `frontend/src/components/home/*`: homepage sections and carousels.
- `frontend/src/components/process/*`: five-stage scroll narrative and mobile fallback.
- `frontend/src/components/motion/*`: reduced-motion and capability helpers.
- `content/assets/prompts.json`: exact image-generation manifest.
- `scripts/process-images.ts`: repository-level derivative generation.
- `frontend/public/media/*`: approved hashed production assets served by Next.js or uploaded to COS later.

### Task 1: Add Typed Content Tables, Repository, and Complete Three-Language Seeds

**Files:**
- Create: `backend/src/db/schema/content.ts`
- Modify: `backend/src/db/schema/index.ts`
- Create: `backend/src/content/types.ts`
- Create: `backend/src/content/public-repository.ts`
- Create: `backend/src/content/drizzle-content-store.ts`
- Create: `backend/src/content/public-repository.test.ts`
- Create: `backend/src/content/seed.ts`

- [ ] **Step 1: Write the failing published-content test**

```ts
// backend/src/content/public-repository.test.ts
import { describe, expect, it } from "vitest";
import { createPublicRepository } from "./public-repository";

describe("public content repository", () => {
  it("returns only the requested published locale", async () => {
    const repo = createPublicRepository({
      async findPublishedService(locale, slug) {
        if (locale === "zh" && slug === "hai-yun") return { title: "海运服务", slug };
        return null;
      },
    });
    expect(await repo.getServiceBySlug("zh", "hai-yun")).toMatchObject({ title: "海运服务" });
    await expect(repo.getServiceBySlug("ru", "ocean")).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm --filter @anshow/backend test -- src/content/public-repository.test.ts`

Expected: FAIL because content tables and repository do not exist.

- [ ] **Step 3: Define explicit base and translation tables**

```ts
// backend/src/db/schema/content.ts
import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

function localizedCollection(baseName: string, foreignKeyName: string) {
  const base = sqliteTable(baseName, {
    id: text("id").primaryKey(), code: text("code").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    mediaId: text("media_id"),
    processStageId: text("process_stage_id", { enum: ["route", "pickup", "customs", "transit", "delivery"] }),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    verificationSource: text("verification_source"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  });
  const translations = sqliteTable(`${baseName.slice(0, -1)}_translations`, {
    ownerId: text(foreignKeyName).notNull().references(() => base.id, { onDelete: "cascade" }),
    locale: text("locale", { enum: ["en", "zh", "ru"] }).notNull(),
    status: text("status", { enum: ["draft", "scheduled", "published"] }).notNull().default("draft"),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    slug: text("slug").notNull(), title: text("title").notNull(),
    summary: text("summary").notNull(), body: text("body").notNull(),
    seoTitle: text("seo_title").notNull(), seoDescription: text("seo_description").notNull(),
    altText: text("alt_text").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  }, (table) => [
    primaryKey({ columns: [table.ownerId, table.locale] }),
    uniqueIndex(`${baseName}_locale_slug_idx`).on(table.locale, table.slug),
  ]);
  return { base, translations };
}

export const serviceTables = localizedCollection("services", "service_id");
export const heroSlideTables = localizedCollection("hero_slides", "hero_slide_id");
export const tradeLaneTables = localizedCollection("trade_lanes", "trade_lane_id");
export const cargoTypeTables = localizedCollection("cargo_types", "cargo_type_id");
export const caseStudyTables = localizedCollection("case_studies", "case_study_id");
export const articleTables = localizedCollection("articles", "article_id");
export const partnerTables = localizedCollection("partners", "partner_id");
export const certificateTables = localizedCollection("certificates", "certificate_id");
export const proofMetricTables = localizedCollection("proof_metrics", "proof_metric_id");
export const pageTables = localizedCollection("pages", "page_id");
export const navigationItemTables = localizedCollection("navigation_items", "navigation_item_id");

export const services = serviceTables.base;
export const serviceTranslations = serviceTables.translations;
export const heroSlides = heroSlideTables.base; export const heroSlideTranslations = heroSlideTables.translations;
export const tradeLanes = tradeLaneTables.base; export const tradeLaneTranslations = tradeLaneTables.translations;
export const cargoTypes = cargoTypeTables.base; export const cargoTypeTranslations = cargoTypeTables.translations;
export const caseStudies = caseStudyTables.base; export const caseStudyTranslations = caseStudyTables.translations;
export const articles = articleTables.base; export const articleTranslations = articleTables.translations;
export const partners = partnerTables.base; export const partnerTranslations = partnerTables.translations;
export const certificates = certificateTables.base; export const certificateTranslations = certificateTables.translations;
export const proofMetrics = proofMetricTables.base; export const proofMetricTranslations = proofMetricTables.translations;
export const pages = pageTables.base; export const pageTranslations = pageTables.translations;
export const navigationItems = navigationItemTables.base; export const navigationItemTranslations = navigationItemTables.translations;

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(), storageKey: text("storage_key").notNull().unique(), mimeType: text("mime_type").notNull(),
  width: integer("width").notNull(), height: integer("height").notNull(), dominantColor: text("dominant_color").notNull(),
  focalX: real("focal_x").notNull().default(0.5), focalY: real("focal_y").notNull().default(0.5),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(), replacedAt: integer("replaced_at", { mode: "timestamp" }),
});
export const mediaAssetTranslations = sqliteTable("media_asset_translations", {
  mediaId: text("media_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
  locale: text("locale", { enum: ["en", "zh", "ru"] }).notNull(), altText: text("alt_text").notNull(),
}, (table) => [primaryKey({ columns: [table.mediaId, table.locale] })]);
export const mediaDerivatives = sqliteTable("media_derivatives", {
  id: text("id").primaryKey(), mediaId: text("media_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
  format: text("format", { enum: ["avif", "webp"] }).notNull(), width: integer("width").notNull(), height: integer("height").notNull(),
  byteSize: integer("byte_size").notNull(), url: text("url").notNull(),
}, (table) => [uniqueIndex("media_derivative_variant_idx").on(table.mediaId, table.format, table.width)]);
export const mediaUsage = sqliteTable("media_usage", {
  mediaId: text("media_id").notNull().references(() => mediaAssets.id, { onDelete: "restrict" }), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), field: text("field").notNull(),
}, (table) => [primaryKey({ columns: [table.mediaId, table.entityType, table.entityId, table.field] })]);
```

- [ ] **Step 4: Implement the repository contract**

```ts
// backend/src/content/public-repository.ts
import type { Locale } from "./types";

export type ServiceRecord = { title: string; slug: string };
export interface PublicContentStore {
  findPublishedService(locale: Locale, slug: string): Promise<ServiceRecord | null>;
}

export function createPublicRepository(store: PublicContentStore) {
  return {
    async getServiceBySlug(locale: Locale, slug: string) {
      return store.findPublishedService(locale, slug);
    },
  };
}
```

```ts
// backend/src/content/drizzle-content-store.ts
import { and, eq, isNull, lte } from "drizzle-orm";
import type { AppDatabase } from "../db/client";
import { services, serviceTranslations } from "../db/schema/content";
import type { PublicContentStore } from "./public-repository";

export function createDrizzleContentStore(db: AppDatabase): PublicContentStore {
  return { async findPublishedService(locale, slug) {
    const rows = await db.select({ title: serviceTranslations.title, slug: serviceTranslations.slug }).from(serviceTranslations)
      .innerJoin(services, eq(services.id, serviceTranslations.ownerId))
      .where(and(
        eq(serviceTranslations.locale, locale),
        eq(serviceTranslations.slug, slug),
        eq(serviceTranslations.status, "published"),
        lte(serviceTranslations.publishedAt, new Date()),
        isNull(services.archivedAt),
      )).limit(1);
    return rows[0] ?? null;
  } };
}
```

- [ ] **Step 5: Seed all approved page identities in EN/ZH/RU**

```ts
// backend/src/content/seed.ts
import type { Locale } from "./types";
type Copy = { title: string; slug: string; summary: string };
type SeedCollection = "hero-slides" | "services" | "trade-lanes" | "cargo-types" | "pages" | "case-studies" | "articles";
type SeedItem = { collection: SeedCollection; code: string; imageId?: string; publish?: boolean; en: Copy; zh: Copy; ru: Copy };
const item = (collection: SeedCollection, code: string, imageId: string | undefined, en: Copy, zh: Copy, ru: Copy, publish = true): SeedItem => ({ collection, code, imageId, en, zh, ru, publish });

export const seedCatalog: SeedItem[] = [
  item("hero-slides", "ocean", "hero-ocean", { title: "Ocean freight with connected coordination", slug: "ocean", summary: "Plan containerized and specialist ocean movements with one forwarding contact." }, { title: "协同衔接的国际海运", slug: "hai-yun", summary: "通过统一货运代理窗口规划集装箱及专业海运需求。" }, { title: "Морские перевозки с единой координацией", slug: "morskie-perevozki", summary: "Планируйте контейнерные и специализированные морские перевозки через единое окно." }),
  item("hero-slides", "air", "hero-air", { title: "Air freight for priority cargo", slug: "air", summary: "Coordinate time-sensitive air cargo with clear milestones and documentation readiness." }, { title: "面向优先货物的国际空运", slug: "kong-yun", summary: "以清晰节点和文件准备协同时间敏感型空运货物。" }, { title: "Авиаперевозки для приоритетных грузов", slug: "aviaperevozki", summary: "Координируйте срочные авиагрузы с понятными этапами и готовностью документов." }),
  item("hero-slides", "rail", "hero-rail", { title: "Rail freight across Eurasian corridors", slug: "rail", summary: "Build rail and multimodal plans for China, Russia, Europe, and Central Asia." }, { title: "贯通欧亚通道的铁路运输", slug: "tie-lu", summary: "为中国、俄罗斯、欧洲及中亚方向规划铁路与多式联运方案。" }, { title: "Железнодорожные перевозки по Евразии", slug: "zheleznodorozhnye-perevozki", summary: "Формируйте железнодорожные и мультимодальные решения для Китая, России, Европы и Центральной Азии." }),
  item("hero-slides", "road", "hero-road", { title: "Road freight that closes the route", slug: "road", summary: "Connect terminals, warehouses, and delivery points with coordinated road transport." }, { title: "衔接全程的公路运输", slug: "gong-lu", summary: "通过协同公路运输连接场站、仓库和最终交付点。" }, { title: "Автоперевозки, завершающие маршрут", slug: "avtoperevozki", summary: "Связывайте терминалы, склады и пункты доставки согласованным автотранспортом." }),

  item("services", "ocean-freight", "service-ocean", { title: "Ocean Freight", slug: "ocean-freight", summary: "Forwarding support for containerized, consolidated, and specialist ocean cargo." }, { title: "海运服务", slug: "hai-yun-fu-wu", summary: "为整箱、拼箱及专业海运货物提供货运代理支持。" }, { title: "Морские перевозки", slug: "morskie-perevozki", summary: "Экспедирование контейнерных, сборных и специализированных морских грузов." }),
  item("services", "air-freight", "service-air", { title: "Air Freight", slug: "air-freight", summary: "Air forwarding for priority, controlled, and schedule-sensitive cargo." }, { title: "空运服务", slug: "kong-yun-fu-wu", summary: "为优先、受控及对时效敏感的货物提供空运代理。" }, { title: "Авиаперевозки", slug: "aviaperevozki", summary: "Авиаэкспедирование приоритетных, контролируемых и срочных грузов." }),
  item("services", "rail-freight", "service-rail", { title: "Rail Freight", slug: "rail-freight", summary: "Rail and terminal coordination across selected Eurasian corridors." }, { title: "铁路运输", slug: "tie-lu-yun-shu", summary: "面向重点欧亚通道提供铁路及场站协同。" }, { title: "Железнодорожные перевозки", slug: "zheleznodorozhnye-perevozki", summary: "Координация железнодорожных и терминальных операций на выбранных евразийских маршрутах." }),
  item("services", "road-freight", "service-road", { title: "Road Freight", slug: "road-freight", summary: "Regional and cross-border road coordination for planned cargo movements." }, { title: "公路运输", slug: "gong-lu-yun-shu", summary: "为计划内货物流转提供区域及跨境公路协同。" }, { title: "Автомобильные перевозки", slug: "avtomobilnye-perevozki", summary: "Региональная и трансграничная координация плановых грузовых перевозок." }),
  item("services", "multimodal", "service-multimodal", { title: "Multimodal Transport", slug: "multimodal-transport", summary: "Combine ocean, air, rail, and road legs under one coordinated plan." }, { title: "多式联运", slug: "duo-shi-lian-yun", summary: "在统一方案下衔接海运、空运、铁路和公路运输。" }, { title: "Мультимодальные перевозки", slug: "multimodalnye-perevozki", summary: "Объединяйте морские, авиационные, железнодорожные и автомобильные этапы в одном плане." }),
  item("services", "customs", "service-customs", { title: "Customs Services", slug: "customs-services", summary: "Prepare shipment information and coordinate customs-facing documentation workflows." }, { title: "关务服务", slug: "guan-wu-fu-wu", summary: "准备运输信息并协同面向海关的文件流程。" }, { title: "Таможенное сопровождение", slug: "tamozhennoe-soprovozhdenie", summary: "Подготовка данных и координация документальных процедур для таможенного оформления." }),
  item("services", "warehousing", "service-warehouse", { title: "Warehousing and Distribution", slug: "warehousing-distribution", summary: "Coordinate intake, storage, handling, and onward distribution requirements." }, { title: "仓储与配送", slug: "cang-chu-yu-pei-song", summary: "协同入库、存储、操作及后续配送需求。" }, { title: "Складирование и дистрибуция", slug: "skladirovanie-i-distributsiya", summary: "Координация приемки, хранения, обработки и дальнейшего распределения." }),

  item("trade-lanes", "china-russia", "lane-china-russia", { title: "China-Russia", slug: "china-russia", summary: "Explore coordinated rail, road, air, and multimodal options between China and Russia." }, { title: "中国至俄罗斯", slug: "zhong-guo-e-luo-si", summary: "了解中国与俄罗斯之间的铁路、公路、空运及多式联运协同方案。" }, { title: "Китай — Россия", slug: "kitay-rossiya", summary: "Рассмотрите согласованные железнодорожные, автомобильные, авиационные и мультимодальные варианты." }),
  item("trade-lanes", "china-europe", "lane-china-europe", { title: "China-Europe", slug: "china-europe", summary: "Plan selected China-Europe freight movements with mode and handoff coordination." }, { title: "中国至欧洲", slug: "zhong-guo-ou-zhou", summary: "通过运输方式与交接协同规划重点中欧货运需求。" }, { title: "Китай — Европа", slug: "kitay-evropa", summary: "Планируйте выбранные перевозки между Китаем и Европой с координацией видов транспорта и перегрузок." }),
  item("trade-lanes", "central-asia", "lane-central-asia", { title: "Central Asia", slug: "central-asia", summary: "Coordinate freight routes serving selected Central Asian markets and gateways." }, { title: "中亚通道", slug: "zhong-ya-tong-dao", summary: "协同服务重点中亚市场及口岸的货运路线。" }, { title: "Центральная Азия", slug: "tsentralnaya-aziya", summary: "Координируйте маршруты через выбранные рынки и транспортные узлы Центральной Азии." }),
  item("trade-lanes", "global-network", "lane-global", { title: "Global Network", slug: "global-network", summary: "Connect origin, transit, and destination partners for international forwarding requirements." }, { title: "全球网络", slug: "quan-qiu-wang-luo", summary: "为国际货运代理需求衔接起运地、中转地和目的地合作资源。" }, { title: "Глобальная сеть", slug: "globalnaya-set", summary: "Связывайте партнеров в пунктах отправления, транзита и назначения для международного экспедирования." }),

  item("cargo-types", "project-cargo", "cargo-project", { title: "Project Cargo", slug: "project-cargo", summary: "Coordinate route, handling, equipment, and documentation for project movements." }, { title: "项目物流", slug: "xiang-mu-wu-liu", summary: "为项目运输协同路线、装卸、设备和文件。" }, { title: "Проектные грузы", slug: "proektnye-gruzy", summary: "Координация маршрута, обработки, оборудования и документов для проектных перевозок." }),
  item("cargo-types", "oversized-cargo", "cargo-oversized", { title: "Oversized Cargo", slug: "oversized-cargo", summary: "Plan handling and transport interfaces for cargo outside standard dimensions." }, { title: "超限货物", slug: "chao-xian-huo-wu", summary: "为超出标准尺寸的货物规划装卸与运输接口。" }, { title: "Негабаритные грузы", slug: "negabaritnye-gruzy", summary: "Планирование обработки и транспортных стыков для грузов нестандартных размеров." }),
  item("cargo-types", "dangerous-goods", "cargo-dangerous", { title: "Dangerous Goods", slug: "dangerous-goods", summary: "Coordinate declared regulated cargo with qualified parties and required documentation." }, { title: "危险品运输", slug: "wei-xian-pin-yun-shu", summary: "与具备资质的相关方协同已申报受监管货物及所需文件。" }, { title: "Опасные грузы", slug: "opasnye-gruzy", summary: "Координация заявленных регулируемых грузов с компетентными сторонами и необходимыми документами." }),
  item("cargo-types", "temperature-controlled", "cargo-cold-chain", { title: "Temperature-Controlled Cargo", slug: "temperature-controlled-cargo", summary: "Plan temperature requirements, handoffs, and monitoring responsibilities." }, { title: "温控货物", slug: "wen-kong-huo-wu", summary: "规划温度要求、交接节点及监控责任。" }, { title: "Температурные грузы", slug: "temperaturnye-gruzy", summary: "Планирование температурных требований, перегрузок и ответственности за мониторинг." }),

  item("pages", "about", "trust-operations", { title: "About AnShow", slug: "about", summary: "Learn how AnShow organizes international forwarding around clear communication and accountable coordination." }, { title: "关于 AnShow", slug: "guan-yu", summary: "了解 AnShow 如何以清晰沟通和责任明确的协同组织国际货运代理。" }, { title: "Об AnShow", slug: "o-kompanii", summary: "Узнайте, как AnShow организует международное экспедирование на основе понятной коммуникации и ответственной координации." }),
  item("pages", "network", "trust-coordination", { title: "Network", slug: "network", summary: "See how origin, transit, and destination coordination supports international routes." }, { title: "服务网络", slug: "fu-wu-wang-luo", summary: "了解起运地、中转地和目的地协同如何支持国际路线。" }, { title: "Сеть", slug: "set", summary: "Узнайте, как координация в пунктах отправления, транзита и назначения поддерживает международные маршруты." }),
  item("pages", "contact", "trust-coordination", { title: "Contact", slug: "contact", summary: "Share your route, cargo, and timing requirements with the AnShow team." }, { title: "联系我们", slug: "lian-xi", summary: "向 AnShow 团队说明您的路线、货物及时间需求。" }, { title: "Контакты", slug: "kontakty", summary: "Сообщите команде AnShow маршрут, характеристики груза и временные требования." }),
  item("pages", "privacy", undefined, { title: "Privacy Notice", slug: "privacy", summary: "How AnShow handles information submitted through this website." }, { title: "隐私声明", slug: "yin-si", summary: "说明 AnShow 如何处理通过本网站提交的信息。" }, { title: "Уведомление о конфиденциальности", slug: "konfidentsialnost", summary: "Как AnShow обрабатывает информацию, отправленную через этот сайт." }),
  item("pages", "terms", undefined, { title: "Terms of Use", slug: "terms", summary: "Terms governing use of the AnShow website and published information." }, { title: "使用条款", slug: "shi-yong-tiao-kuan", summary: "适用于 AnShow 网站及所发布信息的使用条款。" }, { title: "Условия использования", slug: "usloviya", summary: "Условия использования сайта AnShow и опубликованной информации." }),
  item("pages", "cookies", undefined, { title: "Cookie Notice", slug: "cookies", summary: "Information about essential and optional browser storage used by this website." }, { title: "Cookie 声明", slug: "cookie-sheng-ming", summary: "说明本网站使用的必要及可选浏览器存储。" }, { title: "Уведомление о cookie", slug: "cookie", summary: "Информация об обязательном и дополнительном хранении данных в браузере." }),
  item("pages", "not-found", undefined, { title: "Page not found", slug: "not-found", summary: "The requested page is unavailable. Return to AnShow services or contact the team." }, { title: "页面未找到", slug: "wei-zhao-dao", summary: "您访问的页面不可用，请返回 AnShow 服务页面或联系我们。" }, { title: "Страница не найдена", slug: "ne-naydeno", summary: "Запрошенная страница недоступна. Вернитесь к услугам AnShow или свяжитесь с командой." }),

  item("case-studies", "multimodal-planning", "trust-coordination", { title: "A multimodal planning framework", slug: "multimodal-planning-framework", summary: "A representative planning framework showing how route legs, handoffs, and documents can be coordinated without claiming a named customer result." }, { title: "多式联运规划框架", slug: "duo-shi-lian-yun-gui-hua", summary: "以代表性框架说明如何协同运输区段、交接和文件，不宣称具体客户成果。" }, { title: "Схема мультимодального планирования", slug: "skhema-multimodalnogo-planirovaniya", summary: "Типовая схема координации этапов, перегрузок и документов без заявлений о результатах конкретного клиента." }, false),
  item("case-studies", "customs-readiness", "trust-customs", { title: "A customs-readiness workflow", slug: "customs-readiness-workflow", summary: "A representative workflow for collecting, reviewing, and handing off shipment information." }, { title: "关务准备流程", slug: "guan-wu-zhun-bei-liu-cheng", summary: "用于收集、检查和交接运输信息的代表性流程。" }, { title: "Процесс таможенной готовности", slug: "protsess-tamozhennoy-gotovnosti", summary: "Типовой процесс сбора, проверки и передачи информации о перевозке." }, false),
  item("case-studies", "warehouse-handoff", "trust-warehouse", { title: "A warehouse handoff checklist", slug: "warehouse-handoff-checklist", summary: "A representative checklist for intake, condition records, handling, and onward release." }, { title: "仓库交接清单", slug: "cang-ku-jiao-jie-qing-dan", summary: "覆盖入库、状态记录、操作及后续放行的代表性清单。" }, { title: "Чек-лист складской передачи", slug: "chek-list-skladskoy-peredachi", summary: "Типовой чек-лист приемки, фиксации состояния, обработки и дальнейшей выдачи." }, false),
  item("articles", "enquiry-preparation", "trust-operations", { title: "What to prepare before a freight enquiry", slug: "prepare-freight-enquiry", summary: "A practical list of route, cargo, timing, and handling information that helps a forwarder respond clearly." }, { title: "提交货运询盘前需要准备什么", slug: "huo-yun-xun-pan-zhun-bei", summary: "整理路线、货物、时间和操作信息，帮助货运代理更清晰地回复。" }, { title: "Что подготовить перед запросом", slug: "podgotovka-zaprosa", summary: "Практический список данных о маршруте, грузе, сроках и обработке для точного ответа экспедитора." }),
  item("articles", "mode-selection", "service-multimodal", { title: "How transport modes shape a freight plan", slug: "transport-mode-selection", summary: "A neutral overview of factors considered when comparing ocean, air, rail, road, and multimodal options." }, { title: "运输方式如何影响货运方案", slug: "yun-shu-fang-shi-xuan-ze", summary: "中立介绍比较海运、空运、铁路、公路和多式联运时需要考虑的因素。" }, { title: "Как вид транспорта влияет на план", slug: "vybor-vida-transporta", summary: "Нейтральный обзор факторов при сравнении морских, авиационных, железнодорожных, автомобильных и мультимодальных решений." }),
  item("articles", "document-readiness", "trust-customs", { title: "Why document readiness matters", slug: "document-readiness", summary: "An overview of how complete, consistent shipment information supports smoother coordination." }, { title: "为什么文件准备很重要", slug: "wen-jian-zhun-bei", summary: "说明完整、一致的运输信息如何支持更顺畅的协同。" }, { title: "Почему важна готовность документов", slug: "gotovnost-dokumentov", summary: "Обзор того, как полная и согласованная информация помогает координации перевозки." }),
];

export function expandCopy(copy: Copy, locale: Locale) {
  return { ...copy, body: copy.summary, seoTitle: `${copy.title} | AnShow`, seoDescription: copy.summary, altText: locale === "zh" ? `${copy.title}物流场景` : locale === "ru" ? `Логистическая сцена: ${copy.title}` : `${copy.title} logistics scene` };
}
```

Insert each base row and all three expanded translations in one transaction. Set translation status to `published` only when `publish !== false`; representative case-study frameworks remain drafts until staff replaces or explicitly approves them. Seed navigation and footer labels from the same catalog. Do not insert years, shipment volumes, office counts, certifications, customer names, or transit promises.

- [ ] **Step 6: Verify content isolation and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/content/public-repository.test.ts
pnpm --filter @anshow/backend db:generate
pnpm --filter @anshow/backend typecheck
```

Expected: repository test passes and migration generation succeeds.

```bash
git add backend/src/db/schema backend/src/content backend/migrations
git commit -m "Make multilingual freight content explicit and publishable" \
  -m "Constraint: Public pages cannot mix locales or publish incomplete translations" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Directive: Keep factual company claims unpublished until verified in site settings" \
  -m "Tested: repository unit test, migration generation, and typecheck"
```

### Task 2: Expose Published Content Through Hono and Generate the Frontend Client

**Files:**
- Create: `backend/src/content/public-contract.ts`
- Create: `backend/src/public/content-routes.ts`
- Create: `backend/src/public/content-routes.test.ts`
- Modify: `backend/src/content/public-repository.ts`
- Modify: `backend/src/content/drizzle-content-store.ts`
- Modify: `backend/src/app.ts`
- Modify: `openapi/anshow.json`
- Modify: `frontend/src/generated/api.ts`
- Create: `frontend/src/api/http.ts`
- Create: `frontend/src/api/public-content.server.ts`
- Create: `frontend/src/api/public-content.browser.ts`
- Create: `frontend/src/api/public-content.server.test.ts`
- Modify: `frontend/src/env.ts`

- [ ] **Step 1: Write failing Hono integration tests against in-memory SQLite**

```ts
// backend/src/public/content-routes.test.ts
import { describe, expect, it } from "vitest";
import { createPublicContentRoutes } from "./content-routes";

const repository = {
  getHome: async (locale: "en" | "zh" | "ru") => ({
    locale,
    headline: locale === "zh" ? "连接全球货运" : "Freight connected globally",
    slides: [], services: [], tradeLanes: [], cargoTypes: [], proof: [],
    verifiedTrust: [], cases: [], articles: [], channels: [],
  }),
  listCollection: async () => [],
  getBySlug: async (_collection: string, locale: string, slug: string) =>
    locale === "zh" && slug === "hai-yun-fu-wu"
      ? { id: "service-ocean", locale, slug, title: "海运服务", summary: "海运代理", body: "海运代理", seoTitle: "海运服务 | AnShow", seoDescription: "海运代理", altText: "海运物流场景", processStageId: "transit", alternates: { en: "/en/services/ocean-freight", zh: "/zh/services/hai-yun-fu-wu" }, media: null }
      : null,
  listSitemap: async () => [],
};

describe("public content API", () => {
  it("returns one locale in the stable envelope", async () => {
    const app = createPublicContentRoutes({ repository });
    const response = await app.request("/api/public/content/home/zh");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { locale: "zh", headline: "连接全球货运" }, error: null, requestId: expect.any(String) });
  });

  it("returns 404 instead of falling back to another language", async () => {
    const app = createPublicContentRoutes({ repository });
    const response = await app.request("/api/public/content/services/ru/ocean-freight");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ data: null, error: { code: "CONTENT_NOT_FOUND" } });
  });
});
```

- [ ] **Step 2: Run the backend test and verify red**

Run: `pnpm --filter @anshow/backend test -- src/public/content-routes.test.ts`

Expected: FAIL because the public content schemas and route factory do not exist.

- [ ] **Step 3: Define OpenAPI schemas and the complete repository contract**

```ts
// backend/src/content/public-contract.ts
import { z } from "@hono/zod-openapi";

export const localeSchema = z.enum(["en", "zh", "ru"]).openapi("PublicLocale");
export const collectionSchema = z.enum(["services", "trade-lanes", "special-cargo", "insights", "case-studies", "pages"]).openapi("PublicCollection");
export const mediaSchema = z.object({
  alt: z.string(), width: z.number().int().positive(), height: z.number().int().positive(),
  dominantColor: z.string(), mobileAvif: z.string().nullable(), avifSrcSet: z.string(), webpSrcSet: z.string(),
}).openapi("PublicMedia");
export const publicItemSchema = z.object({
  id: z.string(), locale: localeSchema, slug: z.string(), title: z.string(), summary: z.string(), body: z.string(),
  seoTitle: z.string(), seoDescription: z.string(), altText: z.string(),
  processStageId: z.enum(["route", "pickup", "customs", "transit", "delivery"]).nullable(),
  alternates: z.record(localeSchema, z.string()).partial(), media: mediaSchema.nullable(),
}).openapi("PublicContentItem");
export const homeSchema = z.object({
  locale: localeSchema, headline: z.string(), slides: z.array(publicItemSchema), services: z.array(publicItemSchema),
  tradeLanes: z.array(publicItemSchema), cargoTypes: z.array(publicItemSchema), proof: z.array(publicItemSchema),
  verifiedTrust: z.array(publicItemSchema), cases: z.array(publicItemSchema), articles: z.array(publicItemSchema),
  channels: z.array(z.object({ id: z.string(), label: z.string(), href: z.string() })),
}).openapi("PublicHome");
export const sitemapItemSchema = z.object({
  path: z.string(), updatedAt: z.string().datetime(), alternates: z.record(localeSchema, z.string()).partial(),
}).openapi("PublicSitemapItem");
export const errorSchema = z.object({ code: z.string(), message: z.string(), fields: z.record(z.string(), z.array(z.string())).optional() }).openapi("ApiError");
export const envelope = <T extends z.ZodTypeAny>(name: string, data: T) => z.object({ data, error: z.null(), requestId: z.string() }).openapi(name);
export const errorEnvelope = z.object({ data: z.null(), error: errorSchema, requestId: z.string() }).openapi("ErrorEnvelope");
export type PublicContentItem = z.infer<typeof publicItemSchema>;
export type PublicHome = z.infer<typeof homeSchema>;
export type PublicSitemapItem = z.infer<typeof sitemapItemSchema>;
```

```ts
// backend/src/content/types.ts
export const locales = ["en", "zh", "ru"] as const;
export type Locale = (typeof locales)[number];
export const publicCollections = ["services", "trade-lanes", "special-cargo", "insights", "case-studies", "pages"] as const;
export type PublicCollection = (typeof publicCollections)[number];
```

```ts
// backend/src/content/public-repository.ts (replace the Task 1 narrow contract)
import type { PublicContentItem, PublicHome, PublicSitemapItem } from "./public-contract";
import type { Locale, PublicCollection } from "./types";
export interface PublicContentRepository {
  getHome(locale: Locale): Promise<PublicHome>;
  listCollection(collection: PublicCollection, locale: Locale): Promise<PublicContentItem[]>;
  getBySlug(collection: PublicCollection, locale: Locale, slug: string): Promise<PublicContentItem | null>;
  listSitemap(): Promise<PublicSitemapItem[]>;
}
```

Implement this interface in `drizzle-content-store.ts`. Map `services`, `trade-lanes`, `special-cargo`, `insights`, `case-studies`, and `pages` to their explicit base/translation table pairs. Every query must require `status = 'published'`, `publishedAt <= now`, and `archivedAt IS NULL`; translation alternates are joined by base record ID, never guessed from the current slug. `getHome` performs one bounded query per homepage collection and assembles the response without row-per-item database calls.

- [ ] **Step 4: Implement the OpenAPI route factory and mount it in Hono**

```ts
// backend/src/public/content-routes.ts
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { PublicContentRepository } from "../content/public-repository";
import { collectionSchema, envelope, errorEnvelope, homeSchema, localeSchema, publicItemSchema, sitemapItemSchema } from "../content/public-contract";

const homeRoute = createRoute({ method: "get", path: "/api/public/content/home/{locale}", request: { params: z.object({ locale: localeSchema }) }, responses: { 200: { description: "Published homepage", content: { "application/json": { schema: envelope("PublicHomeEnvelope", homeSchema) } } } } });
const listRoute = createRoute({ method: "get", path: "/api/public/content/{collection}/{locale}", request: { params: z.object({ collection: collectionSchema, locale: localeSchema }) }, responses: { 200: { description: "Published collection", content: { "application/json": { schema: envelope("PublicCollectionEnvelope", z.array(publicItemSchema)) } } } } });
const detailRoute = createRoute({ method: "get", path: "/api/public/content/{collection}/{locale}/{slug}", request: { params: z.object({ collection: collectionSchema, locale: localeSchema, slug: z.string().min(1).max(160) }) }, responses: { 200: { description: "Published item", content: { "application/json": { schema: envelope("PublicItemEnvelope", publicItemSchema) } } }, 404: { description: "Not found in requested locale", content: { "application/json": { schema: errorEnvelope } } } } });
const sitemapRoute = createRoute({ method: "get", path: "/api/public/content/sitemap", responses: { 200: { description: "Published URLs", content: { "application/json": { schema: envelope("PublicSitemapEnvelope", z.array(sitemapItemSchema)) } } } } });

export function createPublicContentRoutes({ repository }: { repository: PublicContentRepository }) {
  const app = new OpenAPIHono();
  app.openapi(homeRoute, async (c) => c.json({ data: await repository.getHome(c.req.valid("param").locale), error: null, requestId: crypto.randomUUID() }, 200));
  app.openapi(listRoute, async (c) => { const p = c.req.valid("param"); return c.json({ data: await repository.listCollection(p.collection, p.locale), error: null, requestId: crypto.randomUUID() }, 200); });
  app.openapi(detailRoute, async (c) => { const p = c.req.valid("param"); const item = await repository.getBySlug(p.collection, p.locale, p.slug); return item ? c.json({ data: item, error: null, requestId: crypto.randomUUID() }, 200) : c.json({ data: null, error: { code: "CONTENT_NOT_FOUND", message: "Published content was not found in the requested locale." }, requestId: crypto.randomUUID() }, 404); });
  app.openapi(sitemapRoute, async (c) => c.json({ data: await repository.listSitemap(), error: null, requestId: crypto.randomUUID() }, 200));
  return app;
}
```

In `backend/src/app.ts`, construct the Drizzle repository from the existing database dependency and mount `createPublicContentRoutes({ repository })` before `app.doc(...)`. The frontend must never import this route file, repository, schema, database client, or any `backend/*` alias.

- [ ] **Step 5: Verify the backend API and regenerate the contract**

Run:

```bash
pnpm --filter @anshow/backend test -- src/public/content-routes.test.ts src/content/public-repository.test.ts
pnpm --filter @anshow/backend typecheck
pnpm openapi:generate
```

Expected: backend tests and typecheck pass; `openapi/anshow.json` contains all four public content paths and `frontend/src/generated/api.ts` contains their generated response types.

- [ ] **Step 6: Write a failing frontend SSR-client test**

```ts
// frontend/src/api/public-content.server.test.ts
import { afterEach, expect, it, vi } from "vitest";
import { getPublicHome } from "./public-content.server";

afterEach(() => vi.unstubAllGlobals());
it("uses the private backend URL during server rendering", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { locale: "en", headline: "Freight connected globally", slides: [], services: [], tradeLanes: [], cargoTypes: [], proof: [], verifiedTrust: [], cases: [], articles: [], channels: [] }, error: null, requestId: "request-1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await getPublicHome("en", { baseUrl: "http://backend:4000" });
  expect(fetchMock).toHaveBeenCalledWith("http://backend:4000/api/public/content/home/en", expect.objectContaining({ cache: "no-store" }));
});
```

- [ ] **Step 7: Implement generated-type server and browser clients**

```ts
// frontend/src/api/http.ts
export async function getEnvelope<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json() as { data: T | null; error: { code: string; message: string } | null; requestId: string };
  if (!response.ok || body.error || body.data === null) throw Object.assign(new Error(body.error?.message ?? "API request failed"), { status: response.status, code: body.error?.code, requestId: body.requestId });
  return body.data;
}
```

```ts
// frontend/src/api/public-content.server.ts
import "server-only";
import type { paths } from "@/generated/api";
import type { Locale } from "@/lib/app-config";
import { env } from "@/env";
import { getEnvelope } from "./http";

type HomeEnvelope = paths["/api/public/content/home/{locale}"]["get"]["responses"][200]["content"]["application/json"];
type Home = NonNullable<HomeEnvelope["data"]>;
export async function getPublicHome(locale: Locale, options: { baseUrl?: string } = {}): Promise<Home> {
  return getEnvelope<Home>(`${options.baseUrl ?? env.BACKEND_INTERNAL_URL}/api/public/content/home/${locale}`, { cache: "no-store" });
}
```

```ts
// frontend/src/api/public-content.browser.ts
"use client";
import type { paths } from "@/generated/api";
import type { Locale } from "@/lib/app-config";
import { getEnvelope } from "./http";
type HomeEnvelope = paths["/api/public/content/home/{locale}"]["get"]["responses"][200]["content"]["application/json"];
export const refreshPublicHome = (locale: Locale) => getEnvelope<NonNullable<HomeEnvelope["data"]>>(`/api/public/content/home/${locale}`, { cache: "no-store" });
```

Add generated-type-derived `listPublicContent`, `getPublicContent`, and `listPublishedUrls` functions to the server module. Add `BACKEND_INTERNAL_URL` to the existing server-only env schema with development default `http://localhost:4000`; do not expose it through `NEXT_PUBLIC_*`.

- [ ] **Step 8: Verify the boundary and commit**

Run:

```bash
pnpm --filter @anshow/frontend test -- src/api/public-content.server.test.ts
pnpm --filter @anshow/frontend typecheck
pnpm openapi:generate
git diff --exit-code -- frontend/src/generated/api.ts openapi/anshow.json
```

Expected: frontend test and typecheck pass; the second contract generation produces no diff.

```bash
git add backend/src/content backend/src/public backend/src/app.ts openapi/anshow.json frontend/src/generated/api.ts frontend/src/api frontend/src/env.ts
git commit -m "Keep published content behind one generated API contract" \
  -m "Constraint: Next.js cannot import Drizzle, SQLite, or backend repositories" \
  -m "Rejected: Share repository source with the frontend | breaks independent application builds" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: Hono integration tests, generated-contract drift check, frontend SSR client test, and both typechecks"
```

### Task 3: Build the Responsive Public Shell and SEO Contract

**Files:**
- Create: `frontend/src/components/site/site-header.tsx`
- Create: `frontend/src/components/site/mobile-menu.tsx`
- Create: `frontend/src/components/site/locale-switcher.tsx`
- Create: `frontend/src/components/site/site-footer.tsx`
- Create: `frontend/src/components/site/site-header.test.tsx`
- Create: `frontend/src/lib/seo.ts`
- Create: `frontend/src/lib/seo.test.ts`
- Modify: `frontend/src/app/[locale]/layout.tsx`

- [ ] **Step 1: Write failing navigation and hreflang tests**

```tsx
// frontend/src/components/site/site-header.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("keeps quote and language actions keyboard reachable", () => {
    render(<SiteHeader locale="en" labels={{ services: "Services", "trade-lanes": "Trade Lanes", "special-cargo": "Special Cargo", insights: "Insights", about: "About", contact: "Contact", quote: "Request a quote", primary: "Primary", changeLanguage: "Change language", openMenu: "Open menu", closeMenu: "Close menu" }} />);
    expect(screen.getByRole("link", { name: /request a quote/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /change language/i })).toBeVisible();
  });
});
```

```ts
// frontend/src/lib/seo.test.ts
import { describe, expect, it } from "vitest";
import { staticLocaleAlternates } from "./seo";

it("generates all locale alternates", () => {
  expect(staticLocaleAlternates("/privacy")).toEqual({
    en: "/en/privacy", zh: "/zh/privacy", ru: "/ru/privacy",
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter @anshow/frontend test -- src/components/site/site-header.test.tsx src/lib/seo.test.ts`

Expected: FAIL because shell and SEO helpers do not exist.

- [ ] **Step 3: Implement stable navigation**

The desktop header contains Route Apex logo, Services, Trade Lanes, Special Cargo, Insights, About, Contact, language selector, and orange quote action. The mobile header contains logo, language action, and a 44px menu button opening a focus-trapped drawer. Use Lucide icons and visible focus rings.

```tsx
// frontend/src/components/site/site-header.tsx
import Link from "next/link";
import { AnShowLogo } from "@/components/brand/anshow-logo";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileMenu } from "./mobile-menu";
import type { Locale } from "@/lib/app-config";
const items = ["services", "trade-lanes", "special-cargo", "insights", "about", "contact"] as const;
type Labels = Record<(typeof items)[number] | "quote" | "primary" | "changeLanguage" | "openMenu" | "closeMenu", string>;
export function SiteHeader({ locale, labels, alternates = {} }: { locale: Locale; labels: Labels; alternates?: Partial<Record<Locale, string>> }) {
  return <header className="sticky top-0 z-40 border-b border-white/15 bg-[var(--color-carbon)] text-white">
    <nav aria-label={labels.primary} className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
      <Link href={`/${locale}`} aria-label="AnShow home"><AnShowLogo /></Link>
      <div className="hidden items-center gap-6 lg:flex">{items.map((item) => <Link key={item} href={`/${locale}/${item}`}>{labels[item]}</Link>)}</div>
      <div className="flex items-center gap-2"><LocaleSwitcher current={locale} alternates={alternates} label={labels.changeLanguage} /><Link href={`/${locale}/quote`} className="hidden min-h-11 items-center bg-[var(--color-action)] px-4 sm:flex">{labels.quote}</Link><MobileMenu locale={locale} labels={labels} /></div>
    </nav>
  </header>;
}
```

```tsx
// frontend/src/components/site/locale-switcher.tsx
"use client";
import Link from "next/link";
import { Languages } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/lib/app-config";
export function LocaleSwitcher({ current, alternates, label }: { current: Locale; alternates: Partial<Record<Locale, string>>; label: string }) {
  const [open, setOpen] = useState(false);
  return <div className="relative"><button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid size-11 place-items-center"><Languages aria-hidden="true" /></button>{open ? <div className="absolute right-0 top-12 min-w-40 border border-white/20 bg-[var(--color-elevated)] p-2">{(["en", "zh", "ru"] as const).map((locale) => <Link className="block min-h-11 px-3 py-2" aria-current={locale === current ? "page" : undefined} key={locale} href={alternates[locale] ?? `/${locale}`} hrefLang={locale}>{locale === "zh" ? "中文" : locale === "ru" ? "Русский" : "English"}</Link>)}</div> : null}</div>;
}
```

```tsx
// frontend/src/components/site/mobile-menu.tsx
"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/app-config";
const items = ["services", "trade-lanes", "special-cargo", "insights", "about", "contact"] as const;
type Labels = Record<(typeof items)[number] | "quote" | "primary" | "changeLanguage" | "openMenu" | "closeMenu", string>;
export function MobileMenu({ locale, labels }: { locale: Locale; labels: Labels }) {
  const [open, setOpen] = useState(false); const trigger = useRef<HTMLButtonElement>(null); const dialog = useRef<HTMLDivElement>(null); const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; close.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]; const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); trigger.current?.focus(); };
  }, [open]);
  return <div className="lg:hidden"><button ref={trigger} type="button" aria-label={labels.openMenu} aria-expanded={open} onClick={() => setOpen(true)} className="grid size-11 place-items-center"><Menu aria-hidden="true" /></button>{open ? <div ref={dialog} role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[var(--color-carbon)] p-4"><button ref={close} type="button" aria-label={labels.closeMenu} onClick={() => setOpen(false)} className="ml-auto grid size-11 place-items-center"><X aria-hidden="true" /></button><nav className="mt-8 grid gap-2">{items.map((item) => <Link className="min-h-11 py-3 text-xl" key={item} href={`/${locale}/${item}`} onClick={() => setOpen(false)}>{labels[item]}</Link>)}<Link className="mt-4 min-h-11 bg-[var(--color-action)] px-4 py-3" href={`/${locale}/quote`}>{labels.quote}</Link></nav></div> : null}</div>;
}
```

The visible link text comes from `next-intl` in the locale layout and is passed as `labels`; no English navigation label is hard-coded for Chinese or Russian pages.

Page routes pass translation URLs resolved by the shared base record ID. When a target translation is not published, `LocaleSwitcher` falls back to that locale's homepage rather than substituting the current slug.

```ts
// frontend/src/lib/seo.ts
export function staticLocaleAlternates(pathname: string) {
  return { en: `/en${pathname}`, zh: `/zh${pathname}`, ru: `/ru${pathname}` };
}
```

- [ ] **Step 4: Add metadata to locale layout**

Generate canonical and language alternates from the published translation record. Use the production `SITE_URL`. Add localized title templates, Open Graph metadata, robots directives, and organization structured data without unverified addresses or metrics.

```ts
// frontend/src/lib/seo.ts
export function pageMetadata(input: { siteUrl: string; locale: string; path: string; title: string; description: string; alternates?: Record<string, string> }) {
  const canonical = `${input.siteUrl}/${input.locale}${input.path}`;
  return { title: input.title, description: input.description, alternates: { canonical, languages: input.alternates ?? staticLocaleAlternates(input.path) }, openGraph: { type: "website", url: canonical, title: input.title, description: input.description } };
}
```

Dynamic service, lane, cargo, insight, and case pages must pass `alternates` returned by the backend. `staticLocaleAlternates` is only for route-identical legal pages. The locale layout adds a skip link, self-hosted locale-specific font subsets, localized title templates, and organization JSON-LD containing only verified settings.

- [ ] **Step 5: Verify public shell and commit**

Run:

```bash
pnpm --filter @anshow/frontend test -- src/components/site/site-header.test.tsx src/lib/seo.test.ts
pnpm --filter @anshow/frontend build
```

Expected: tests and build pass.

```bash
git add frontend/src/components/site frontend/src/lib/seo* 'frontend/src/app/[locale]/layout.tsx'
git commit -m "Keep AnShow navigation clear across every locale and viewport" \
  -m "Constraint: Quote and language actions must remain reachable on mobile and keyboard" \
  -m "Confidence: high" -m "Scope-risk: moderate" \
  -m "Tested: navigation and SEO unit tests plus production build"
```

### Task 4: Generate and Process the 23-Image Production Asset Set

**Files:**
- Create: `content/assets/prompts.json`
- Create: `content/assets/manifest.json`
- Create: `scripts/process-images.ts`
- Create: `scripts/process-images.test.ts`
- Create: `assets/source/*`
- Create: `frontend/public/media/*`
- Modify: `package.json`

- [ ] **Step 1: Write the failing derivative-plan test**

```ts
// scripts/process-images.test.ts
import { describe, expect, it } from "vitest";
import { derivativePlan } from "./process-images";

it("creates desktop and mobile hero variants", () => {
  expect(derivativePlan("hero-ocean", "hero")).toEqual([
    "480.avif", "768.avif", "1280.avif", "1920.avif",
    "480.webp", "768.webp", "1280.webp", "1920.webp",
    "mobile-768.avif", "mobile-768.webp", "thumb-320.avif",
  ]);
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm assets:test`

Expected: FAIL because the processor does not exist.

- [ ] **Step 3: Create the exact generation manifest**

`content/assets/prompts.json` contains 23 entries with these IDs:

```json
[
  {"id":"hero-ocean","use":"homepage hero","prompt":"Photorealistic international container vessel at a modern port before sunrise, wide cinematic composition, operational realism, clear negative space on the left for HTML copy, carbon blue atmosphere with restrained orange port lights, no logos, no text, no watermark"},
  {"id":"hero-air","use":"homepage hero","prompt":"Photorealistic air cargo aircraft and loading operation at a modern freight apron, wide cinematic composition, clear negative space on the left, cool industrial lighting, no airline branding, no text, no watermark"},
  {"id":"hero-rail","use":"homepage hero","prompt":"Photorealistic Eurasian freight train carrying containers through a broad continental landscape, wide cinematic composition, clear negative space on the left, realistic infrastructure, no logos, no text, no watermark"},
  {"id":"hero-road","use":"homepage hero","prompt":"Photorealistic international road freight convoy at a modern logistics corridor, wide cinematic composition, clear negative space on the left, realistic weather and road texture, no company branding, no text, no watermark"},
  {"id":"service-ocean","use":"service header","prompt":"Photorealistic container terminal crane operation viewed from an elevated angle, editorial freight photography, wide framing, no logos, no text, no watermark"},
  {"id":"service-air","use":"service header","prompt":"Photorealistic airport cargo pallets being prepared beside a freight aircraft, editorial operations photography, wide framing, no logos, no text, no watermark"},
  {"id":"service-rail","use":"service header","prompt":"Photorealistic intermodal rail terminal with freight containers and gantry equipment, wide editorial framing, no logos, no text, no watermark"},
  {"id":"service-road","use":"service header","prompt":"Photorealistic long-haul freight truck at an international logistics hub, wide editorial framing, no logos, no text, no watermark"},
  {"id":"service-multimodal","use":"service header","prompt":"Photorealistic multimodal freight hub showing rail, truck and stacked containers in one credible scene, wide framing, no logos, no text, no watermark"},
  {"id":"service-customs","use":"service header","prompt":"Photorealistic customs documentation workspace with cargo manifests, seal and inspection context, no readable private data, no logos, no text overlay, no watermark"},
  {"id":"service-warehouse","use":"service header","prompt":"Photorealistic modern freight warehouse with organized pallet lanes and safe operations, wide editorial framing, no logos, no text, no watermark"},
  {"id":"lane-china-russia","use":"trade lane","prompt":"Photorealistic rail freight crossing a cold continental landscape associated with China to Russia trade, no flags, no logos, no text, no watermark"},
  {"id":"lane-china-europe","use":"trade lane","prompt":"Photorealistic intercontinental freight train moving through a broad Eurasian corridor toward Europe, no flags, no logos, no text, no watermark"},
  {"id":"lane-central-asia","use":"trade lane","prompt":"Photorealistic road and rail logistics corridor through Central Asian terrain with modern freight infrastructure, no logos, no text, no watermark"},
  {"id":"lane-global","use":"trade lane","prompt":"Photorealistic global container port network scene with vessels and terminal infrastructure, realistic scale, no logos, no text, no watermark"},
  {"id":"cargo-project","use":"special cargo","prompt":"Photorealistic project cargo operation lifting industrial equipment with professional rigging, safe realistic procedure, no logos, no text, no watermark"},
  {"id":"cargo-oversized","use":"special cargo","prompt":"Photorealistic oversized machinery secured on specialized transport equipment, credible logistics operation, no logos, no text, no watermark"},
  {"id":"cargo-dangerous","use":"special cargo","prompt":"Photorealistic regulated dangerous-goods freight handling with compliant containers and protective procedures, no brand labels, no text overlay, no watermark"},
  {"id":"cargo-cold-chain","use":"special cargo","prompt":"Photorealistic temperature-controlled warehouse and refrigerated freight handling, clean modern environment, no logos, no text, no watermark"},
  {"id":"trust-operations","use":"trust section","prompt":"Photorealistic diverse logistics operations team coordinating shipments in a modern control room, natural professional scene, no visible company logos, no text, no watermark"},
  {"id":"trust-warehouse","use":"trust section","prompt":"Photorealistic warehouse quality inspection and inventory coordination, natural editorial lighting, no logos, no text, no watermark"},
  {"id":"trust-customs","use":"trust section","prompt":"Photorealistic freight documentation review between logistics professionals, documents contain no readable private data, no logos, no watermark"},
  {"id":"trust-coordination","use":"trust section","prompt":"Photorealistic international logistics coordination meeting around a shipment route display, no visible third-party brands, no readable confidential text, no watermark"}
]
```

- [ ] **Step 4: Generate each master with the built-in image generation path**

Issue one image-generation call per manifest entry. Save approved project assets under `assets/source/<id>.png`. Generate an additional portrait composition for the four hero IDs under `assets/source/<id>-mobile.png`. Reject outputs containing third-party marks, embedded text, implausible equipment, or documentary claims about AnShow.

- [ ] **Step 5: Implement Sharp derivatives**

Install repository-level build tooling and add deterministic scripts:

```bash
pnpm add -Dw sharp tsx vitest @types/node
```

```json
// package.json scripts additions
{
  "scripts": {
    "assets:test": "vitest run scripts/process-images.test.ts",
    "assets:build": "tsx scripts/process-images.ts",
    "assets:verify": "tsx scripts/process-images.ts --verify"
  }
}
```

```ts
// scripts/process-images.ts
export function derivativePlan(_id: string, kind: "hero" | "content") {
  const widths = kind === "hero" ? [480, 768, 1280, 1920] : [480, 768, 1280];
  const files = ["avif", "webp"].flatMap((format) => widths.map((width) => `${width}.${format}`));
  return kind === "hero" ? [...files, "mobile-768.avif", "mobile-768.webp", "thumb-320.avif"] : [...files, "thumb-320.avif"];
}
```

Add a CLI entry that reads the manifest, uses Sharp to strip metadata, resizes with focal cropping, enforces the 280KB/140KB/90KB budgets, and writes hashed derivatives plus intrinsic dimensions into `content/assets/manifest.json`.

```ts
// scripts/process-images.ts
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
type Variant = { width: number; height: number; format: "avif" | "webp"; byteSize: number; url: string; role: "desktop" | "mobile" | "thumbnail" };
async function encode(source: string, width: number, format: "avif" | "webp", maxBytes: number, outputDir: string, role: Variant["role"]) {
  for (let quality = format === "avif" ? 60 : 78; quality >= 30; quality -= 5) {
    const image = sharp(source).rotate().resize({ width, withoutEnlargement: true });
    const buffer = await (format === "avif" ? image.avif({ quality }) : image.webp({ quality })).toBuffer();
    if (buffer.byteLength > maxBytes) continue;
    const metadata = await sharp(buffer).metadata(); const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
    const filename = `${role}-${width}.${hash}.${format}`; await fs.writeFile(path.join(outputDir, filename), buffer);
    return { width: metadata.width!, height: metadata.height!, format, byteSize: buffer.byteLength, url: `/media/${path.basename(outputDir)}/${filename}`, role } satisfies Variant;
  }
  throw new Error(`${source} cannot meet ${maxBytes} byte budget at ${width}px`);
}
export async function processAsset(id: string, kind: "hero" | "content") {
  const source = path.join("assets/source", `${id}.png`);
  const outputDir = path.join("frontend/public/media", id);
  await fs.mkdir(outputDir, { recursive: true });
  const widths = kind === "hero" ? [480, 768, 1280, 1920] : [480, 768, 1280];
  const variants: Variant[] = [];
  for (const format of ["avif", "webp"] as const) for (const width of widths) variants.push(await encode(source, width, format, kind === "hero" ? 280 * 1024 : 90 * 1024, outputDir, "desktop"));
  if (kind === "hero") { const mobile = path.join("assets/source", `${id}-mobile.png`); for (const format of ["avif", "webp"] as const) variants.push(await encode(mobile, 768, format, 140 * 1024, outputDir, "mobile")); }
  variants.push(await encode(source, 320, "avif", 35 * 1024, outputDir, "thumbnail"));
  const metadata = await sharp(source).metadata(); const dominant = (await sharp(source).stats()).dominant;
  return { id, width: metadata.width!, height: metadata.height!, dominantColor: `rgb(${dominant.r} ${dominant.g} ${dominant.b})`, variants };
}
```

The CLI reads `content/assets/prompts.json`, processes all 23 entries, writes the returned records atomically to `content/assets/manifest.json`, and deletes stale hashed derivatives only after the new manifest is complete.

- [ ] **Step 6: Verify assets and commit**

Run:

```bash
pnpm assets:test
pnpm assets:build
pnpm assets:verify
```

Expected: test passes; verification reports 23 complete source records and zero desktop hero, mobile hero, content, or thumbnail budget violations.

```bash
git add package.json pnpm-lock.yaml content/assets assets/source frontend/public/media scripts/process-images*
git commit -m "Deliver logistics imagery without making visitors download the masters" \
  -m "Constraint: Mobile and desktop need different image budgets and art direction" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Directive: Keep text and AnShow-specific claims out of generated photography" \
  -m "Tested: derivative unit test, asset processor, and production size scan"
```

### Task 5: Build the Homepage, Hero Carousel, and Proof Sections

**Files:**
- Create: `frontend/src/components/home/hero-carousel.tsx`
- Create: `frontend/src/components/home/hero-carousel.test.tsx`
- Create: `frontend/src/components/home/service-grid.tsx`
- Create: `frontend/src/components/home/trade-lanes.tsx`
- Create: `frontend/src/components/home/special-cargo.tsx`
- Create: `frontend/src/components/home/proof-strip.tsx`
- Create: `frontend/src/components/home/trust-scroller.tsx`
- Create: `frontend/src/components/home/case-carousel.tsx`
- Modify: `frontend/src/app/[locale]/page.tsx`

- [ ] **Step 1: Write the failing carousel behavior test**

```tsx
// frontend/src/components/home/hero-carousel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HeroCarousel } from "./hero-carousel";

it("lets a visitor pause autoplay", async () => {
  render(<HeroCarousel headline="International freight forwarding" slides={[{ id: "1", title: "Ocean", image: "/ocean.avif" }]} />);
  await userEvent.click(screen.getByRole("button", { name: /pause carousel/i }));
  expect(screen.getByRole("button", { name: /play carousel/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm --filter @anshow/frontend test -- src/components/home/hero-carousel.test.tsx`

Expected: FAIL because the carousel does not exist.

- [ ] **Step 3: Implement the hero carousel with Embla**

The first image uses `priority`; later slides use lazy responsive `picture` sources. Add pause/play, previous/next, progress, dots, keyboard navigation, touch swipe, tab visibility pause, focus pause, and reduced-motion no-autoplay behavior. Keep the H1 stable so slide changes do not change the page's primary heading hierarchy.

```tsx
// frontend/src/components/home/hero-carousel.tsx
"use client";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
type Slide = { id: string; title: string; image: string; alt?: string; mobileAvif?: string; avifSrcSet?: string; webpSrcSet?: string };
export function HeroCarousel({ headline, slides }: { headline: string; slides: Slide[] }) {
  const [viewportRef, api] = useEmblaCarousel({ loop: true });
  const [playing, setPlaying] = useState(true); const [selected, setSelected] = useState(0);
  useEffect(() => { if (!api) return; const select = () => setSelected(api.selectedScrollSnap()); api.on("select", select); select(); return () => { api.off("select", select); }; }, [api]);
  useEffect(() => { if (!api || !playing || matchMedia("(prefers-reduced-motion: reduce)").matches) return; const timer = setInterval(() => api.scrollNext(), 6500); const visibility = () => { if (document.hidden) setPlaying(false); }; document.addEventListener("visibilitychange", visibility); return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibility); }; }, [api, playing]);
  return <section aria-roledescription="carousel" onFocusCapture={() => setPlaying(false)} onMouseEnter={() => setPlaying(false)}>
    <h1 className="absolute z-10">{headline}</h1>
    <div ref={viewportRef} className="overflow-hidden"><div className="flex">{slides.map((slide, index) => <article className="min-w-0 flex-[0_0_100%]" key={slide.id}><picture>{slide.mobileAvif && <source media="(max-width: 767px)" type="image/avif" srcSet={slide.mobileAvif} />}{slide.avifSrcSet && <source type="image/avif" srcSet={slide.avifSrcSet} sizes="100vw" />}{slide.webpSrcSet && <source type="image/webp" srcSet={slide.webpSrcSet} sizes="100vw" />}<img src={slide.image} alt={slide.alt ?? ""} fetchPriority={index === 0 ? "high" : "auto"} loading={index === 0 ? "eager" : "lazy"} /></picture><h2>{slide.title}</h2></article>)}</div></div>
    <div role="group" aria-label="Carousel controls"><button aria-label="Previous slide" onClick={() => api?.scrollPrev()}><ChevronLeft /></button><button aria-label={playing ? "Pause carousel" : "Play carousel"} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause /> : <Play />}</button><button aria-label="Next slide" onClick={() => api?.scrollNext()}><ChevronRight /></button></div>
    <div aria-hidden="true" className="h-1 bg-white/20"><span className="block h-full origin-left bg-cyan-400" style={{ transform: `scaleX(${(selected + 1) / slides.length})` }} /></div>
    <div>{slides.map((slide, index) => <button aria-label={`Go to slide ${index + 1}`} aria-current={index === selected} key={slide.id} onClick={() => api?.scrollTo(index)} />)}</div>
  </section>;
}
```

- [ ] **Step 4: Assemble the homepage**

Render in order: hero, short enquiry anchor, services, five-stage process story, trade lanes, specialist cargo, verified proof modules, cases, insights, and final contact CTA. Omit any proof module whose official settings are unconfigured.

```tsx
// frontend/src/app/[locale]/page.tsx
import { getPublicHome } from "@/api/public-content.server";
export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const content = await getPublicHome(locale);
  return <main><HeroCarousel headline={content.headline} slides={content.slides} /><QuickEnquiryAnchor /><ServiceGrid items={content.services} /><TradeLanes items={content.tradeLanes} /><SpecialCargo items={content.cargoTypes} />{content.proof.length > 0 && <ProofStrip items={content.proof} />}<TrustScroller items={content.verifiedTrust} /><CaseCarousel items={content.cases} /><Insights items={content.articles} /><ContactCta channels={content.channels} /></main>;
}
```

`getPublicHome` is the generated-contract server client from Task 2. It calls `BACKEND_INTERNAL_URL`; client components receive serializable props and do not query SQLite or import backend code. Any later browser refresh uses `refreshPublicHome`, which calls same-origin `/api/public/content/home/:locale`.

```tsx
// frontend/src/components/home/trust-scroller.tsx
"use client";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
type TrustItem = { id: string; title: string };
export function TrustScroller({ items }: { items: readonly TrustItem[] }) {
  const [playing, setPlaying] = useState(true); const viewport = useRef<HTMLDivElement>(null);
  const move = useCallback((direction: number) => viewport.current?.scrollBy({ left: direction * 320, behavior: "smooth" }), []);
  useEffect(() => { if (!playing || matchMedia("(prefers-reduced-motion: reduce)").matches) return; const timer = setInterval(() => move(1), 5000); const visibility = () => { if (document.hidden) setPlaying(false); }; document.addEventListener("visibilitychange", visibility); return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibility); }; }, [move, playing]);
  if (!items.length) return null;
  return <section onMouseEnter={() => setPlaying(false)} onFocusCapture={() => setPlaying(false)}><div className="flex justify-end"><button title="Previous" onClick={() => move(-1)}><ChevronLeft /></button><button title={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</button><button title="Next" onClick={() => move(1)}><ChevronRight /></button></div><div ref={viewport} className="flex snap-x gap-4 overflow-x-auto">{items.map((item) => <article className="min-w-64 snap-start" key={item.id}>{item.title}</article>)}</div></section>;
}
```

Only verified partners/certificates enter `items`; no unconfigured module is rendered. If timed advancement is enabled, pause on hover, focus, hidden tab, and reduced motion.

- [ ] **Step 5: Verify homepage behavior and commit**

Run:

```bash
pnpm --filter @anshow/frontend test -- src/components/home/hero-carousel.test.tsx
pnpm --filter @anshow/frontend build
```

Expected: test and build pass.

```bash
git add frontend/src/components/home 'frontend/src/app/[locale]/page.tsx'
git commit -m "Turn the AnShow homepage into a clear conversion journey" \
  -m "Constraint: High-impact media cannot hide quote, pause, or language controls" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: carousel interaction test and production build"
```

### Task 6: Implement the Five-Stage Process and Per-Step Micro-Animations

**Files:**
- Create: `frontend/src/components/process/process-data.ts`
- Create: `frontend/src/components/process/process-story.tsx`
- Create: `frontend/src/components/process/process-story.client.tsx`
- Create: `frontend/src/components/process/process-micro-scene.tsx`
- Create: `frontend/src/components/process/process-story.test.tsx`
- Create: `frontend/src/components/process/mobile-process.tsx`
- Create: `frontend/src/components/motion/use-motion-profile.ts`
- Create: `frontend/src/components/motion/use-motion-profile.test.ts`
- Create: `frontend/src/components/motion/route-scene.tsx`
- Create: `frontend/src/components/motion/route-scene.client.tsx`
- Modify: `frontend/src/app/[locale]/page.tsx`

- [ ] **Step 1: Write failing semantic and motion-profile tests**

```tsx
// frontend/src/components/process/process-story.test.tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ProcessStory } from "./process-story";

it("renders all five stages without animation", async () => {
  render(await ProcessStory({ locale: "en", motion: "reduced" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
  expect(screen.getByText("Customs readiness")).toBeVisible();
});
```

```ts
// frontend/src/components/motion/use-motion-profile.test.ts
import { expect, it } from "vitest";
import { chooseMotionProfile } from "./use-motion-profile";

it("disables rich scenes on mobile or reduced motion", () => {
  expect(chooseMotionProfile({ width: 390, reduced: false, cores: 8 })).toBe("light");
  expect(chooseMotionProfile({ width: 1440, reduced: true, cores: 8 })).toBe("none");
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter @anshow/frontend test -- src/components/process/process-story.test.tsx src/components/motion/use-motion-profile.test.ts`

Expected: FAIL because process components do not exist.

- [ ] **Step 3: Define typed five-stage data**

```ts
// frontend/src/components/process/process-data.ts
export const processStageIds = ["route", "pickup", "customs", "transit", "delivery"] as const;
export type ProcessStageId = (typeof processStageIds)[number];
export type ProcessStage = { id: ProcessStageId; title: string; phases: readonly [string, string, string] };
```

- [ ] **Step 4: Implement the motion profile**

```ts
// frontend/src/components/motion/use-motion-profile.ts
import { useEffect, useState } from "react";
export function chooseMotionProfile(input: { width: number; reduced: boolean; cores: number }) {
  if (input.reduced) return "none" as const;
  if (input.width < 768 || input.cores < 4) return "light" as const;
  return "rich" as const;
}

export function useMotionProfile() {
  const [profile, setProfile] = useState<"none" | "light" | "rich">("none");
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setProfile(chooseMotionProfile({ width: innerWidth, reduced: media.matches, cores: navigator.hardwareConcurrency || 2 }));
    update(); media.addEventListener("change", update); addEventListener("resize", update);
    return () => { media.removeEventListener("change", update); removeEventListener("resize", update); };
  }, []);
  return profile;
}
```

- [ ] **Step 5: Add the capability-gated Three.js route scene**

```tsx
// frontend/src/components/motion/route-scene.tsx
"use client";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useMotionProfile } from "./use-motion-profile";

export function RouteScene() {
  const profile = useMotionProfile();
  const [Scene, setScene] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (profile !== "rich") return;
    let active = true;
    void import("./route-scene.client").then((module) => { if (active) setScene(() => module.RouteSceneClient); });
    return () => { active = false; };
  }, [profile]);
  if (profile !== "rich") return <div data-route-static className="h-40 w-full border-y border-cyan-400/30" />;
  return <div className="min-h-[420px] w-full" aria-label="Global freight route visualization">{Scene ? <Scene /> : null}</div>;
}
```

```tsx
// frontend/src/components/motion/route-scene.client.tsx
"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
export function RouteSceneClient() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); camera.position.z = 6;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); host.current.append(renderer.domElement);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-3, -1, 0), new THREE.Vector3(-1, 1, 0), new THREE.Vector3(1, -0.4, 0), new THREE.Vector3(3, 1, 0)]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160)); geometry.setDrawRange(0, 0);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x38bdf8 })); scene.add(line);
    const resize = () => { const width = host.current!.clientWidth; const height = Math.max(420, host.current!.clientHeight); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.render(scene, camera); };
    const observer = new ResizeObserver(resize); observer.observe(host.current); resize();
    let frame = 0; const started = performance.now();
    const draw = (now: number) => { const progress = Math.min(1, (now - started) / 1200); geometry.setDrawRange(0, Math.floor(progress * 161)); renderer.render(scene, camera); if (progress < 1) frame = requestAnimationFrame(draw); };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); geometry.dispose(); (line.material as THREE.Material).dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  return <div ref={host} className="h-[420px] w-full" />;
}
```

Render `RouteScene` as a full-width, unframed chapter between the service overview and process story. The scene performs one route draw and stops; it never starts a perpetual render loop.

```tsx
// frontend/src/app/[locale]/page.tsx (Task 5 insertion)
<ServiceGrid items={content.services} />
<RouteScene />
<ProcessStory locale={locale} />
<TradeLanes items={content.tradeLanes} />
```

- [ ] **Step 6: Implement one coordinated GSAP timeline**

On rich desktop profiles, dynamically import GSAP and ScrollTrigger, create one scoped timeline for the full process, and map scroll progress to route fill, active stage, copy reveal, and per-step micro-animation. Each step micro-scene plays its three phases once. Kill the timeline on unmount. Do not pin on mobile. `mobile-process.tsx` renders a normal ordered list with one-time IntersectionObserver reveals. `motion="reduced"` renders the completed route and all text immediately.

```tsx
// frontend/src/components/process/process-story.client.tsx
"use client";
import { useEffect, useRef } from "react";
import { useMotionProfile } from "@/components/motion/use-motion-profile";
import { ProcessMicroScene } from "./process-micro-scene";
export function ProcessStoryClient({ stages }: { stages: readonly ProcessStage[] }) {
  const root = useRef<HTMLDivElement>(null);
  const profile = useMotionProfile();
  useEffect(() => {
    if (profile !== "rich") return;
    let cleanup = () => undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      const context = gsap.context(() => {
        const timeline = gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 70%", end: "bottom 30%", scrub: 0.6 } });
        timeline.fromTo("[data-route-fill]", { scaleX: 0 }, { scaleX: 1, transformOrigin: "left" });
        root.current?.querySelectorAll<HTMLElement>("[data-process-step]").forEach((step) => {
          timeline.fromTo(step, { opacity: 0.35, y: 24 }, { opacity: 1, y: 0, duration: 0.2 });
          step.querySelectorAll("[data-micro-phase]").forEach((phase) => timeline.fromTo(phase, { opacity: 0, y: 16, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.12 }));
        });
      }, root);
      cleanup = () => context.revert();
    });
    return () => cleanup();
  }, [profile]);
  return <div ref={root} data-process-complete={profile !== "rich" ? "true" : undefined}>{stages.map((stage) => <section data-process-step data-stage={stage.id} key={stage.id}><h3>{stage.title}</h3><ProcessMicroScene stage={stage} /></section>)}</div>;
}
```

```tsx
// frontend/src/components/process/process-micro-scene.tsx
import { BadgeCheck, Boxes, ClipboardCheck, Files, Flag, Handshake, MapPin, PackageCheck, Plane, Route, ScanLine, Ship, Train, Truck, Warehouse } from "lucide-react";
const visuals = {
  route: [MapPin, Route, BadgeCheck], pickup: [Boxes, Warehouse, ClipboardCheck], customs: [Files, ScanLine, BadgeCheck],
  transit: [PackageCheck, Ship, Route], delivery: [Flag, Handshake, BadgeCheck],
} as const;
export function ProcessMicroScene({ stage }: { stage: ProcessStage }) {
  return <div className="grid grid-cols-3 gap-3" aria-label={stage.title}>{stage.phases.map((phase, index) => { const Icon = visuals[stage.id][index]; return <div key={phase} data-micro-phase={index + 1} className="min-h-28 border border-cyan-400/30 p-3"><span className="block font-mono text-xs">0{index + 1}</span><Icon aria-hidden="true" className="my-3 size-6 text-cyan-400" />{stage.id === "transit" && index === 1 ? <span aria-hidden="true" className="flex gap-2"><Ship /><Plane /><Train /><Truck /></span> : null}<span>{phase}</span><span aria-hidden="true" data-visual={stage.id} className="mt-4 block h-1 origin-left bg-cyan-400" /></div>; })}</div>;
}
```

Style the three visuals by `data-visual`: routing connects origin/destination and resolves mode choices; pickup assembles cargo units then completes an intake checklist; customs stacks documents, passes a scan line, and reveals clearance-ready; transit crossfades ocean/air/rail/road silhouettes while route progress advances; delivery completes destination milestones and closes the route. The GSAP phase sequence animates only opacity and transform, while light/reduced profiles render all three phases completed.

- [ ] **Step 7: Add service-page variants**

Expose `ProcessStory` props for `locale`, `stageIds`, and `compact`. Service pages pass only the relevant stage with `compact=true`; the homepage passes all stages. Resolve titles and phase labels from the active locale dictionary before choosing the client or mobile renderer.

```tsx
// frontend/src/components/process/process-story.tsx
import { getTranslations } from "next-intl/server";
export async function ProcessStory({ locale, stageIds = processStageIds, compact = false, motion }: { locale: Locale; stageIds?: readonly ProcessStageId[]; compact?: boolean; motion?: "reduced" }) {
  const t = await getTranslations({ locale, namespace: "Process" });
  const stages = stageIds.map((id) => ({ id, title: t(`${id}.title`), phases: t.raw(`${id}.phases`) as [string, string, string] }));
  if (motion === "reduced" || compact) return <MobileProcess stages={stages} complete={motion === "reduced"} />;
  return <ProcessStoryClient stages={stages} />;
}
```

- [ ] **Step 8: Verify process behavior and commit**

Run:

```bash
pnpm --filter @anshow/frontend test -- src/components/process src/components/motion
pnpm --filter @anshow/frontend build
```

Expected: semantic and profile tests pass; build keeps GSAP out of server bundles.

Run the mobile and reduced-motion Playwright profiles and assert no request URL contains a Three.js chunk. On desktop, capture the route scene and assert the canvas contains non-transparent pixels after the one-time draw.

```bash
git add frontend/src/components/process frontend/src/components/motion frontend/src/components/home 'frontend/src/app/[locale]'
git commit -m "Explain every shipment stage through controlled motion" \
  -m "Constraint: Desktop immersion must preserve native scroll and mobile readability" \
  -m "Confidence: medium" -m "Scope-risk: broad" \
  -m "Directive: Keep all five stages on one coordinated timeline and destroy it on unmount" \
  -m "Tested: semantic tests, motion-profile tests, and production build"
```

### Task 7: Build Public Detail Routes, Search Metadata, and Visual QA

**Files:**
- Create: `frontend/src/app/[locale]/services/page.tsx`
- Create: `frontend/src/app/[locale]/services/[slug]/page.tsx`
- Create: `frontend/src/app/[locale]/trade-lanes/page.tsx`
- Create: `frontend/src/app/[locale]/trade-lanes/[slug]/page.tsx`
- Create: `frontend/src/app/[locale]/special-cargo/page.tsx`
- Create: `frontend/src/app/[locale]/special-cargo/[slug]/page.tsx`
- Create: `frontend/src/app/[locale]/insights/page.tsx`
- Create: `frontend/src/app/[locale]/insights/[slug]/page.tsx`
- Create: `frontend/src/app/[locale]/case-studies/page.tsx`
- Create: `frontend/src/app/[locale]/case-studies/[slug]/page.tsx`
- Create: `frontend/src/app/[locale]/about/page.tsx`
- Create: `frontend/src/app/[locale]/network/page.tsx`
- Create: `frontend/src/app/[locale]/certifications/page.tsx`
- Create: `frontend/src/app/[locale]/contact/page.tsx`
- Create: `frontend/src/app/[locale]/quote/page.tsx`
- Create: `frontend/src/app/[locale]/privacy/page.tsx`
- Create: `frontend/src/app/[locale]/terms/page.tsx`
- Create: `frontend/src/app/[locale]/cookies/page.tsx`
- Create: `frontend/src/app/[locale]/not-found.tsx`
- Create: `frontend/src/app/[locale]/error.tsx`
- Create: `frontend/src/app/sitemap.ts`
- Create: `frontend/src/app/robots.ts`
- Create: `frontend/tests/e2e/public-site.spec.ts`

- [ ] **Step 1: Write failing E2E coverage**

```ts
// frontend/tests/e2e/public-site.spec.ts
import { test, expect } from "@playwright/test";

test("keeps route context when switching language", async ({ page }) => {
  await page.goto("/en/services/ocean-freight");
  await page.getByRole("button", { name: /change language/i }).click();
  await page.getByRole("link", { name: "中文" }).click();
  await expect(page).toHaveURL(/\/zh\/services\//);
});

test("mobile page has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/en");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});
```

- [ ] **Step 2: Run E2E and confirm failure**

Run: `pnpm --filter @anshow/frontend test:e2e -- tests/e2e/public-site.spec.ts`

Expected: FAIL because detail routes are absent.

- [ ] **Step 3: Implement all typed public routes**

Each route reads only published locale data, generates localized metadata, uses responsive media, provides breadcrumbs below the second hierarchy level, and displays a short enquiry CTA. Unknown or unpublished slugs call `notFound()`.

```tsx
// frontend/src/app/[locale]/services/[slug]/page.tsx
import { getPublicContent } from "@/api/public-content.server";
import { notFound } from "next/navigation";
export default async function ServicePage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const service = await getPublicContent("services", locale, slug).catch((error: { status?: number }) => error.status === 404 ? null : Promise.reject(error));
  if (!service) notFound();
  return <main><Breadcrumbs items={[service.title]} /><ServiceHero service={service} /><RichText value={service.body} /><ProcessStory locale={locale} compact stageIds={[service.processStageId]} /><QuoteCta /></main>;
}
```

```tsx
// frontend/src/app/[locale]/not-found.tsx
"use client";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
export default function NotFound() { const t = useTranslations("Errors"); const locale = usePathname().split("/")[1] || "en"; return <main><h1>{t("notFoundTitle")}</h1><p>{t("notFoundBody")}</p><a href={`/${locale}`}>AnShow</a></main>; }
```

```tsx
// frontend/src/app/[locale]/error.tsx
"use client";
import { useTranslations } from "next-intl";
export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { const t = useTranslations(); return <main><h1>{t("Errors.unexpected")}</h1><button onClick={reset}>{t("Common.retry")}</button></main>; }
```

Log only the error digest server-side; do not expose stack traces or visitor data.

- [ ] **Step 4: Generate sitemap and robots output**

```ts
// frontend/src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { listPublishedUrls } from "@/api/public-content.server";
import { env } from "@/env";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const records = await listPublishedUrls();
  return records.map((record) => ({ url: new URL(record.path, env.SITE_URL).toString(), lastModified: record.updatedAt, alternates: { languages: record.alternates } }));
}
```

```ts
// frontend/src/app/robots.ts
import type { MetadataRoute } from "next";
import { env } from "@/env";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }, sitemap: `${env.SITE_URL}/sitemap.xml` };
}
```

The backend implementation behind `listPublishedUrls` selects only published translations whose base row is not archived, returns equivalent translated URLs by record ID, and therefore excludes drafts, scheduled content, `/admin`, and internal APIs. The frontend consumes the generated response type and never reconstructs sitemap records from database state.

- [ ] **Step 5: Run visual and accessibility checks**

Run:

```bash
pnpm --filter @anshow/frontend build
pnpm --filter @anshow/frontend test:e2e -- tests/e2e/public-site.spec.ts
```

Capture Playwright screenshots at 375, 768, 1024, and 1440px. Verify no overlap, readable Russian/Chinese wrapping, keyboard focus, carousel controls, process fallback, and no blank rich-motion canvas.

- [ ] **Step 6: Commit**

```bash
git add 'frontend/src/app/[locale]' frontend/src/app/sitemap.ts frontend/src/app/robots.ts frontend/tests/e2e/public-site.spec.ts
git commit -m "Make every AnShow capability discoverable and shareable" \
  -m "Constraint: Published locale pages need stable URLs, metadata, and mobile readability" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: production build, public Playwright flows, responsive screenshots, and accessibility review"
```

## Public Experience Completion Gate

Run:

```bash
pnpm --filter @anshow/backend test
pnpm --filter @anshow/frontend test
pnpm --filter @anshow/backend lint
pnpm --filter @anshow/frontend lint
pnpm --filter @anshow/backend typecheck
pnpm --filter @anshow/frontend typecheck
pnpm --filter @anshow/backend build
pnpm --filter @anshow/frontend build
pnpm --filter @anshow/frontend test:e2e -- tests/e2e/public-site.spec.ts
```

Expected: all public routes work in EN/ZH/RU, generated media meets budgets, the hero and case carousels are controllable, five process steps work in rich/light/none profiles, and mobile pages remain readable without horizontal overflow.
