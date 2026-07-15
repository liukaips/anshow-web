import { describe, expect, it } from "vitest";

import { chooseMotionProfile } from "./use-motion-profile";

describe("chooseMotionProfile", () => {
  it("keeps rich motion for capable desktop devices", () => {
    expect(chooseMotionProfile({ cores: 8, reduced: false, width: 1440 })).toBe("rich");
  });

  it("uses light motion on mobile or low-core devices", () => {
    expect(chooseMotionProfile({ cores: 8, reduced: false, width: 390 })).toBe("light");
    expect(chooseMotionProfile({ cores: 2, reduced: false, width: 1440 })).toBe("light");
  });

  it("disables motion when the visitor requests it", () => {
    expect(chooseMotionProfile({ cores: 8, reduced: true, width: 1440 })).toBe("none");
  });
});

