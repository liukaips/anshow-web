import type { AdminContentCollection } from "../../../../api/admin-content";
import { AdminFormField } from "../../ui/admin-form-field";

type FactValue = { label: string; value: string; unit?: string };
type ProcessStep = { title: string; text: string };
type ArticleSection = { heading: string; text: string };

export type BusinessBodyValue =
  | {
      kind: "service";
      description: string;
      scope: string;
      cargo: string;
      process: ProcessStep[];
      documents: string;
    }
  | {
      kind: "case";
      cargo: string;
      origin: string;
      destination: string;
      challenge: string;
      solution: string;
      results: string;
    }
  | {
      kind: "lane";
      description: string;
      region: string;
      modes: string;
      cargo: string;
      coordination: string;
    }
  | {
      kind: "certificate";
      description: string;
      certificateNumber: string;
      validUntil: string;
      verificationSource: string;
    }
  | {
      kind: "article";
      introduction: string;
      sections: ArticleSection[];
    }
  | {
      kind: "page";
      introduction: string;
      facts: FactValue[];
      callToAction: string;
    };

type StructuredSection =
  | { type: "paragraph"; text: string }
  | {
      type: "fact-list";
      items: { key: string; label: string; value: string; unit?: string }[];
    }
  | { type: "process"; steps: ProcessStep[] }
  | { type: "bullet-list"; title?: string; items: string[] }
  | { type: "callout"; title: string; text: string }
  | { type: "quote-cta"; title: string; text: string };

type StructuredBody = { version: 1; sections: StructuredSection[] };

type BusinessContentFieldsProps = {
  collection: AdminContentCollection;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
  value: string;
};

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-neutral-300 bg-white px-3 py-2 text-base text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100 disabled:bg-neutral-100";

const collectionKinds: Partial<Record<AdminContentCollection, BusinessBodyValue["kind"]>> = {
  articles: "article",
  "cargo-types": "service",
  "case-studies": "case",
  certificates: "certificate",
  pages: "page",
  services: "service",
  "trade-lanes": "lane",
};

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function structuredSections(body: string): StructuredSection[] | null {
  try {
    const parsed = JSON.parse(body) as Partial<StructuredBody>;
    if (parsed.version !== 1 || !Array.isArray(parsed.sections)) return null;
    return parsed.sections as StructuredSection[];
  } catch {
    return null;
  }
}

function textAfterPrefix(text: string, prefix: string): string | undefined {
  return text.startsWith(prefix) ? text.slice(prefix.length).trim() : undefined;
}

function firstParagraph(sections: readonly StructuredSection[]): string {
  return sections.find((section) => section.type === "paragraph")?.text ?? "";
}

function paragraphByPrefix(
  sections: readonly StructuredSection[],
  prefix: string,
): string {
  for (const section of sections) {
    if (section.type !== "paragraph") continue;
    const value = textAfterPrefix(section.text, prefix);
    if (value !== undefined) return value;
  }
  return "";
}

function calloutText(sections: readonly StructuredSection[], title: string): string {
  const section = sections.find(
    (candidate): candidate is Extract<StructuredSection, { type: "callout" }> =>
      candidate.type === "callout" && candidate.title === title,
  );
  return section?.text ?? "";
}

function factValue(
  sections: readonly StructuredSection[],
  key: string,
  label: string,
): string {
  for (const section of sections) {
    if (section.type !== "fact-list") continue;
    const item = section.items.find(
      (candidate) => candidate.key === key || candidate.label === label,
    );
    if (item) return item.value;
  }
  return "";
}

function bulletItems(sections: readonly StructuredSection[], title: string): string {
  const section = sections.find(
    (candidate) => candidate.type === "bullet-list" && candidate.title === title,
  );
  return section?.type === "bullet-list" ? section.items.join("\n") : "";
}

function processSteps(sections: readonly StructuredSection[]): ProcessStep[] {
  const section = sections.find((candidate) => candidate.type === "process");
  if (section?.type === "process") return section.steps.slice(0, 4);
  return [
    { title: "资料核对", text: "" },
    { title: "方案确认", text: "" },
    { title: "执行跟踪", text: "" },
  ];
}

function articleSections(sections: readonly StructuredSection[]): ArticleSection[] {
  return sections
    .filter((section): section is Extract<StructuredSection, { type: "paragraph" }> =>
      section.type === "paragraph",
    )
    .slice(1)
    .map((section, index) => ({
      heading: `段落 ${index + 1}`,
      text: section.text,
    }));
}

