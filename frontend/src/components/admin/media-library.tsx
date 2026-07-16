"use client";

import {
  Grid2X2,
  ImagePlus,
  List,
  LoaderCircle,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";

import {
  deleteAdminMedia,
  replaceAdminMedia,
  updateAdminMediaMetadata,
  uploadAdminMedia,
  type AdminMediaAsset,
  type AdminMediaMetadataInput,
} from "../../api/admin-media";
import { ApiError } from "../../api/http";
import { AdminConfirmDialog } from "./ui/admin-feedback";

type MediaLibraryProps = { canWrite: boolean; initialItems: AdminMediaAsset[] };
type Phase = "idle" | "validating" | "uploading" | "processing" | "saved" | "error";
type Locale = keyof AdminMediaMetadataInput["alt"];
type MetadataErrors = Partial<Record<Locale | "focalX" | "focalY", string>>;

const locales: readonly Locale[] = ["zh", "en", "ru"];
const localeLabels: Record<Locale, string> = {
  zh: "中文图片说明",
  en: "英文图片说明",
  ru: "俄文图片说明",
};
const referenceTypeLabels: Record<string, string> = {
  article: "文章",
  articles: "文章",
  "hero-slide": "首页轮播图",
  "hero-slides": "首页轮播图",
  service: "服务内容",
  services: "服务内容",
  "case-study": "案例",
  "case-studies": "案例",
  "trade-lane": "运输线路",
  "trade-lanes": "运输线路",
};
const referenceFieldLabels: Record<string, string> = {
  image: "图片",
  leadImage: "主图",
  mediaId: "配图",
};
const mediaErrorLabels: Record<string, string> = {
  INVALID_MEDIA: "图片文件无效，请重新选择。",
  INVALID_MEDIA_DIMENSIONS: "图片尺寸无效，请选择宽高大于零的图片。",
  MEDIA_BUDGET_EXCEEDED: "图片处理后仍然过大，请压缩原图后重试。",
  MEDIA_CLEANUP_FAILED: "旧图片清理失败，系统会保留记录以便稍后重试。",
  MEDIA_IN_USE: "图片正在被内容使用，请先更换对应内容中的图片。",
  MEDIA_NOT_FOUND: "图片已不存在，请刷新媒体库。",
  MEDIA_TOO_LARGE: "图片不能超过 20 MB，请压缩后重试。",
  UNSUPPORTED_MEDIA: "暂不支持此图片格式，请使用 JPG、PNG、WebP 或 AVIF。",
  VALIDATION_ERROR: "图片信息不完整，请检查三语言说明。",
};
const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-neutral-300 bg-white px-3 text-base outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100";
const buttonClass = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold transition-[background-color,filter,opacity] duration-[var(--motion-fast)] disabled:cursor-not-allowed disabled:opacity-50";

function validateMetadata(metadata: AdminMediaMetadataInput): MetadataErrors {
  const errors: MetadataErrors = {};
  if (!metadata.alt.en.trim()) errors.en = "请填写英文图片说明。";
  if (!metadata.alt.zh.trim()) errors.zh = "请填写中文图片说明。";
  if (!metadata.alt.ru.trim()) errors.ru = "请填写俄文图片说明。";
  if (!Number.isFinite(metadata.focalX) || metadata.focalX < 0 || metadata.focalX > 1) errors.focalX = "横向主体位置无效，请重新选择。";
  if (!Number.isFinite(metadata.focalY) || metadata.focalY < 0 || metadata.focalY > 1) errors.focalY = "纵向主体位置无效，请重新选择。";
  return errors;
}

function mediaErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError) {
    return mediaErrorLabels[reason.code] ?? fallback;
  }
  return reason instanceof Error && /[\u3400-\u9fff]/u.test(reason.message)
    ? reason.message
    : fallback;
}

function phaseLabel(phase: Phase, progress: number): string {
  if (phase === "validating") return "正在检查图片和说明...";
  if (phase === "uploading") return `正在上传 ${progress}%`;
  if (phase === "processing") return "正在生成适合网站展示的图片版本...";
  if (phase === "saved") return "上传完成";
  return "";
}

