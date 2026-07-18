import Link from "next/link";

import type { components } from "../../generated/api";

type StructuredBody = NonNullable<
  components["schemas"]["PublicContentItem"]["structuredBody"]
>;
type ContentSection = StructuredBody["sections"][number];

function assertNever(value: never): never {
  throw new Error(`Unsupported structured content section: ${JSON.stringify(value)}`);
}

export function StructuredContent({
  body,
  quoteHref,
  structuredBody,
}: {
  body: string;
  quoteHref: string;
  structuredBody: components["schemas"]["PublicContentItem"]["structuredBody"];
}) {
  if (!structuredBody?.sections.length) {
    return <p>{body}</p>;
  }

  return (
    <div className="space-y-10">
      {structuredBody.sections.map((section, sectionIndex) => (
        <Section
          key={`section-${sectionIndex}`}
          quoteHref={quoteHref}
          section={section}
          sectionIndex={sectionIndex}
        />
      ))}
    </div>
  );
}

function Section({
  quoteHref,
  section,
  sectionIndex,
}: {
  quoteHref: string;
  section: ContentSection;
  sectionIndex: number;
}) {
  switch (section.type) {
    case "paragraph":
      return <p>{section.text}</p>;
    case "fact-list":
      return (
        <dl className="grid gap-x-8 gap-y-5 border-y border-black/10 py-6 sm:grid-cols-2">
          {section.items.map((item) => (
            <div key={`fact-${sectionIndex}-${item.key}`}>
              <dt className="text-sm font-semibold text-black/65">{item.label}</dt>
              <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xl font-semibold text-black">
                <span className="tabular-nums">{item.value}</span>
                {item.unit ? <span className="text-base font-normal text-black/65">{item.unit}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      );
    case "process":
      return (
        <ol className="space-y-7 border-l border-[var(--color-teal)] pl-6">
          {section.steps.map((step, stepIndex) => (
            <li key={`process-${sectionIndex}-${stepIndex}`} className="pl-1">
              <h2 className="text-xl font-semibold leading-snug text-black">{step.title}</h2>
              <p className="mt-2">{step.text}</p>
            </li>
          ))}
        </ol>
      );
    case "bullet-list":
      return (
        <section>
          {section.title ? <h2 className="text-xl font-semibold leading-snug text-black">{section.title}</h2> : null}
          <ul className={`${section.title ? "mt-3" : ""} list-disc space-y-2 pl-5 marker:text-[var(--color-teal-ink)]`}>
            {section.items.map((item, itemIndex) => (
              <li key={`bullet-${sectionIndex}-${itemIndex}`}>{item}</li>
            ))}
          </ul>
        </section>
      );
    case "callout":
      return (
        <aside className="border-y border-[var(--color-teal)] py-5">
          <strong className="block text-lg text-black">{section.title}</strong>
          <p className="mt-2">{section.text}</p>
        </aside>
      );
    case "quote-cta":
      return (
        <aside className="bg-[var(--color-teal)] text-[var(--color-carbon)]">
          <Link className="block px-6 py-7 transition-colors hover:bg-[var(--color-action)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--color-carbon)]" href={quoteHref}>
            <strong className="block text-xl">{section.title}</strong>
            <span className="mt-2 block">{section.text}</span>
          </Link>
        </aside>
      );
    default:
      return assertNever(section);
  }
}
