# AnShow Foundation and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the tested pnpm workspace, separate Next.js frontend and Hono backend, locale routing, brand tokens, SQLite access, staff authentication, generated API contract, and Docker/Caddy production baseline.

**Architecture:** `frontend/` owns the public website and `/admin` UI; `backend/` owns Hono APIs, Better Auth, Drizzle, SQLite, media, and worker entry points. Caddy keeps the deployment same-origin by routing `/api/*` to the backend and all remaining requests to the frontend, while OpenAPI generation is the only DTO-sharing mechanism.

**Tech Stack:** pnpm workspaces, Next.js, Hono, TypeScript, Tailwind CSS, Vitest, Playwright, next-intl, OpenAPI, Drizzle ORM, better-sqlite3, Better Auth, Argon2id, Docker Compose, Caddy, Let's Encrypt ACME

---

## Execution Order and File Map

Execute this plan before the public, admin, and enquiry plans.

- `package.json` and `pnpm-workspace.yaml`: workspace scripts and application boundaries.
- `frontend/`: Next.js public and administration interface.
- `backend/`: Hono API, persistence, authentication, and worker code.
- `frontend/src/app/[locale]/layout.tsx`: localized public root.
- `frontend/src/app/[locale]/page.tsx`: initial localized smoke page.
- `frontend/src/app/admin/login/page.tsx`: staff login surface.
- `frontend/src/i18n/*`: locale routing, dictionaries, and request configuration.
- `frontend/src/styles/tokens.css`: approved AnShow semantic tokens.
- `frontend/src/components/brand/*`: Route Apex logo variants.
- `backend/src/db/*`: SQLite connection, schema, migrations, and test helpers.
- `backend/src/auth/*`: Better Auth configuration, session access, and RBAC guard.
- `frontend/src/proxy.ts`: locale routing and admin access boundary.
- `frontend/Dockerfile`, `backend/Dockerfile`, `compose.yaml`, `Caddyfile`: production runtime.

### Task 1: Scaffold the Application and Test Harness

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `openapi/anshow.json`
- Create: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/vitest.setup.ts`
- Create: `frontend/playwright.config.ts`
- Create: `frontend/src/lib/app-config.test.ts`
- Create: `frontend/src/lib/app-config.ts`
- Create: `frontend/src/generated/api.ts`
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/eslint.config.mjs`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/app.test.ts`
- Create: `backend/src/http/context.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/worker/index.ts`
- Create: `backend/scripts/export-openapi.ts`

- [ ] **Step 1: Create the workspace and generate the frontend base**

Run:

```bash
pnpm dlx create-next-app@latest /tmp/anshow-next \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm --yes
mkdir -p frontend backend openapi
rsync -a --exclude .git --exclude README.md /tmp/anshow-next/ frontend/
rm -rf /tmp/anshow-next
```

```yaml
# pnpm-workspace.yaml
packages:
  - frontend
  - backend
