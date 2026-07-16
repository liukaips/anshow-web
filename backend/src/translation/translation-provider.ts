import { z } from "zod";

export const translatedContentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/),
  summary: z.string().trim().min(1).max(2_000),
  body: z.string().trim().min(1).max(50_000),
  seoTitle: z.string().trim().min(1).max(60),
  seoDescription: z.string().trim().min(1).max(160),
  altText: z.string().trim().min(1).max(1_000),
}).strict();

export type TranslatedContent = z.infer<typeof translatedContentSchema>;
export type TranslationSource = Omit<TranslatedContent, "slug">;

export interface TranslationProvider {
  translate(input: {
    source: TranslationSource;
    targetLocale: "en" | "ru";
  }): Promise<TranslatedContent>;
}

type ProviderOptions = {
  apiUrl: string;
  apiKey: string;
  model: string;
  fetcher?: typeof fetch;
};

const responseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string() }),
  })).min(1),
});

export function createTranslationProvider(options: ProviderOptions): TranslationProvider {
  const fetcher = options.fetcher ?? fetch;
  return {
    async translate(input) {
      const response = await fetcher(options.apiUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            {
              role: "system",
              content: `Translate international freight-forwarding website content into ${input.targetLocale === "en" ? "English" : "Russian"}. Preserve facts, do not add claims, and return only the requested JSON fields. The slug must contain lowercase ASCII letters, numbers, and hyphens only.`,
            },
            { role: "user", content: JSON.stringify(input.source) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "translated_content",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["title", "slug", "summary", "body", "seoTitle", "seoDescription", "altText"],
                properties: {
                  title: { type: "string" },
                  slug: { type: "string" },
                  summary: { type: "string" },
                  body: { type: "string" },
                  seoTitle: { type: "string" },
                  seoDescription: { type: "string" },
                  altText: { type: "string" },
                },
              },
            },
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`翻译服务请求失败（${response.status}）`);
      }
      const payload = responseSchema.parse(await response.json());
      return translatedContentSchema.parse(JSON.parse(payload.choices[0].message.content));
    },
  };
}
