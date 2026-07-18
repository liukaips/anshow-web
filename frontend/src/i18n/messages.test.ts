import { describe, expect, it } from "vitest";

import english from "./messages/en.json";
import russian from "./messages/ru.json";
import chinese from "./messages/zh.json";

describe("public shell dictionaries", () => {
  const keys = (value: unknown, prefix = ""): string[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
    return Object.entries(value).flatMap(([key, child]) =>
      keys(child, prefix ? `${prefix}.${key}` : key),
    );
  };

  it("keeps every interface message key aligned across locales", () => {
    const expectedKeys = keys(english).sort();
    expect(keys(chinese).sort()).toEqual(expectedKeys);
    expect(keys(russian).sort()).toEqual(expectedKeys);
  });

  it("uses the approved certainty headline naturally in all three locales", () => {
    expect(chinese.Home.title).toBe("让复杂货运，变得确定。");
    expect(english.Home.title).toBe("Make complex freight feel certain.");
    expect(russian.Home.title).toBe("Сложные перевозки. Предсказуемый результат.");
  });

  it("keeps the shell contract identical across all locales", () => {
    const expectedKeys = Object.keys(english.Shell).sort();
    expect(Object.keys(chinese.Shell).sort()).toEqual(expectedKeys);
    expect(Object.keys(russian.Shell).sort()).toEqual(expectedKeys);
  });

  it("provides locale-owned visible labels instead of English fallbacks", () => {
    expect(chinese.Shell.tradeLanes).not.toBe(english.Shell.tradeLanes);
    expect(russian.Shell.tradeLanes).not.toBe(english.Shell.tradeLanes);
    expect(chinese.Shell.footerDescription).not.toBe(
      english.Shell.footerDescription,
    );
    expect(russian.SEO.description).not.toBe(english.SEO.description);
  });
});
