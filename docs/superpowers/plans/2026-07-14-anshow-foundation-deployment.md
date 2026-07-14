# AnShow Foundation and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the tested Next.js foundation, locale routing, brand tokens, SQLite access, staff authentication, and Docker/Caddy production baseline that every later AnShow subsystem builds on.

**Architecture:** One Next.js TypeScript application serves public and `/admin` routes. SQLite is accessed through Drizzle, Better Auth owns persistent staff sessions, and the foundation Compose stack runs the application behind Caddy; the operations plan adds worker and backup services after those binaries exist.

**Tech Stack:** Next.js, TypeScript, pnpm, Tailwind CSS, Vitest, Playwright, next-intl, Drizzle ORM, better-sqlite3, Better Auth, Argon2id, Docker Compose, Caddy

---

## Execution Order and File Map

Execute this plan before the public, admin, and enquiry plans.

- `package.json`: scripts and dependency contract.
- `src/app/[locale]/layout.tsx`: localized public root.
- `src/app/[locale]/page.tsx`: initial localized smoke page.
- `src/app/admin/login/page.tsx`: staff login surface.
- `src/i18n/*`: locale routing, dictionaries, and request configuration.
- `src/styles/tokens.css`: approved AnShow semantic tokens.
- `src/components/brand/*`: Route Apex logo variants.
- `src/db/*`: SQLite connection, schema, migrations, and test helpers.
- `src/auth/*`: Better Auth configuration, session access, and RBAC guard.
- `src/proxy.ts`: locale routing and admin access boundary.
- `Dockerfile`, `compose.yaml`, `Caddyfile`: production runtime.

### Task 1: Scaffold the Application and Test Harness

**Files:**
- Create: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `src/lib/app-config.test.ts`
- Create: `src/lib/app-config.ts`

- [ ] **Step 1: Generate the Next.js base and install approved dependencies**

Run:

```bash
pnpm dlx create-next-app@latest /tmp/anshow-next \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm --yes
rsync -a --exclude .git --exclude README.md /tmp/anshow-next/ ./
rm -rf /tmp/anshow-next
pnpm add next-intl drizzle-orm better-sqlite3 better-auth argon2 zod \
  embla-carousel-react gsap three lucide-react sharp nodemailer
pnpm add -D drizzle-kit @types/better-sqlite3 @types/nodemailer @types/three \
  vitest @vitejs/plugin-react jsdom @testing-library/react \
  @testing-library/jest-dom @testing-library/user-event @playwright/test \
  @axe-core/playwright tsx tsup
```

Expected: `package.json`, `pnpm-lock.yaml`, `src/app`, and Tailwind files exist; dependency installation exits 0.

- [ ] **Step 2: Add scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

Merge these scripts with the generated package metadata and retain the installed dependency versions.

- [ ] **Step 3: Write the failing application-config test**

```ts
// src/lib/app-config.test.ts
import { describe, expect, it } from "vitest";
import { APP_NAME, DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./app-config";

describe("app config", () => {
  it("fixes the public brand and locale contract", () => {
    expect(APP_NAME).toBe("AnShow");
    expect(DEFAULT_LOCALE).toBe("en");
    expect(SUPPORTED_LOCALES).toEqual(["en", "zh", "ru"]);
  });
});
```

- [ ] **Step 4: Configure Vitest and verify the test fails**

```ts
// vitest.config.ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"] },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
Object.defineProperty(window, "matchMedia", { writable: true, value: (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver;
```

Run: `pnpm test -- src/lib/app-config.test.ts`

Expected: FAIL because `src/lib/app-config.ts` does not exist.

- [ ] **Step 5: Implement the application config**

```ts
// src/lib/app-config.ts
export const APP_NAME = "AnShow";
export const SUPPORTED_LOCALES = ["en", "zh", "ru"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
```

- [ ] **Step 6: Verify the foundation toolchain**

Run:

