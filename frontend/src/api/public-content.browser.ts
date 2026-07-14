"use client";

import type { paths } from "../generated/api";

import { getEnvelope } from "./http";

type HomeOperation = paths["/api/public/content/home/{locale}"]["get"];
type Home = NonNullable<
  HomeOperation["responses"][200]["content"]["application/json"]["data"]
>;
type Locale = HomeOperation["parameters"]["path"]["locale"];

export function refreshPublicHome(locale: Locale): Promise<Home> {
  return getEnvelope<Home>(
    `/api/public/content/home/${encodeURIComponent(locale)}`,
    { cache: "no-store" },
  );
}
