import type { HTMLAttributes } from "react";

type AdminToolbarProps = HTMLAttributes<HTMLElement>;

export function AdminToolbar({ className = "", ...props }: AdminToolbarProps) {
  return (
    <section
      className={`flex min-w-0 flex-col gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-end sm:justify-between ${className}`}
      {...props}
    />
  );
}
