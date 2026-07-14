import { describe, expect, it } from "vitest";

import english from "./messages/en.json";
import russian from "./messages/ru.json";
import chinese from "./messages/zh.json";

describe("public shell dictionaries", () => {
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