```

```json
// package.json
{
  "name": "anshow-web",
  "private": true,
  "packageManager": "pnpm@10.13.1",
  "scripts": {
    "dev": "pnpm --parallel --filter @anshow/frontend --filter @anshow/backend dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @anshow/frontend test:e2e",
    "openapi:generate": "pnpm --filter @anshow/backend openapi:export && openapi-typescript openapi/anshow.json -o frontend/src/generated/api.ts"
  },
  "devDependencies": { "openapi-typescript": "latest" }
}
```

Change the generated frontend package name to `@anshow/frontend`, keep its generated Next.js dependencies, and add the workspace scripts shown in Step 2. Expected: root workspace files and `frontend/src/app` exist.

- [ ] **Step 2: Install strictly separated frontend and backend dependencies**

```json
// frontend/package.json additions
{
  "name": "@anshow/frontend",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

```json
// backend/package.json
{
  "name": "@anshow/backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup src/server.ts src/worker/index.ts scripts/create-admin.ts --format esm --out-dir dist",
    "start": "node dist/server.js",
    "admin:create": "node dist/scripts/create-admin.js",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "openapi:export": "tsx scripts/export-openapi.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

Run:

```bash
pnpm --filter @anshow/frontend add next-intl embla-carousel-react gsap three lucide-react
pnpm --filter @anshow/frontend add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test @axe-core/playwright @types/three
pnpm --filter @anshow/backend add hono @hono/node-server @hono/zod-openapi zod
pnpm --filter @anshow/backend add -D typescript tsx tsup vitest eslint @eslint/js typescript-eslint
pnpm install
```

Expected: the frontend lockfile section contains no SQLite, Drizzle, SMTP, COS, or password-hashing packages; the backend contains no React, Next.js, GSAP, Embla, or Three.js packages.

- [ ] **Step 3: Write failing frontend and backend smoke tests**

```ts
// frontend/src/lib/app-config.test.ts
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

```ts
// backend/src/app.test.ts
import { describe, expect, it } from "vitest";
import { app } from "./app";

describe("backend app", () => {
  it("serves a typed liveness envelope", async () => {
    const response = await app.request("/api/health/live");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { status: "ok" }, error: null, requestId: expect.any(String) });
  });
});
```

- [ ] **Step 4: Configure both test environments and verify red**

```ts
// frontend/vitest.config.ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"] },
});
```

```ts
// frontend/vitest.setup.ts
import "@testing-library/jest-dom/vitest";
Object.defineProperty(window, "matchMedia", { writable: true, value: (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver;
```

```ts
// backend/vitest.config.ts
import path from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({ resolve: { alias: { "@": path.resolve(__dirname, "src") } }, test: { environment: "node" } });
```

Run:

```bash
pnpm --filter @anshow/frontend test -- src/lib/app-config.test.ts
pnpm --filter @anshow/backend test -- src/app.test.ts
```

Expected: frontend fails because `app-config.ts` is absent; backend fails because `app.ts` is absent.

- [ ] **Step 5: Implement the frontend config and typed Hono liveness route**

```ts
// frontend/src/lib/app-config.ts
export const APP_NAME = "AnShow";
export const SUPPORTED_LOCALES = ["en", "zh", "ru"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
```

```ts
// backend/src/app.ts
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/http/context";

const liveRoute = createRoute({
  method: "get", path: "/api/health/live",
  responses: { 200: { content: { "application/json": { schema: z.object({ data: z.object({ status: z.literal("ok") }), error: z.null(), requestId: z.string() }) } }, description: "Process is alive" } },
});

export const app = new OpenAPIHono<AppEnv>({ defaultHook: (result, context) => {
  if (!result.success) return context.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Request validation failed", fieldErrors: result.error.flatten().fieldErrors }, requestId: context.get("requestId") }, 400);
} });
app.use("*", async (context, next) => {
  const requestId = crypto.randomUUID();
  context.set("requestId", requestId);
  await next();
  context.header("x-request-id", requestId);
});
app.openapi(liveRoute, (context) => context.json({ data: { status: "ok" as const }, error: null, requestId: context.get("requestId") }));
app.onError((error, context) => {
  console.error(JSON.stringify({ level: "error", requestId: context.get("requestId"), message: error.message }));
  return context.json({ data: null, error: { code: "INTERNAL_ERROR", message: "The request could not be completed" }, requestId: context.get("requestId") }, 500);
});
app.doc("/api/openapi.json", { openapi: "3.1.0", info: { title: "AnShow API", version: "1.0.0" } });
```

```ts
// backend/src/http/context.ts
export type AppEnv = { Variables: { requestId: string; actor?: { user: { id: string; email: string }; permissions: readonly string[] } } };
```

Keep `app.doc(...)` after every route mount as later plans extend `backend/src/app.ts`, so the generated document always contains the full API surface. API handlers reuse the request ID from context and never return stack traces or secret-bearing error objects.

```ts
// backend/src/server.ts
import { serve } from "@hono/node-server";
import { app } from "./app";
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 4000) });
```

```ts
// backend/scripts/export-openapi.ts
import fs from "node:fs/promises";
import { app } from "../src/app";
const response = await app.request("/api/openapi.json");
if (!response.ok) throw new Error(`OpenAPI export failed: ${response.status}`);
await fs.mkdir(new URL("../../openapi/", import.meta.url), { recursive: true });
await fs.writeFile(new URL("../../openapi/anshow.json", import.meta.url), JSON.stringify(await response.json(), null, 2));
```

```ts
// backend/src/worker/index.ts
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
if (!stopping) process.exitCode = 0;
```

This initial entry proves the worker build output without starting a polling loop; the enquiry plan replaces it with the signal-aware SMTP and scheduled-publishing loop without changing the backend image boundary.

- [ ] **Step 6: Generate the API contract and verify the workspace**

Run:

```bash
pnpm openapi:generate
pnpm -r test
pnpm -r lint
pnpm -r typecheck
```

Expected: all commands exit 0, `openapi/anshow.json` contains `/api/health/live`, and `frontend/src/generated/api.ts` is regenerated without manual edits.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml openapi frontend backend
git commit -m "Keep the AnShow interface and data service independently buildable" \
  -m "Constraint: Frontend and backend must use separate directories and share DTOs only through OpenAPI" \
  -m "Confidence: high" -m "Scope-risk: moderate" \
  -m "Tested: OpenAPI generation, workspace tests, lint, and typecheck"
```

### Task 2: Add Typed Locale Routing and Dictionaries

**Files:**
- Create: `frontend/src/i18n/routing.ts`
- Create: `frontend/src/i18n/request.ts`
- Create: `frontend/src/i18n/messages/en.json`
- Create: `frontend/src/i18n/messages/zh.json`
- Create: `frontend/src/i18n/messages/ru.json`
- Create: `frontend/src/i18n/routing.test.ts`
- Create: `frontend/src/proxy.ts`
- Create: `frontend/src/app/[locale]/layout.tsx`
- Create: `frontend/src/app/[locale]/page.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Write the failing locale test**

```ts
// frontend/src/i18n/routing.test.ts
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

Run: `pnpm --filter @anshow/frontend test -- src/i18n/routing.test.ts`

Expected: FAIL because `routing.ts` does not exist.

- [ ] **Step 3: Implement routing and request configuration**

```ts
// frontend/src/i18n/routing.ts
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
// frontend/src/i18n/request.ts
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
// frontend/src/proxy.ts
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);
export const config = { matcher: ["/((?!api|admin|_next|.*\\..*).*)"] };
```

- [ ] **Step 4: Add complete initial dictionaries**

```json
// frontend/src/i18n/messages/en.json
{"Common":{"learnMore":"Learn more","viewAll":"View all","previous":"Previous","next":"Next","pause":"Pause","play":"Play","close":"Close","loading":"Loading","retry":"Try again"},"Navigation":{"services":"Services","tradeLanes":"Trade Lanes","specialCargo":"Special Cargo","insights":"Insights","about":"About","contact":"Contact","quote":"Request a quote","language":"Change language","menu":"Open menu"},"Home":{"eyebrow":"Global logistics network","title":"Move freight. Command certainty.","cta":"Request a quote","services":"Freight services","lanes":"Priority trade lanes","cargo":"Specialist cargo","process":"How a shipment moves","cases":"Case studies","insights":"Latest insights","contact":"Plan your next shipment"},"Process":{"route":{"title":"Enquiry and routing","phases":["Connect","Compare","Select"]},"pickup":{"title":"Pickup and handling","phases":["Collect","Receive","Confirm"]},"customs":{"title":"Customs readiness","phases":["Documents","Validate","Release"]},"transit":{"title":"Main transport","phases":["Load","Move","Milestone"]},"delivery":{"title":"Final delivery","phases":["Arrive","Handover","Complete"]}},"Enquiry":{"name":"Name","company":"Company","email":"Email","phone":"Phone","need":"Transport requirement","message":"Message","consent":"I agree to the privacy notice","submit":"Submit enquiry","submitting":"Submitting","success":"Your enquiry has been received","invalid":"Please correct the highlighted fields","rateLimited":"Too many enquiries. Please try again later."},"Footer":{"privacy":"Privacy Notice","terms":"Terms of Use","cookies":"Cookie Notice"},"Errors":{"notFoundTitle":"Page not found","notFoundBody":"The requested page is unavailable.","unexpected":"Something went wrong. Please try again."}}
```

```json
// frontend/src/i18n/messages/zh.json
{"Common":{"learnMore":"了解更多","viewAll":"查看全部","previous":"上一个","next":"下一个","pause":"暂停","play":"播放","close":"关闭","loading":"加载中","retry":"重试"},"Navigation":{"services":"服务项目","tradeLanes":"贸易线路","specialCargo":"专业货物","insights":"资讯洞察","about":"关于我们","contact":"联系我们","quote":"提交询盘","language":"切换语言","menu":"打开菜单"},"Home":{"eyebrow":"全球物流网络","title":"掌控运输，确定抵达。","cta":"提交询盘","services":"货运服务","lanes":"重点贸易线路","cargo":"专业货物能力","process":"货物如何完成运输","cases":"案例研究","insights":"最新洞察","contact":"规划您的下一票货物"},"Process":{"route":{"title":"询盘与路线规划","phases":["连接起讫点","比较方式","确认路线"]},"pickup":{"title":"提货与操作","phases":["提取货物","完成入库","确认清单"]},"customs":{"title":"关务准备","phases":["收集文件","校验信息","准备放行"]},"transit":{"title":"干线运输","phases":["装载","运输","更新节点"]},"delivery":{"title":"最终交付","phases":["抵达","交接","完成"]}},"Enquiry":{"name":"姓名","company":"公司","email":"邮箱","phone":"电话","need":"运输需求","message":"留言","consent":"我同意隐私声明","submit":"提交询盘","submitting":"提交中","success":"我们已收到您的询盘","invalid":"请修正标记的字段","rateLimited":"提交次数过多，请稍后再试。"},"Footer":{"privacy":"隐私声明","terms":"使用条款","cookies":"Cookie 声明"},"Errors":{"notFoundTitle":"页面未找到","notFoundBody":"您访问的页面不可用。","unexpected":"出现错误，请重试。"}}
```

```json
// frontend/src/i18n/messages/ru.json
{"Common":{"learnMore":"Подробнее","viewAll":"Смотреть все","previous":"Назад","next":"Вперед","pause":"Пауза","play":"Воспроизвести","close":"Закрыть","loading":"Загрузка","retry":"Повторить"},"Navigation":{"services":"Услуги","tradeLanes":"Маршруты","specialCargo":"Специальные грузы","insights":"Материалы","about":"О компании","contact":"Контакты","quote":"Отправить запрос","language":"Сменить язык","menu":"Открыть меню"},"Home":{"eyebrow":"Глобальная логистическая сеть","title":"Управляйте грузом. Сохраняйте уверенность.","cta":"Отправить запрос","services":"Транспортные услуги","lanes":"Приоритетные маршруты","cargo":"Специальные грузы","process":"Как проходит перевозка","cases":"Примеры процессов","insights":"Последние материалы","contact":"Спланируйте следующую перевозку"},"Process":{"route":{"title":"Запрос и маршрут","phases":["Соединить точки","Сравнить варианты","Выбрать маршрут"]},"pickup":{"title":"Забор и обработка","phases":["Забрать груз","Принять на терминале","Подтвердить список"]},"customs":{"title":"Таможенная готовность","phases":["Собрать документы","Проверить данные","Подготовить выпуск"]},"transit":{"title":"Основная перевозка","phases":["Погрузить","Перевезти","Отметить этап"]},"delivery":{"title":"Финальная доставка","phases":["Прибыть","Передать","Завершить"]}},"Enquiry":{"name":"Имя","company":"Компания","email":"Электронная почта","phone":"Телефон","need":"Требования к перевозке","message":"Сообщение","consent":"Я принимаю уведомление о конфиденциальности","submit":"Отправить запрос","submitting":"Отправка","success":"Мы получили ваш запрос","invalid":"Исправьте отмеченные поля","rateLimited":"Слишком много запросов. Повторите позже."},"Footer":{"privacy":"Конфиденциальность","terms":"Условия использования","cookies":"Уведомление о cookie"},"Errors":{"notFoundTitle":"Страница не найдена","notFoundBody":"Запрошенная страница недоступна.","unexpected":"Произошла ошибка. Повторите попытку."}}
```

- [ ] **Step 5: Implement the localized layout and smoke page**

```tsx
// frontend/src/app/[locale]/layout.tsx
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
// frontend/src/app/[locale]/page.tsx
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("Home");
  return <main><p>{t("eyebrow")}</p><h1>{t("title")}</h1><a href="#quote">{t("cta")}</a></main>;
}
```

```tsx
// frontend/src/app/layout.tsx
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
pnpm --filter @anshow/frontend test -- src/i18n/routing.test.ts
pnpm --filter @anshow/frontend build
```

Expected: tests pass and build emits localized routes.

```bash
git add frontend/src/i18n frontend/src/proxy.ts 'frontend/src/app/[locale]'
git commit -m "Make every public route explicitly multilingual" \
  -m "Constraint: English, Chinese, and Russian must have stable prefixed URLs" \
  -m "Confidence: high" -m "Scope-risk: moderate" \
  -m "Tested: locale unit tests and production build"
