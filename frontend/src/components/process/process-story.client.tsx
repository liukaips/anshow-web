"use client";

import { useEffect, useRef } from "react";

import { useMotionProfile } from "../motion/use-motion-profile";

import { MobileProcess } from "./mobile-process";
import type { ProcessStage } from "./process-data";
import { ProcessMicroScene } from "./process-micro-scene";

type ProcessStoryClientProps = {
  stageLabel?: string;
  stages: readonly ProcessStage[];
};

export function ProcessStoryClient({ stageLabel, stages }: ProcessStoryClientProps) {
  const root = useRef<HTMLDivElement>(null);
  const profile = useMotionProfile();

  useEffect(() => {
    if (profile !== "rich") return;
    let cancelled = false;
    let revert: () => void = () => undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, triggerModule]) => {
        if (cancelled || !root.current) return;
        const { gsap } = gsapModule;
        const { ScrollTrigger } = triggerModule;
        gsap.registerPlugin(ScrollTrigger);
        const context = gsap.context(() => {
          const timeline = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              end: "bottom 32%",
              scrub: 0.55,
              start: "top 70%",
              trigger: root.current,
            },
          });

          timeline.fromTo(
            "[data-route-fill]",
            { scaleY: 0 },
            { duration: 0.5, scaleY: 1, transformOrigin: "top" },
          );

          root.current?.querySelectorAll<HTMLElement>("[data-process-step]").forEach((step) => {
            const checkpoint = step.querySelector("[data-process-checkpoint]");
            const copy = step.querySelector("[data-process-copy]");
            const phases = step.querySelectorAll("[data-micro-phase]");

            timeline.fromTo(
              checkpoint,
              { scale: 0.55 },
              { duration: 0.08, scale: 1.15 },
            );
            timeline.to(checkpoint, { duration: 0.06, scale: 1 });
            timeline.fromTo(copy, { x: -20 }, { duration: 0.14, x: 0 });
            phases.forEach((phase) => {
              timeline.fromTo(phase, { y: 18 }, { duration: 0.1, y: 0 });
            });
            timeline.fromTo(
              step.querySelectorAll("[data-micro-line]"),
              { scaleX: 0 },
              { duration: 0.12, scaleX: 1, transformOrigin: "left" },
            );

            const stage = step.dataset.stage;
            if (stage === "route") {
              timeline.fromTo(
                step.querySelectorAll('[data-scene-part="route-node"] [data-scene-symbol]'),
                { scale: 0.4 },
                { duration: 0.08, scale: 1 },
              );
            }
            if (stage === "pickup") {
              timeline.fromTo(
                step.querySelectorAll('[data-scene-part="cargo-unit"] [data-scene-symbol]'),
                { x: -16 },
                { duration: 0.1, x: 0 },
              );
            }
            if (stage === "customs") {
              timeline.fromTo(
                step.querySelector('[data-scene-part="scan-line"] [data-scene-symbol]'),
                { y: -12 },
                { duration: 0.12, y: 12 },
              );
            }
            if (stage === "transit") {
              step.querySelectorAll<HTMLElement>("[data-transit-mode]").forEach((mode) => {
                timeline.fromTo(
                  mode,
                  { opacity: 0.15, scale: 0.75 },
                  { duration: 0.08, opacity: 1, scale: 1 },
                );
                timeline.to(mode, { duration: 0.05, opacity: 0.35, scale: 0.9 });
              });
            }
            if (stage === "delivery") {
              timeline.fromTo(
                step.querySelectorAll('[data-scene-part="milestone"] [data-scene-symbol], [data-scene-part="route-close"] [data-scene-symbol]'),
                { rotate: -12, scale: 0.5 },
                { duration: 0.12, rotate: 0, scale: 1 },
              );
            }
          });
        }, root);
        revert = () => context.revert();
      },
    );

    return () => {
      cancelled = true;
      revert();
    };
  }, [profile]);

  if (profile !== "rich") {
    return (
      <MobileProcess
        complete={profile === "none"}
        inverse
        stageLabel={stageLabel}
        stages={stages}
      />
    );
  }

  return (
    <div className="relative mt-12" ref={root}>
      <div aria-hidden="true" className="absolute bottom-0 left-4 top-0 w-px bg-white/15">
        <span
          className="block h-full w-px origin-top bg-[var(--color-cyan)]"
          data-route-fill
        />
      </div>
      <div className="space-y-5 pl-12">
        {stages.map((stage, index) => (
          <section
            className="relative grid min-h-72 gap-7 border-y border-white/15 py-8 lg:grid-cols-[minmax(0,0.55fr)_minmax(28rem,1fr)] lg:items-center"
            data-process-step
            data-stage={stage.id}
            key={stage.id}
          >
            <span
              aria-hidden="true"
              className="absolute -left-[2.55rem] top-10 grid size-8 place-items-center bg-[var(--color-cyan)] font-mono text-xs text-[var(--color-carbon)]"
              data-process-checkpoint
            >
              {index + 1}
            </span>
            <div data-process-copy>
              <p className="font-mono text-xs text-[var(--color-cyan)]">
                {stageLabel ? `${stageLabel} / ` : ""}0{index + 1}
              </p>
              <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">{stage.title}</h3>
            </div>
            <ProcessMicroScene stage={stage} />
          </section>
        ))}
      </div>
    </div>
  );
}
