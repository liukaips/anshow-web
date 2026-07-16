import { describe, expect, it } from "vitest";

import { INQUIRY_STATUSES, canTransition, assertInquiryTransition } from "./state-machine.js";

const allowedTransitions = new Set([
  "new:pending_follow_up", "new:in_progress", "new:closed", "new:spam",
  "pending_follow_up:in_progress", "pending_follow_up:waiting_customer", "pending_follow_up:closed", "pending_follow_up:spam",
  "in_progress:pending_follow_up", "in_progress:waiting_customer", "in_progress:completed", "in_progress:closed", "in_progress:spam",
  "waiting_customer:pending_follow_up", "waiting_customer:in_progress", "waiting_customer:completed", "waiting_customer:spam",
  "completed:in_progress", "completed:closed", "closed:in_progress", "spam:new",
]);

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

  it("defines every state pair explicitly", () => {
    for (const from of INQUIRY_STATUSES) {
      for (const to of INQUIRY_STATUSES) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(
          allowedTransitions.has(`${from}:${to}`),
        );
      }
    }
  });
});
