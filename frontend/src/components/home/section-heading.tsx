type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  inverse?: boolean;
};

export function SectionHeading({ eyebrow, title, inverse = false }: SectionHeadingProps) {
  return (
    <header className="max-w-3xl">
      <p
        className={`font-mono text-xs uppercase ${
          inverse ? "text-[var(--color-cyan)]" : "text-[var(--color-cyan-ink)]"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-4 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl ${
          inverse ? "text-[var(--color-text-inverse)]" : "text-[var(--color-text)]"
        }`}
      >
        {title}
      </h2>
    </header>
  );
}
