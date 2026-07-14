import { describe, expect, it } from "vitest";

import english from "./messages/en.json";
import russian from "./messages/ru.json";
import chinese from "./messages/zh.json";
import { isLocale } from "./routing";

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
    "eyebrow",
    "title",
    "cta",
    "services",
    "lanes",
    "cargo",
    "process",
    "cases",
    "insights",
    "contact",
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

describe("locale routing", () => {
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
});
