import type { Locale, ProcessStageId } from "./types.js";
import { LOCALES } from "./types.js";
import {
  structuredContentBodySchema,
  type FactListItem,
  type StructuredContentBody,
  type StructuredContentSection,
} from "./structured-body.js";

export type SeedCollection =
  | "hero-slides"
  | "services"
  | "trade-lanes"
  | "cargo-types"
  | "pages"
  | "case-studies"
  | "articles"
  | "certificates"
  | "proof-metrics"
  | "navigation-items";

export type SeedTranslation = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  altText: string;
};

export type SeedItem = {
  collection: SeedCollection;
  code: string;
  desiredMediaId?: string;
  processStageId?: ProcessStageId;
  publish: boolean;
  translations: Record<Locale, SeedTranslation>;
};

export type ContentSeedRevision = {
  version: number;
  expectedCatalogDigest: string;
};

export const currentContentSeedRevision = {
  version: 2,
  expectedCatalogDigest:
    "72004b8be71d51c270eb3cbc9708b127ec637152e56b129195a099312147fd1d",
} as const satisfies ContentSeedRevision;

type CopyInput = {
  title: string;
  slug: string;
  summary: string;
  sections?: StructuredContentSection[];
  altText?: string;
  seoTitle?: string;
};

type LocalizedCopy = Record<Locale, CopyInput>;

function copy(
  title: string,
  slug: string,
  summary: string,
  sections?: StructuredContentSection[],
  options: { altText?: string; seoTitle?: string } = {},
): CopyInput {
  return { title, slug, summary, sections, ...options };
}

function serializeBody(
  collection: SeedCollection,
  code: string,
  locale: Locale,
  sections: StructuredContentSection[],
) {
  const candidate: StructuredContentBody = { version: 1, sections };
  const parsed = structuredContentBodySchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      `Invalid seed body for ${collection}/${code}/${locale}: ${parsed.error.message}`,
    );
  }
  return JSON.stringify(parsed.data);
}

function item(
  collection: SeedCollection,
  code: string,
  desiredMediaId: string | undefined,
  localized: LocalizedCopy,
  options: { publish?: boolean; processStageId?: ProcessStageId } = {},
): SeedItem {
  const translations = Object.fromEntries(
    LOCALES.map((locale) => {
      const value = localized[locale];
      return [
        locale,
        {
          title: value.title,
          slug: value.slug,
          summary: value.summary,
          body: serializeBody(
            collection,
            code,
            locale,
            value.sections ?? [{ type: "paragraph", text: value.summary }],
          ),
          seoTitle: value.seoTitle ?? `${value.title} | AnShow`,
          seoDescription: value.summary,
          altText: value.altText ?? `${value.title}. ${value.summary}`,
        },
      ];
    }),
  ) as Record<Locale, SeedTranslation>;

  return {
    collection,
    code,
    desiredMediaId,
    processStageId: options.processStageId,
    publish: options.publish ?? true,
    translations,
  };
}

function localizedParagraphs(
  en: [string, string, string],
  zh: [string, string, string],
  ru: [string, string, string],
): LocalizedCopy {
  return {
    en: copy(...en),
    zh: copy(...zh),
    ru: copy(...ru),
  };
}

const heroSlides: SeedItem[] = [
  item("hero-slides", "ocean", "hero-ocean", localizedParagraphs(
    ["Ocean freight, made certain", "ocean-freight", "Coordinate FCL, LCL, special containers, and project cargo through one accountable forwarding team."],
    ["让国际海运更确定", "guo-ji-hai-yun", "由统一货代团队协调整箱、拼箱、特种柜及项目货物运输。"],
    ["Предсказуемые морские перевозки", "morskie-perevozki", "Единая экспедиторская команда координирует FCL, LCL, специальные контейнеры и проектные грузы."],
  ), { processStageId: "route" }),
  item("hero-slides", "air", "hero-air", localizedParagraphs(
    ["Air freight for urgent priorities", "air-freight", "Keep urgent and controlled air cargo moving with prepared documents and visible milestones."],
    ["紧急货物高效空运", "jin-ji-kong-yun", "通过前置单证准备和清晰节点，协同紧急及受控空运货物。"],
    ["Авиаперевозки срочных грузов", "aviaperevozki", "Подготовленные документы и прозрачные этапы помогают координировать срочные и контролируемые авиагрузы."],
  ), { processStageId: "transit" }),
  item("hero-slides", "rail", "hero-rail", localizedParagraphs(
    ["Rail freight across Eurasia", "rail-freight", "Plan China-Europe, China-Russia, and Central Asia rail movements with coordinated terminal handoffs."],
    ["贯通欧亚的铁路运输", "ou-ya-tie-lu-yun-shu", "协同中欧、中俄及中亚班列运输与场站交接。"],
    ["Железнодорожные перевозки по Евразии", "zheleznodorozhnye-perevozki", "Планируйте перевозки Китай-Европа, Китай-Россия и в Центральную Азию с координацией терминалов."],
  ), { processStageId: "transit" }),
  item("hero-slides", "road", "hero-road", localizedParagraphs(
    ["Road and TIR across borders", "road-tir-freight", "Connect border crossings, terminals, and final delivery for cross-border road and TIR cargo."],
    ["跨境公路与 TIR 运输", "kua-jing-gong-lu-tir", "为跨境公路及 TIR 货物衔接口岸、场站与末端交付。"],
    ["Международные автоперевозки и TIR", "avtoperevozki-tir", "Координируйте погранпереходы, терминалы и доставку грузов в международных автомобильных перевозках и TIR."],
  ), { processStageId: "delivery" }),
];

function service(
  code: string,
  media: string,
  stage: ProcessStageId,
  en: [string, string, string, string[]],
  zh: [string, string, string, string[]],
  ru: [string, string, string, string[]],
) {
  const localized = Object.fromEntries(
    LOCALES.map((locale) => {
      const [title, slug, summary, scope] = { en, zh, ru }[locale];
      const scopeTitle = { en: "Service scope", zh: "服务范围", ru: "Состав услуги" }[locale];
      return [locale, copy(title, slug, summary, [
        { type: "paragraph", text: summary },
        { type: "bullet-list", title: scopeTitle, items: scope },
      ])];
    }),
  ) as LocalizedCopy;
  return item("services", code, media, localized, { processStageId: stage });
}

