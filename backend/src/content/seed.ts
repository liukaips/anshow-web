import type { AppDatabase } from "../db/client.js";
import {
  articles,
  articleTranslations,
  cargoTypes,
  cargoTypeTranslations,
  caseStudies,
  caseStudyTranslations,
  heroSlides,
  heroSlideTranslations,
  navigationItems,
  navigationItemTranslations,
  pages,
  pageTranslations,
  services,
  serviceTranslations,
  tradeLanes,
  tradeLaneTranslations,
} from "../db/schema/content.js";
import type { Locale, ProcessStageId } from "./types.js";
import { LOCALES } from "./types.js";

export type SeedCollection =
  | "hero-slides"
  | "services"
  | "trade-lanes"
  | "cargo-types"
  | "pages"
  | "case-studies"
  | "articles"
  | "navigation-items";

type CopyInput = {
  title: string;
  slug: string;
  summary: string;
};

export type SeedTranslation = CopyInput & {
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

function expandCopy(copy: CopyInput, locale: Locale): SeedTranslation {
  const separator = locale === "zh" ? "：" : ": ";
  return {
    ...copy,
    body: copy.summary,
    seoTitle: `${copy.title} | AnShow`,
    seoDescription: copy.summary,
    altText: `${copy.title}${separator}${copy.summary}`,
  };
}

function item(
  collection: SeedCollection,
  code: string,
  desiredMediaId: string | undefined,
  en: CopyInput,
  zh: CopyInput,
  ru: CopyInput,
  options: { publish?: boolean; processStageId?: ProcessStageId } = {},
): SeedItem {
  return {
    collection,
    code,
    desiredMediaId,
    processStageId: options.processStageId,
    publish: options.publish ?? true,
    translations: {
      en: expandCopy(en, "en"),
      zh: expandCopy(zh, "zh"),
      ru: expandCopy(ru, "ru"),
    },
  };
}

export const seedCatalog: SeedItem[] = [
  item(
    "hero-slides",
    "ocean",
    "hero-ocean",
    { title: "Ocean freight with connected coordination", slug: "ocean", summary: "Plan containerized and specialist ocean movements with one forwarding contact." },
    { title: "协同衔接的国际海运", slug: "hai-yun", summary: "通过统一货运代理窗口规划集装箱及专业海运需求。" },
    { title: "Морские перевозки с единой координацией", slug: "morskie-perevozki", summary: "Планируйте контейнерные и специализированные морские перевозки через единое окно." },
    { processStageId: "route" },
  ),
  item(
    "hero-slides",
    "air",
    "hero-air",
    { title: "Air freight for priority cargo", slug: "air", summary: "Coordinate time-sensitive air cargo with clear milestones and documentation readiness." },
    { title: "面向优先货物的国际空运", slug: "kong-yun", summary: "以清晰节点和文件准备协同时间敏感型空运货物。" },
    { title: "Авиаперевозки для приоритетных грузов", slug: "aviaperevozki", summary: "Координируйте срочные авиагрузы с понятными этапами и готовностью документов." },
    { processStageId: "route" },
  ),
  item(
    "hero-slides",
    "rail",
    "hero-rail",
    { title: "Rail freight across Eurasian corridors", slug: "rail", summary: "Build rail and multimodal plans for China, Russia, Europe, and Central Asia." },
    { title: "贯通欧亚通道的铁路运输", slug: "tie-lu", summary: "为中国、俄罗斯、欧洲及中亚方向规划铁路与多式联运方案。" },
    { title: "Железнодорожные перевозки по Евразии", slug: "zheleznodorozhnye-perevozki", summary: "Формируйте железнодорожные и мультимодальные решения для Китая, России, Европы и Центральной Азии." },
    { processStageId: "route" },
  ),
  item(
    "hero-slides",
    "road",
    "hero-road",
    { title: "Road freight that closes the route", slug: "road", summary: "Connect terminals, warehouses, and delivery points with coordinated road transport." },
    { title: "衔接全程的公路运输", slug: "gong-lu", summary: "通过协同公路运输连接场站、仓库和最终交付点。" },
    { title: "Автоперевозки, завершающие маршрут", slug: "avtoperevozki", summary: "Связывайте терминалы, склады и пункты доставки согласованным автотранспортом." },
    { processStageId: "delivery" },
  ),

  item(
    "services",
    "ocean-freight",
    "service-ocean",
    { title: "Ocean Freight", slug: "ocean-freight", summary: "Forwarding support for containerized, consolidated, and specialist ocean cargo." },
    { title: "海运服务", slug: "hai-yun-fu-wu", summary: "为整箱、拼箱及专业海运货物提供货运代理支持。" },
    { title: "Морские перевозки", slug: "morskie-perevozki", summary: "Экспедирование контейнерных, сборных и специализированных морских грузов." },
    { processStageId: "transit" },
  ),
  item(
    "services",
    "air-freight",
    "service-air",
    { title: "Air Freight", slug: "air-freight", summary: "Air forwarding for priority, controlled, and schedule-sensitive cargo." },
    { title: "空运服务", slug: "kong-yun-fu-wu", summary: "为优先、受控及对时效敏感的货物提供空运代理。" },
    { title: "Авиаперевозки", slug: "aviaperevozki", summary: "Авиаэкспедирование приоритетных, контролируемых и срочных грузов." },
    { processStageId: "transit" },
  ),
  item(
    "services",
    "rail-freight",
    "service-rail",
    { title: "Rail Freight", slug: "rail-freight", summary: "Rail and terminal coordination across selected Eurasian corridors." },
    { title: "铁路运输", slug: "tie-lu-yun-shu", summary: "面向重点欧亚通道提供铁路及场站协同。" },
    { title: "Железнодорожные перевозки", slug: "zheleznodorozhnye-perevozki", summary: "Координация железнодорожных и терминальных операций на выбранных евразийских маршрутах." },
    { processStageId: "transit" },
  ),
  item(
    "services",
    "road-freight",
    "service-road",
    { title: "Road Freight", slug: "road-freight", summary: "Regional and cross-border road coordination for planned cargo movements." },
    { title: "公路运输", slug: "gong-lu-yun-shu", summary: "为计划内货物流转提供区域及跨境公路协同。" },
    { title: "Автомобильные перевозки", slug: "avtomobilnye-perevozki", summary: "Региональная и трансграничная координация плановых грузовых перевозок." },
    { processStageId: "delivery" },
  ),
  item(
    "services",
    "multimodal",
    "service-multimodal",
    { title: "Multimodal Transport", slug: "multimodal-transport", summary: "Combine ocean, air, rail, and road legs under one coordinated plan." },
    { title: "多式联运", slug: "duo-shi-lian-yun", summary: "在统一方案下衔接海运、空运、铁路和公路运输。" },
    { title: "Мультимодальные перевозки", slug: "multimodalnye-perevozki", summary: "Объединяйте морские, авиационные, железнодорожные и автомобильные этапы в одном плане." },
    { processStageId: "route" },
  ),
  item(
    "services",
    "customs",
    "service-customs",
    { title: "Customs Services", slug: "customs-services", summary: "Prepare shipment information and coordinate customs-facing documentation workflows." },
    { title: "关务服务", slug: "guan-wu-fu-wu", summary: "准备运输信息并协同面向海关的文件流程。" },
    { title: "Таможенное сопровождение", slug: "tamozhennoe-soprovozhdenie", summary: "Подготовка данных и координация документальных процедур для таможенного оформления." },
    { processStageId: "customs" },
  ),
  item(
    "services",
    "warehousing",
    "service-warehouse",
    { title: "Warehousing and Distribution", slug: "warehousing-distribution", summary: "Coordinate intake, storage, handling, and onward distribution requirements." },
    { title: "仓储与配送", slug: "cang-chu-yu-pei-song", summary: "协同入库、存储、操作及后续配送需求。" },
    { title: "Складирование и дистрибуция", slug: "skladirovanie-i-distributsiya", summary: "Координация приемки, хранения, обработки и дальнейшего распределения." },
    { processStageId: "pickup" },
  ),

  item(
    "trade-lanes",
    "china-russia",
    "lane-china-russia",
    { title: "China-Russia", slug: "china-russia", summary: "Explore coordinated rail, road, air, and multimodal options between China and Russia." },
    { title: "中国至俄罗斯", slug: "zhong-guo-e-luo-si", summary: "了解中国与俄罗斯之间的铁路、公路、空运及多式联运协同方案。" },
    { title: "Китай — Россия", slug: "kitay-rossiya", summary: "Рассмотрите согласованные железнодорожные, автомобильные, авиационные и мультимодальные варианты." },
    { processStageId: "route" },
  ),
  item(
    "trade-lanes",
    "china-europe",
    "lane-china-europe",
    { title: "China-Europe", slug: "china-europe", summary: "Plan selected China-Europe freight movements with mode and handoff coordination." },
    { title: "中国至欧洲", slug: "zhong-guo-ou-zhou", summary: "通过运输方式与交接协同规划重点中欧货运需求。" },
    { title: "Китай — Европа", slug: "kitay-evropa", summary: "Планируйте выбранные перевозки между Китаем и Европой с координацией видов транспорта и перегрузок." },
    { processStageId: "route" },
  ),
  item(
    "trade-lanes",
    "central-asia",
    "lane-central-asia",
    { title: "Central Asia", slug: "central-asia", summary: "Coordinate freight routes serving selected Central Asian markets and gateways." },
    { title: "中亚通道", slug: "zhong-ya-tong-dao", summary: "协同服务重点中亚市场及口岸的货运路线。" },
    { title: "Центральная Азия", slug: "tsentralnaya-aziya", summary: "Координируйте маршруты через выбранные рынки и транспортные узлы Центральной Азии." },
    { processStageId: "route" },
  ),
  item(
    "trade-lanes",
    "global-network",
    "lane-global",
    { title: "Global Network", slug: "global-network", summary: "Connect origin, transit, and destination partners for international forwarding requirements." },
    { title: "全球网络", slug: "quan-qiu-wang-luo", summary: "为国际货运代理需求衔接起运地、中转地和目的地合作资源。" },
    { title: "Глобальная сеть", slug: "globalnaya-set", summary: "Связывайте партнеров в пунктах отправления, транзита и назначения для международного экспедирования." },
    { processStageId: "route" },
  ),

  item(
    "cargo-types",
    "project-cargo",
    "cargo-project",
    { title: "Project Cargo", slug: "project-cargo", summary: "Coordinate route, handling, equipment, and documentation for project movements." },
    { title: "项目物流", slug: "xiang-mu-wu-liu", summary: "为项目运输协同路线、装卸、设备和文件。" },
    { title: "Проектные грузы", slug: "proektnye-gruzy", summary: "Координация маршрута, обработки, оборудования и документов для проектных перевозок." },
    { processStageId: "pickup" },
  ),
  item(
    "cargo-types",
    "oversized-cargo",
    "cargo-oversized",
    { title: "Oversized Cargo", slug: "oversized-cargo", summary: "Plan handling and transport interfaces for cargo outside standard dimensions." },
    { title: "超限货物", slug: "chao-xian-huo-wu", summary: "为超出标准尺寸的货物规划装卸与运输接口。" },
    { title: "Негабаритные грузы", slug: "negabaritnye-gruzy", summary: "Планирование обработки и транспортных стыков для грузов нестандартных размеров." },
    { processStageId: "pickup" },
  ),
  item(
    "cargo-types",
    "dangerous-goods",
    "cargo-dangerous",
    { title: "Dangerous Goods", slug: "dangerous-goods", summary: "Coordinate declared regulated cargo with qualified parties and required documentation." },
    { title: "危险品运输", slug: "wei-xian-pin-yun-shu", summary: "与具备资质的相关方协同已申报受监管货物及所需文件。" },
    { title: "Опасные грузы", slug: "opasnye-gruzy", summary: "Координация заявленных регулируемых грузов с компетентными сторонами и необходимыми документами." },
    { processStageId: "customs" },
  ),
  item(
    "cargo-types",
    "temperature-controlled",
    "cargo-cold-chain",
    { title: "Temperature-Controlled Cargo", slug: "temperature-controlled-cargo", summary: "Plan temperature requirements, handoffs, and monitoring responsibilities." },
    { title: "温控货物", slug: "wen-kong-huo-wu", summary: "规划温度要求、交接节点及监控责任。" },
    { title: "Температурные грузы", slug: "temperaturnye-gruzy", summary: "Планирование температурных требований, перегрузок и ответственности за мониторинг." },
    { processStageId: "pickup" },
  ),

  item("pages", "about", "trust-operations", { title: "About AnShow", slug: "about", summary: "Learn how AnShow organizes international forwarding around clear communication and accountable coordination." }, { title: "关于 AnShow", slug: "guan-yu", summary: "了解 AnShow 如何以清晰沟通和责任明确的协同组织国际货运代理。" }, { title: "Об AnShow", slug: "o-kompanii", summary: "Узнайте, как AnShow организует международное экспедирование на основе понятной коммуникации и ответственной координации." }),
  item("pages", "network", "trust-coordination", { title: "Network", slug: "network", summary: "See how origin, transit, and destination coordination supports international routes." }, { title: "服务网络", slug: "fu-wu-wang-luo", summary: "了解起运地、中转地和目的地协同如何支持国际路线。" }, { title: "Сеть", slug: "set", summary: "Узнайте, как координация в пунктах отправления, транзита и назначения поддерживает международные маршруты." }),
  item("pages", "contact", "trust-coordination", { title: "Contact", slug: "contact", summary: "Share your route, cargo, and timing requirements with the AnShow team." }, { title: "联系我们", slug: "lian-xi", summary: "向 AnShow 团队说明您的路线、货物及时间需求。" }, { title: "Контакты", slug: "kontakty", summary: "Сообщите команде AnShow маршрут, характеристики груза и временные требования." }),
  item("pages", "privacy", undefined, { title: "Privacy Notice", slug: "privacy", summary: "How AnShow handles information submitted through this website." }, { title: "隐私声明", slug: "yin-si", summary: "说明 AnShow 如何处理通过本网站提交的信息。" }, { title: "Уведомление о конфиденциальности", slug: "konfidentsialnost", summary: "Как AnShow обрабатывает информацию, отправленную через этот сайт." }),
  item("pages", "terms", undefined, { title: "Terms of Use", slug: "terms", summary: "Terms governing use of the AnShow website and published information." }, { title: "使用条款", slug: "shi-yong-tiao-kuan", summary: "适用于 AnShow 网站及所发布信息的使用条款。" }, { title: "Условия использования", slug: "usloviya", summary: "Условия использования сайта AnShow и опубликованной информации." }),
  item("pages", "cookies", undefined, { title: "Cookie Notice", slug: "cookies", summary: "Information about essential and optional browser storage used by this website." }, { title: "Cookie 声明", slug: "cookie-sheng-ming", summary: "说明本网站使用的必要及可选浏览器存储。" }, { title: "Уведомление о cookie", slug: "cookie", summary: "Информация об обязательном и дополнительном хранении данных в браузере." }),
  item("pages", "not-found", undefined, { title: "Page not found", slug: "not-found", summary: "The requested page is unavailable. Return to AnShow services or contact the team." }, { title: "页面未找到", slug: "wei-zhao-dao", summary: "您访问的页面不可用，请返回 AnShow 服务页面或联系我们。" }, { title: "Страница не найдена", slug: "ne-naydeno", summary: "Запрошенная страница недоступна. Вернитесь к услугам AnShow или свяжитесь с командой." }),

  item("case-studies", "multimodal-planning", "trust-coordination", { title: "A multimodal planning framework", slug: "multimodal-planning-framework", summary: "A representative planning framework showing how route legs, handoffs, and documents can be coordinated without claiming a named customer result." }, { title: "多式联运规划框架", slug: "duo-shi-lian-yun-gui-hua", summary: "以代表性框架说明如何协同运输区段、交接和文件，不宣称具体客户成果。" }, { title: "Схема мультимодального планирования", slug: "skhema-multimodalnogo-planirovaniya", summary: "Типовая схема координации этапов, перегрузок и документов без заявлений о результатах конкретного клиента." }, { publish: false, processStageId: "route" }),
  item("case-studies", "customs-readiness", "trust-customs", { title: "A customs-readiness workflow", slug: "customs-readiness-workflow", summary: "A representative workflow for collecting, reviewing, and handing off shipment information." }, { title: "关务准备流程", slug: "guan-wu-zhun-bei-liu-cheng", summary: "用于收集、检查和交接运输信息的代表性流程。" }, { title: "Процесс таможенной готовности", slug: "protsess-tamozhennoy-gotovnosti", summary: "Типовой процесс сбора, проверки и передачи информации о перевозке." }, { publish: false, processStageId: "customs" }),
  item("case-studies", "warehouse-handoff", "trust-warehouse", { title: "A warehouse handoff checklist", slug: "warehouse-handoff-checklist", summary: "A representative checklist for intake, condition records, handling, and onward release." }, { title: "仓库交接清单", slug: "cang-ku-jiao-jie-qing-dan", summary: "覆盖入库、状态记录、操作及后续放行的代表性清单。" }, { title: "Чек-лист складской передачи", slug: "chek-list-skladskoy-peredachi", summary: "Типовой чек-лист приемки, фиксации состояния, обработки и дальнейшей выдачи." }, { publish: false, processStageId: "pickup" }),

  item("articles", "enquiry-preparation", "trust-operations", { title: "What to prepare before a freight enquiry", slug: "prepare-freight-enquiry", summary: "A practical list of route, cargo, timing, and handling information that helps a forwarder respond clearly." }, { title: "提交货运询盘前需要准备什么", slug: "huo-yun-xun-pan-zhun-bei", summary: "整理路线、货物、时间和操作信息，帮助货运代理更清晰地回复。" }, { title: "Что подготовить перед запросом", slug: "podgotovka-zaprosa", summary: "Практический список данных о маршруте, грузе, сроках и обработке для точного ответа экспедитора." }),
  item("articles", "mode-selection", "service-multimodal", { title: "How transport modes shape a freight plan", slug: "transport-mode-selection", summary: "A neutral overview of factors considered when comparing ocean, air, rail, road, and multimodal options." }, { title: "运输方式如何影响货运方案", slug: "yun-shu-fang-shi-xuan-ze", summary: "中立介绍比较海运、空运、铁路、公路和多式联运时需要考虑的因素。" }, { title: "Как вид транспорта влияет на план", slug: "vybor-vida-transporta", summary: "Нейтральный обзор факторов при сравнении морских, авиационных, железнодорожных, автомобильных и мультимодальных решений." }),
  item("articles", "document-readiness", "trust-customs", { title: "Why document readiness matters", slug: "document-readiness", summary: "An overview of how complete, consistent shipment information supports smoother coordination." }, { title: "为什么文件准备很重要", slug: "wen-jian-zhun-bei", summary: "说明完整、一致的运输信息如何支持更顺畅的协同。" }, { title: "Почему важна готовность документов", slug: "gotovnost-dokumentov", summary: "Обзор того, как полная и согласованная информация помогает координации перевозки." }),

  item("navigation-items", "home", undefined, { title: "Home", slug: "home", summary: "Return to the AnShow home page." }, { title: "首页", slug: "shou-ye", summary: "返回 AnShow 首页。" }, { title: "Главная", slug: "glavnaya", summary: "Вернуться на главную страницу AnShow." }),
  item("navigation-items", "services", undefined, { title: "Services", slug: "services", summary: "Explore AnShow freight forwarding services." }, { title: "服务", slug: "fu-wu", summary: "了解 AnShow 货运代理服务。" }, { title: "Услуги", slug: "uslugi", summary: "Ознакомьтесь с экспедиторскими услугами AnShow." }),
  item("navigation-items", "network", undefined, { title: "Network", slug: "network", summary: "Explore AnShow route coordination." }, { title: "服务网络", slug: "fu-wu-wang-luo", summary: "了解 AnShow 路线协同。" }, { title: "Сеть", slug: "set", summary: "Узнайте о координации маршрутов AnShow." }),
  item("navigation-items", "about", undefined, { title: "About", slug: "about", summary: "Learn about AnShow's coordination approach." }, { title: "关于我们", slug: "guan-yu", summary: "了解 AnShow 的协同方式。" }, { title: "О компании", slug: "o-kompanii", summary: "Узнайте о подходе AnShow к координации." }),
  item("navigation-items", "insights", undefined, { title: "Insights", slug: "insights", summary: "Read practical freight planning articles." }, { title: "行业洞察", slug: "hang-ye-dong-cha", summary: "阅读实用的货运规划文章。" }, { title: "Материалы", slug: "materialy", summary: "Читайте практические статьи о планировании перевозок." }),
  item("navigation-items", "contact", undefined, { title: "Contact", slug: "contact", summary: "Contact the AnShow team about a freight requirement." }, { title: "联系我们", slug: "lian-xi", summary: "就货运需求联系 AnShow 团队。" }, { title: "Контакты", slug: "kontakty", summary: "Свяжитесь с командой AnShow по вопросу перевозки." }),
  item("navigation-items", "privacy", undefined, { title: "Privacy", slug: "privacy", summary: "Read the AnShow privacy notice." }, { title: "隐私", slug: "yin-si", summary: "阅读 AnShow 隐私声明。" }, { title: "Конфиденциальность", slug: "konfidentsialnost", summary: "Прочитайте уведомление AnShow о конфиденциальности." }),
  item("navigation-items", "terms", undefined, { title: "Terms", slug: "terms", summary: "Read the AnShow website terms." }, { title: "条款", slug: "shi-yong-tiao-kuan", summary: "阅读 AnShow 网站使用条款。" }, { title: "Условия", slug: "usloviya", summary: "Прочитайте условия использования сайта AnShow." }),
  item("navigation-items", "cookies", undefined, { title: "Cookies", slug: "cookies", summary: "Read the AnShow cookie notice." }, { title: "Cookie", slug: "cookie-sheng-ming", summary: "阅读 AnShow Cookie 声明。" }, { title: "Cookie", slug: "cookie", summary: "Прочитайте уведомление AnShow о cookie." }),
];

type ContentTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

function insertLocalizedItem(
  tx: ContentTransaction,
  baseTable: typeof services,
  translationTable: typeof serviceTranslations,
  seedItem: SeedItem,
  sortOrder: number,
  now: Date,
) {
  tx.insert(baseTable)
    .values({
      id: seedItem.code,
      code: seedItem.code,
      sortOrder,
      processStageId: seedItem.processStageId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: baseTable.id })
    .run();

  for (const locale of LOCALES) {
    const copy = seedItem.translations[locale];
    tx.insert(translationTable)
      .values({
        ownerId: seedItem.code,
        locale,
        status: seedItem.publish ? "published" : "draft",
        scheduledAt: null,
        publishedAt: seedItem.publish ? now : null,
        ...copy,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [translationTable.ownerId, translationTable.locale],
      })
      .run();
  }
}

export function seedPublicContent(
  db: AppDatabase,
  options: { now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const collectionPositions = new Map<SeedCollection, number>();

  db.transaction((tx) => {
    for (const seedItem of seedCatalog) {
      const sortOrder = collectionPositions.get(seedItem.collection) ?? 0;
      collectionPositions.set(seedItem.collection, sortOrder + 1);

      switch (seedItem.collection) {
        case "hero-slides":
          insertLocalizedItem(tx, heroSlides, heroSlideTranslations, seedItem, sortOrder, now);
          break;
        case "services":
          insertLocalizedItem(tx, services, serviceTranslations, seedItem, sortOrder, now);
          break;
        case "trade-lanes":
          insertLocalizedItem(tx, tradeLanes, tradeLaneTranslations, seedItem, sortOrder, now);
          break;
        case "cargo-types":
          insertLocalizedItem(tx, cargoTypes, cargoTypeTranslations, seedItem, sortOrder, now);
          break;
        case "pages":
          insertLocalizedItem(tx, pages, pageTranslations, seedItem, sortOrder, now);
          break;
        case "case-studies":
          insertLocalizedItem(tx, caseStudies, caseStudyTranslations, seedItem, sortOrder, now);
          break;
        case "articles":
          insertLocalizedItem(tx, articles, articleTranslations, seedItem, sortOrder, now);
          break;
        case "navigation-items":
          insertLocalizedItem(tx, navigationItems, navigationItemTranslations, seedItem, sortOrder, now);
          break;
      }
    }
  });
}
