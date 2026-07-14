import type { ComponentPropsWithoutRef } from "react";

export type RouteApexMarkProps = Omit<
  ComponentPropsWithoutRef<"svg">,
  "children"
>;

export function RouteApexMark(props: RouteApexMarkProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      data-testid="route-apex-mark"
      focusable="false"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M7 54 27 10h10l20 44H46L32 23 18 54H7Z" fill="currentColor" />
      <path
        d="M21 42h22l-5-9H26l-5 9Z"
        fill="var(--color-cyan, #38bdf8)"
      />
      <circle cx="49" cy="16" r="6" fill="var(--color-action, #f97316)" />
    </svg>
  );
}
