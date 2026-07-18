import type { HomeItem } from "./types";

const gridColumns = [
  "",
  "md:grid-cols-1 xl:grid-cols-1",
  "md:grid-cols-2 xl:grid-cols-2",
  "md:grid-cols-2 xl:grid-cols-3",
  "md:grid-cols-2 xl:grid-cols-4",
] as const;

export function ServiceCommitments({
  eyebrow,
  items,
  title,
}: {
  eyebrow: string;
  items: readonly HomeItem[];
  title: string;
}) {
  const commitments = items.slice(0, 4);
  if (!commitments.length) return null;

  return (
    <section className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
      <div className="mx-auto w-full max-w-7xl">
        <header className="max-w-3xl">
          <p className="font-mono text-xs uppercase text-[var(--color-cyan-ink)]">{eyebrow}</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-[var(--color-text)] sm:text-4xl">{title}</h2>
        </header>
        <ul className={`mt-10 grid border-y border-black/10 ${gridColumns[commitments.length]}`}>
          {commitments.map((item, index) => (
            <li className="border-b border-black/10 py-7 md:px-7 md:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:first:pl-0 xl:last:border-r-0 xl:last:pr-0" key={item.id}>
              <p className="font-mono text-xs tabular-nums text-[var(--color-teal-ink)]">0{index + 1}</p>
              <h3 className="mt-4 text-xl font-semibold leading-snug text-[var(--color-text)]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-black/65">{item.summary}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
