import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";

import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { getFrontendServerEnv } from "../../env";
import { routing } from "../../i18n/routing";
import {
  organizationJsonLd,
  pageMetadata,
  serializeJsonLd,
  staticLocaleAlternates,
} from "../../lib/seo";

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const translate = await getTranslations({ locale, namespace: "SEO" });
  const { SITE_URL } = getFrontendServerEnv();
  const metadata = pageMetadata({
    alternates: staticLocaleAlternates(""),
    description: translate("description"),
    locale,
    path: "",
    siteUrl: SITE_URL,
    title: translate("title"),
  });

  return {
    ...metadata,
    title: {
      default: translate("title"),
      template: translate("titleTemplate"),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const translate = await getTranslations({ locale, namespace: "Shell" });
  const { SITE_URL } = getFrontendServerEnv();
  const headerLabels = {
    about: translate("about"),
    changeLanguage: translate("changeLanguage"),
    closeMenu: translate("closeMenu"),
    contact: translate("contact"),
    home: translate("home"),
    insights: translate("insights"),
    languageMenu: translate("languageMenu"),
    mobileNavigation: translate("mobileNavigation"),
    openMenu: translate("openMenu"),
    primary: translate("primary"),
    quote: translate("quote"),
    services: translate("services"),
    specialCargo: translate("specialCargo"),
    tradeLanes: translate("tradeLanes"),
  };
  const organization = serializeJsonLd(organizationJsonLd(SITE_URL));

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <a
        className="fixed left-4 top-0 z-[110] -translate-y-full bg-[var(--color-surface)] px-4 py-3 font-semibold text-[var(--color-text)] transition-transform duration-[var(--motion-fast)] focus:translate-y-4"
        href="#main-content"
      >
        {translate("skipToContent")}
      </a>
      <SiteHeader
        alternates={staticLocaleAlternates("")}
        labels={headerLabels}
        locale={locale}
      />
      <div className="flex-1" id="main-content" tabIndex={-1}>
        {children}
      </div>
      <SiteFooter
        labels={{
          about: translate("about"),
          contact: translate("contact"),
          cookies: translate("cookies"),
          description: translate("footerDescription"),
          insights: translate("insights"),
          legal: translate("footerLegal"),
          navigation: translate("footerNavigation"),
          privacy: translate("privacy"),
          quote: translate("quote"),
          quotePrompt: translate("quotePrompt"),
          services: translate("services"),
          terms: translate("terms"),
          tradeLanes: translate("tradeLanes"),
        }}
        locale={locale}
      />
      <script
        dangerouslySetInnerHTML={{ __html: organization }}
        type="application/ld+json"
      />
    </NextIntlClientProvider>
  );
}
