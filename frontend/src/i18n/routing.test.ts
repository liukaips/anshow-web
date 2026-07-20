import { describe, expect, it } from "vitest";

import english from "./messages/en.json";
import russian from "./messages/ru.json";
import chinese from "./messages/zh.json";
import { isLocale, routing } from "./routing";

const requiredMessagePaths = [
  ...[
    "learnMore",
    "viewAll",
    "previous",
    "next",
    "pause",
    "play",
    "close",
    "loading",
    "retry",
  ].map((key) => `Common.${key}`),
  ...[
    "services",
    "tradeLanes",
    "specialCargo",
    "insights",
    "about",
    "contact",
    "quote",
    "language",
    "menu",
  ].map((key) => `Navigation.${key}`),
  ...[
    "home",
    "primary",
    "services",
    "tradeLanes",
    "specialCargo",
    "insights",
    "about",
    "contact",
    "quote",
    "changeLanguage",
    "languageMenu",
    "mobileNavigation",
    "openMenu",
    "closeMenu",
    "skipToContent",
    "footerDescription",
    "footerNavigation",
    "footerLegal",
    "quotePrompt",
    "privacy",
    "terms",
    "cookies",
  ].map((key) => `Shell.${key}`),
  ...["title", "titleTemplate", "description"].map(
    (key) => `SEO.${key}`,
  ),
  ...[
    "eyebrow",
    "title",
    "cta",
    "compactQuoteTitle",
    "compactQuoteCases",
    "services",
    "lanes",
    "cargo",
    "process",
    "cases",
    "insights",
    "insightsEyebrow",
    "evidenceEyebrow",
    "evidenceTitle",
    "evidenceAll",
    "commitmentsEyebrow",
    "commitmentsTitle",
    "trustTitle",
    "trustBasic",
    "trustVerified",
    "contact",
    "routeOrigin",
    "routeDestination",
    "stage",
    "lane",
    "proof",
    "trust",
    "nextMove",
    "quoteEntry.eyebrow",
    "quoteEntry.title",
    "quoteEntry.summary",
    "quoteEntry.routeTitle",
    "quoteEntry.routeText",
    "quoteEntry.cargoTitle",
    "quoteEntry.cargoText",
    "quoteEntry.contactTitle",
    "quoteEntry.contactText",
    "quoteEntry.cta",
  ].map((key) => `Home.${key}`),
  ...["route", "pickup", "customs", "transit", "delivery"].flatMap(
    (step) => [
      `Process.${step}.title`,
      `Process.${step}.phases.0`,
      `Process.${step}.phases.1`,
      `Process.${step}.phases.2`,
    ],
  ),
  ...[
    "name",
    "company",
    "email",
    "phone",
    "need",
    "message",
    "consent",
    "submit",
    "submitting",
    "success",
    "invalid",
    "rateLimited",
  ].map((key) => `Enquiry.${key}`),
  ...["privacy", "terms", "cookies"].map((key) => `Footer.${key}`),
  ...["notFoundTitle", "notFoundBody", "unexpected"].map(
    (key) => `Errors.${key}`,
  ),
].sort();

function messagePaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      messagePaths(item, `${prefix}.${index}`),
    );
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      messagePaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }

  return [prefix];
}

function expectCompleteContent(value: unknown, path = "messages"): void {
  if (Array.isArray(value)) {
    if (path.endsWith(".phases")) {
      expect(value, `${path} must contain exactly three phases`).toHaveLength(3);
    }

    value.forEach((item, index) =>
      expectCompleteContent(item, `${path}.${index}`),
    );
    return;
  }

  if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) =>
      expectCompleteContent(child, `${path}.${key}`),
    );
    return;
  }

  expect(typeof value, `${path} must be a string`).toBe("string");
  expect((value as string).trim(), `${path} must not be empty`).not.toBe("");
}

describe("locale routing", () => {
  it("uses English as the fixed default instead of detecting the browser language", () => {
    expect(routing.defaultLocale).toBe("en");
    expect(routing.localeDetection).toBe(false);
  });

  it.each(["en", "zh", "ru"])("accepts the supported locale %s", (locale) => {
    expect(isLocale(locale)).toBe(true);
  });

  it("rejects unsupported locales", () => {
    expect(isLocale("de")).toBe(false);
  });
});

describe("locale dictionaries", () => {
  it("provides the complete message contract in every locale", () => {
    const englishPaths = messagePaths(english).sort();

    expect(englishPaths).toEqual(requiredMessagePaths);
    expect(messagePaths(chinese).sort()).toEqual(englishPaths);
    expect(messagePaths(russian).sort()).toEqual(englishPaths);
  });

  it.each([
    ["English", english],
    ["Chinese", chinese],
    ["Russian", russian],
  ])("provides non-empty content and three phases in %s", (_name, messages) => {
    expectCompleteContent(messages);
  });
});