```

### Task 3: Add Brand Tokens and Route Apex Components

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/fonts.css`
- Create: `frontend/src/assets/fonts/exo-2-latin.woff2`
- Create: `frontend/src/assets/fonts/exo-2-cyrillic.woff2`
- Create: `frontend/src/assets/fonts/noto-sans-latin.woff2`
- Create: `frontend/src/assets/fonts/noto-sans-cyrillic.woff2`
- Create: `frontend/src/assets/fonts/noto-sans-sc.woff2`
- Create: `frontend/src/assets/fonts/roboto-mono-latin-cyrillic.woff2`
- Create: `frontend/src/assets/fonts/LICENSES.md`
- Create: `frontend/src/components/brand/route-apex-mark.tsx`
- Create: `frontend/src/components/brand/anshow-logo.tsx`
- Create: `frontend/src/components/brand/anshow-logo.test.tsx`
- Create: `assets/brand/route-apex-symbol.svg`
- Create: `assets/brand/anshow-horizontal-dark.svg`
- Create: `assets/brand/anshow-horizontal-light.svg`
- Create: `scripts/export-brand-assets.ts`
- Create: `frontend/src/app/icon.svg`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Write the failing logo accessibility test**

```tsx
// frontend/src/components/brand/anshow-logo.test.tsx
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

Run: `pnpm --filter @anshow/frontend test -- src/components/brand/anshow-logo.test.tsx`

Expected: FAIL because the brand components do not exist.

- [ ] **Step 3: Implement semantic tokens**

```css
/* frontend/src/styles/tokens.css */
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
/* frontend/src/styles/fonts.css */
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
// frontend/src/components/brand/route-apex-mark.tsx
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
// frontend/src/components/brand/anshow-logo.tsx
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
await fs.mkdir("frontend/public/brand", { recursive: true });
for (const name of sources) {
  const source = path.join("assets/brand", `${name}.svg`);
  await fs.copyFile(source, path.join("frontend/public/brand", `${name}.svg`));
  await sharp(source).png().toFile(path.join("frontend/public/brand", `${name}.png`));
}
for (const size of [32, 48, 64]) await sharp("assets/brand/route-apex-symbol.svg").resize(size, size).png().toFile(`frontend/public/brand/favicon-${size}.png`);
```

Use the same flat Route Apex geometry as `RouteApexMark`. The dark horizontal variant uses light wordmark text, the light variant uses carbon text, and neither SVG contains gradients, glow, animation, or external font/image references. Copy the symbol SVG to `frontend/src/app/icon.svg` and run `pnpm tsx scripts/export-brand-assets.ts`.

- [ ] **Step 6: Import tokens globally and verify**

Add `@import "../styles/fonts.css";` and `@import "../styles/tokens.css";` to `frontend/src/app/globals.css`, apply `var(--font-body)` to body and `var(--font-display)` to headings, and keep `frontend/src/app/layout.tsx` free of locale-specific text.

Run:

```bash
pnpm --filter @anshow/frontend test -- src/components/brand/anshow-logo.test.tsx
pnpm tsx scripts/export-brand-assets.ts
pnpm --filter @anshow/frontend lint
pnpm --filter @anshow/frontend typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add assets/brand frontend/public/brand scripts/export-brand-assets.ts frontend/src/styles frontend/src/components/brand frontend/src/app/icon.svg frontend/src/app/globals.css frontend/src/app/layout.tsx
git commit -m "Give AnShow a stable visual identity" \
  -m "Constraint: The logo must remain clear across dark, light, mobile, and favicon contexts" \
  -m "Confidence: high" -m "Scope-risk: narrow" \
  -m "Tested: component tests, lint, and typecheck"