const services: SeedItem[] = [
  service("ocean-freight", "service-ocean", "transit",
    ["Ocean Freight", "ocean-freight", "Ocean forwarding for standard and specialist cargo with clear booking and handoff coordination.", ["FCL and LCL", "Special containers and project cargo", "Booking, documentation, and destination handoff"]],
    ["海运服务", "hai-yun-fu-wu", "为常规及专业货物提供海运代理，清晰协同订舱与交接。", ["整箱与拼箱", "特种柜及项目货物", "订舱、单证与目的港交接"]],
    ["Морские перевозки", "morskie-perevozki", "Экспедирование стандартных и специальных грузов с координацией бронирования и передачи.", ["FCL и LCL", "Специальные контейнеры и проектные грузы", "Бронирование, документы и передача в пункте назначения"]]),
  service("air-freight", "service-air", "transit",
    ["Air Freight for Time-Critical Cargo", "air-freight", "Air forwarding for urgent, controlled, and time-sensitive cargo.", ["Priority flight planning", "Document and handling readiness", "Milestone and arrival coordination"]],
    ["空运服务", "kong-yun-fu-wu", "为紧急、受控及高时效货物提供空运代理。", ["优先航班方案", "单证与操作准备", "节点跟踪与到港协同"]],
    ["Авиаперевозки", "aviaperevozki", "Авиаэкспедирование срочных, контролируемых и чувствительных ко срокам грузов.", ["Подбор приоритетного рейса", "Подготовка документов и обработки", "Контроль этапов и прибытия"]]),
  service("rail-freight", "service-rail", "transit",
    ["Rail Freight", "rail-freight", "Rail coordination for China-Europe, China-Russia, and Central Asia corridors.", ["Container and schedule planning", "Terminal and border handoffs", "Rail-road multimodal delivery"]],
    ["铁路运输", "tie-lu-yun-shu", "协同中欧、中俄及中亚方向的班列运输。", ["箱型与班期规划", "场站及口岸交接", "铁路与公路多式联运"]],
    ["Железнодорожные перевозки", "zheleznodorozhnye-perevozki", "Координация железнодорожных маршрутов Китай-Европа, Китай-Россия и в Центральную Азию.", ["Планирование контейнера и графика", "Терминальные и пограничные операции", "Мультимодальная доставка поезд-авто"]]),
  service("road-freight", "service-road", "delivery",
    ["Road Freight and TIR", "road-freight-tir", "Cross-border trucking and TIR coordination for scheduled cargo and large equipment.", ["Cross-border trucking", "TIR route coordination", "Terminal transfer and final delivery"]],
    ["公路与 TIR 运输", "gong-lu-tir-yun-shu", "为计划货物及大型设备协同跨境卡航与 TIR 运输。", ["跨境卡航", "TIR 路线协同", "场站转运与末端配送"]],
    ["Автоперевозки и TIR", "avtoperevozki-tir", "Координация международных автоперевозок и TIR для плановых грузов и крупной техники.", ["Международные автоперевозки", "Координация маршрута TIR", "Терминальная передача и доставка"]]),
  service("warehousing", "service-warehouse", "pickup",
    ["Warehousing and Distribution", "warehousing-distribution", "Coordinate receipt, storage, handling, consolidation, and onward distribution.", ["Inbound receipt and records", "Storage, handling, and consolidation", "Distribution and release coordination"]],
    ["仓储与配送", "cang-chu-yu-pei-song", "协同入库、存储、装卸、分拨及后续配送。", ["收货入库与记录", "存储、操作与集拼", "分拨与放行协同"]],
    ["Складирование и дистрибуция", "skladirovanie-distributsiya", "Координация приемки, хранения, обработки, консолидации и дальнейшей доставки.", ["Приемка и учет", "Хранение, обработка и консолидация", "Распределение и выпуск"]]),
  service("customs-origin", "service-customs", "customs",
    ["Customs and Certificates of Origin", "customs-certificates-origin", "Support import and export clearance, shipment documents, and certificates of origin.", ["Import and export declaration coordination", "Document readiness checks", "Certificate-of-origin support"]],
    ["报关与产地证", "bao-guan-yu-chan-di-zheng", "支持进出口清关、运输单证准备及产地证办理。", ["进出口申报协同", "单证完整性核对", "产地证服务"]],
    ["Таможенное оформление и сертификаты происхождения", "tamozhennoe-oformlenie-sertifikaty", "Сопровождение импортного и экспортного оформления, документов и сертификатов происхождения.", ["Координация импортных и экспортных деклараций", "Проверка готовности документов", "Содействие в оформлении сертификатов происхождения"]]),
  service("insurance-solutions", "trust-coordination", "route",
    ["Insurance and Tailored Solutions", "insurance-tailored-solutions", "Coordinate cargo insurance and tailored plans for dangerous, oversized, cold-chain, and complex cargo.", ["Cargo insurance support", "Mode and route comparison", "Plans tailored after cargo assessment"]],
    ["保险与定制方案", "bao-xian-yu-ding-zhi-fang-an", "协同货运保险，并为危险品、超限设备、冷链及复杂货物定制方案。", ["货运保险支持", "运输方式与路线比较", "货物评估后的定制方案"]],
    ["Страхование и индивидуальные решения", "strakhovanie-individualnye-resheniya", "Координация страхования и индивидуальных схем для опасных, негабаритных, температурных и сложных грузов.", ["Содействие в страховании груза", "Сравнение видов транспорта и маршрутов", "Решение после оценки груза"]]),
];