```bash
pnpm test -- src/lib/app-config.test.ts
pnpm lint
pnpm typecheck
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src vitest.config.ts vitest.setup.ts playwright.config.ts
git commit -m "Establish a testable AnShow application base" \
  -m "Constraint: The empty repository needs one reproducible pnpm and Next.js toolchain" \
  -m "Confidence: high" -m "Scope-risk: moderate" \
  -m "Tested: pnpm test, lint, and typecheck"
```

### Task 2: Add Typed Locale Routing and Dictionaries

**Files:**
- Create: `src/i18n/routing.ts`
- Create: `src/i18n/request.ts`
- Create: `src/i18n/messages/en.json`
- Create: `src/i18n/messages/zh.json`
- Create: `src/i18n/messages/ru.json`
- Create: `src/i18n/routing.test.ts`
- Create: `src/proxy.ts`
- Create: `src/app/[locale]/layout.tsx`
- Create: `src/app/[locale]/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Write the failing locale test**

```ts
// src/i18n/routing.test.ts
import { describe, expect, it } from "vitest";
import { isLocale } from "./routing";

describe("locale routing", () => {
  it.each(["en", "zh", "ru"])("accepts %s", (locale) => {
    expect(isLocale(locale)).toBe(true);
  });

  it("rejects unsupported locale values", () => {
    expect(isLocale("de")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the locale test and confirm failure**

Run: `pnpm test -- src/i18n/routing.test.ts`

Expected: FAIL because `routing.ts` does not exist.

- [ ] **Step 3: Implement routing and request configuration**

```ts
// src/i18n/routing.ts
import { defineRouting } from "next-intl/routing";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/app-config";

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: "en",
  localePrefix: "always",
});

export function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}
```

```ts
// src/i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: (await import(`./messages/${locale}.json`)).default };
});
```

```ts
// src/proxy.ts
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);
export const config = { matcher: ["/((?!api|admin|_next|.*\\..*).*)"] };
```

- [ ] **Step 4: Add complete initial dictionaries**

```json
// src/i18n/messages/en.json
{"Common":{"learnMore":"Learn more","viewAll":"View all","previous":"Previous","next":"Next","pause":"Pause","play":"Play","close":"Close","loading":"Loading","retry":"Try again"},"Navigation":{"services":"Services","tradeLanes":"Trade Lanes","specialCargo":"Special Cargo","insights":"Insights","about":"About","contact":"Contact","quote":"Request a quote","language":"Change language","menu":"Open menu"},"Home":{"eyebrow":"Global logistics network","title":"Move freight. Command certainty.","cta":"Request a quote","services":"Freight services","lanes":"Priority trade lanes","cargo":"Specialist cargo","process":"How a shipment moves","cases":"Case studies","insights":"Latest insights","contact":"Plan your next shipment"},"Process":{"route":{"title":"Enquiry and routing","phases":["Connect","Compare","Select"]},"pickup":{"title":"Pickup and handling","phases":["Collect","Receive","Confirm"]},"customs":{"title":"Customs readiness","phases":["Documents","Validate","Release"]},"transit":{"title":"Main transport","phases":["Load","Move","Milestone"]},"delivery":{"title":"Final delivery","phases":["Arrive","Handover","Complete"]}},"Enquiry":{"name":"Name","company":"Company","email":"Email","phone":"Phone","need":"Transport requirement","message":"Message","consent":"I agree to the privacy notice","submit":"Submit enquiry","submitting":"Submitting","success":"Your enquiry has been received","invalid":"Please correct the highlighted fields","rateLimited":"Too many enquiries. Please try again later."},"Footer":{"privacy":"Privacy Notice","terms":"Terms of Use","cookies":"Cookie Notice"},"Errors":{"notFoundTitle":"Page not found","notFoundBody":"The requested page is unavailable.","unexpected":"Something went wrong. Please try again."}}
```

```json
// src/i18n/messages/zh.json
{"Common":{"learnMore":"了解更多","viewAll":"查看全部","previous":"上一个","next":"下一个","pause":"暂停","play":"播放","close":"关闭","loading":"加载中","retry":"重试"},"Navigation":{"services":"服务项目","tradeLanes":"贸易线路","specialCargo":"专业货物","insights":"资讯洞察","about":"关于我们","contact":"联系我们","quote":"提交询盘","language":"切换语言","menu":"打开菜单"},"Home":{"eyebrow":"全球物流网络","title":"掌控运输，确定抵达。","cta":"提交询盘","services":"货运服务","lanes":"重点贸易线路","cargo":"专业货物能力","process":"货物如何完成运输","cases":"案例研究","insights":"最新洞察","contact":"规划您的下一票货物"},"Process":{"route":{"title":"询盘与路线规划","phases":["连接起讫点","比较方式","确认路线"]},"pickup":{"title":"提货与操作","phases":["提取货物","完成入库","确认清单"]},"customs":{"title":"关务准备","phases":["收集文件","校验信息","准备放行"]},"transit":{"title":"干线运输","phases":["装载","运输","更新节点"]},"delivery":{"title":"最终交付","phases":["抵达","交接","完成"]}},"Enquiry":{"name":"姓名","company":"公司","email":"邮箱","phone":"电话","need":"运输需求","message":"留言","consent":"我同意隐私声明","submit":"提交询盘","submitting":"提交中","success":"我们已收到您的询盘","invalid":"请修正标记的字段","rateLimited":"提交次数过多，请稍后再试。"},"Footer":{"privacy":"隐私声明","terms":"使用条款","cookies":"Cookie 声明"},"Errors":{"notFoundTitle":"页面未找到","notFoundBody":"您访问的页面不可用。","unexpected":"出现错误，请重试。"}}
```

```json
// src/i18n/messages/ru.json
{"Common":{"learnMore":"Подробнее","viewAll":"Смотреть все","previous":"Назад","next":"Вперед","pause":"Пауза","play":"Воспроизвести","close":"Закрыть","loading":"Загрузка","retry":"Повторить"},"Navigation":{"services":"Услуги","tradeLanes":"Маршруты","specialCargo":"Специальные грузы","insights":"Материалы","about":"О компании","contact":"Контакты","quote":"Отправить запрос","language":"Сменить язык","menu":"Открыть меню"},"Home":{"eyebrow":"Глобальная логистическая сеть","title":"Управляйте грузом. Сохраняйте уверенность.","cta":"Отправить запрос","services":"Транспортные услуги","lanes":"Приоритетные маршруты","cargo":"Специальные грузы","process":"Как проходит перевозка","cases":"Примеры процессов","insights":"Последние материалы","contact":"Спланируйте следующую перевозку"},"Process":{"route":{"title":"Запрос и маршрут","phases":["Соединить точки","Сравнить варианты","Выбрать маршрут"]},"pickup":{"title":"Забор и обработка","phases":["Забрать груз","Принять на терминале","Подтвердить список"]},"customs":{"title":"Таможенная готовность","phases":["Собрать документы","Проверить данные","Подготовить выпуск"]},"transit":{"title":"Основная перевозка","phases":["Погрузить","Перевезти","Отметить этап"]},"delivery":{"title":"Финальная доставка","phases":["Прибыть","Передать","Завершить"]}},"Enquiry":{"name":"Имя","company":"Компания","email":"Электронная почта","phone":"Телефон","need":"Требования к перевозке","message":"Сообщение","consent":"Я принимаю уведомление о конфиденциальности","submit":"Отправить запрос","submitting":"Отправка","success":"Мы получили ваш запрос","invalid":"Исправьте отмеченные поля","rateLimited":"Слишком много запросов. Повторите позже."},"Footer":{"privacy":"Конфиденциальность","terms":"Условия использования","cookies":"Уведомление о cookie"},"Errors":{"notFoundTitle":"Страница не найдена","notFoundBody":"Запрошенная страница недоступна.","unexpected":"Произошла ошибка. Повторите попытку."}}
```

- [ ] **Step 5: Implement the localized layout and smoke page**

```tsx
// src/app/[locale]/layout.tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export default async function LocaleLayout({ children, params }: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
```

```tsx
// src/app/[locale]/page.tsx
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("Home");
  return <main><p>{t("eyebrow")}</p><h1>{t("title")}</h1><a href="#quote">{t("cta")}</a></main>;
}
```

```tsx
// src/app/layout.tsx
import { getLocale } from "next-intl/server";
import "./globals.css";
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return <html lang={locale}><body>{children}</body></html>;
}
```

- [ ] **Step 6: Verify locales and commit**

Run:

```bash
pnpm test -- src/i18n/routing.test.ts
pnpm build
```

Expected: tests pass and build emits localized routes.

```bash
git add src/i18n src/proxy.ts 'src/app/[locale]'
git commit -m "Make every public route explicitly multilingual" \
  -m "Constraint: English, Chinese, and Russian must have stable prefixed URLs" \
  -m "Confidence: high" -m "Scope-risk: moderate" \
  -m "Tested: locale unit tests and production build"
```

### Task 3: Add Brand Tokens and Route Apex Components

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/fonts.css`
- Create: `src/assets/fonts/exo-2-latin.woff2`
- Create: `src/assets/fonts/exo-2-cyrillic.woff2`
- Create: `src/assets/fonts/noto-sans-latin.woff2`
- Create: `src/assets/fonts/noto-sans-cyrillic.woff2`
- Create: `src/assets/fonts/noto-sans-sc.woff2`
- Create: `src/assets/fonts/roboto-mono-latin-cyrillic.woff2`
- Create: `src/assets/fonts/LICENSES.md`
- Create: `src/components/brand/route-apex-mark.tsx`
- Create: `src/components/brand/anshow-logo.tsx`
- Create: `src/components/brand/anshow-logo.test.tsx`
- Create: `assets/brand/route-apex-symbol.svg`
- Create: `assets/brand/anshow-horizontal-dark.svg`
- Create: `assets/brand/anshow-horizontal-light.svg`
- Create: `scripts/export-brand-assets.ts`
- Create: `src/app/icon.svg`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Write the failing logo accessibility test**

```tsx
// src/components/brand/anshow-logo.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnShowLogo } from "./anshow-logo";

describe("AnShowLogo", () => {
  it("exposes the brand name and hides the decorative mark", () => {
    render(<AnShowLogo />);
    expect(screen.getByText("AnShow")).toBeVisible();
    expect(screen.getByTestId("route-apex-mark")).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm test -- src/components/brand/anshow-logo.test.tsx`

Expected: FAIL because the brand components do not exist.

- [ ] **Step 3: Implement semantic tokens**

```css
/* src/styles/tokens.css */
:root {
  --color-carbon: #06090d;
  --color-dark-surface: #0b1117;
  --color-light-surface: #f5f7f8;
  --color-surface: #ffffff;
  --color-text: #071018;
  --color-text-inverse: #eef6fb;
  --color-muted-inverse: #b9c7d1;
  --color-cyan: #38bdf8;
  --color-teal: #14b8a6;
  --color-action: #f97316;
  --color-danger: #dc2626;
  --motion-fast: 180ms;
  --motion-standard: 260ms;
  --radius-control: 4px;
}
```

```css
/* src/styles/fonts.css */
@font-face { font-family: "Exo 2"; src: url("../assets/fonts/exo-2-latin.woff2") format("woff2"); font-display: swap; unicode-range: U+0000-024F; }
@font-face { font-family: "Exo 2"; src: url("../assets/fonts/exo-2-cyrillic.woff2") format("woff2"); font-display: swap; unicode-range: U+0400-052F; }
@font-face { font-family: "Noto Sans"; src: url("../assets/fonts/noto-sans-latin.woff2") format("woff2"); font-display: swap; unicode-range: U+0000-024F; }
@font-face { font-family: "Noto Sans"; src: url("../assets/fonts/noto-sans-cyrillic.woff2") format("woff2"); font-display: swap; unicode-range: U+0400-052F; }
@font-face { font-family: "Noto Sans SC"; src: url("../assets/fonts/noto-sans-sc.woff2") format("woff2"); font-display: swap; unicode-range: U+3000-9FFF; }
@font-face { font-family: "Roboto Mono"; src: url("../assets/fonts/roboto-mono-latin-cyrillic.woff2") format("woff2"); font-display: swap; }
:lang(en), :lang(ru) { --font-display: "Exo 2", sans-serif; --font-body: "Noto Sans", sans-serif; }
:lang(zh) { --font-display: "Noto Sans SC", sans-serif; --font-body: "Noto Sans SC", sans-serif; }
```

Use upstream OFL-licensed WOFF2 files and preserve their license notices in `assets/fonts/LICENSES.md`. Unicode ranges ensure the browser fetches only subsets needed by the active page language.

- [ ] **Step 4: Implement the SVG logo components**

```tsx
// src/components/brand/route-apex-mark.tsx
export function RouteApexMark({ className }: { className?: string }) {
  return (
    <svg data-testid="route-apex-mark" aria-hidden="true" viewBox="0 0 64 64" className={className}>
      <path d="M12 56 29 8h8L54 56H43L33 25 23 56Z" fill="currentColor" />
      <path d="M22 40h22v8H22z" fill="#38BDF8" />
      <rect x="48" y="4" width="10" height="10" fill="#F97316" />
    </svg>
  );
}
```

```tsx
// src/components/brand/anshow-logo.tsx
import { RouteApexMark } from "./route-apex-mark";

export function AnShowLogo({ compact = false }: { compact?: boolean }) {
  return <span className="inline-flex items-center gap-3 font-bold text-current">
    <RouteApexMark className="size-9" />
    {!compact && <span>AnShow</span>}
  </span>;
}
```

- [ ] **Step 5: Export the complete logo asset set**

```ts
// scripts/export-brand-assets.ts
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const sources = ["route-apex-symbol", "anshow-horizontal-dark", "anshow-horizontal-light"] as const;
await fs.mkdir("public/brand", { recursive: true });
for (const name of sources) {
  const source = path.join("assets/brand", `${name}.svg`);
  await fs.copyFile(source, path.join("public/brand", `${name}.svg`));
  await sharp(source).png().toFile(path.join("public/brand", `${name}.png`));
}
for (const size of [32, 48, 64]) await sharp("assets/brand/route-apex-symbol.svg").resize(size, size).png().toFile(`public/brand/favicon-${size}.png`);
```

Use the same flat Route Apex geometry as `RouteApexMark`. The dark horizontal variant uses light wordmark text, the light variant uses carbon text, and neither SVG contains gradients, glow, animation, or external font/image references. Copy the symbol SVG to `src/app/icon.svg` and run `pnpm tsx scripts/export-brand-assets.ts`.

- [ ] **Step 6: Import tokens globally and verify**

Add `@import "../styles/fonts.css";` and `@import "../styles/tokens.css";` to `src/app/globals.css`, apply `var(--font-body)` to body and `var(--font-display)` to headings, and keep `src/app/layout.tsx` free of locale-specific text.

Run:

```bash
pnpm test -- src/components/brand/anshow-logo.test.tsx
pnpm tsx scripts/export-brand-assets.ts
pnpm lint
pnpm typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add assets/brand public/brand scripts/export-brand-assets.ts src/styles src/components/brand src/app/icon.svg src/app/globals.css src/app/layout.tsx
git commit -m "Give AnShow a stable visual identity" \
  -m "Constraint: The logo must remain clear across dark, light, mobile, and favicon contexts" \
  -m "Confidence: high" -m "Scope-risk: narrow" \
  -m "Tested: component tests, lint, and typecheck"
```

### Task 4: Add SQLite, Drizzle, and RBAC Schema

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/client.ts`
- Create: `src/db/schema/auth.ts`
- Create: `src/db/schema/rbac.ts`
- Create: `src/db/schema/index.ts`
- Create: `src/db/test-db.ts`
- Create: `src/db/rbac.test.ts`

- [ ] **Step 1: Write the failing RBAC persistence test**

```ts
// src/db/rbac.test.ts
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "./test-db";

describe("rbac schema", () => {
  it("assigns a role to a user without duplicate rows", async () => {
    const db = createTestDatabase();
    const result = await db.assignRole("user-1", "role-1");
    expect(result).toEqual({ userId: "user-1", roleId: "role-1" });
    await expect(db.assignRole("user-1", "role-1")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm test -- src/db/rbac.test.ts`

Expected: FAIL because the test database helper does not exist.

- [ ] **Step 3: Define the database connection**

```ts
// src/db/client.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_PATH ?? "data/anshow.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });
export type AppDatabase = typeof db;
```

- [ ] **Step 4: Add RBAC tables**

```ts
// src/db/schema/rbac.ts
import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
});

export const userRoles = sqliteTable("user_roles", {
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.userId, table.roleId] })]);

export const rolePermissions = sqliteTable("role_permissions", {
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: text("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]);
```

- [ ] **Step 5: Generate auth tables from the installed Better Auth version**

Create `src/auth/server.ts` with the Drizzle adapter and email/password enabled, then run:

```bash
pnpm dlx @better-auth/cli@latest generate --config src/auth/server.ts --output src/db/schema/auth.ts
```

Expected: Better Auth writes concrete user, session, account, and verification tables compatible with the installed package version.

- [ ] **Step 6: Export schema, implement the in-memory helper, and verify**

```ts
// src/db/schema/index.ts
export * from "./auth";
export * from "./rbac";
```

```ts
// src/db/test-db.ts
import Database from "better-sqlite3";

export function createTestDatabase() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE roles (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE user_roles (
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
    INSERT INTO roles (id, name) VALUES ('role-1', 'Editor');
  `);
  return {
    async assignRole(userId: string, roleId: string) {
      sqlite.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").run(userId, roleId);
      return { userId, roleId };
    },
    close() { sqlite.close(); },
  };
}
```

Run:

```bash
pnpm test -- src/db/rbac.test.ts
pnpm db:generate
pnpm typecheck
```

Expected: test passes, Drizzle generates a migration, typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add drizzle.config.ts src/db src/auth migrations
git commit -m "Persist staff identity and permissions in SQLite" \
  -m "Constraint: Staff sessions and RBAC must survive container restarts" \
  -m "Confidence: medium" -m "Scope-risk: moderate" \
  -m "Directive: Regenerate Better Auth schema only when upgrading the installed auth package" \
  -m "Tested: RBAC unit test, migration generation, and typecheck"
```

### Task 5: Implement Staff Login and Server-Side Permission Guards

**Files:**
- Create: `src/auth/server.ts`
- Create: `src/auth/client.ts`
- Create: `src/auth/permissions.ts`
- Create: `src/auth/permissions.test.ts`
- Create: `src/auth/seed-rbac.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `scripts/create-admin.ts`

- [ ] **Step 1: Write the failing permission test**

```ts
// src/auth/permissions.test.ts
import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("permission guard", () => {
  it("defaults to deny", () => {
    expect(can([], "content.publish")).toBe(false);
  });

  it("allows an explicit permission", () => {
    expect(can(["content.publish"], "content.publish")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm test -- src/auth/permissions.test.ts`

Expected: FAIL because `permissions.ts` does not exist.

- [ ] **Step 3: Implement the pure permission guard**

```ts
// src/auth/permissions.ts
export const PERMISSION_KEYS = [
  "content.read", "content.write", "content.publish", "media.read", "media.write",
  "inquiry.read", "inquiry.assign", "inquiry.status", "inquiry.note", "inquiry.retry", "inquiry.export",
  "staff.manage", "settings.manage", "audit.read",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function can(granted: readonly string[], required: PermissionKey): boolean {
  return granted.includes(required);
}
```

```ts
// src/auth/seed-rbac.ts
import type { AppDatabase } from "@/db/client";
import { permissions, rolePermissions, roles } from "@/db/schema/rbac";
import { PERMISSION_KEYS, type PermissionKey } from "./permissions";
const rolePresets: Record<string, readonly PermissionKey[]> = {
  "Super Administrator": PERMISSION_KEYS,
  Publisher: ["content.read", "content.write", "content.publish", "media.read", "media.write"],
  "Content Editor": ["content.read", "content.write", "media.read", "media.write"],
  Sales: ["inquiry.read", "inquiry.assign", "inquiry.status", "inquiry.note", "inquiry.retry", "inquiry.export"],
  Viewer: ["content.read", "media.read", "inquiry.read", "audit.read"],
};
export async function seedRbac(db: AppDatabase) {
  await db.transaction(async (tx) => {
    for (const key of PERMISSION_KEYS) await tx.insert(permissions).values({ id: key, key }).onConflictDoNothing();
    for (const [name, granted] of Object.entries(rolePresets)) {
      const id = name.toLowerCase().replaceAll(" ", "-"); await tx.insert(roles).values({ id, name }).onConflictDoNothing();
      for (const key of granted) await tx.insert(rolePermissions).values({ roleId: id, permissionId: key }).onConflictDoNothing();
    }
  });
}
```

- [ ] **Step 4: Configure Better Auth and its route handler**

```ts
// src/auth/server.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client";
import argon2 from "argon2";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true, password: {
    hash: (password) => argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    verify: ({ hash, password }) => argon2.verify(hash, password),
  } },
  session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 30 },
});
```

```ts
// src/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth/server";
import { seedRbac } from "@/auth/seed-rbac";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 5: Implement login and protected admin smoke pages**

```ts
// src/auth/client.ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();
```

```tsx
// src/app/admin/login/page.tsx
"use client";
import { useState } from "react";
import { authClient } from "@/auth/client";

export default function AdminLoginPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(formData: FormData) {
    setPending(true); setError("");
    const result = await authClient.signIn.email({
      email: String(formData.get("email")), password: String(formData.get("password")),
      callbackURL: "/admin",
    });
    if (result.error) { setError(result.error.message ?? "Unable to sign in"); setPending(false); }
  }
  return <main><form action={submit}>
    <label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required />
    <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required />
    {error && <p role="alert">{error}</p>}
    <button disabled={pending}>{pending ? "Signing in" : "Sign in"}</button>
  </form></main>;
}
```

```tsx
// src/app/admin/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth/server";

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/admin/login");
  return <main><h1>Administration</h1><p>{session.user.email}</p></main>;
}
```

```ts
// scripts/create-admin.ts
import { eq } from "drizzle-orm";
import { auth } from "@/auth/server";
import { db } from "@/db/client";
import { roles, userRoles } from "@/db/schema/rbac";
const [email, password, name = "Administrator"] = process.argv.slice(2);
if (!email || !password) throw new Error("Usage: pnpm tsx scripts/create-admin.ts <email> <password> [name]");
await seedRbac(db);
const result = await auth.api.signUpEmail({ body: { email, password, name } });
const [superAdmin] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, "Super Administrator")).limit(1);
if (!superAdmin) throw new Error("RBAC seed is missing Super Administrator");
await db.insert(userRoles).values({ userId: result.user.id, roleId: superAdmin.id });
console.log(`Created administrator ${result.user.email}`);
```

Seed the complete permission list and the Super Administrator, Publisher, Content Editor, Sales, and Viewer role presets before running this command. Do not create default credentials in migrations or Compose.

- [ ] **Step 6: Verify authentication boundaries**

Run:

```bash
pnpm test -- src/auth/permissions.test.ts
pnpm build
```

Expected: permission tests pass and auth routes build.

- [ ] **Step 7: Commit**

```bash
git add src/auth src/app/api/auth src/app/admin
git commit -m "Protect AnShow administration with persistent staff sessions" \
  -m "Constraint: Every admin action needs server-side identity and default-deny authorization" \
  -m "Confidence: medium" -m "Scope-risk: broad" \
  -m "Tested: permission unit tests and production build"
```

### Task 6: Add Docker Compose, Caddy, Health Checks, and Environment Validation

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `compose.yaml`
- Create: `Caddyfile`
- Create: `src/env.ts`
- Create: `src/env.test.ts`
- Create: `src/app/api/health/route.ts`
- Modify: `next.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Write the failing environment test**

```ts
// src/env.test.ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("environment", () => {
  it("rejects a production config without a site URL", () => {
    expect(() => parseEnv({ NODE_ENV: "production", DATABASE_PATH: "/data/a.db" })).toThrow("SITE_URL");
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm test -- src/env.test.ts`

Expected: FAIL because `env.ts` does not exist.

- [ ] **Step 3: Implement environment validation**

```ts
// src/env.ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  SITE_URL: z.string().url(),
  DATABASE_PATH: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  RATE_LIMIT_SECRET: z.string().min(32),
  MEDIA_DRIVER: z.enum(["local", "cos"]).default("local"),
});

export function parseEnv(input: Record<string, unknown>) { return schema.parse(input); }
export const env = parseEnv(process.env);
```

- [ ] **Step 4: Add health route and production Dockerfile**

```ts
// src/app/api/health/route.ts
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
```

```dockerfile
# Dockerfile
FROM node:24-alpine AS build
RUN apk add --no-cache python3 make g++
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
```

```ts
// next.config.ts
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl({ output: "standalone" });
```

- [ ] **Step 5: Add Compose and Caddy**

```yaml
# compose.yaml
services:
  app:
    build: .
    env_file: .env
    volumes: ["app-data:/data", "media-data:/media"]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
  caddy:
    image: caddy:2-alpine
    environment: ["SITE_HOST=${SITE_HOST}"]
    ports: ["80:80", "443:443"]
    volumes: ["./Caddyfile:/etc/caddy/Caddyfile:ro", "caddy-data:/data", "caddy-config:/config"]
    depends_on: { app: { condition: service_healthy } }
volumes: { app-data: {}, media-data: {}, caddy-data: {}, caddy-config: {} }
```

```dotenv
# .env.example
NODE_ENV=production
SITE_URL=
SITE_HOST=
DATABASE_PATH=/data/anshow.db
BETTER_AUTH_SECRET=
RATE_LIMIT_SECRET=
MEDIA_DRIVER=local
```

```caddyfile
{$SITE_HOST} {
  encode zstd gzip
  reverse_proxy app:3000
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}
```

- [ ] **Step 6: Verify the production baseline**

Run:

```bash
pnpm test -- src/env.test.ts
pnpm build
docker compose config
docker build -t anshow-foundation .
```

Expected: tests and build pass, Compose renders valid YAML, Docker image builds.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile .dockerignore compose.yaml Caddyfile .env.example src/env.ts src/env.test.ts src/app/api/health
git commit -m "Make AnShow reproducibly deployable on Tencent Cloud" \
  -m "Constraint: One CVM must provide automatic HTTPS and persistent SQLite/media volumes" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Directive: Never replace persistent volumes during a normal application update" \
  -m "Tested: env unit test, production build, compose config, and Docker build"
```

## Foundation Completion Gate

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e --grep "locale|admin login"
docker compose config
```

Expected: all commands pass. `/` redirects to `/en`, `/en`, `/zh`, and `/ru` render localized smoke content, `/admin` requires a persistent staff session, and the Docker image answers `/api/health`.