```

### Task 4: Add SQLite, Drizzle, and RBAC Schema

**Files:**
- Create: `backend/drizzle.config.ts`
- Create: `backend/src/db/client.ts`
- Create: `backend/src/db/schema/auth.ts`
- Create: `backend/src/db/schema/rbac.ts`
- Create: `backend/src/db/schema/index.ts`
- Create: `backend/src/db/test-db.ts`
- Create: `backend/src/db/rbac.test.ts`
- Create: `backend/src/auth/server.ts`

- [ ] **Step 1: Install backend persistence dependencies and write the failing RBAC test**

Run:

```bash
pnpm --filter @anshow/backend add drizzle-orm better-sqlite3 better-auth argon2
pnpm --filter @anshow/backend add -D drizzle-kit @types/better-sqlite3
```

```ts
// backend/src/db/rbac.test.ts
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

Run: `pnpm --filter @anshow/backend test -- src/db/rbac.test.ts`

Expected: FAIL because the test database helper does not exist.

- [ ] **Step 3: Define the database connection**

```ts
// backend/drizzle.config.ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/index.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.DATABASE_PATH ?? "data/anshow.db" },
});
```

```ts
// backend/src/db/client.ts
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
// backend/src/db/schema/rbac.ts
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

Create the concrete config used by the installed CLI, then run:

```ts
// backend/src/auth/server.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client";
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "development-only-secret-32-chars-minimum",
  baseURL: process.env.SITE_URL ?? "http://localhost:3000",
  basePath: "/api/auth",
  emailAndPassword: { enabled: true },
});
```

```bash
pnpm --filter @anshow/backend dlx @better-auth/cli@latest generate --config src/auth/server.ts --output src/db/schema/auth.ts
```

Expected: Better Auth writes concrete user, session, account, and verification tables compatible with the installed package version.

- [ ] **Step 6: Export schema, implement the in-memory helper, and verify**

```ts
// backend/src/db/schema/index.ts
export * from "./auth";
export * from "./rbac";
```

```ts
// backend/src/db/test-db.ts
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
pnpm --filter @anshow/backend test -- src/db/rbac.test.ts
pnpm --filter @anshow/backend db:generate
pnpm --filter @anshow/backend typecheck
```

Expected: test passes, Drizzle generates a migration, typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add backend/package.json pnpm-lock.yaml backend/drizzle.config.ts backend/src/db backend/src/auth backend/migrations
git commit -m "Persist staff identity and permissions in SQLite" \
  -m "Constraint: Staff sessions and RBAC must survive container restarts" \
  -m "Confidence: medium" -m "Scope-risk: moderate" \
  -m "Directive: Regenerate Better Auth schema only when upgrading the installed auth package" \
  -m "Tested: RBAC unit test, migration generation, and typecheck"
```