const tradeLanes: SeedItem[] = [
  item("trade-lanes", "china-russia", "lane-china-russia", localizedParagraphs(
    ["China-Russia", "china-russia", "Coordinate rail, road, air, and multimodal freight between China and Russia through selected partners and gateways."],
    ["中国至俄罗斯", "zhong-guo-zhi-e-luo-si", "通过重点口岸与合作伙伴协同中俄铁路、公路、空运及多式联运。"],
    ["Китай - Россия", "kitay-rossiya", "Координация железнодорожных, автомобильных, авиационных и мультимодальных перевозок через выбранных партнеров и погранпереходы."],
  ), { processStageId: "route" }),
  item("trade-lanes", "china-europe", "lane-china-europe", localizedParagraphs(
    ["China-Europe", "china-europe", "Compare ocean, rail, air, and multimodal options for selected China-Europe routes."],
    ["中国至欧洲", "zhong-guo-zhi-ou-zhou", "为重点中欧路线比较海运、铁路、空运及多式联运方案。"],
    ["Китай - Европа", "kitay-evropa", "Сравнивайте морские, железнодорожные, авиационные и мультимодальные варианты на выбранных маршрутах Китай-Европа."],
  ), { processStageId: "route" }),
  item("trade-lanes", "central-asia", "lane-central-asia", localizedParagraphs(
    ["Central Asia", "central-asia", "Plan rail and road freight through selected Central Asian gateways with coordinated border handoffs."],
    ["中亚通道", "zhong-ya-tong-dao", "通过重点中亚口岸规划铁路与公路运输，并协同跨境交接。"],
    ["Центральная Азия", "tsentralnaya-aziya", "Планируйте железнодорожные и автомобильные перевозки через выбранные узлы Центральной Азии с координацией границ."],
  ), { processStageId: "route" }),
  item("trade-lanes", "global-network", "lane-global", localizedParagraphs(
    ["Global Partner Network", "global-partner-network", "Coordinate international destinations through origin, transit, and destination forwarding partners."],
    ["全球代理协同网络", "quan-qiu-dai-li-wang-luo", "通过起运地、中转地及目的地代理伙伴协同国际目的地服务。"],
    ["Глобальная партнерская сеть", "globalnaya-partnerskaya-set", "Координация международных направлений с экспедиторскими партнерами в пунктах отправления, транзита и назначения."],
  ), { processStageId: "route" }),
];

const cargoTypes: SeedItem[] = [
  item("cargo-types", "dangerous-goods", "cargo-dangerous", localizedParagraphs(
    ["Dangerous Goods", "dangerous-goods", "Coordinate declared dangerous goods with cargo assessment, compliant packaging information, qualified parties, and required documents."],
    ["危险品运输", "wei-xian-pin-yun-shu", "通过货物评估、合规包装资料、资质协同及必要单证组织已申报危险品运输。"],
    ["Опасные грузы", "opasnye-gruzy", "Координация заявленных опасных грузов после оценки, проверки упаковки, документов и участия компетентных сторон."],
  ), { processStageId: "customs" }),
  item("cargo-types", "oversized-cargo", "cargo-oversized", localizedParagraphs(
    ["Oversized Cargo", "oversized-cargo", "Plan route, lifting, securing, special equipment, and permits for cargo outside standard dimensions."],
    ["超限设备", "chao-xian-she-bei", "为超出标准尺寸的货物规划路线、吊装、加固、特种设备及许可。"],
    ["Негабаритные грузы", "negabaritnye-gruzy", "Планирование маршрута, подъема, крепления, спецтехники и разрешений для грузов нестандартных размеров."],
  ), { processStageId: "pickup" }),
  item("cargo-types", "temperature-controlled", "cargo-cold-chain", localizedParagraphs(
    ["Temperature-Controlled and Cold-Chain Cargo", "temperature-controlled-cold-chain", "Define temperature ranges, monitoring responsibilities, handoffs, and contingency requirements before booking."],
    ["温控与冷链货物", "wen-kong-yu-leng-lian", "订舱前明确温度区间、监控责任、交接节点及应急要求。"],
    ["Температурные грузы и холодовая цепь", "temperaturnye-gruzy-kholodovaya-tsep", "До бронирования согласуйте температурный диапазон, мониторинг, передачи и действия при отклонениях."],
  ), { processStageId: "pickup" }),
  item("cargo-types", "complex-projects", "cargo-project", localizedParagraphs(
    ["Complex Project Cargo", "complex-project-cargo", "Build a shipment plan around cargo constraints, route interfaces, handling, documents, and delivery milestones."],
    ["复杂项目货物", "fu-za-xiang-mu-huo-wu", "围绕货物限制、路线衔接、装卸、单证及交付节点制定运输方案。"],
    ["Сложные проектные грузы", "slozhnye-proektnye-gruzy", "Формируйте план с учетом ограничений груза, стыков маршрута, обработки, документов и этапов доставки."],
  ), { processStageId: "route" }),
];

