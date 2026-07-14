import type { ComponentPropsWithoutRef } from "react";

import { RouteApexMark } from "./route-apex-mark";

export type AnShowLogoProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "children"
> & {
  compact?: boolean;
  markClassName?: string;
};

export function AnShowLogo({
  className,
  compact = false,
  markClassName,
  ...props
}: AnShowLogoProps) {
  const rootClassName = [
    "inline-flex min-w-0 items-center text-current",
    compact ? undefined : "gap-3",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const markClasses = ["h-9 w-9 shrink-0", markClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      {...props}
      aria-label={compact ? "AnShow" : props["aria-label"]}
      className={rootClassName}
      role={compact ? "img" : props.role}
    >
      <RouteApexMark className={markClasses} />
      {!compact && (
        <span className="font-display whitespace-nowrap text-xl font-semibold leading-none">
          AnShow
        </span>
      )}
    </span>
  );
}
