"use client";

import { Bell, Building2, Globe2, ToggleLeft } from "lucide-react";
import { useState, type FormEvent } from "react";

import type {
  AdminSettings,
  BackupSettings,
  SiteLocale,
} from "@/api/admin-settings.server";
import { AdminToast } from "./ui/admin-feedback";
import { AdminFormField } from "./ui/admin-form-field";

const localeLabels: Record<SiteLocale, string> = {
  en: "英文",
  zh: "中文",
  ru: "俄文",
};
const localeOptions: readonly SiteLocale[] = ["en", "zh", "ru"];

const defaultSettings = {
  companyIdentity: {
    displayName: "",
    legalName: "",
    registrationNumber: "",
    address: "",
  },
  publicContacts: { email: "", phone: "" },
  privacyController: { name: "", email: "" },
  smtpRecipient: { name: "", email: "" },
  localeDefaults: { defaultLocale: "en" as const, enabledLocales: localeOptions.slice() },
  mediaMode: "local" as const,
  featureFlags: {
    enquiriesEnabled: true,
    caseStudiesEnabled: true,
    insightsEnabled: true,
  },
};

const inputClass =
  "min-h-11 w-full rounded border border-neutral-300 px-3 text-base text-neutral-950 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)]";

function saveableBackup(backup: BackupSettings | undefined) {
  if (!backup) return undefined;
  return {
    enabled: backup.enabled,
    intervalHours: backup.intervalHours,
    retentionDays: backup.retentionDays,
    target: backup.target,
    cosBucket: backup.cosBucket,
    cosRegion: backup.cosRegion,
  };
}

