import { describe, expect, it, vi } from "vitest";

import { createTranslationProvider } from "./translation-provider.js";

describe("translation provider", () => {
  it("requests and validates structured editable translations", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      choices: [{ message: { content: JSON.stringify({
        title: "Cold-chain logistics service",
        slug: "cold-chain-logistics-service",
        summary: "Controlled-temperature international transport.",
        body: "A complete translated description.",
        seoTitle: "Cold-chain logistics | AnShow",
        seoDescription: "International temperature-controlled freight service.",
        altText: "Temperature-controlled cargo being loaded",
      }) } }],
    }));
    const provider = createTranslationProvider({
      apiUrl: "https://api.example.test/v1/chat/completions",
      apiKey: "server-secret",
      model: "translation-model",
      fetcher,
    });
    await expect(provider.translate({
      targetLocale: "en",
      source: { title: "冷链运输服务", summary: "温控运输", body: "详细说明", seoTitle: "冷链运输", seoDescription: "国际温控运输", altText: "冷链货物装车" },
    })).resolves.toMatchObject({ title: "Cold-chain logistics service", slug: "cold-chain-logistics-service" });
    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer server-secret" }) }));
  });

  it("rejects malformed provider output", async () => {
    const provider = createTranslationProvider({
      apiUrl: "https://api.example.test/v1/chat/completions",
      apiKey: "server-secret",
      model: "translation-model",
      fetcher: async () => Response.json({ choices: [{ message: { content: "{}" } }] }),
    });
    await expect(provider.translate({ targetLocale: "ru", source: { title: "服务", summary: "介绍", body: "说明", seoTitle: "服务", seoDescription: "描述", altText: "货物" } })).rejects.toThrow();
  });
});