export function parseBusinessBody(
  collection: AdminContentCollection,
  body: string,
): BusinessBodyValue {
  const kind = collectionKinds[collection] ?? "page";
  const sections = structuredSections(body);
  const legacy = sections ? "" : body;
  const sourceSections = sections ?? [];

  switch (kind) {
    case "case":
      return {
        kind,
        cargo: factValue(sourceSections, "cargo", "货物类型"),
        origin: factValue(sourceSections, "origin", "起运地"),
        destination: factValue(sourceSections, "destination", "目的地"),
        challenge: paragraphByPrefix(sourceSections, "项目难点：") || legacy,
        solution: paragraphByPrefix(sourceSections, "解决方案："),
        results: calloutText(sourceSections, "项目结果"),
      };
    case "certificate":
      return {
        kind,
        description: firstParagraph(sourceSections) || legacy,
        certificateNumber: factValue(sourceSections, "certificateNumber", "证书编号"),
        validUntil: factValue(sourceSections, "validUntil", "有效期"),
        verificationSource: factValue(sourceSections, "verificationSource", "验证来源"),
      };
    case "lane":
      return {
        kind,
        description: firstParagraph(sourceSections) || legacy,
        region: factValue(sourceSections, "region", "服务区域"),
        modes: factValue(sourceSections, "modes", "运输方式"),
        cargo: bulletItems(sourceSections, "适合货物"),
        coordination: calloutText(sourceSections, "协同重点"),
      };
    case "service":
      return {
        kind,
        description: firstParagraph(sourceSections) || legacy,
        scope: factValue(sourceSections, "scope", "服务范围"),
        cargo: bulletItems(sourceSections, "适合货物"),
        process: processSteps(sourceSections),
        documents: bulletItems(sourceSections, "常见资料"),
      };
    case "article":
      return {
        kind,
        introduction: firstParagraph(sourceSections) || legacy,
        sections: articleSections(sourceSections),
      };
    case "page":
      return {
        kind,
        introduction: firstParagraph(sourceSections) || legacy,
        facts: [],
        callToAction: calloutText(sourceSections, "访客行动"),
      };
  }
}

function compactSections(sections: StructuredSection[]): StructuredBody {
  const next = sections.filter((section) => {
    if (section.type === "paragraph") return section.text.trim();
    if (section.type === "fact-list") return section.items.length > 0;
    if (section.type === "process") {
      return section.steps.some((step) => step.title.trim() || step.text.trim());
    }
    if (section.type === "bullet-list") return section.items.length > 0;
    return section.title.trim() || section.text.trim();
  });
  return {
    version: 1,
    sections: next.length > 0 ? next : [{ type: "paragraph", text: "待补充。" }],
  };
}

export function serializeBusinessBody(value: BusinessBodyValue): string {
  switch (value.kind) {
    case "case":
      return JSON.stringify(
        compactSections([
          {
            type: "fact-list",
            items: [
              { key: "cargo", label: "货物类型", value: value.cargo.trim() },
              { key: "origin", label: "起运地", value: value.origin.trim() },
              {
                key: "destination",
                label: "目的地",
                value: value.destination.trim(),
              },
            ].filter((item) => item.value),
          },
          { type: "paragraph", text: `项目难点：${value.challenge.trim()}` },
          { type: "paragraph", text: `解决方案：${value.solution.trim()}` },
          { type: "callout", title: "项目结果", text: value.results.trim() },
        ]),
      );
    case "certificate":
      return JSON.stringify(
        compactSections([
          { type: "paragraph", text: value.description.trim() },
          {
            type: "fact-list",
            items: [
              {
                key: "certificateNumber",
                label: "证书编号",
                value: value.certificateNumber.trim(),
              },
              { key: "validUntil", label: "有效期", value: value.validUntil.trim() },
              {
                key: "verificationSource",
                label: "验证来源",
                value: value.verificationSource.trim(),
              },
            ].filter((item) => item.value),
          },
        ]),
      );
    case "lane":
      return JSON.stringify(
        compactSections([
          { type: "paragraph", text: value.description.trim() },
          {
            type: "fact-list",
            items: [
              { key: "region", label: "服务区域", value: value.region.trim() },
              { key: "modes", label: "运输方式", value: value.modes.trim() },
            ].filter((item) => item.value),
          },
          { type: "bullet-list", title: "适合货物", items: lines(value.cargo) },
          { type: "callout", title: "协同重点", text: value.coordination.trim() },
        ]),
      );
    case "service":
      return JSON.stringify(
        compactSections([
          { type: "paragraph", text: value.description.trim() },
          {
            type: "fact-list",
            items: [{ key: "scope", label: "服务范围", value: value.scope.trim() }].filter(
              (item) => item.value,
            ),
          },
          { type: "bullet-list", title: "适合货物", items: lines(value.cargo) },
          {
            type: "process",
            steps: value.process.filter(
              (step) => step.title.trim() || step.text.trim(),
            ),
          },
          { type: "bullet-list", title: "常见资料", items: lines(value.documents) },
        ]),
      );
    case "article":
      return JSON.stringify(
        compactSections([
          { type: "paragraph", text: value.introduction.trim() },
          ...value.sections
            .filter((section) => section.text.trim())
            .map((section) => ({
              type: "paragraph" as const,
              text: section.heading.trim()
                ? `${section.heading.trim()}：${section.text.trim()}`
                : section.text.trim(),
            })),
        ]),
      );
    case "page":
      return JSON.stringify(
        compactSections([
          { type: "paragraph", text: value.introduction.trim() },
          {
            type: "fact-list",
            items: value.facts
              .filter((fact) => fact.label.trim() && fact.value.trim())
              .map((fact, index) => ({
                key: `fact-${index + 1}`,
                label: fact.label.trim(),
                value: fact.value.trim(),
                unit: fact.unit?.trim() || undefined,
              })),
          },
          { type: "callout", title: "访客行动", text: value.callToAction.trim() },
        ]),
      );
  }
}

