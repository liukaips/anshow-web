import {
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  Files,
  Flag,
  Handshake,
  MapPin,
  PackageCheck,
  Plane,
  Route,
  ScanLine,
  Ship,
  Train,
  Truck,
  Warehouse,
} from "lucide-react";

import type { ProcessStage } from "./process-data";

const visuals = {
  route: [MapPin, Route, BadgeCheck],
  pickup: [Boxes, Warehouse, ClipboardCheck],
  customs: [Files, ScanLine, BadgeCheck],
  transit: [PackageCheck, Ship, Route],
  delivery: [Flag, Handshake, BadgeCheck],
} as const;

const transitModes = [
  ["ocean", Ship],
  ["air", Plane],
  ["rail", Train],
  ["road", Truck],
] as const;

const scenePart = {
  route: ["route-node", "route-leg", "route-node"],
  pickup: ["cargo-unit", "cargo-unit", "intake-check"],
  customs: ["document", "scan-line", "clearance"],
  transit: ["transit-track", "transit-modes", "transit-track"],
  delivery: ["milestone", "handoff", "route-close"],
} as const;

export function ProcessMicroScene({ stage }: { stage: ProcessStage }) {
  return (
    <div
      aria-label={stage.title}
      className="mt-6 grid grid-cols-1 gap-px bg-white/15 sm:grid-cols-3"
      data-micro-scene={stage.id}
    >
      {stage.phases.map((phase, index) => {
        const Icon = visuals[stage.id][index];
        return (
          <div
            className="min-h-44 bg-[var(--color-dark-surface)] p-4"
            data-micro-phase
            data-scene-part={scenePart[stage.id][index]}
            key={phase}
          >
            <span className="font-mono text-[0.65rem] text-[var(--color-cyan)]">0{index + 1}</span>
            <div
              aria-hidden="true"
              className="my-4 flex h-12 items-center gap-3 overflow-hidden border-y border-white/10 px-2 text-[var(--color-teal)]"
              data-scene-visual
            >
              <Icon className="size-6 shrink-0" data-scene-symbol />
              <span className="h-px flex-1 origin-left bg-[var(--color-cyan)]" data-micro-line />
              {stage.id === "transit" && index === 1 ? (
                <span className="grid flex-1 grid-cols-4 gap-1">
                  {transitModes.map(([mode, ModeIcon]) => (
                    <ModeIcon
                      className="size-5"
                      data-transit-mode={mode}
                      key={mode}
                    />
                  ))}
                </span>
              ) : null}
            </div>
            <span className="block text-base leading-6 text-[var(--color-muted-inverse)]">{phase}</span>
            <span aria-hidden="true" className="mt-4 block h-px origin-left bg-[var(--color-cyan)]" data-micro-line />
          </div>
        );
      })}
    </div>
  );
}
