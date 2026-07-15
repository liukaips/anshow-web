"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";

import { useMotionProfile } from "./use-motion-profile";

export function RouteScene({
  destinationLabel,
  label,
  originLabel,
}: {
  destinationLabel: string;
  label: string;
  originLabel: string;
}) {
  const profile = useMotionProfile();
  const [Scene, setScene] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (profile !== "rich") return;
    let active = true;
    void import("./route-scene.client").then((module) => {
      if (active) setScene(() => module.RouteSceneClient);
    });
    return () => {
      active = false;
    };
  }, [profile]);

  return (
    <section
      aria-label={label}
      className="relative isolate min-h-72 overflow-hidden bg-[var(--color-dark-surface)] text-[var(--color-text-inverse)] sm:min-h-[26rem]"
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-[var(--color-cyan)]/20" />
      <div className="absolute inset-x-0 top-6 z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 font-mono text-[0.65rem] uppercase text-[var(--color-cyan)] sm:px-8 lg:px-12">
        <span>{originLabel}</span>
        <span>{destinationLabel}</span>
      </div>
      {profile === "rich" && Scene ? (
        <Scene />
      ) : (
        <div className="absolute inset-x-[8%] top-1/2 h-28 -translate-y-1/2" data-route-static>
          <span className="absolute left-0 top-1/2 size-3 -translate-y-1/2 bg-[var(--color-action)]" />
          <span className="absolute left-2 right-2 top-1/2 block h-px -translate-y-1/2 bg-[var(--color-cyan)]" />
          <span className="absolute right-0 top-1/2 size-3 -translate-y-1/2 bg-[var(--color-teal)]" />
          <span className="absolute left-1/4 top-1/2 size-2 -translate-y-1/2 bg-white" />
          <span className="absolute left-1/2 top-1/2 size-2 -translate-y-1/2 bg-white" />
          <span className="absolute left-3/4 top-1/2 size-2 -translate-y-1/2 bg-white" />
        </div>
      )}
    </section>
  );
}
