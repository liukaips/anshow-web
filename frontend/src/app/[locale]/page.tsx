import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { getPublicHome } from "@/api/public-content.server";
import { HomepageContent } from "@/components/home/homepage-content";
import { getHomepageLabels } from "@/components/home/homepage-content.server";
import { ProcessStory } from "@/components/process/process-story";
import { isLocale } from "@/i18n/routing";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const [content, labels] = await Promise.all([
    getPublicHome(locale),
    getHomepageLabels(locale),
  ]);

  return (
    <HomepageContent
      content={content}
      labels={labels}
      locale={locale}
      processStory={
        <ProcessStory heading={labels.process} locale={locale} stageLabel={labels.stage} />
      }
    />
  );
}
