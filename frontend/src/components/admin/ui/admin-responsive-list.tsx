import type { ReactNode } from "react";

type AdminResponsiveListProps<Item> = Readonly<{
  "aria-label": string;
  className?: string;
  getItemKey: (item: Item) => string;
  items: readonly Item[];
  renderItem: (item: Item) => ReactNode;
}>;

export function AdminResponsiveList<Item>({
  "aria-label": ariaLabel,
  className = "",
  getItemKey,
  items,
  renderItem,
}: AdminResponsiveListProps<Item>) {
  return (
    <ul aria-label={ariaLabel} className={`divide-y divide-neutral-200 ${className}`}>
      {items.map((item) => (
        <li className="min-w-0 bg-white px-4 py-4" key={getItemKey(item)}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