const pages: SeedItem[] = [
  item("pages", "about", "trust-operations", {
    en: copy("About AnShow", "about-anshow", "An-Show Supply Chain (Shenzhen) Co., Ltd. has coordinated international freight forwarding from Shenzhen since 2012.", [
      { type: "paragraph", text: "An-Show Supply Chain (Shenzhen) Co., Ltd. was founded in 2012 and is based in Tower A, Tianli Central Plaza, Nanshan District, Shenzhen." },
      { type: "callout", title: "Company qualification", text: "AnShow is a Class-A international freight-forwarding enterprise approved by China's Ministry of Commerce." },
    ]),
    zh: copy("关于安啸供应链", "guan-yu-an-xiao", "安啸供应链（深圳）有限公司自 2012 年起在深圳协同国际货运代理业务。", [
      { type: "paragraph", text: "安啸供应链（深圳）有限公司成立于 2012 年，总部位于深圳市南山区天利中央广场 A 座。" },
      { type: "callout", title: "企业资质", text: "安啸是经商务部批准的一级国际货运代理企业。" },
    ]),
    ru: copy("О компании AnShow", "o-kompanii-anshow", "An-Show Supply Chain (Shenzhen) Co., Ltd. координирует международные перевозки из Шэньчжэня с 2012 года.", [
      { type: "paragraph", text: "Компания An-Show Supply Chain (Shenzhen) Co., Ltd. основана в 2012 году. Офис находится в башне A комплекса Tianli Central Plaza, район Наньшань, Шэньчжэнь." },
      { type: "callout", title: "Статус компании", text: "AnShow является международным экспедитором класса A, одобренным Министерством коммерции КНР." },
    ]),
  }),
  item("pages", "network", "trust-coordination", localizedParagraphs(
    ["Partner Network", "partner-network", "AnShow coordinates international routes with forwarding partners at origin, transit points, and destinations."],
    ["代理协同网络", "dai-li-xie-tong-wang-luo", "安啸通过起运地、中转地和目的地货代伙伴协同国际路线。"],
    ["Партнерская сеть", "partnerskaya-set", "AnShow координирует международные маршруты с экспедиторами в пунктах отправления, транзита и назначения."],
  )),
  item("pages", "contact", "trust-coordination", {
    en: copy("Contact AnShow", "contact-anshow", "Contact the Shenzhen team with your route, cargo, timing, and handling requirements.", [
      { type: "fact-list", items: [
        { key: "company", label: "Company", value: "An-Show Supply Chain (Shenzhen) Co., Ltd." },
        { key: "address", label: "Address", value: "Tower A, Tianli Central Plaza, Nanshan District, Shenzhen" },
        { key: "phone", label: "Phone", value: "+86-0755-26651969 ext#201" },
        { key: "mobile", label: "Mobile", value: "+86-18998909323" },
        { key: "email", label: "Email", value: "anfisa@an-show.com" },
      ] },
    ]),
    zh: copy("联系安啸", "lian-xi-an-xiao", "请向深圳团队提供路线、货物、时效及操作要求。", [
      { type: "fact-list", items: [
        { key: "company", label: "公司", value: "安啸供应链（深圳）有限公司" },
        { key: "address", label: "地址", value: "深圳市南山区天利中央广场 A 座" },
        { key: "phone", label: "电话", value: "+86-0755-26651969 ext#201" },
        { key: "mobile", label: "手机", value: "+86-18998909323" },
        { key: "email", label: "邮箱", value: "anfisa@an-show.com" },
      ] },
    ]),
    ru: copy("Связаться с AnShow", "kontakty-anshow", "Передайте команде в Шэньчжэне данные о маршруте, грузе, сроках и обработке.", [
      { type: "fact-list", items: [
        { key: "company", label: "Компания", value: "An-Show Supply Chain (Shenzhen) Co., Ltd." },
        { key: "address", label: "Адрес", value: "Tower A, Tianli Central Plaza, Nanshan District, Shenzhen" },
        { key: "phone", label: "Телефон", value: "+86-0755-26651969 ext#201" },
        { key: "mobile", label: "Мобильный", value: "+86-18998909323" },
        { key: "email", label: "Эл. почта", value: "anfisa@an-show.com" },
      ] },
    ]),
  }),
  item("pages", "privacy", undefined, localizedParagraphs(
    ["Privacy Notice", "privacy", "How AnShow handles information submitted through this website."],
    ["隐私声明", "yin-si-sheng-ming", "说明安啸如何处理通过本网站提交的信息。"],
    ["Уведомление о конфиденциальности", "konfidentsialnost", "Как AnShow обрабатывает информацию, переданную через этот сайт."],
  )),
  item("pages", "terms", undefined, localizedParagraphs(
    ["Terms of Use", "terms", "Terms governing use of the AnShow website and its published information."],
    ["使用条款", "shi-yong-tiao-kuan", "适用于安啸网站及所发布信息的使用条款。"],
    ["Условия использования", "usloviya-ispolzovaniya", "Условия использования сайта AnShow и опубликованной информации."],
  )),
  item("pages", "cookies", undefined, localizedParagraphs(
    ["Cookie Notice", "cookies", "Information about essential and optional browser storage used by this website."],
    ["Cookie 声明", "cookie-sheng-ming", "说明本网站使用的必要及可选浏览器存储。"],
    ["Уведомление о cookie", "cookie", "Информация об обязательном и дополнительном хранении данных в браузере."],
  )),
  item("pages", "not-found", undefined, localizedParagraphs(
    ["Page Not Found", "not-found", "The requested page is unavailable. Return to AnShow services or contact the team."],
    ["页面未找到", "ye-mian-wei-zhao-dao", "您访问的页面不可用，请返回安啸服务页面或联系我们。"],
    ["Страница не найдена", "stranitsa-ne-naydena", "Запрошенная страница недоступна. Вернитесь к услугам AnShow или свяжитесь с командой."],
  )),
];

type CaseFactDefinition = {
  key: string;
  value: string;
  labels: Record<Locale, string>;
  unit?: string;
};

function caseCopy(
  locale: Locale,
  title: string,
  slug: string,
  summary: string,
  factDefinitions: CaseFactDefinition[],
  challenge: string,
  execution: string,
  result: string,
  options: { seoTitle?: string } = {},
) {
  const processTitles = {
    en: ["Project challenge", "Execution plan", "Project result"],
    zh: ["项目难点", "执行方案", "项目结果"],
    ru: ["Задача проекта", "Схема выполнения", "Результат проекта"],
  }[locale];
  const facts: FactListItem[] = factDefinitions.map((definition) => ({
    key: definition.key,
    label: definition.labels[locale],
    value: definition.value,
    ...(definition.unit ? { unit: definition.unit } : {}),
  }));
  return copy(title, slug, summary, [
    { type: "paragraph", text: summary },
    { type: "fact-list", items: facts },
    { type: "process", steps: [
      { title: processTitles[0], text: challenge },
      { title: processTitles[1], text: execution },
      { title: processTitles[2], text: result },
    ] },
  ], options);
}

function fact(
  key: string,
  value: string,
  en: string,
  zh: string,
  ru: string,
  unit?: string,
): CaseFactDefinition {
  return { key, value, labels: { en, zh, ru }, unit };
}

