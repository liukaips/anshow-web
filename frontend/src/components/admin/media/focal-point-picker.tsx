import Image from "next/image";
import { useCallback } from "react";

type Point = { x: number; y: number };

type FocalPointPickerProps = {
  src: string;
  value: Point;
  onChange: (value: Point) => void;
};

const clamp = (value: number) => Math.min(1, Math.max(0, Number(value.toFixed(2))));

export function FocalPointPicker({ src, value, onChange }: FocalPointPickerProps) {
  const updateFromPointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    onChange({
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    });
  }, [onChange]);

  function updateFromKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.05 : 0.01;
    const next = { ...value };
    if (event.key === "ArrowLeft") next.x -= step;
    else if (event.key === "ArrowRight") next.x += step;
    else if (event.key === "ArrowUp") next.y -= step;
    else if (event.key === "ArrowDown") next.y += step;
    else return;
    event.preventDefault();
    onChange({ x: clamp(next.x), y: clamp(next.y) });
  }

  return (
    <div>
      <div
        aria-label="图片焦点"
        aria-valuemax={1}
        aria-valuemin={0}
        aria-valuenow={value.x}
        className="relative aspect-[16/9] min-h-44 overflow-hidden rounded-[var(--radius-card)] bg-neutral-100 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan-ink)]"
        onKeyDown={updateFromKey}
        onPointerDown={updateFromPointer}
        role="slider"
        tabIndex={0}
      >
        <Image alt="" className="object-cover" fill sizes="(max-width: 768px) 100vw, 560px" src={src} unoptimized />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--color-action)]/80 shadow-lg ring-2 ring-black/20"
          style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600">点击图片或使用方向键选择主体焦点。</p>
    </div>
  );
}
