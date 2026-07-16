import "server-only";

import type { paths } from "../generated/api";
import { getFrontendServerEnv } from "../env";
import { getEnvelope } from "./http";

type PreviewOperation = paths["/api/public/preview/{token}/{locale}"]["get"];
export type PublicPreview = NonNullable<PreviewOperation["responses"][200]["content"]["application/json"]["data"]>;
type PreviewLocale = PreviewOperation["parameters"]["path"]["locale"];

export function getPublicPreview(token: string, locale: PreviewLocale): Promise<PublicPreview> {
  return getEnvelope<PublicPreview>(new URL(`/api/public/preview/${encodeURIComponent(token)}/${locale}`, getFrontendServerEnv().BACKEND_INTERNAL_URL).toString(), { cache: "no-store" });
}
