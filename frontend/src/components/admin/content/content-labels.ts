import type { AdminContentCollection } from "../../../api/admin-content";

export const collectionLabels: Record<AdminContentCollection, string> = {
  pages: "页面",
  "hero-slides": "首屏轮播",
  services: "服务",
  "trade-lanes": "贸易航线",
  "cargo-types": "特种货物",
  "case-studies": "案例",
  articles: "文章",
  partners: "合作伙伴",
  certificates: "资质证书",
  "proof-metrics": "证明指标",
  "navigation-items": "导航项目",
};

export const collectionDescriptions: Record<AdminContentCollection, string> = {
  pages: "管理官网固定页面及其三语版本。",
  "hero-slides": "管理官网首页轮播内容、展示顺序和发布状态。",
  services: "管理官网服务介绍及其三语版本。",
  "trade-lanes": "管理贸易航线介绍及其三语版本。",
  "cargo-types": "管理特种货物解决方案及其三语版本。",
  "case-studies": "管理客户案例及其三语版本。",
  articles: "管理行业文章及其三语版本。",
  partners: "管理合作伙伴展示内容。",
  certificates: "管理资质证书展示内容。",
  "proof-metrics": "管理官网业务证明指标。",
  "navigation-items": "管理官网导航名称、顺序和发布状态。",
};

export const collectionPageTitles: Record<AdminContentCollection, string> = {
  pages: "页面内容",
  "hero-slides": "首屏轮播内容",
  services: "服务内容",
  "trade-lanes": "贸易航线内容",
  "cargo-types": "特种货物内容",
  "case-studies": "案例内容",
  articles: "文章内容",
  partners: "合作伙伴内容",
  certificates: "资质证书内容",
  "proof-metrics": "证明指标内容",
  "navigation-items": "导航项目内容",
};
