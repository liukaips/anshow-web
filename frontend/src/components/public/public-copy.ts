import type { SupportedLocale } from "../../lib/app-config";

export const publicCollections = [
  "services",
  "trade-lanes",
  "special-cargo",
  "insights",
  "case-studies",
] as const;

export type PublicCollection = (typeof publicCollections)[number];
export type FixedPageCode =
  | "about"
  | "network"
  | "contact"
  | "privacy"
  | "terms"
  | "cookies";

type PublicCopy = {
  breadcrumb: string;
  certifications: {
    description: string;
    empty: string;
    title: string;
  };
  collections: Record<
    PublicCollection,
    { description: string; eyebrow: string; title: string }
  >;
  contact: string;
  empty: string;
  home: string;
  learnMore: string;
  publishedInformation: string;
  quote: {
    description: string;
    eyebrow: string;
    title: string;
  };
  quoteAction: string;
  retry: string;
};

const copy: Record<SupportedLocale, PublicCopy> = {
  en: {
    breadcrumb: "Breadcrumb",
    certifications: {
      description:
        "Only qualifications verified and approved by AnShow are shown here.",
      empty: "No verified qualifications are published yet.",
      title: "Certifications and qualifications",
    },
    collections: {
      services: {
        description:
          "International forwarding options coordinated around route, cargo, documentation, and handover requirements.",
        eyebrow: "Freight solutions",
        title: "Freight services",
      },
      "trade-lanes": {
        description:
          "Route coordination for selected Eurasian corridors and wider international forwarding requirements.",
        eyebrow: "Connected corridors",
        title: "Trade lanes",
      },
      "special-cargo": {
        description:
          "Planning and operational coordination for cargo that requires additional handling, controls, or documentation.",
        eyebrow: "Specialist handling",
        title: "Special cargo",
      },
      insights: {
        description:
          "Practical notes for preparing freight requirements, documents, and transport decisions.",
        eyebrow: "Operational intelligence",
        title: "Freight insights",
      },
      "case-studies": {
        description:
          "Approved examples of freight planning and coordination are published here when available.",
        eyebrow: "Selected work",
        title: "Case studies",
      },
    },
    contact: "Contact AnShow",
    empty: "No published items are available in this language yet.",
    home: "Home",
    learnMore: "Learn more",
    publishedInformation: "Published information",
    quote: {
      description:
        "Share the route, cargo, target timing, and any handling or documentation requirements. The AnShow team can then review the forwarding request.",
      eyebrow: "Start an enquiry",
      title: "Tell us what needs to move",
    },
    quoteAction: "Request a quote",
    retry: "Try again",
  },
  zh: {
    breadcrumb: "面包屑导航",
    certifications: {
      description: "此处仅展示经 AnShow 核验并批准发布的资质信息。",
      empty: "目前尚未发布已验证的资质信息。",
      title: "认证与资质",
    },
    collections: {
      services: {
        description: "围绕路线、货物、文件和交接需求协同国际货运代理方案。",
        eyebrow: "货运方案",
        title: "货运服务",
      },
      "trade-lanes": {
        description: "面向重点欧亚通道及更广泛国际货运需求的路线协同。",
        eyebrow: "互联通道",
        title: "贸易航线",
      },
      "special-cargo": {
        description: "为需要额外装卸、管控或文件要求的货物提供规划与运营协同。",
        eyebrow: "专业操作",
        title: "特种货物",
      },
      insights: {
        description: "有关货运需求、文件准备和运输方式选择的实用信息。",
        eyebrow: "运营洞察",
        title: "货运洞察",
      },
      "case-studies": {
        description: "经批准的货运规划与协同案例将在可用时发布于此。",
        eyebrow: "精选实践",
        title: "案例研究",
      },
    },
    contact: "联系 AnShow",
    empty: "当前语言下暂无已发布内容。",
    home: "首页",
    learnMore: "了解更多",
    publishedInformation: "已发布信息",
    quote: {
      description:
        "请提供路线、货物、目标时间以及装卸或文件要求，AnShow 团队将据此评估货运代理需求。",
      eyebrow: "开始询价",
      title: "告诉我们需要运输什么",
    },
    quoteAction: "获取报价",
    retry: "重试",
  },
  ru: {
    breadcrumb: "Навигационная цепочка",
    certifications: {
      description:
        "Здесь публикуются только проверенные и одобренные AnShow сведения о квалификациях.",
      empty: "Подтвержденные квалификации пока не опубликованы.",
      title: "Сертификаты и квалификации",
    },
    collections: {
      services: {
        description:
          "Международные экспедиторские решения с учетом маршрута, груза, документов и перегрузок.",
        eyebrow: "Грузовые решения",
        title: "Экспедиторские услуги",
      },
      "trade-lanes": {
        description:
          "Координация маршрутов по выбранным евразийским коридорам и другим международным направлениям.",
        eyebrow: "Связанные коридоры",
        title: "Торговые направления",
      },
      "special-cargo": {
        description:
          "Планирование и координация грузов с особыми требованиями к обработке, контролю или документам.",
        eyebrow: "Специальная обработка",
        title: "Специальные грузы",
      },
      insights: {
        description:
          "Практические материалы о подготовке требований, документов и выборе транспорта.",
        eyebrow: "Операционная аналитика",
        title: "Материалы о перевозках",
      },
      "case-studies": {
        description:
          "Одобренные примеры планирования и координации перевозок публикуются по мере появления.",
        eyebrow: "Избранные проекты",
        title: "Примеры работы",
      },
    },
    contact: "Связаться с AnShow",
    empty: "На этом языке пока нет опубликованных материалов.",
    home: "Главная",
    learnMore: "Узнать больше",
    publishedInformation: "Опубликованная информация",
    quote: {
      description:
        "Укажите маршрут, характеристики груза, желаемые сроки и требования к обработке или документам. Команда AnShow рассмотрит запрос.",
      eyebrow: "Начать запрос",
      title: "Расскажите, что нужно перевезти",
    },
    quoteAction: "Запросить расчет",
    retry: "Повторить",
  },
};

export function getPublicCopy(locale: SupportedLocale): PublicCopy {
  return copy[locale];
}