function horizontalPosition(value: number): string {
  if (value < 0.34) return "偏左";
  if (value > 0.66) return "偏右";
  return "居中";
}

function verticalPosition(value: number): string {
  if (value < 0.34) return "偏上";
  if (value > 0.66) return "偏下";
  return "居中";
}

function FocusControl({
  axis,
  disabled = false,
  prefix = "",
  onChange,
  value,
}: {
  axis: "horizontal" | "vertical";
  disabled?: boolean;
  prefix?: string;
  onChange(value: number): void;
  value: number;
}) {
  const label = `${prefix}${axis === "horizontal" ? "横向主体位置" : "纵向主体位置"}`;
  const current = axis === "horizontal" ? horizontalPosition(value) : verticalPosition(value);
  return (
    <label className="block min-w-0 text-sm font-semibold text-[var(--color-text)]">
      {label}
      <input
        aria-label={label}
        className="mt-2 min-h-11 w-full cursor-pointer accent-[var(--color-cyan-ink)] disabled:cursor-not-allowed"
        disabled={disabled}
        max="1"
        min="0"
        onChange={(event) => onChange(Number(event.target.value))}
        step="0.01"
        type="range"
        value={value}
      />
      <span className="mt-1 block text-sm font-normal text-neutral-600">当前：{current}</span>
    </label>
  );
}

function UploadForm({ onSaved }: { onSaved(asset: AdminMediaAsset): void }) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState({ en: "", zh: "", ru: "" });
  const [focal, setFocal] = useState({ x: 0.5, y: 0.5 });
  const [validationErrors, setValidationErrors] = useState<MetadataErrors>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const englishInput = useRef<HTMLInputElement>(null);
  const pending = ["validating", "uploading", "processing"].includes(phase);

  async function submit() {
    setPhase("validating");
    setError(null);
    const metadata = { alt, focalX: focal.x, focalY: focal.y };
    const errors = validateMetadata(metadata);
    setValidationErrors(errors);
    if (!file) {
      setPhase("error");
      setError("请选择 JPG、PNG、WebP 或 AVIF 图片文件。");
      return;
    }
    if (Object.keys(errors).length > 0) {
      setPhase("error");
      setError(Object.values(errors)[0] ?? "请检查图片说明后重试。");
      englishInput.current?.focus();
      return;
    }
    setPhase("uploading");
    try {
      const saved = await uploadAdminMedia(
        { file, ...metadata },
        {
          onUploadProgress: setProgress,
          onUploadComplete: () => setPhase("processing"),
        },
      );
      onSaved(saved);
      setPhase("saved");
      setFile(null);
      setAlt({ en: "", zh: "", ru: "" });
      setFocal({ x: 0.5, y: 0.5 });
    } catch (reason) {
      setPhase("error");
      setError(mediaErrorMessage(reason, "图片上传失败，请重试。"));
    }
  }

  return (
    <section aria-label="上传媒体" className="border-y border-neutral-200 bg-white px-4 py-5 sm:px-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-neutral-950">上传新图片</h2>
        <p className="text-sm leading-6 text-neutral-600">系统会自动生成 WebP 和 AVIF 等轻量版本，减少前台加载时间。</p>
      </div>
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(14rem,1.2fr)_repeat(3,minmax(10rem,1fr))]">
        <label className="min-w-0 text-sm font-semibold text-[var(--color-text)]">
          图片文件
          <input accept="image/jpeg,image/png,image/webp,image/avif" className={`${inputClass} py-2 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold`} disabled={pending} onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
        </label>
        {locales.map((locale) => (
          <label className="min-w-0 text-sm font-semibold text-[var(--color-text)]" key={locale}>
            新图片{localeLabels[locale]}
            <input
              aria-describedby={validationErrors[locale] ? `upload-${locale}-error` : undefined}
              aria-invalid={Boolean(validationErrors[locale])}
              className={inputClass}
              disabled={pending}
              onChange={(event) => setAlt((current) => ({ ...current, [locale]: event.target.value }))}
              ref={locale === "en" ? englishInput : undefined}
              value={alt[locale]}
            />
            {validationErrors[locale] ? <span className="mt-1 block text-sm font-normal text-[var(--color-danger)]" id={`upload-${locale}-error`}>{validationErrors[locale]}</span> : null}
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-2 lg:max-w-2xl">
        <FocusControl axis="horizontal" disabled={pending} onChange={(x) => setFocal((current) => ({ ...current, x }))} prefix="新图片" value={focal.x} />
        <FocusControl axis="vertical" disabled={pending} onChange={(y) => setFocal((current) => ({ ...current, y }))} prefix="新图片" value={focal.y} />
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button className={`${buttonClass} bg-[var(--color-action)] text-white hover:brightness-95`} disabled={pending} onClick={submit} type="button">
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Upload aria-hidden="true" className="size-4" />}
          上传媒体
        </button>
        <div aria-live="polite" className="min-h-6 text-base">
          {error ? <span className="font-medium text-[var(--color-danger)]" role="alert">{error}</span> : phaseLabel(phase, progress)}
        </div>
      </div>
    </section>
  );
}

