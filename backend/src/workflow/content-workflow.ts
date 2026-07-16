import type { PermissionKey } from "../auth/permissions.js";
import type { WorkflowState } from "../db/schema/workflow.js";

type TransitionRule = Readonly<{
  from: WorkflowState;
  to: WorkflowState;
  permission: PermissionKey;
}>;

const TRANSITION_RULES: readonly TransitionRule[] = [
  { from: "draft", to: "translation_pending", permission: "content.submit" },
  { from: "draft", to: "review_pending", permission: "content.submit" },
  {
    from: "translation_pending",
    to: "review_pending",
    permission: "content.submit",
  },
  {
    from: "changes_requested",
    to: "translation_pending",
    permission: "content.submit",
  },
  {
    from: "changes_requested",
    to: "review_pending",
    permission: "content.submit",
  },
  {
    from: "review_pending",
    to: "changes_requested",
    permission: "content.review",
  },
  {
    from: "review_pending",
    to: "approved",
    permission: "content.review",
  },
  { from: "draft", to: "scheduled", permission: "content.publish" },
  { from: "draft", to: "published", permission: "content.publish" },
  {
    from: "translation_pending",
    to: "scheduled",
    permission: "content.publish",
  },
  {
    from: "translation_pending",
    to: "published",
    permission: "content.publish",
  },
  {
    from: "changes_requested",
    to: "scheduled",
    permission: "content.publish",
  },
  {
    from: "changes_requested",
    to: "published",
    permission: "content.publish",
  },
  {
    from: "review_pending",
    to: "scheduled",
    permission: "content.publish",
  },
  {
    from: "review_pending",
    to: "published",
    permission: "content.publish",
  },
  { from: "approved", to: "scheduled", permission: "content.publish" },
  { from: "approved", to: "published", permission: "content.publish" },
  { from: "scheduled", to: "approved", permission: "content.publish" },
  { from: "scheduled", to: "published", permission: "content.publish" },
  { from: "published", to: "archived", permission: "content.publish" },
  { from: "archived", to: "draft", permission: "content.publish" },
] as const;

export class ContentVersionConflictError extends Error {
  readonly code = "CONTENT_VERSION_CONFLICT";
  readonly status = 409;

  constructor(
    readonly currentVersion: number,
    readonly expectedVersion: number,
  ) {
    super("内容已被其他人更新，请刷新后重试");
    this.name = "ContentVersionConflictError";
  }
}

export class InvalidWorkflowTransitionError extends Error {
  readonly code = "INVALID_WORKFLOW_TRANSITION";
  readonly status = 409;

  constructor(
    readonly currentState: WorkflowState,
    readonly nextState: WorkflowState,
  ) {
    super("当前内容状态不允许执行此操作");
    this.name = "InvalidWorkflowTransitionError";
  }
}

export function assertVersion(
  currentVersion: number,
  expectedVersion: number,
): void {
  if (currentVersion !== expectedVersion) {
    throw new ContentVersionConflictError(currentVersion, expectedVersion);
  }
}

export function canTransition(
  currentState: WorkflowState,
  nextState: WorkflowState,
  permission: PermissionKey,
): boolean {
  return TRANSITION_RULES.some(
    (rule) =>
      rule.from === currentState &&
      rule.to === nextState &&
      rule.permission === permission,
  );
}

export function transitionWorkflow(input: {
  currentState: WorkflowState;
  nextState: WorkflowState;
  permission: PermissionKey;
  currentVersion: number;
  expectedVersion: number;
}): { state: WorkflowState; version: number } {
  assertVersion(input.currentVersion, input.expectedVersion);
  if (!canTransition(input.currentState, input.nextState, input.permission)) {
    throw new InvalidWorkflowTransitionError(
      input.currentState,
      input.nextState,
    );
  }

  return { state: input.nextState, version: input.currentVersion + 1 };
}
