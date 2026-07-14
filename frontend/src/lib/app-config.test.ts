import { describe, expect, it } from "vitest";

import {
  APP_NAME,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from "./app-config";

describe("application configuration", () => {
  it("defines the AnShow brand and supported locales", () => {
    expect(APP_NAME).toBe("AnShow");
    expect(DEFAULT_LOCALE).toBe("en");
    expect(SUPPORTED_LOCALES).toEqual(["en", "zh", "ru"]);
  });
});
