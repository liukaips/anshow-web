import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const translate = await getTranslations("Home");

  return (
    <main className="flex min-h-screen items-center px-6 py-24 sm:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-sm font-semibold uppercase text-foreground/60">
          {translate("eyebrow")}
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">
          {translate("title")}
        </h1>
        <a
          className="mt-9 inline-flex min-h-12 items-center border border-foreground px-6 text-sm font-semibold transition-colors hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4"
          href="#contact"
        >
          {translate("cta")}
        </a>
      </div>
    </main>
  );
}