const caseStudies: SeedItem[] = [
  (() => {
    const facts = [
      fact("origin", "Shenzhen", "Origin", "起运地", "Пункт отправления"),
      fact("destination", "Hamburg", "Destination", "目的地", "Пункт назначения"),
      fact("un", "UN1263", "UN number", "UN 编号", "Номер ООН"),
      fact("hazardClass", "3", "Hazard class", "危险类别", "Класс опасности"),
      fact("weight", "12", "Weight", "货重", "Вес", "t"),
      fact("duration", "28", "Approximate transit time", "运输时效（约）", "Примерный срок перевозки", "days"),
    ];
    return item("case-studies", "un1263-hamburg", "case-un1263-hamburg", {
      en: caseCopy("en", "UN1263 Solvent from Shenzhen to Hamburg", "un1263-solvent-shenzhen-hamburg", "Representative movement of 12 t of Class 3 UN1263 solvent from Shenzhen to Hamburg in about 28 days.", facts, "The regulated cargo required aligned declaration data, packaging evidence, and carrier acceptance.", "The team coordinated document review, dangerous-goods booking, loading requirements, and destination handoff.", "The representative shipment reached Hamburg in about 28 days under the agreed transport plan."),
      zh: caseCopy("zh", "深圳至汉堡 UN1263 三类溶剂运输", "un1263-rong-ji-shen-zhen-han-bao", "代表性项目：12 吨 UN1263 三类化学溶剂由深圳运抵汉堡，全程约 28 天。", facts, "受监管货物需要统一申报数据、包装证明及承运审核要求。", "团队协同单证核对、危险品订舱、装载要求和目的港交接。", "该代表性货物按既定运输方案约 28 天抵达汉堡。"),
      ru: caseCopy("ru", "Растворитель UN1263 из Шэньчжэня в Гамбург", "rastvoritel-un1263-shenzhen-gamburg", "Представительный проект: 12 т растворителя UN1263 класса 3 доставлены из Шэньчжэня в Гамбург примерно за 28 дней.", facts, "Для регулируемого груза требовалось согласовать данные декларации, подтверждение упаковки и допуск перевозчика.", "Команда координировала проверку документов, бронирование опасного груза, погрузку и передачу в пункте назначения.", "В рамках данного проекта груз прибыл в Гамбург примерно за 28 дней по согласованной схеме."),
    }, { processStageId: "transit" });
  })(),
  (() => {
    const facts = [
      fact("destination", "India", "Destination", "目的地", "Пункт назначения"),
      fact("un", "UN3265", "UN number", "UN 编号", "Номер ООН"),
      fact("hazardClass", "8", "Hazard class", "危险类别", "Класс опасности"),
      fact("drums", "800", "Quantity", "数量", "Количество", "drums"),
      fact("clearanceDuration", "3", "Project clearance duration", "该项目清关用时", "Срок оформления в проекте", "days"),
    ];
    return item("case-studies", "un3265-india", "case-un3265-india", {
      en: caseCopy("en", "UN3265 Electrolyte Export to India", "un3265-electrolyte-india", "Representative export of 800 drums of Class 8 UN3265 electrolyte to India, with clearance completed in three days for this project.", facts, "The corrosive cargo required compliant packaging, load planning, and consistent declaration records.", "The team aligned drum documentation, loading controls, export handling, and destination clearance information.", "Destination clearance was completed in three days for this representative shipment."),
      zh: caseCopy("zh", "UN3265 电解液出口印度", "un3265-dian-jie-ye-yin-du", "代表性项目：800 桶 UN3265 八类电解液出口印度，该项目清关用时 3 天。", facts, "腐蚀性货物需要合规包装、装载规划及一致的申报资料。", "团队协同桶装资料、装载控制、出口操作与目的地清关信息。", "该代表性货物在目的地 3 天完成清关。"),
      ru: caseCopy("ru", "Экспорт электролита UN3265 в Индию", "elektrolit-un3265-indiya", "Представительный проект: экспорт 800 бочек электролита UN3265 класса 8 в Индию; оформление этой партии заняло три дня.", facts, "Коррозионный груз требовал соответствующей упаковки, схемы загрузки и согласованных данных декларации.", "Команда координировала документы на бочки, контроль загрузки, экспортные операции и данные для оформления в Индии.", "Таможенное оформление этой представительной партии заняло три дня."),
    }, { processStageId: "customs" });
  })(),
  (() => {
    const facts = [
      fact("origin", "Shenzhen", "Origin", "起运地", "Пункт отправления"),
      fact("destination", "Los Angeles", "Destination", "目的地", "Пункт назначения"),
      fact("un", "UN3480", "UN number", "UN 编号", "Номер ООН"),
      fact("weight", "5", "Weight", "货重", "Вес", "t"),
      fact("duration", "14", "Approximate transit time", "运输时效（约）", "Примерный срок перевозки", "days"),
      fact("projectTimeSaved", "7", "Representative project time comparison", "该项目时效对比", "Сравнение срока в этом проекте", "days"),
      fact("projectCostDifference", "8", "Representative project cost comparison", "该项目成本对比", "Сравнение стоимости в этом проекте", "%"),
    ];
    return item("case-studies", "un3480-los-angeles", "case-un3480-los-angeles", {
      en: caseCopy("en", "UN3480 Lithium Batteries to Los Angeles", "un3480-lithium-batteries-los-angeles", "Representative movement of 5 t of UN3480 lithium batteries to Los Angeles in about 14 days.", facts, "Battery classification, test evidence, packing, and capacity timing had to be aligned before acceptance.", "The team coordinated document readiness, compliant handling data, booking, and milestone follow-up.", "For this project, the selected plan took about 14 days, seven days less and 8% lower in cost than the compared option at that time."),
      zh: caseCopy("zh", "UN3480 锂电池运抵洛杉矶", "un3480-li-dian-chi-luo-shan-ji", "代表性项目：5 吨 UN3480 锂电池运抵洛杉矶，运输约 14 天。", facts, "承运审核前需统一电池分类、测试证明、包装资料及舱位时点。", "团队协同单证准备、合规操作资料、订舱及节点跟进。", "就该项目当时的比较方案而言，所选方案约 14 天，节省 7 天，成本低 8%。"),
      ru: caseCopy("ru", "Литиевые батареи UN3480 в Лос-Анджелес", "litievye-batarei-un3480-los-andzheles", "Представительный проект: 5 т литиевых батарей UN3480 доставлены в Лос-Анджелес примерно за 14 дней.", facts, "До допуска требовалось согласовать классификацию батарей, результаты испытаний, упаковку и наличие емкости.", "Команда координировала готовность документов, данные по обработке, бронирование и контроль этапов.", "В этом проекте выбранная схема заняла около 14 дней: на семь дней меньше и на 8% дешевле сравнивавшегося тогда варианта."),
    }, { processStageId: "transit" });
  })(),
  (() => {
    const facts = [
      fact("destination", "Turkey", "Destination", "目的地", "Пункт назначения"),
      fact("dimensions", "11.8 × 2.6 × 3.2", "Dimensions", "设备尺寸", "Габариты", "m"),
      fact("weight", "28", "Weight", "货重", "Вес", "t"),
      fact("equipment", "40-foot flat rack", "Equipment", "箱型", "Оборудование"),
    ];
    return item("case-studies", "injection-machine-turkey", "case-injection-machine-turkey", {
      en: caseCopy("en", "Injection Molding Machine Export to Turkey", "injection-molding-machine-turkey", "Representative export of a 28 t injection molding machine measuring 11.8 × 2.6 × 3.2 m in a 40-foot flat rack.", facts, "The injection molding machine exceeded standard dimensions and required a verified lifting and securing plan.", "The team coordinated injection molding machine measurements, flat-rack booking, lifting interfaces, securing, and transport documents.", "The injection molding machine moved to Turkey under the agreed special-container plan."),
      zh: caseCopy("zh", "注塑机出口土耳其", "zhu-su-ji-tu-er-qi", "代表性项目：一台 28 吨、尺寸 11.8 × 2.6 × 3.2 米的注塑机使用 40 英尺框架柜出口土耳其。", facts, "设备超出标准尺寸，需要核实吊装与加固方案。", "团队协同尺寸复核、框架柜订舱、吊装接口、加固及运输单证。", "设备按约定的特种柜方案运往土耳其。"),
      ru: caseCopy("ru", "Экспорт термопластавтомата в Турцию", "termoplastavtomat-turtsiya", "Представительный проект: оборудование весом 28 т и размером 11.8 × 2.6 × 3.2 м отправлено в Турцию на 40-футовой платформе flat rack.", facts, "Оборудование превышало стандартные габариты, поэтому требовались проверенные схемы подъема и крепления.", "Команда координировала замеры, бронирование flat rack, подъем, крепление и транспортные документы.", "Оборудование отправлено в Турцию по согласованной схеме со специальным контейнером."),
    }, { processStageId: "pickup" });
  })(),
  (() => {
    const facts = [
      fact("destination", "Moscow", "Destination", "目的地", "Пункт назначения"),
      fact("mode", "TIR road", "Mode", "运输方式", "Вид перевозки"),
      fact("distance", "8,600", "Approximate distance", "运输里程（约）", "Примерное расстояние", "km"),
      fact("duration", "15", "Approximate transit time", "运输时效（约）", "Примерный срок перевозки", "days"),
    ];
    return item("case-studies", "excavators-tir-moscow", "case-excavators-tir-moscow", {
      en: caseCopy("en", "Excavators by TIR to Moscow", "excavators-tir-moscow", "Representative TIR movement of excavators to Moscow over about 8,600 km in about 15 days.", facts, "Large equipment required route checks, cross-border timing, and protection at each handoff.", "The team coordinated TIR documentation, border milestones, equipment securing, and delivery communication.", "The representative route covered about 8,600 km and reached Moscow in about 15 days."),
      zh: caseCopy("zh", "挖掘机 TIR 运输至莫斯科", "wa-jue-ji-tir-mo-si-ke", "代表性项目：挖掘机通过 TIR 运抵莫斯科，里程约 8,600 公里，用时约 15 天。", facts, "大型设备需要核对路线、跨境时点及各交接节点的设备保护。", "团队协同 TIR 单证、口岸节点、设备加固及交付沟通。", "该代表性路线约 8,600 公里，约 15 天抵达莫斯科。"),
      ru: caseCopy("ru", "Экскаваторы по TIR в Москву", "ekskavatory-tir-moskva", "Представительный проект: экскаваторы доставлены в Москву по TIR примерно за 15 дней по маршруту около 8 600 км.", facts, "Для крупной техники требовались проверка маршрута, планирование границ и защита при каждой передаче.", "Команда координировала документы TIR, пограничные этапы, крепление техники и связь по доставке.", "Маршрут составил около 8 600 км, доставка в Москву заняла примерно 15 дней."),
    }, { processStageId: "delivery" });
  })(),
  (() => {
    const facts = [
      fact("route", "China-Russia", "Route", "路线", "Маршрут"),
      fact("mode", "Rail", "Mode", "运输方式", "Вид перевозки"),
      fact("duration", "18–22", "Approximate transit time", "运输时效（约）", "Примерный срок перевозки", "days"),
      fact("projectCostDifference", "60", "Representative project cost comparison with air", "该项目与空运成本对比", "Сравнение стоимости с авиа в этом проекте", "%"),
    ];
    return item("case-studies", "auto-parts-rail-russia", "case-auto-parts-rail-russia", {
      en: caseCopy("en", "Auto Parts by Rail from China to Russia", "auto-parts-rail-china-russia", "Representative China-Russia rail movement of auto parts in about 18-22 days.", facts, "The plan had to balance delivery timing, rail schedules, terminal handoffs, and budget.", "The team coordinated container planning, rail booking, border documents, and final road delivery.", "For this project, transit was about 18-22 days and the compared rail plan cost about 60% less than air at that time."),
      zh: caseCopy("zh", "汽车配件中俄铁路运输", "qi-che-pei-jian-zhong-e-tie-lu", "代表性项目：汽车配件通过中俄铁路运输，时效约 18 至 22 天。", facts, "方案需要在交付时效、班列计划、场站交接及预算之间取得平衡。", "团队协同箱型计划、铁路订舱、口岸单证及末端公路配送。", "就该项目当时的比较而言，运输约 18 至 22 天，铁路方案成本比空运低约 60%。"),
      ru: caseCopy("ru", "Автокомпоненты по железной дороге Китай-Россия", "avtokomponenty-zhd-kitay-rossiya", "Представительный проект: железнодорожная перевозка автокомпонентов из Китая в Россию примерно за 18-22 дня.", facts, "Требовалось сбалансировать срок доставки, график поезда, терминальные передачи и бюджет.", "Команда координировала контейнер, бронирование поезда, пограничные документы и автомобильную доставку.", "В этом проекте перевозка заняла около 18-22 дней, а сравнивавшаяся железнодорожная схема была примерно на 60% дешевле авиаперевозки."),
    }, { processStageId: "transit" });
  })(),
  (() => {
    const facts = [
      fact("destination", "Munich", "Destination", "目的地", "Пункт назначения"),
      fact("mode", "Air", "Mode", "运输方式", "Вид перевозки"),
      fact("weight", "3", "Weight", "货重", "Вес", "t"),
      fact("duration", "42", "Approximate transit time", "运输时效（约）", "Примерный срок перевозки", "hours"),
    ];
    return item("case-studies", "electronics-air-munich", "case-electronics-air-munich", {
      en: caseCopy("en", "Electronics by Air to Munich", "electronics-air-munich", "Representative air movement of 3 t of electronics to Munich in about 42 hours.", facts, "The high-priority cargo required rapid document readiness, capacity confirmation, and coordinated handoffs.", "The team aligned cargo data, flight booking, airport handling, milestone updates, and destination delivery.", "The representative shipment reached Munich in about 42 hours."),
      zh: caseCopy("zh", "3 吨电子部件空运慕尼黑", "dian-zi-bu-jian-kong-yun-mu-ni-hei", "代表性项目：3 吨电子部件空运至慕尼黑，用时约 42 小时。", facts, "高时效货物需要快速完成单证准备、舱位确认及交接协同。", "团队衔接货物资料、航班订舱、机场操作、节点更新与目的地配送。", "该代表性货物约 42 小时抵达慕尼黑。"),
      ru: caseCopy("ru", "Электроника авиатранспортом в Мюнхен", "elektronika-avia-myunhen", "Представительный проект: 3 т электроники доставлены авиатранспортом в Мюнхен примерно за 42 часа.", facts, "Для срочного груза требовались быстрая подготовка документов, подтверждение емкости и согласованные передачи.", "Команда координировала данные груза, бронирование рейса, аэропортовую обработку, статусы и доставку.", "Представительная партия прибыла в Мюнхен примерно за 42 часа."),
    }, { processStageId: "transit" });
  })(),
  (() => {
    const facts = [
      fact("cargo", "Used semiconductor equipment", "Cargo", "货物", "Груз"),
      fact("movement", "Import clearance", "Project type", "项目类型", "Тип проекта"),
      fact("duration", "5", "Approximate project resolution time", "该项目问题处理用时（约）", "Примерный срок решения в проекте", "days"),
    ];
    return item("case-studies", "semiconductor-import-clearance", "case-semiconductor-clearance", {
      en: caseCopy("en", "Used Semiconductor Equipment Import Clearance", "used-semiconductor-import-clearance", "Representative import-clearance project for used semiconductor equipment, with the identified issue resolved in about five days.", facts, "Used equipment records required reconciliation before inspection and customs communication could proceed.", "The team coordinated document comparison, equipment data clarification, inspection support, and customs-facing communication.", "The identified clearance issue was resolved in about five days for this project."),
      zh: caseCopy("zh", "二手半导体设备进口清关", "er-shou-ban-dao-ti-she-bei-qing-guan", "代表性项目：二手半导体设备进口清关，发现的问题约 5 天完成处理。", facts, "二手设备资料需要核对一致后，方可推进查验及关务沟通。", "团队协同单证比对、设备信息澄清、查验支持及关务沟通。", "该项目发现的清关问题约 5 天完成处理。"),
      ru: caseCopy("ru", "Импортное оформление бывшего в эксплуатации полупроводникового оборудования", "importnoe-oformlenie-poluprovodnikovogo-oborudovaniya", "Представительный проект импортного оформления бывшего в эксплуатации полупроводникового оборудования; выявленный вопрос решен примерно за пять дней.", facts, "До досмотра и взаимодействия с таможней требовалось сверить сведения о бывшем в эксплуатации оборудовании.", "Команда координировала сопоставление документов, уточнение данных, поддержку досмотра и коммуникацию с таможней.", "Выявленный вопрос оформления был решен примерно за пять дней в рамках этого проекта.", { seoTitle: "Импортное оформление оборудования | AnShow" }),
    }, { processStageId: "customs" });
  })(),
];

