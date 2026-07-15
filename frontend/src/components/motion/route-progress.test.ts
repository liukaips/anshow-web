import { expect, it } from "vitest";

import { routeProgress } from "./route-progress";

it("clamps route animation progress when RAF time precedes the start", () => {
  expect(routeProgress(99, 100)).toEqual({ eased: 0, raw: 0 });
  expect(routeProgress(1_900, 100)).toEqual({ eased: 1, raw: 1 });
});
