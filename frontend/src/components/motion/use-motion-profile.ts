"use client";

import { useEffect, useState } from "react";

export type MotionProfile = "none" | "light" | "rich";

export function chooseMotionProfile(input: {
  width: number;
  reduced: boolean;
  cores: number;
}): MotionProfile {
  if (input.reduced) return "none";
  if (input.width < 768 || input.cores < 4) return "light";
  return "rich";
}

export function useMotionProfile(): MotionProfile {
  const [profile, setProfile] = useState<MotionProfile>("none");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setProfile(
        chooseMotionProfile({
          cores: navigator.hardwareConcurrency || 2,
          reduced: reduced.matches,
          width: window.innerWidth,
        }),
      );
    };
    const initialFrame = window.requestAnimationFrame(update);
    reduced.addEventListener("change", update);
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.cancelAnimationFrame(initialFrame);
      reduced.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return profile;
}

