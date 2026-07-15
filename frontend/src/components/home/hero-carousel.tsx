"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export type HeroSlide = {
  id: string;
  title: string;
  summary: string;
  alt: string;
  fallback?: string;
  mobileAvif?: string | null;
  avifSrcSet?: string;
  webpSrcSet?: string;
};

export type HeroCarouselLabels = {
  previous: string;
  next: string;
  pause: string;
  play: string;
  goTo: string;
};

type HeroCarouselProps = {
  eyebrow: string;
  headline: string;
  labels: HeroCarouselLabels;
  quoteHref: string;
  quoteLabel: string;
  slides: readonly HeroSlide[];
};

export function HeroCarousel({
  eyebrow,
  headline,
  labels,
  quoteHref,
  quoteLabel,
  slides,
}: HeroCarouselProps) {
  const [viewportRef, embla] = useEmblaCarousel({ loop: slides.length > 1 });
  const [selected, setSelected] = useState(0);
  const [manualPaused, setManualPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [visibilityPaused, setVisibilityPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const select = useCallback(() => {
    if (embla) setSelected(embla.selectedScrollSnap());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    embla.on("select", select);
    embla.on("reInit", select);
    return () => {
      embla.off("select", select);
      embla.off("reInit", select);
    };
  }, [embla, select]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    const frame = window.requestAnimationFrame(update);
    media.addEventListener("change", update);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", update);
    };
  }, []);

  const playing =
    !manualPaused && !interactionPaused && !visibilityPaused && !reducedMotion;

  useEffect(() => {
    if (
      !embla ||
      slides.length < 2 ||
      !playing
    ) {
      return;
    }

    const timer = window.setInterval(() => embla.scrollNext(), 6500);
    return () => {
      window.clearInterval(timer);
    };
  }, [embla, playing, slides.length]);

  useEffect(() => {
    const update = () => setVisibilityPaused(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const hasCarousel = slides.length > 0;

  return (
    <section
      aria-roledescription={hasCarousel ? "carousel" : undefined}
      className="relative isolate min-h-[clamp(42rem,88svh,58rem)] overflow-hidden bg-[var(--color-carbon)] text-[var(--color-text-inverse)]"
      data-autoplay-active={playing}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false);
      }}
      onFocusCapture={() => setInteractionPaused(true)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") embla?.scrollPrev();
        if (event.key === "ArrowRight") embla?.scrollNext();
      }}
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
    >
      {hasCarousel ? (
        <div className="absolute inset-0" ref={viewportRef}>
          <div className="flex h-full touch-pan-y">
            {slides.map((slide, index) => (
              <article
                aria-hidden={selected !== index}
                className={`relative min-w-0 flex-[0_0_100%] overflow-hidden transition-opacity duration-700 ${
                  selected === index ? "opacity-100" : "opacity-70"
                }`}
                key={slide.id}
              >
                {slide.fallback ? (
                  <picture>
                    {slide.mobileAvif ? (
                      <source
                        media="(max-width: 767px)"
                        srcSet={slide.mobileAvif}
                        type="image/avif"
                      />
                    ) : null}
                    {slide.avifSrcSet ? (
                      <source
                        sizes="100vw"
                        srcSet={slide.avifSrcSet}
                        type="image/avif"
                      />
                    ) : null}
                    {slide.webpSrcSet ? (
                      <source
                        sizes="100vw"
                        srcSet={slide.webpSrcSet}
                        type="image/webp"
                      />
                    ) : null}
                    <img
                      alt={slide.alt}
                      className={`absolute inset-0 size-full object-cover object-center transition-transform duration-[1600ms] ease-out motion-reduce:transform-none ${
                        selected === index
                          ? "scale-[1.02] -translate-x-[0.5%]"
                          : "scale-[1.06] translate-x-0"
                      }`}
                      decoding="async"
                      fetchPriority={index === 0 ? "high" : "auto"}
                      height={1080}
                      loading={index === 0 ? "eager" : "lazy"}
                      src={slide.fallback}
                      width={1920}
                    />
                  </picture>
                ) : (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[var(--color-dark-surface)]"
                    data-hero-media-fallback
                  />
                )}
                <div className="absolute inset-0 bg-black/45" />
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                  <span className="hero-scanline motion-reduce:hidden" />
                  <div className="absolute right-8 top-28 hidden h-28 w-64 border border-white/20 bg-black/10 backdrop-blur-[2px] lg:block">
                    <span className="hero-route-line" />
                    <span className="hero-route-node left-[12%] top-[63%]" />
                    <span className="hero-route-node left-[47%] top-[42%] [animation-delay:400ms]" />
                    <span className="hero-route-node left-[82%] top-[19%] [animation-delay:800ms]" />
                    <span className="absolute inset-x-3 bottom-3 border-t border-dashed border-white/20" />
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-24 mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
                  <div className="ml-auto max-w-lg overflow-hidden border-l border-white/35 pl-5 sm:pl-7">
                    <div
                      className={`transition-[transform,opacity] duration-700 motion-reduce:transform-none ${
                        selected === index
                          ? "translate-y-0 opacity-100"
                          : "translate-y-5 opacity-0"
                      }`}
                    >
                    <p className="font-mono text-[0.7rem] uppercase text-[var(--color-cyan)]">
                      0{index + 1} / 0{slides.length}
                    </p>
                    <h2 className="mt-3 text-xl font-semibold sm:text-2xl">{slide.title}</h2>
                    <p className="mt-3 max-w-md text-base leading-7 text-[var(--color-muted-inverse)]">
                      {slide.summary}
                    </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[var(--color-dark-surface)]" />
      )}

      <div className="pointer-events-none relative z-10 mx-auto flex min-h-[clamp(42rem,88svh,58rem)] w-full max-w-7xl flex-col justify-center px-5 pb-48 pt-28 sm:px-8 lg:px-12">
        <div className="max-w-4xl">
          <p className="font-mono text-xs uppercase text-[var(--color-cyan)]">{eyebrow}</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">
            {headline}
          </h1>
          <Link
            className="pointer-events-auto mt-9 inline-flex min-h-12 items-center gap-3 bg-[var(--color-action)] px-5 font-semibold text-[var(--color-carbon)] transition-colors hover:bg-orange-500"
            href={quoteHref}
          >
            {quoteLabel}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/15 bg-black/55">
          <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center gap-3 px-5 sm:px-8 lg:px-12">
            <button
              aria-label={labels.previous}
              className="grid size-11 shrink-0 place-items-center border border-white/25 transition-colors hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
              onClick={() => embla?.scrollPrev()}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              aria-label={manualPaused ? labels.play : labels.pause}
              aria-pressed={manualPaused}
              className="grid size-11 shrink-0 place-items-center border border-white/25 transition-colors hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
              onClick={() => setManualPaused((value) => !value)}
              type="button"
            >
              {manualPaused ? (
                <Play aria-hidden="true" className="size-4" />
              ) : (
                <Pause aria-hidden="true" className="size-4" />
              )}
            </button>
            <button
              aria-label={labels.next}
              className="grid size-11 shrink-0 place-items-center border border-white/25 transition-colors hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
              onClick={() => embla?.scrollNext()}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
            <div className="ml-auto flex items-center gap-2" role="group">
              {slides.map((slide, index) => (
                <button
                  aria-current={selected === index ? "true" : undefined}
                  aria-label={`${labels.goTo} ${index + 1}`}
                  className="group grid size-11 place-items-center"
                  key={slide.id}
                  onClick={() => embla?.scrollTo(index)}
                  type="button"
                >
                  <span
                    className={`block h-0.5 transition-[width,background-color] ${
                      selected === index
                        ? "w-8 bg-[var(--color-cyan)]"
                        : "w-4 bg-white/45 group-hover:bg-white"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div aria-hidden="true" className="h-0.5 bg-white/15">
            <span
              className="block h-full origin-left bg-[var(--color-cyan)] transition-transform duration-[var(--motion-standard)]"
              style={{ transform: `scaleX(${(selected + 1) / slides.length})` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
