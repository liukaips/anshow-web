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
        <p className="mt-9 text-base font-semibold">
          {translate("cta")}
        </p>
      </div>
    </main>
  );
}