function referenceLabel(reference: AdminMediaAsset["references"][number]): string {
  return `${referenceTypeLabels[reference.entityType] ?? "网站内容"} · ${referenceFieldLabels[reference.field] ?? "配图"}`;
}

function AssetEditor({
  asset,
  canWrite,
  onChange,
  onDelete,
  view,
}: {
  asset: AdminMediaAsset;
  canWrite: boolean;
  onChange(asset: AdminMediaAsset): void;
  onDelete(id: string): void;
  view: "grid" | "list";
}) {
  const [metadata, setMetadata] = useState<AdminMediaMetadataInput>({ alt: { ...asset.alt }, focalX: asset.focalX, focalY: asset.focalY });
  const [replacement, setReplacement] = useState<File | null>(null);
  const [pending, setPending] = useState<"metadata" | "replacement" | "delete" | null>(null);
  const [errors, setErrors] = useState<MetadataErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [blockingReferences, setBlockingReferences] = useState(asset.references);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const englishInput = useRef<HTMLInputElement>(null);
  const preview = asset.derivatives.find((item) => item.format === "webp") ?? asset.derivatives[0];

  async function saveMetadata() {
    const validation = validateMetadata(metadata);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      englishInput.current?.focus();
      return;
    }
    setPending("metadata");
    setMessage(null);
    try {
      onChange(await updateAdminMediaMetadata(asset.id, metadata));
      setMessage("图片信息已保存。");
    } catch (reason) {
      setMessage(mediaErrorMessage(reason, "图片信息保存失败，请重试。"));
    } finally {
      setPending(null);
    }
  }

  async function replace() {
    if (!replacement) {
      setMessage("请先选择用于替换的新图片。");
      return;
    }
    setPending("replacement");
    setMessage("正在上传替换图片...");
    try {
      onChange(await replaceAdminMedia(asset.id, { file: replacement, ...metadata }, { onUploadComplete: () => setMessage("正在生成网站图片版本...") }));
      setReplacement(null);
      setMessage("图片已替换。");
    } catch (reason) {
      setMessage(mediaErrorMessage(reason, "图片替换失败，请重试。"));
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    setDeleteOpen(false);
    setPending("delete");
    setMessage(null);
    try {
      await deleteAdminMedia(asset.id);
      onDelete(asset.id);
    } catch (reason) {
      if (reason instanceof ApiError && Array.isArray(reason.details?.references)) {
        setBlockingReferences(
          reason.details.references.filter(
            (value): value is AdminMediaAsset["references"][number] =>
              typeof value === "object" && value !== null &&
              "entityType" in value && "entityId" in value && "field" in value &&
              typeof value.entityType === "string" && typeof value.entityId === "string" && typeof value.field === "string",
          ),
        );
      }
      setMessage(mediaErrorMessage(reason, "图片删除失败，请重试。"));
      setPending(null);
    }
  }

  const subjectPosition = `主体位置：水平${horizontalPosition(metadata.focalX)}、垂直${verticalPosition(metadata.focalY)}`;
  return (
    <article className={`min-w-0 border-b border-neutral-200 bg-white ${view === "list" ? "grid gap-5 p-4 lg:grid-cols-[16rem_minmax(0,1fr)]" : "p-4"}`}>
      <div className="min-w-0">
        {preview ? (
          <Image
            alt=""
            className="aspect-[3/2] w-full bg-neutral-100 object-cover transition-[object-position] duration-200"
            height={asset.height}
            loading="lazy"
            src={preview.url}
            style={{ objectPosition: `${metadata.focalX * 100}% ${metadata.focalY * 100}%` }}
            unoptimized
            width={asset.width}
          />
        ) : <div aria-label="暂无预览图" className="aspect-[3/2] bg-neutral-100" />}
        <p className="mt-3 text-base text-neutral-700">{asset.width} × {asset.height} · {asset.mimeType.replace("image/", "").toUpperCase()}</p>
        <p className="mt-1 text-sm text-neutral-600">{preview ? `预览约 ${Math.ceil(preview.byteSize / 1024)} KB` : "尚未生成预览"} · {asset.referenceCount > 0 ? `${asset.referenceCount} 处内容正在使用` : "暂未被内容使用"}</p>
        {!canWrite ? <p className="mt-2 text-base text-neutral-700">{subjectPosition}</p> : null}
        <details className="mt-3 text-sm text-neutral-600">
          <summary className="min-h-11 cursor-pointer py-3 font-medium text-[var(--color-cyan-ink)]">查看技术信息</summary>
          <dl className="grid gap-1 border-l-2 border-neutral-200 pl-3">
            <div><dt className="inline font-medium">资源编号：</dt><dd className="inline break-all">{asset.id}</dd></div>
            <div><dt className="inline font-medium">原始格式：</dt><dd className="inline">{asset.mimeType}</dd></div>
          </dl>
        </details>
      </div>

      <div className="mt-5 min-w-0 space-y-4 lg:mt-0">
        {canWrite ? (
          <>
            <fieldset className="grid min-w-0 gap-3 md:grid-cols-3">
              <legend className="mb-2 text-sm font-semibold text-neutral-950">多语言图片说明</legend>
              {locales.map((locale) => (
                <label className="min-w-0 text-sm font-semibold" key={locale}>
                  {localeLabels[locale]}
                  <input aria-describedby={errors[locale] ? `${asset.id}-${locale}-error` : undefined} aria-invalid={Boolean(errors[locale])} className={inputClass} onChange={(event) => setMetadata((current) => ({ ...current, alt: { ...current.alt, [locale]: event.target.value } }))} ref={locale === "en" ? englishInput : undefined} value={metadata.alt[locale]} />
                  {errors[locale] ? <span className="mt-1 block text-sm font-normal text-[var(--color-danger)]" id={`${asset.id}-${locale}-error`}>{errors[locale]}</span> : null}
                </label>
              ))}
            </fieldset>
            <div className="grid gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-2">
              <FocusControl axis="horizontal" onChange={(focalX) => setMetadata((current) => ({ ...current, focalX }))} value={metadata.focalX} />
              <FocusControl axis="vertical" onChange={(focalY) => setMetadata((current) => ({ ...current, focalY }))} value={metadata.focalY} />
            </div>
            <button className={`${buttonClass} border border-neutral-300 bg-white hover:bg-neutral-50`} disabled={pending !== null} onClick={saveMetadata} type="button">
              {pending === "metadata" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="size-4" />}
              保存图片信息
            </button>
            <div className="grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
              <label className="min-w-0 text-sm font-semibold">替换为新图片<input accept="image/jpeg,image/png,image/webp,image/avif" className={`${inputClass} py-2`} onChange={(event) => setReplacement(event.target.files?.[0] ?? null)} type="file" /></label>
              <button className={`${buttonClass} border border-neutral-300 bg-white hover:bg-neutral-50`} disabled={pending !== null} onClick={replace} type="button"><RotateCcw aria-hidden="true" className="size-4" />替换图片</button>
              <button className={`${buttonClass} border border-red-200 bg-white text-[var(--color-danger)] hover:bg-red-50`} disabled={pending !== null || blockingReferences.length > 0} onClick={() => setDeleteOpen(true)} title={blockingReferences.length > 0 ? "请先解除内容引用" : undefined} type="button"><Trash2 aria-hidden="true" className="size-4" />删除图片</button>
            </div>
          </>
        ) : (
          <dl className="grid gap-3 text-base sm:grid-cols-3">
            {locales.map((locale) => <div key={locale}><dt className="text-sm font-semibold text-neutral-500">{localeLabels[locale]}</dt><dd className="mt-1 break-words text-base text-[var(--color-text)]">{asset.alt[locale]}</dd></div>)}
          </dl>
        )}

        {blockingReferences.length > 0 ? (
          <div className="border border-amber-200 bg-amber-50 px-3 py-3">
            <h3 className="text-sm font-semibold text-amber-950">此图片正在被内容使用</h3>
            <p className="mt-1 text-sm text-amber-900">请先在对应内容中更换图片，之后才能删除。</p>
            <ul className="mt-2 grid gap-1 text-base text-amber-950">{blockingReferences.map((reference) => <li className="text-base" key={`${reference.entityType}-${reference.entityId}-${reference.field}`}>{referenceLabel(reference)}</li>)}</ul>
          </div>
        ) : null}
        <div aria-live="polite" className="min-h-6 text-base text-neutral-700">{message}</div>
      </div>

      <AdminConfirmDialog
        confirmLabel="确认删除"
        description="删除后无法恢复。只有未被任何内容使用的图片才能删除。"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void remove()}
        open={deleteOpen}
        title="确认删除这张图片？"
      />
    </article>
  );
}