const articles: SeedItem[] = [
  item("articles", "enquiry-preparation", "trust-operations", localizedParagraphs(
    ["What to Prepare for a Freight Enquiry", "prepare-freight-enquiry", "Prepare route, cargo, dimensions, weight, timing, handling, and contact details for a clearer forwarding response."],
    ["提交货运询盘前需要准备什么", "huo-yun-xun-pan-zhun-bei", "提前整理路线、品名、尺寸、重量、时效、操作要求及联系方式，便于货代准确回复。"],
    ["Что подготовить для запроса на перевозку", "podgotovka-zaprosa-na-perevozku", "Подготовьте маршрут, описание, габариты, вес, сроки, требования к обработке и контакты для точного ответа экспедитора."],
  )),
  item("articles", "mode-selection", "service-rail", localizedParagraphs(
    ["How to Compare Freight Modes", "compare-freight-modes", "A neutral guide to timing, cargo constraints, cost composition, capacity, and handoffs across ocean, air, rail, and road."],
    ["如何比较不同运输方式", "ru-he-bi-jiao-yun-shu-fang-shi", "从时效、货物限制、费用构成、舱位及交接节点比较海运、空运、铁路与公路运输。"],
    ["Как сравнивать виды грузовых перевозок", "sravnenie-vidov-perevozok", "Нейтральный обзор сроков, ограничений груза, структуры стоимости, емкости и перегрузок для моря, авиа, железной дороги и авто."],
  )),
  item("articles", "document-readiness", "trust-customs", localizedParagraphs(
    ["Why Document Readiness Matters", "document-readiness", "Complete and consistent shipment records support booking, declaration, handling, and destination coordination."],
    ["为什么单证准备很重要", "dan-zheng-zhun-bei", "完整且一致的运输资料有助于订舱、申报、操作及目的地交接。"],
    ["Почему важна готовность документов", "gotovnost-dokumentov", "Полные и согласованные сведения помогают при бронировании, декларировании, обработке и передаче в пункте назначения."],
  )),
];

