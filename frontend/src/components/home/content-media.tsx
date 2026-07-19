import type { HomeItem } from "./types";
import { largestSource } from "./types";

type ContentMediaProps = {
  item: HomeItem;
  eager?: boolean;
  className?: string;
};

export function ContentMedia({ item, eager = false, className = "" }: ContentMediaProps) {
  const media = item.media;
  if (!media) return null;
  const fallback = largestSource(media.webpSrcSet) ?? largestSource(media.avifSrcSet);
  if (!fallback) return null;

  return (
    <picture>
      {media.mobileAvif ? (
        <source media="(max-width: 767px)" srcSet={media.mobileAvif} type="image/avif" />
      ) : null}
      {media.mobileWebp ? (
        <source media="(max-width: 767px)" srcSet={media.mobileWebp} type="image/webp" />
      ) : null}
      <source sizes="(max-width: 767px) 100vw, 50vw" srcSet={media.avifSrcSet} type="image/avif" />
      <source sizes="(max-width: 767px) 100vw, 50vw" srcSet={media.webpSrcSet} type="image/webp" />
      <img
        alt={media.alt || item.altText}
        className={className}
        decoding="async"
        height={media.height}
        loading={eager ? "eager" : "lazy"}
        src={fallback}
        style={{ backgroundColor: media.dominantColor }}
        width={media.width}
      />
    </picture>
  );
}