### Task 5: Implement Staff Login and Server-Side Permission Guards

**Files:**
- Modify: `backend/src/auth/server.ts`
- Create: `frontend/src/auth/client.ts`
- Create: `backend/src/auth/permissions.ts`
- Create: `backend/src/auth/permissions.test.ts`
- Create: `backend/src/auth/seed-rbac.ts`
- Create: `backend/src/auth/permission-repository.ts`
- Create: `backend/src/routes/admin-session.ts`
- Modify: `backend/src/app.ts`
- Create: `frontend/src/api/server.ts`
- Create: `frontend/src/app/admin/login/page.tsx`
- Create: `frontend/src/app/admin/page.tsx`
- Create: `backend/scripts/create-admin.ts`

- [ ] **Step 1: Write the failing permission test**

```ts
// backend/src/auth/permissions.test.ts
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

Run: `pnpm --filter @anshow/backend test -- src/auth/permissions.test.ts`

Expected: FAIL because `permissions.ts` does not exist.

- [ ] **Step 3: Implement the pure permission guard**

```ts
// backend/src/auth/permissions.ts
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
// backend/src/auth/seed-rbac.ts
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
  db.transaction((tx) => {
    for (const key of PERMISSION_KEYS) tx.insert(permissions).values({ id: key, key }).onConflictDoNothing().run();
    for (const [name, granted] of Object.entries(rolePresets)) {
      const id = name.toLowerCase().replaceAll(" ", "-"); tx.insert(roles).values({ id, name }).onConflictDoNothing().run();
      for (const key of granted) tx.insert(rolePermissions).values({ roleId: id, permissionId: key }).onConflictDoNothing().run();
    }
  });
}
```

```ts
// backend/src/auth/permission-repository.ts
import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { permissions, rolePermissions, userRoles } from "@/db/schema/rbac";
import type { PermissionKey } from "./permissions";
export async function permissionsForUser(db: AppDatabase, userId: string): Promise<PermissionKey[]> {
  const rows = db.select({ key: permissions.key }).from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId)).all();
  return rows.map(({ key }) => key as PermissionKey);
}
```

- [ ] **Step 4: Configure Better Auth and its route handler**

Run: `pnpm --filter @anshow/frontend add better-auth`

```ts
// backend/src/auth/server.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client";
import argon2 from "argon2";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "development-only-secret-32-chars-minimum",
  baseURL: siteUrl,
  basePath: "/api/auth",
  trustedOrigins: [siteUrl],
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
  emailAndPassword: { enabled: true, password: {
    hash: (password) => argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    verify: ({ hash, password }) => argon2.verify(hash, password),
  } },
  session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 30 },
});
```

Verify in the authentication integration test that production session cookies are scoped to the public host and use `Secure`, `HttpOnly`, and `SameSite=Lax`. Development keeps the explicit localhost `SITE_URL` allowlist and does not accept arbitrary origins.

```ts
// backend/src/app.ts additions
import { auth } from "@/auth/server";
import { adminSessionRoute } from "@/routes/admin-session";