const certificates: SeedItem[] = [
  item("certificates", "iata", undefined, localizedParagraphs(
    ["IATA", "iata-qualification", "AnShow lists IATA membership among its freight-forwarding qualifications; credential details are displayed only after verification."],
    ["IATA 资质", "iata-zi-zhi", "安啸将 IATA 会员资质列入企业资质；凭证详情仅在完成核实后展示。"],
    ["IATA", "kvalifikatsiya-iata", "AnShow указывает членство IATA в числе своих квалификаций; реквизиты подтверждения публикуются только после проверки."],
  )),
  item("certificates", "nvocc", undefined, localizedParagraphs(
    ["NVOCC", "nvocc-qualification", "AnShow lists NVOCC qualification among its ocean-forwarding credentials; registration details are displayed only after verification."],
    ["NVOCC 资质", "nvocc-zi-zhi", "安啸将 NVOCC 资质列入海运代理资质；登记详情仅在完成核实后展示。"],
    ["NVOCC", "kvalifikatsiya-nvocc", "AnShow указывает статус NVOCC среди квалификаций в морском экспедировании; регистрационные данные публикуются только после проверки."],
  )),
  item("certificates", "wca", undefined, localizedParagraphs(
    ["WCA", "wca-membership", "WCA membership supports coordination with international forwarding partners at origin, transit, and destination."],
    ["WCA 会员", "wca-hui-yuan", "WCA 会员网络支持安啸与起运地、中转地及目的地国际货代伙伴开展协同。"],
    ["WCA", "chlenstvo-wca", "Членство WCA помогает координировать работу с международными экспедиторами в пунктах отправления, транзита и назначения."],
  )),
  item("certificates", "jctrans", undefined, localizedParagraphs(
    ["JCtrans", "jctrans-membership", "JCtrans membership supports partner coordination for selected international forwarding requirements."],
    ["JCtrans 会员", "jctrans-hui-yuan", "JCtrans 会员网络支持重点国际货运代理需求的伙伴协同。"],
    ["JCtrans", "chlenstvo-jctrans", "Членство JCtrans поддерживает партнерскую координацию по выбранным международным перевозкам."],
  )),
];