export function SiteSettingsForm({ settings }: { settings: AdminSettings }) {
  const [value, setValue] = useState(() => ({
    companyIdentity: {
      ...defaultSettings.companyIdentity,
      ...settings.companyIdentity,
    },
    publicContacts: { ...defaultSettings.publicContacts, ...settings.publicContacts },
    privacyController: {
      ...defaultSettings.privacyController,
      ...settings.privacyController,
    },
    smtpRecipient: { ...defaultSettings.smtpRecipient, ...settings.smtpRecipient },
    localeDefaults: {
      ...defaultSettings.localeDefaults,
      ...settings.localeDefaults,
      enabledLocales:
        settings.localeDefaults?.enabledLocales ?? defaultSettings.localeDefaults.enabledLocales,
    },
    mediaMode: settings.mediaMode ?? defaultSettings.mediaMode,
    featureFlags: { ...defaultSettings.featureFlags, ...settings.featureFlags },
  }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);

  function toggleLocale(locale: SiteLocale, checked: boolean) {
    const enabledLocales = checked
      ? [...new Set([...value.localeDefaults.enabledLocales, locale])]
      : value.localeDefaults.enabledLocales.filter((item) => item !== locale);
    setValue({
      ...value,
      localeDefaults: {
        defaultLocale: enabledLocales.includes(value.localeDefaults.defaultLocale)
          ? value.localeDefaults.defaultLocale
          : enabledLocales[0] ?? "en",
        enabledLocales: enabledLocales.length > 0 ? enabledLocales : ["en"],
      },
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...settings,
          ...value,
          backup: saveableBackup(settings.backup),
        }),
      });
      if (!response.ok) throw new Error("save failed");
      setMessage({ text: "网站设置已保存", tone: "success" });
    } catch {
      setMessage({ text: "网站设置保存失败，请检查后重试", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-label="网站设置"
      className="border border-neutral-200 bg-white"
      onSubmit={(event) => void save(event)}
    >
      <div className="border-b border-neutral-200 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-semibold text-neutral-950">网站基础设置</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-600">
          这些内容会影响官网展示、询价接收和语言默认选择。
        </p>
      </div>

      <SettingsSection
        description="用于官网页脚、关于我们、联系页和搜索结构化信息。"
        icon={Building2}
        title="公司与联系方式"
      >
        <AdminFormField htmlFor="site-display-name" label="官网显示名称">
          <input
            className={inputClass}
            id="site-display-name"
            onChange={(event) =>
              setValue({
                ...value,
                companyIdentity: {
                  ...value.companyIdentity,
                  displayName: event.target.value,
                },
              })
            }
            value={value.companyIdentity.displayName}
          />
        </AdminFormField>
        <AdminFormField htmlFor="site-legal-name" label="公司主体名称">
          <input
            className={inputClass}
            id="site-legal-name"
            onChange={(event) =>
              setValue({
                ...value,
                companyIdentity: {
                  ...value.companyIdentity,
                  legalName: event.target.value,
                },
              })
            }
            value={value.companyIdentity.legalName}
          />
        </AdminFormField>
        <AdminFormField htmlFor="site-phone" label="公开联系电话">
          <input
            className={inputClass}
            id="site-phone"
            onChange={(event) =>
              setValue({
                ...value,
                publicContacts: { ...value.publicContacts, phone: event.target.value },
              })
            }
            value={value.publicContacts.phone}
          />
        </AdminFormField>
        <AdminFormField htmlFor="site-email" label="公开邮箱">
          <input
            className={inputClass}
            id="site-email"
            onChange={(event) =>
              setValue({
                ...value,
                publicContacts: { ...value.publicContacts, email: event.target.value },
              })
            }
            type="email"
            value={value.publicContacts.email}
          />
        </AdminFormField>
        <div className="sm:col-span-2">
          <AdminFormField htmlFor="site-address" label="公开地址">
            <textarea
              className={`${inputClass} py-2`}
              id="site-address"
              onChange={(event) =>
                setValue({
                  ...value,
                  companyIdentity: {
                    ...value.companyIdentity,
                    address: event.target.value,
                  },
                })
              }
              rows={3}
              value={value.companyIdentity.address}
            />
          </AdminFormField>
        </div>
      </SettingsSection>

      <SettingsSection
        description="控制访客首次打开官网时看到的默认语言，以及哪些语言入口可见。"
        icon={Globe2}
        title="语言与默认设置"
      >
        <AdminFormField htmlFor="site-default-locale" label="默认打开语言">
          <select
            className={`${inputClass} bg-white`}
            id="site-default-locale"
            onChange={(event) =>
              setValue({
                ...value,
                localeDefaults: {
                  ...value.localeDefaults,
                  defaultLocale: event.target.value as SiteLocale,
                },
              })
            }
            value={value.localeDefaults.defaultLocale}
          >
            {localeOptions.map((locale) => (
              <option key={locale} value={locale}>
                {localeLabels[locale]}
              </option>
            ))}
          </select>
        </AdminFormField>
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium text-neutral-900">前台可切换语言</legend>
          {localeOptions.map((locale) => (
            <label className="flex min-h-11 items-center gap-3 text-sm text-neutral-900" key={locale}>
              <input
                checked={value.localeDefaults.enabledLocales.includes(locale)}
                className="size-5 accent-[var(--color-cyan-ink)]"
                onChange={(event) => toggleLocale(locale, event.target.checked)}
                type="checkbox"
              />
              {localeLabels[locale]}
            </label>
          ))}
        </fieldset>
      </SettingsSection>

      <SettingsSection
        description="询价表单提交后，系统会把提醒发送给这里配置的负责人。"
        icon={Bell}
        title="询价通知"
      >
        <AdminFormField htmlFor="recipient-name" label="接收人名称">
          <input
            className={inputClass}
            id="recipient-name"
            onChange={(event) =>
              setValue({
                ...value,
                smtpRecipient: { ...value.smtpRecipient, name: event.target.value },
              })
            }
            value={value.smtpRecipient.name}
          />
        </AdminFormField>
        <AdminFormField htmlFor="recipient-email" label="接收邮箱">
          <input
            className={inputClass}
            id="recipient-email"
            onChange={(event) =>
              setValue({
                ...value,
                smtpRecipient: { ...value.smtpRecipient, email: event.target.value },
              })
            }
            type="email"
            value={value.smtpRecipient.email}
          />
        </AdminFormField>
      </SettingsSection>

      <SettingsSection
        description="用于临时下线不适合展示的前台模块，不影响后台数据。"
        icon={ToggleLeft}
        title="前台功能开关"
      >
        {[
          ["enquiriesEnabled", "开放询价入口"],
          ["caseStudiesEnabled", "展示项目案例"],
          ["insightsEnabled", "展示行业洞察"],
        ].map(([key, label]) => (
          <label className="flex min-h-11 items-center gap-3 text-sm text-neutral-900" key={key}>
            <input
              checked={Boolean(value.featureFlags[key as keyof typeof value.featureFlags])}
              className="size-5 accent-[var(--color-cyan-ink)]"
              onChange={(event) =>
                setValue({
                  ...value,
                  featureFlags: {
                    ...value.featureFlags,
                    [key]: event.target.checked,
                  },
                })
              }
              type="checkbox"
            />
            {label}
          </label>
        ))}
      </SettingsSection>

      <div className="flex flex-col gap-3 border-t border-neutral-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-sm leading-6 text-neutral-600">
          邮件服务密钥、对象存储密钥等敏感信息仍由部署环境配置，这里只显示业务可编辑内容。
        </p>
        <button
          className="min-h-11 shrink-0 rounded bg-[var(--color-cyan-ink)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? "正在保存..." : "保存网站设置"}
        </button>
      </div>
      {message ? (
        <div className="border-t border-neutral-200 p-3">
          <AdminToast message={message.text} tone={message.tone} />
        </div>
      ) : null}
    </form>
  );
}

function SettingsSection({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon: typeof Building2;
  title: string;
}) {
  return (
    <section className="grid gap-4 border-t border-neutral-200 px-4 py-5 sm:px-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded bg-sky-50 text-sky-800">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold text-neutral-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-600">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
