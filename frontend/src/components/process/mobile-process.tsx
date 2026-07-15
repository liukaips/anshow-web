"use client";

import { useEffect, useRef } from "react";

import type { ProcessStage } from "./process-data";

function stageNumber(index: number, label?: string) {
  const number = String(index + 1).padStart(2, "0");
  return label ? `${label} / ${number}` : number;
}

export function MobileProcess({
  complete = false,
  inverse = false,
  stageLabel,
  stages,
}: {
  complete?: boolean;
  inverse?: boolean;
  stageLabel?: string;
  stages: readonly ProcessStage[];
}) {
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (complete) return;

    const steps = list.current?.querySelectorAll<HTMLElement>("[data-process-step]");
    if (!steps?.length) return;
    if (!("IntersectionObserver" in window)) {
      steps.forEach((step) => {
        step.dataset.revealed = "true";
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = (entry.target as HTMLElement).dataset.stage;
          if (id) {
            (entry.target as HTMLElement).dataset.revealed = "true";
          }
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12%", threshold: 0.15 },
    );
    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, [complete]);

  return (
    <ol
      className={`mt-10 border-y ${inverse ? "border-white/15" : "border-black/10"}`}
      data-process-complete={complete || undefined}
      ref={list}
    >
      {stages.map((stage, index) => (
        <li
          className={`grid translate-y-4 gap-4 border-b py-7 transition-transform duration-500 last:border-b-0 data-[revealed=true]:translate-y-0 sm:grid-cols-[7rem_1fr] ${
            inverse ? "border-white/15" : "border-black/10"
          }`}
          data-process-step
          data-revealed={complete}
          data-stage={stage.id}
          key={stage.id}
        >
          <span
            className={`font-mono text-xs ${
              inverse ? "text-[var(--color-cyan)]" : "text-[var(--color-teal-ink)]"
            }`}
          >
            {stageNumber(index, stageLabel)}
          </span>
          <div>
            <h3 className="text-xl font-semibold">{stage.title}</h3>
            <div
              className={`mt-4 grid gap-3 text-base sm:grid-cols-3 ${
                inverse ? "text-[var(--color-muted-inverse)]" : "text-black/65"
              }`}
            >
              {stage.phases.map((phase) => (
                <p
                  className={`border-l pl-3 text-base leading-7 ${
                    inverse ? "border-white/20" : "border-black/15"
                  }`}
                  key={phase}
                >
                  {phase}
                </p>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