const proofMetrics: SeedItem[] = [
  item("proof-metrics", "founded-2012", "trust-operations", {
    en: copy("Founded in 2012", "founded-2012", "AnShow has coordinated international freight forwarding from Shenzhen since 2012.", [
      { type: "fact-list", items: [{ key: "founded", label: "Founded", value: "2012" }] },
    ]),
    zh: copy("成立于 2012 年", "cheng-li-2012", "安啸自 2012 年起在深圳协同国际货运代理业务。", [
      { type: "fact-list", items: [{ key: "founded", label: "成立年份", value: "2012" }] },
    ]),
    ru: copy("Основана в 2012 году", "osnovana-2012", "AnShow координирует международные перевозки из Шэньчжэня с 2012 года.", [
      { type: "fact-list", items: [{ key: "founded", label: "Год основания", value: "2012" }] },
    ]),
  }),
  item("proof-metrics", "exception-response", "trust-coordination", {
    en: copy("2-hour exception response target", "two-hour-exception-response", "Operational exceptions enter AnShow's response mechanism with a target initial response within two hours; resolution time depends on the event.", [
      { type: "callout", title: "Response target", text: "The two-hour target applies to entering the response mechanism and an initial response, not guaranteed resolution within two hours." },
    ]),
    zh: copy("2 小时异常响应机制目标", "liang-xiao-shi-yi-chang-xiang-ying", "运输异常进入安啸响应机制，首次响应目标为 2 小时内；实际解决时间取决于具体事件。", [
      { type: "callout", title: "响应口径", text: "2 小时目标指进入响应机制并作出首次响应，不代表所有问题均在 2 小时内解决。" },
    ]),
    ru: copy("Цель первичного ответа на исключение - 2 часа", "otvet-na-isklyuchenie-dva-chasa", "Операционное исключение включается в механизм реагирования AnShow с целью первичного ответа в течение двух часов; срок решения зависит от ситуации.", [
      { type: "callout", title: "Целевой срок ответа", text: "Два часа относятся к запуску механизма и первичному ответу, а не к гарантированному решению за это время." },
    ]),
  }),
  item("proof-metrics", "multilingual-support", "trust-coordination", localizedParagraphs(
    ["24/7 multilingual communication", "multilingual-support", "AnShow provides 24/7 multilingual communication support for active freight coordination."],
    ["7x24 多语言沟通支持", "duo-yu-yan-gou-tong-zhi-chi", "安啸为在途货运协同提供 7x24 多语言沟通支持。"],
    ["Многоязычная связь 24/7", "mnogoyazychnaya-podderzhka", "AnShow обеспечивает круглосуточную многоязычную связь при координации действующих перевозок."],
  )),
  item("proof-metrics", "transparent-pricing", "trust-operations", localizedParagraphs(
    ["Transparent quote composition", "transparent-quote-composition", "Quotes identify the planned transport components and assumptions to reduce hidden charges and information gaps."],
    ["报价构成透明", "bao-jia-gou-cheng-tou-ming", "报价明确计划内运输费用构成及前提，减少隐藏费用和信息差。"],
    ["Прозрачная структура предложения", "prozrachnaya-struktura-stoimosti", "Предложение раскрывает запланированные компоненты и исходные условия, снижая риск скрытых расходов и информационных разрывов."],
  )),
];

const navigationItems: SeedItem[] = [
  item("navigation-items", "home", undefined, localizedParagraphs(
    ["Home", "home", "Return to the AnShow home page."],
    ["首页", "shou-ye", "返回安啸首页。"],
    ["Главная", "glavnaya", "Вернуться на главную страницу AnShow."],
  )),
  item("navigation-items", "services", undefined, localizedParagraphs(
    ["Services", "services", "Explore AnShow freight-forwarding services."],
    ["物流服务", "wu-liu-fu-wu", "了解安啸国际货运代理服务。"],
    ["Услуги", "uslugi", "Ознакомьтесь с экспедиторскими услугами AnShow."],
  )),
  item("navigation-items", "network", undefined, localizedParagraphs(
    ["Network", "network", "Explore AnShow's international partner coordination."],
    ["服务网络", "fu-wu-wang-luo", "了解安啸的国际代理协同。"],
    ["Сеть", "set", "Узнайте о международной партнерской координации AnShow."],
  )),
  item("navigation-items", "about", undefined, localizedParagraphs(
    ["About", "about", "Learn about AnShow's company facts and forwarding approach."],
    ["关于我们", "guan-yu-wo-men", "了解安啸的企业信息与货代服务方式。"],
    ["О компании", "o-kompanii", "Узнайте о компании AnShow и ее подходе к экспедированию."],
  )),
  item("navigation-items", "insights", undefined, localizedParagraphs(
    ["Insights", "insights", "Read practical freight-planning guides."],
    ["行业洞察", "hang-ye-dong-cha", "阅读实用的货运规划指南。"],
    ["Материалы", "materialy", "Читайте практические материалы о планировании перевозок."],
  )),
  item("navigation-items", "contact", undefined, localizedParagraphs(
    ["Contact", "contact", "Contact the AnShow team about a freight requirement."],
    ["联系我们", "lian-xi-wo-men", "就货运需求联系安啸团队。"],
    ["Контакты", "kontakty", "Свяжитесь с командой AnShow по вопросу перевозки."],
  )),
  item("navigation-items", "privacy", undefined, localizedParagraphs(
    ["Privacy", "privacy", "Read the AnShow privacy notice."],
    ["隐私", "yin-si", "阅读安啸隐私声明。"],
    ["Конфиденциальность", "konfidentsialnost", "Прочитайте уведомление AnShow о конфиденциальности."],
  )),
  item("navigation-items", "terms", undefined, localizedParagraphs(
    ["Terms", "terms", "Read the AnShow website terms."],
    ["条款", "tiao-kuan", "阅读安啸网站使用条款。"],
    ["Условия", "usloviya", "Прочитайте условия использования сайта AnShow."],
  )),
  item("navigation-items", "cookies", undefined, localizedParagraphs(
    ["Cookies", "cookies", "Read the AnShow cookie notice."],
    ["Cookie", "cookie", "阅读安啸 Cookie 声明。"],
    ["Cookie", "cookie", "Прочитайте уведомление AnShow о cookie."],
  )),
];

export const seedCatalog: SeedItem[] = [
  ...heroSlides,
  ...services,
  ...tradeLanes,
  ...cargoTypes,
  ...pages,
  ...caseStudies,
  ...articles,
  ...certificates,
  ...proofMetrics,
  ...navigationItems,
];