function updateValue<T extends BusinessBodyValue>(
  value: T,
  patch: Partial<T>,
): string {
  return serializeBusinessBody({ ...value, ...patch } as BusinessBodyValue);
}

export function BusinessContentFields({
  collection,
  disabled,
  error,
  onChange,
  value,
}: BusinessContentFieldsProps) {
  const parsed = parseBusinessBody(collection, value);
  const field = (
    id: string,
    label: string,
    currentValue: string,
    change: (nextValue: string) => void,
    options: { help?: string; multiline?: boolean; required?: boolean } = {},
  ) => (
    <AdminFormField
      error={id === "translation-body" ? error : undefined}
      help={options.help}
      htmlFor={id}
      label={label}
      required={options.required}
    >
      {options.multiline ? (
        <textarea
          className={inputClass}
          disabled={disabled}
          id={id}
          onChange={(event) => change(event.target.value)}
          rows={4}
          value={currentValue}
        />
      ) : (
        <input
          className={inputClass}
          disabled={disabled}
          id={id}
          onChange={(event) => change(event.target.value)}
          type="text"
          value={currentValue}
        />
      )}
    </AdminFormField>
  );

  if (parsed.kind === "case") {
    return (
      <section aria-labelledby="business-content-heading" className="space-y-5">
        <SectionIntro text="按案例页面展示顺序填写，前台会自动组织为路线、难点、方案和结果。" />
        <div className="grid gap-5 lg:grid-cols-3">
          {field("case-cargo", "货物类型", parsed.cargo, (next) =>
            onChange(updateValue(parsed, { cargo: next })),
          )}
          {field("case-origin", "起运地", parsed.origin, (next) =>
            onChange(updateValue(parsed, { origin: next })),
          )}
          {field("case-destination", "目的地", parsed.destination, (next) =>
            onChange(updateValue(parsed, { destination: next })),
          )}
        </div>
        {field(
          "translation-body",
          "项目难点",
          parsed.challenge,
          (next) => onChange(updateValue(parsed, { challenge: next })),
          { multiline: true, required: true },
        )}
        {field(
          "case-solution",
          "解决方案",
          parsed.solution,
          (next) => onChange(updateValue(parsed, { solution: next })),
          { multiline: true },
        )}
        {field(
          "case-results",
          "项目结果",
          parsed.results,
          (next) => onChange(updateValue(parsed, { results: next })),
          { multiline: true },
        )}
      </section>
    );
  }

  if (parsed.kind === "certificate") {
    return (
      <section aria-labelledby="business-content-heading" className="space-y-5">
        <SectionIntro text="证书信息会影响前台资质展示；未核实的编号和来源可以先留空。" />
        {field(
          "translation-body",
          "证书说明",
          parsed.description,
          (next) => onChange(updateValue(parsed, { description: next })),
          { multiline: true, required: true },
        )}
        <div className="grid gap-5 lg:grid-cols-3">
          {field("certificate-number", "证书编号（可选）", parsed.certificateNumber, (next) =>
            onChange(updateValue(parsed, { certificateNumber: next })),
          )}
          {field("certificate-valid-until", "有效期（可选）", parsed.validUntil, (next) =>
            onChange(updateValue(parsed, { validUntil: next })),
          )}
          {field(
            "certificate-verification-source",
            "验证来源（可选）",
            parsed.verificationSource,
            (next) => onChange(updateValue(parsed, { verificationSource: next })),
          )}
        </div>
      </section>
    );
  }

  if (parsed.kind === "lane") {
    return (
      <section aria-labelledby="business-content-heading" className="space-y-5">
        <SectionIntro text="重点航线按服务区域、运输方式、适合货物和协同重点展示。" />
        {field(
          "translation-body",
          "航线说明",
          parsed.description,
          (next) => onChange(updateValue(parsed, { description: next })),
          { multiline: true, required: true },
        )}
        <div className="grid gap-5 lg:grid-cols-2">
          {field("lane-region", "服务区域", parsed.region, (next) =>
            onChange(updateValue(parsed, { region: next })),
          )}
          {field("lane-modes", "运输方式", parsed.modes, (next) =>
            onChange(updateValue(parsed, { modes: next })),
          )}
        </div>
        {field(
          "lane-cargo",
          "适合货物",
          parsed.cargo,
          (next) => onChange(updateValue(parsed, { cargo: next })),
          { help: "每行填写一类货物。", multiline: true },
        )}
        {field(
          "lane-coordination",
          "协同重点",
          parsed.coordination,
          (next) => onChange(updateValue(parsed, { coordination: next })),
          { multiline: true },
        )}
      </section>
    );
  }

  if (parsed.kind === "service") {
    return (
      <section aria-labelledby="business-content-heading" className="space-y-5">
        <SectionIntro text="按官网服务详情页的阅读顺序填写，系统会自动生成流程和清单样式。" />
        {field(
          "translation-body",
          "服务说明",
          parsed.description,
          (next) => onChange(updateValue(parsed, { description: next })),
          { multiline: true, required: true },
        )}
        {field("service-scope", "服务范围", parsed.scope, (next) =>
          onChange(updateValue(parsed, { scope: next })),
        )}
        {field(
          "service-cargo",
          "适合货物",
          parsed.cargo,
          (next) => onChange(updateValue(parsed, { cargo: next })),
          { help: "每行填写一类货物。", multiline: true },
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          {parsed.process.map((step, index) => (
            <div key={`step-${index}`} className="rounded-[var(--radius-card)] border border-neutral-200 bg-neutral-50 p-4">
              {field(`service-step-title-${index}`, `流程 ${index + 1}`, step.title, (next) => {
                const process = parsed.process.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, title: next } : item,
                );
                onChange(updateValue(parsed, { process }));
              })}
              <div className="mt-3">
                {field(`service-step-text-${index}`, "步骤说明", step.text, (next) => {
                  const process = parsed.process.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, text: next } : item,
                  );
                  onChange(updateValue(parsed, { process }));
                }, { multiline: true })}
              </div>
            </div>
          ))}
        </div>
        {field(
          "service-documents",
          "常见资料",
          parsed.documents,
          (next) => onChange(updateValue(parsed, { documents: next })),
          { help: "每行填写一种资料。", multiline: true },
        )}
      </section>
    );
  }

  if (parsed.kind === "article") {
    return (
      <section aria-labelledby="business-content-heading" className="space-y-5">
        <SectionIntro text="行业洞察会按导语和段落内容展示。" />
        {field(
          "translation-body",
          "文章导语",
          parsed.introduction,
          (next) => onChange(updateValue(parsed, { introduction: next })),
          { multiline: true, required: true },
        )}
        {(parsed.sections.length > 0 ? parsed.sections : [{ heading: "", text: "" }]).map((section, index) => (
          <div key={`article-section-${index}`} className="grid gap-3">
            {field(`article-heading-${index}`, `段落标题 ${index + 1}`, section.heading, (next) => {
              const sections = [...parsed.sections];
              sections[index] = { ...(sections[index] ?? { text: "" }), heading: next };
              onChange(updateValue(parsed, { sections }));
            })}
            {field(`article-text-${index}`, `段落内容 ${index + 1}`, section.text, (next) => {
              const sections = [...parsed.sections];
              sections[index] = { ...(sections[index] ?? { heading: "" }), text: next };
              onChange(updateValue(parsed, { sections }));
            }, { multiline: true })}
          </div>
        ))}
      </section>
    );
  }

  return (
    <section aria-labelledby="business-content-heading" className="space-y-5">
      <SectionIntro text="填写页面核心介绍和访客行动，前台会按官网页面样式展示。" />
      {field(
        "translation-body",
        "页面介绍",
        parsed.introduction,
        (next) => onChange(updateValue(parsed, { introduction: next })),
        { multiline: true, required: true },
      )}
      {field(
        "page-call-to-action",
        "访客行动",
        parsed.callToAction,
        (next) => onChange(updateValue(parsed, { callToAction: next })),
        { multiline: true },
      )}
    </section>
  );
}

function SectionIntro({ text }: { text: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text)]" id="business-content-heading">
        前台展示内容
      </h2>
      <p className="mt-1 text-sm leading-6 text-neutral-600">{text}</p>
    </div>
  );
}