app.on(["GET", "POST"], "/api/auth/*", (context) => auth.handler(context.req.raw));
app.route("/api/admin/session", adminSessionRoute);
```

```ts
// backend/src/routes/admin-session.ts
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { auth } from "@/auth/server";
import { db } from "@/db/client";
import { permissionsForUser } from "@/auth/permission-repository";
const dataSchema = z.object({ user: z.object({ id: z.string(), email: z.string().email() }), permissions: z.array(z.string()) }).openapi("AdminSessionData");
const route = createRoute({ method: "get", path: "/", responses: {
  200: { content: { "application/json": { schema: z.object({ data: dataSchema, error: z.null(), requestId: z.string() }) } }, description: "Current staff session" },
  401: { content: { "application/json": { schema: z.object({ data: z.null(), error: z.object({ code: z.literal("UNAUTHENTICATED"), message: z.string() }), requestId: z.string() }) } }, description: "No staff session" },
} });
export const adminSessionRoute = new OpenAPIHono().openapi(route, async (context) => {
  const session = await auth.api.getSession({ headers: context.req.raw.headers });
  if (!session) return context.json({ data: null, error: { code: "UNAUTHENTICATED", message: "Authentication required" }, requestId: crypto.randomUUID() }, 401);
  const permissions = await permissionsForUser(db, session.user.id);
  return context.json({ data: { user: session.user, permissions }, error: null, requestId: crypto.randomUUID() });
});
```

- [ ] **Step 5: Implement login and protected admin smoke pages**

```ts
// frontend/src/auth/client.ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();
```

```ts
// frontend/src/api/server.ts
import { headers } from "next/headers";
import type { components } from "@/generated/api";
type AdminSession = components["schemas"]["AdminSessionData"];
export async function getAdminSession() {
  const requestHeaders = await headers();
  const response = await fetch(`${process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000"}/api/admin/session`, { headers: { cookie: requestHeaders.get("cookie") ?? "" }, cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Session API failed: ${response.status}`);
  return (await response.json()).data as AdminSession;
}
```

```tsx
// frontend/src/app/admin/login/page.tsx
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
// frontend/src/app/admin/page.tsx
import { redirect } from "next/navigation";
import { getAdminSession } from "@/api/server";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return <main><h1>Administration</h1><p>{session.user.email}</p></main>;
}
```

```ts
// backend/scripts/create-admin.ts
import { eq } from "drizzle-orm";
import { auth } from "@/auth/server";
import { seedRbac } from "@/auth/seed-rbac";
import { db } from "@/db/client";
import { roles, userRoles } from "@/db/schema/rbac";
const [email, password, name = "Administrator"] = process.argv.slice(2);
if (!email || !password) throw new Error("Usage: pnpm tsx backend/scripts/create-admin.ts <email> <password> [name]");
await seedRbac(db);
const result = await auth.api.signUpEmail({ body: { email, password, name } });
const superAdmin = db.select({ id: roles.id }).from(roles).where(eq(roles.name, "Super Administrator")).get();
if (!superAdmin) throw new Error("RBAC seed is missing Super Administrator");
db.insert(userRoles).values({ userId: result.user.id, roleId: superAdmin.id }).run();
console.log(`Created administrator ${result.user.email}`);
```

Seed the complete permission list and the Super Administrator, Publisher, Content Editor, Sales, and Viewer role presets before running this command. Do not create default credentials in migrations or Compose.

- [ ] **Step 6: Verify authentication boundaries**

Run:

```bash
pnpm --filter @anshow/backend test -- src/auth/permissions.test.ts
pnpm openapi:generate
pnpm -r build
```

Expected: permission tests pass and auth routes build.

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth backend/src/routes backend/src/app.ts backend/scripts frontend/package.json frontend/src/auth frontend/src/api frontend/src/app/admin pnpm-lock.yaml openapi frontend/src/generated
git commit -m "Protect AnShow administration with persistent staff sessions" \
  -m "Constraint: Every admin action needs server-side identity and default-deny authorization" \
  -m "Confidence: medium" -m "Scope-risk: broad" \
  -m "Tested: permission unit tests and production build"
```

### Task 6: Add Docker Compose, Caddy, Health Checks, and Environment Validation

**Files:**
- Create: `frontend/Dockerfile`
- Create: `backend/Dockerfile`
- Create: `.dockerignore`
- Create: `compose.yaml`
- Create: `Caddyfile`
- Create: `backend/src/env.ts`
- Create: `backend/src/env.test.ts`
- Modify: `backend/src/auth/server.ts`
- Modify: `backend/src/app.ts`
- Modify: `frontend/next.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Write the failing environment test**

```ts
// backend/src/env.test.ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("environment", () => {
  it("rejects a production config without a site URL", () => {
    expect(() => parseEnv({ NODE_ENV: "production", DATABASE_PATH: "/data/a.db" })).toThrow("SITE_URL");
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm --filter @anshow/backend test -- src/env.test.ts`

Expected: FAIL because `env.ts` does not exist.

- [ ] **Step 3: Implement environment validation**

```ts
// backend/src/env.ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  SITE_URL: z.string().url(),
  DATABASE_PATH: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  RATE_LIMIT_SECRET: z.string().min(32),
  MEDIA_DRIVER: z.enum(["local", "cos"]).default("local"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export function parseEnv(input: Record<string, unknown>) { return schema.parse(input); }
export const env = parseEnv(process.env);
```

Replace the Task 5 development fallbacks in `backend/src/auth/server.ts` with `env.SITE_URL`, `env.BETTER_AUTH_SECRET`, and `env.NODE_ENV`. Production startup must fail before binding port 4000 when any required value is absent; only tests and explicit development `.env` files may provide local values.

- [ ] **Step 4: Add backend readiness and independent production images**

```ts
// backend/src/app.ts readiness addition
app.get("/api/health/ready", async (context) => {
  try { await db.run(sql`select 1`); return context.json({ data: { status: "ready" }, error: null, requestId: crypto.randomUUID() }); }
  catch { return context.json({ data: null, error: { code: "NOT_READY", message: "Database unavailable" }, requestId: crypto.randomUUID() }, 503); }
});
```

```dockerfile
# frontend/Dockerfile
FROM node:24-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json frontend/package.json
RUN pnpm install --filter @anshow/frontend... --frozen-lockfile
COPY frontend frontend
RUN pnpm --filter @anshow/frontend build

FROM node:24-bookworm-slim AS runtime
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build --chown=app:app /app/frontend/.next/standalone ./
COPY --from=build --chown=app:app /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=app:app /app/frontend/public ./frontend/public
USER app
EXPOSE 3000
CMD ["node", "frontend/server.js"]
```

```dockerfile
# backend/Dockerfile
FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/package.json
RUN pnpm install --filter @anshow/backend... --frozen-lockfile
COPY backend backend
RUN pnpm --filter @anshow/backend build

FROM node:24-bookworm-slim AS runtime
RUN corepack enable && groupadd --system app && useradd --system --gid app app \
  && mkdir -p /data /media && chown -R app:app /data /media
WORKDIR /app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/backend/node_modules ./backend/node_modules
COPY --from=build --chown=app:app /app/backend/dist ./backend/dist
COPY --from=build --chown=app:app /app/backend/package.json ./backend/package.json
COPY --from=build --chown=app:app /app/backend/drizzle.config.ts ./backend/drizzle.config.ts
COPY --from=build --chown=app:app /app/backend/migrations ./backend/migrations
COPY --from=build --chown=app:app /app/backend/src/db/schema ./backend/src/db/schema
USER app
EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
```

```ts
// frontend/next.config.ts
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl({ output: "standalone", outputFileTracingRoot: new URL("..", import.meta.url).pathname });
```

- [ ] **Step 5: Add Compose and Caddy**

```yaml
# compose.yaml
services:
  frontend:
    image: anshow-frontend:${IMAGE_TAG:-local}
    build: { context: ., dockerfile: frontend/Dockerfile }
    environment: ["BACKEND_INTERNAL_URL=http://backend:4000"]
    depends_on: { backend: { condition: service_healthy } }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/en').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped
  migrate:
    image: anshow-backend:${IMAGE_TAG:-local}
    build: { context: ., dockerfile: backend/Dockerfile }
    command: ["pnpm", "--dir", "backend", "db:migrate"]
    env_file: .env
    volumes: ["app-data:/data"]
    restart: "no"
  backend:
    image: anshow-backend:${IMAGE_TAG:-local}
    build: { context: ., dockerfile: backend/Dockerfile }
    env_file: .env
    depends_on: { migrate: { condition: service_completed_successfully } }
    volumes: ["app-data:/data", "media-data:/media"]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:4000/api/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped
  caddy:
    image: caddy:2-alpine
    environment: ["SITE_HOST=${SITE_HOST}", "ACME_EMAIL=${ACME_EMAIL}"]
    ports: ["80:80", "443:443", "443:443/udp"]
    volumes: ["./Caddyfile:/etc/caddy/Caddyfile:ro", "media-data:/srv/media:ro", "caddy-data:/data", "caddy-config:/config"]
    depends_on: { frontend: { condition: service_healthy }, backend: { condition: service_healthy } }
    restart: unless-stopped
volumes: { app-data: {}, media-data: {}, caddy-data: {}, caddy-config: {} }
```

```dotenv
# .env.example
NODE_ENV=production
SITE_URL=
SITE_HOST=
ACME_EMAIL=
DATABASE_PATH=/data/anshow.db
BETTER_AUTH_SECRET=
RATE_LIMIT_SECRET=
MEDIA_DRIVER=local
```

```caddyfile
{
  email {$ACME_EMAIL}
}
{$SITE_HOST} {
  encode zstd gzip
  handle_path /media/* {
    root * /srv/media
    file_server
  }
  handle /api/* {
    reverse_proxy backend:4000
  }
  handle {
    reverse_proxy frontend:3000
  }
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}
```

Caddy's automatic HTTPS uses ACME to obtain and renew free publicly trusted certificates from Let's Encrypt. ZeroSSL remains an optional fallback issuer if production policy later requires it; no paid Tencent Cloud certificate is needed. Persist `/data` as `caddy-data`; Tencent Cloud DNS only points the hostname to the CVM and TCP 80/443 must reach Caddy for issuance and renewal.

- [ ] **Step 6: Verify the production baseline**

Run:

```bash
pnpm --filter @anshow/backend test -- src/env.test.ts
pnpm -r build
docker compose config
docker build -f frontend/Dockerfile -t anshow-frontend .
docker build -f backend/Dockerfile -t anshow-backend .
```

Expected: tests and build pass, Compose renders valid YAML, both Docker images build, and `migrate` is the only service that runs schema migrations before `backend` becomes healthy.

- [ ] **Step 7: Commit**

```bash
git add frontend/Dockerfile backend/Dockerfile .dockerignore compose.yaml Caddyfile .env.example backend/src/env.ts backend/src/env.test.ts backend/src/auth/server.ts backend/src/app.ts frontend/next.config.ts
git commit -m "Make AnShow reproducibly deployable on Tencent Cloud" \
  -m "Constraint: One CVM must provide automatic HTTPS and persistent SQLite/media volumes" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Directive: Never replace persistent volumes during a normal application update" \
  -m "Tested: env unit test, production build, compose config, and Docker build"
```

## Foundation Completion Gate

Run:

```bash
pnpm -r test
pnpm -r lint
pnpm -r typecheck
pnpm -r build
pnpm --filter @anshow/frontend test:e2e -- --grep "locale|admin login"
docker compose config
```

Expected: all commands pass. `/` redirects to `/en`; localized pages come from the frontend; `/api/health/live` and `/api/health/ready` come from Hono; `/admin` requires a persistent backend session; only Caddy publishes ports 80/443.