export function MediaLibrary({ canWrite, initialItems }: MediaLibraryProps) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const filtered = useMemo(
    () => items.filter((item) => `${item.mimeType} ${Object.values(item.alt).join(" ")}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
    [items, search],
  );
  const change = (updated: AdminMediaAsset) => setItems((current) => current.map((item) => item.id === updated.id ? updated : item));

  return (
    <div className="min-w-0">
      {canWrite ? <UploadForm onSaved={(saved) => setItems((current) => [saved, ...current])} /> : null}
      <div className="flex min-w-0 flex-col gap-3 border-b border-neutral-200 px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="min-w-0 flex-1 text-sm font-semibold"><span className="inline-flex items-center gap-2"><Search aria-hidden="true" className="size-4" />搜索媒体</span><input className={`${inputClass} max-w-xl`} onChange={(event) => setSearch(event.target.value)} placeholder="按图片说明或格式搜索" type="search" value={search} /></label>
        <div aria-label="媒体视图" className="inline-flex self-start border border-neutral-300" role="group">
          <button aria-label="网格视图" aria-pressed={view === "grid"} className="flex size-11 cursor-pointer items-center justify-center border-r border-neutral-300 transition-colors duration-200 hover:bg-neutral-100 aria-pressed:bg-neutral-200" onClick={() => setView("grid")} title="网格视图" type="button"><Grid2X2 aria-hidden="true" className="size-5" /></button>
          <button aria-label="列表视图" aria-pressed={view === "list"} className="flex size-11 cursor-pointer items-center justify-center transition-colors duration-200 hover:bg-neutral-100 aria-pressed:bg-neutral-200" onClick={() => setView("list")} title="列表视图" type="button"><List aria-hidden="true" className="size-5" /></button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="border-b border-neutral-200 px-4 py-12 text-center"><ImagePlus aria-hidden="true" className="mx-auto size-8 text-neutral-400" /><h2 className="mt-3 text-lg font-semibold">暂无媒体资产</h2><p className="mt-1 text-base text-neutral-600">使用上方上传区域添加第一张网站图片。</p></div>
      ) : filtered.length === 0 ? (
        <div className="border-b border-neutral-200 px-4 py-12 text-center"><h2 className="text-lg font-semibold">没有匹配的媒体</h2><p className="mt-1 text-base text-neutral-600">请尝试其他图片说明或文件格式。</p></div>
      ) : (
        <div className={view === "grid" ? "grid min-w-0 grid-cols-1 border-t border-neutral-200 xl:grid-cols-2" : "border-t border-neutral-200"}>
          {filtered.map((item) => <AssetEditor asset={item} canWrite={canWrite} key={item.id} onChange={change} onDelete={(id) => setItems((current) => current.filter((item) => item.id !== id))} view={view} />)}
        </div>
      )}
    </div>
  );
}
