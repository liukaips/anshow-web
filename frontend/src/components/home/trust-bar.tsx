import type { HomeItem } from "./types";

type TrustBarLabels = {
  basic: string;
  verified: string;
};

type Fact = {
  key: string;
  label: string;
  unit?: string;
  value: string;
};

function proofFacts(items: readonly HomeItem[]): Fact[] {
  return items.flatMap(
    (item) =>
      item.structuredBody?.sections.flatMap((section) =>
        section.type === "fact-list" ? section.items : [],
      ) ?? [],
  );
}

export function TrustBar({
  certificates,
  labels,
  proof,
  title,
  verifiedTrust,
}: {
  certificates: readonly HomeItem[];
  labels: TrustBarLabels;
  proof: readonly HomeItem[];
  title: string;
  verifiedTrust: readonly HomeItem[];
}) {
  const facts = proofFacts(proof);
  if (!facts.length && !certificates.length) return null;
  const verifiedIds = new Set(verifiedTrust.map((item) => item.id));

  return (
    <section aria-label={title} className="border-y border-black/10 bg-white px-5 sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-7xl lg:grid-cols-[minmax(10rem,0.75fr)_minmax(0,3fr)]">
        <div className="border-b border-black/10 py-7 lg:border-b-0 lg:border-r lg:pr-8">
          <h2 className="text-sm font-semibold uppercase text-[var(--color-teal-ink)]">{title}</h2>
          {facts.length ? (
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
              {facts.map((fact, index) => (
                <div key={`${fact.key}-${index}`}>
                  <dt className="text-xs text-black/55">{fact.label}</dt>
                  <dd className="mt-1 flex items-baseline gap-1.5 font-mono text-3xl font-semibold tabular-nums text-[var(--color-text)]">
                    {fact.value}
                    {fact.unit ? <span className="text-sm font-normal text-black/55">{fact.unit}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {certificates.length ? (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4">
            {certificates.map((certificate) => {
              const verified = verifiedIds.has(certificate.id);
              const status = verified ? labels.verified : labels.basic;
              return (
                <li
                  aria-label={`${certificate.title} ${status}`}
                  className="border-b border-black/10 py-6 sm:px-6 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"
                  key={certificate.id}
                >
                  <p className="font-mono text-lg font-semibold text-[var(--color-text)]">{certificate.title}</p>
                  <p className="mt-2 text-xs font-semibold uppercase text-[var(--color-teal-ink)]">{status}</p>
                  <p className="mt-3 text-sm leading-6 text-black/60">{certificate.summary}</p>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
