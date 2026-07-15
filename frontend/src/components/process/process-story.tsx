import { getTranslations } from "next-intl/server";

import type { SupportedLocale } from "@/lib/app-config";

import { MobileProcess } from "./mobile-process";
import { processStageIds, type ProcessStage, type ProcessStageId } from "./process-data";
import { ProcessStoryClient } from "./process-story.client";

type ProcessStoryProps = {
  locale: SupportedLocale;
  heading?: string;
  stageLabel?: string;
  stageIds?: readonly ProcessStageId[];
  compact?: boolean;
  motion?: "reduced";
};

export async function ProcessStory({
  locale,
  heading,
  stageLabel,
  stageIds = processStageIds,
  compact = false,
  motion,
}: ProcessStoryProps) {
  const translate = await getTranslations({ locale, namespace: "Process" });
  const stages: ProcessStage[] = stageIds.map((id) => ({
    id,
    phases: translate.raw(`${id}.phases`) as [string, string, string],
    title: translate(`${id}.title`),
  }));

  return (
    <section
      className={
        compact
          ? "bg-[var(--color-surface)] py-8"
          : "bg-[var(--color-carbon)] px-5 py-20 text-[var(--color-text-inverse)] sm:px-8 lg:px-12 lg:py-28"
      }
    >
      <div className={compact ? "w-full" : "mx-auto w-full max-w-7xl"}>
        {heading ? (
          <header className="max-w-3xl">
            <p className="font-mono text-xs uppercase text-[var(--color-cyan)]">ANSHOW / 00</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">{heading}</h2>
          </header>
        ) : null}
        {motion === "reduced" || compact ? (
          <MobileProcess
            complete={motion === "reduced"}
            inverse={!compact}
            stageLabel={stageLabel}
            stages={stages}
          />
        ) : (
          <ProcessStoryClient stageLabel={stageLabel} stages={stages} />
        )}
      </div>
    </section>
  );
}
