import { describe, expect, it } from "vitest";

import {
  ContentVersionConflictError,
  assertVersion,
  canTransition,
  transitionWorkflow,
} from "./content-workflow.js";

describe("content workflow", () => {
  it("allows editors to submit complete drafts for review", () => {
    expect(canTransition("draft", "review_pending", "content.submit")).toBe(true);
    expect(
      canTransition("translation_pending", "review_pending", "content.submit"),
    ).toBe(true);
  });

  it("allows reviewers to approve or request changes", () => {
    expect(
      canTransition("review_pending", "approved", "content.review"),
    ).toBe(true);
    expect(
      canTransition("review_pending", "changes_requested", "content.review"),
    ).toBe(true);
  });

  it("prevents bypassing review with a write permission", () => {
    expect(canTransition("draft", "published", "content.write")).toBe(false);
    expect(canTransition("review_pending", "approved", "content.write")).toBe(
      false,
    );
  });

  it("allows a direct-publish role to bypass review explicitly", () => {
    expect(canTransition("draft", "published", "content.publish")).toBe(true);
    expect(canTransition("draft", "scheduled", "content.publish")).toBe(true);
  });

  it("reports stale writes as a Chinese HTTP 409 domain error", () => {
    expect(() => assertVersion(4, 3)).toThrowError(
      "内容已被其他人更新，请刷新后重试",
    );

    try {
      assertVersion(4, 3);
    } catch (error) {
      expect(error).toBeInstanceOf(ContentVersionConflictError);
      expect(error).toMatchObject({
        code: "CONTENT_VERSION_CONFLICT",
        status: 409,
        currentVersion: 4,
        expectedVersion: 3,
      });
    }
  });

  it("increments the version for a successful transition", () => {
    expect(
      transitionWorkflow({
        currentState: "review_pending",
        nextState: "approved",
        permission: "content.review",
        currentVersion: 7,
        expectedVersion: 7,
      }),
    ).toEqual({ state: "approved", version: 8 });
  });

  it("rejects invalid transitions without changing the version", () => {
    expect(() =>
      transitionWorkflow({
        currentState: "published",
        nextState: "draft",
        permission: "content.publish",
        currentVersion: 2,
        expectedVersion: 2,
      }),
    ).toThrowError("当前内容状态不允许执行此操作");
  });
});
