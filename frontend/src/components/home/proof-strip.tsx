"use client";

import { useEffect, useRef } from "react";

import type { HomeItem } from "./types";

export function ProofStrip({ label, items }: { label: string; items: readonly HomeItem[] }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.querySelectorAll<HTMLElement>("[data-proof-item]").forEach((item) => {
          item.dataset.visible = "true";
        });
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!items.length) return null;

  return (
    <section aria-label={label} className="border-y border-black/10 bg-white" ref={root}>
      <div className="mx-auto grid w-full max-w-7xl sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <article
            className="translate-y-0 border-b border-black/10 px-5 py-8 transition-transform duration-500 motion-safe:translate-y-3 data-[visible=true]:translate-y-0 sm:border-r sm:px-8"
            data-proof-item
            key={item.id}
          >
            <p className="text-2xl font-semibold text-[var(--color-text)]">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-black/60">{item.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
