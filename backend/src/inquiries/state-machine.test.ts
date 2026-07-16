import { describe, expect, it } from "vitest";

import { canTransition, assertInquiryTransition } from "./state-machine.js";

describe("inquiry state machine", () => {
  it.each([
    ["new", "pending_follow_up"],
    ["new", "in_progress"],
    ["pending_follow_up", "in_progress"],
    ["in_progress", "waiting_customer"],
    ["waiting_customer", "in_progress"],
    ["in_progress", "completed"],
    ["completed", "in_progress"],
    ["closed", "in_progress"],
    ["spam", "new"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ["new", "completed"],
    ["waiting_customer", "closed"],
    ["spam", "completed"],
    ["closed", "waiting_customer"],
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertInquiryTransition(from, to)).toThrowError("不允许从当前状态变更为目标状态");
  });
});
