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

type MediaLibraryProps = { canWrite: boolean; initialItems: AdminMediaAsset[] };
type Phase = "idle" | "validating" | "uploading" | "processing" | "saved" | "error";
const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-neutral-300 bg-white px-3 text-base outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100";
const buttonClass = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold transition-[filter,transform,opacity] duration-[var(--motion-fast)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

function validateMetadata(metadata: AdminMediaMetadataInput) {
  const errors: Partial<Record<"en" | "zh" | "ru" | "focalX" | "focalY", string>> = {};
  if (!metadata.alt.en.trim()) errors.en = "English alt text is required.";
  if (!metadata.alt.zh.trim()) errors.zh = "Chinese alt text is required.";
  if (!metadata.alt.ru.trim()) errors.ru = "Russian alt text is required.";
  if (!Number.isFinite(metadata.focalX) || metadata.focalX < 0 || metadata.focalX > 1) errors.focalX = "Focal X must be from 0 to 1.";
  if (!Number.isFinite(metadata.focalY) || metadata.focalY < 0 || metadata.focalY > 1) errors.focalY = "Focal Y must be from 0 to 1.";
  return errors;
}

function phaseLabel(phase: Phase, progress: number) {
  if (phase === "validating") return "Validating";
  if (phase === "uploading") return `Uploading ${progress}%`;
  if (phase === "processing") return "Processing";
  if (phase === "saved") return "Saved";
  return "";
}

function UploadForm({ onSaved }: { onSaved(asset: AdminMediaAsset): void }) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState({ en: "", zh: "", ru: "" });
  const [focal, setFocal] = useState({ x: 0.5, y: 0.5 });
  const [validationErrors, setValidationErrors] = useState<ReturnType<typeof validateMetadata>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const focalXInput = useRef<HTMLInputElement>(null);
  const focalYInput = useRef<HTMLInputElement>(null);
  const pending = ["validating", "uploading", "processing"].includes(phase);

  async function submit() {
    setPhase("validating");
    setError(null);
    const metadata = { alt, focalX: focal.x, focalY: focal.y };
    const errors = validateMetadata(metadata);
    setValidationErrors(errors);
    if (!file) {
      setPhase("error");
      setError("Choose an image file. File type and extension are checked again by the server.");
      return;
    }
    if (Object.keys(errors).length > 0) {
      setPhase("error");
      setError(Object.values(errors)[0] ?? "Upload metadata is invalid.");
      if (errors.en || errors.zh || errors.ru) firstInput.current?.focus();
      else if (errors.focalX) focalXInput.current?.focus();
      else focalYInput.current?.focus();
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
      setError(reason instanceof Error ? reason.message : "Media upload failed.");
    }
  }

  return (
    <section aria-label="上传媒体" className="border-y border-neutral-200 bg-white px-4 py-5 sm:px-5">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(12rem,1.1fr)_repeat(3,minmax(9rem,1fr))_auto] lg:items-end">
        <label className="min-w-0 text-sm font-semibold text-[var(--color-text)]">
          图片文件
          <input accept="image/jpeg,image/png,image/webp,image/avif" className={`${inputClass} py-2 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold`} disabled={pending} onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
        </label>
        {(["en", "zh", "ru"] as const).map((locale, index) => (
          <label className="min-w-0 text-sm font-semibold text-[var(--color-text)]" key={locale}>
            替代文本（{locale.toUpperCase()}）
            <input className={inputClass} disabled={pending} onChange={(event) => setAlt((current) => ({ ...current, [locale]: event.target.value }))} ref={index === 0 ? firstInput : undefined} value={alt[locale]} />
          </label>
        ))}
        <button className={`${buttonClass} bg-[var(--color-action)] text-white hover:-translate-y-px hover:brightness-95`} disabled={pending} onClick={submit} type="button">
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Upload aria-hidden="true" className="size-4" />}
          上传媒体
        </button>
      </div>
      <div className="mt-3 grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[var(--color-text)]">
          上传焦点 X
          <input aria-describedby={validationErrors.focalX ? "upload-focal-x-error" : undefined} aria-invalid={Boolean(validationErrors.focalX)} className={inputClass} disabled={pending} max="1" min="0" onChange={(event) => setFocal((current) => ({ ...current, x: Number(event.target.value) }))} ref={focalXInput} step="0.01" type="number" value={focal.x} />
          {validationErrors.focalX ? <span className="mt-1 block text-base font-normal text-[var(--color-danger)]" id="upload-focal-x-error">{validationErrors.focalX}</span> : null}
        </label>
        <label className="text-sm font-semibold text-[var(--color-text)]">
          上传焦点 Y
          <input aria-describedby={validationErrors.focalY ? "upload-focal-y-error" : undefined} aria-invalid={Boolean(validationErrors.focalY)} className={inputClass} disabled={pending} max="1" min="0" onChange={(event) => setFocal((current) => ({ ...current, y: Number(event.target.value) }))} ref={focalYInput} step="0.01" type="number" value={focal.y} />
          {validationErrors.focalY ? <span className="mt-1 block text-base font-normal text-[var(--color-danger)]" id="upload-focal-y-error">{validationErrors.focalY}</span> : null}
        </label>
      </div>
      <div aria-live="polite" className="mt-2 min-h-6 text-base">
        {error ? <span className="font-medium text-[var(--color-danger)]" role="alert">{error}</span> : phaseLabel(phase, progress)}
      </div>
    </section>
  );
}

function AssetEditor({ asset, canWrite, view, onChange, onDelete }: { asset: AdminMediaAsset; canWrite: boolean; view: "grid" | "list"; onChange(asset: AdminMediaAsset): void; onDelete(id: string): void }) {
  const [metadata, setMetadata] = useState<AdminMediaMetadataInput>({ alt: { ...asset.alt }, focalX: asset.focalX, focalY: asset.focalY });
  const [replacement, setReplacement] = useState<File | null>(null);
  const [pending, setPending] = useState<"metadata" | "replacement" | "delete" | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateMetadata>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [blockingReferences, setBlockingReferences] = useState(asset.references);
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
      setMessage("Metadata saved.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Metadata save failed."); }
    finally { setPending(null); }
  }

  async function replace() {
    if (!replacement) { setMessage("Choose a replacement image."); return; }
    setPending("replacement");
    setMessage("Uploading replacement.");
    try {
      onChange(await replaceAdminMedia(asset.id, { file: replacement, ...metadata }, { onUploadComplete: () => setMessage("Processing replacement.") }));
      setMessage("Replacement saved.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Replacement failed."); }
    finally { setPending(null); }
  }

  async function remove() {
    if (!window.confirm("Delete this media asset permanently?")) return;
    setPending("delete");
    try { await deleteAdminMedia(asset.id); onDelete(asset.id); }
    catch (reason) {
      if (reason instanceof ApiError && Array.isArray(reason.details?.references)) {
        const references = reason.details.references.filter(
          (value): value is AdminMediaAsset["references"][number] =>
            typeof value === "object" &&
            value !== null &&
            "entityType" in value &&
            "entityId" in value &&
            "field" in value &&
            typeof value.entityType === "string" &&
            typeof value.entityId === "string" &&
            typeof value.field === "string",
        );
        setBlockingReferences(references);
      }
      setMessage(reason instanceof Error ? reason.message : "Delete failed.");
      setPending(null);
    }
  }

  return (
    <article className={`min-w-0 border-b border-neutral-200 bg-white ${view === "list" ? "grid gap-5 p-4 lg:grid-cols-[15rem_minmax(0,1fr)]" : "p-4"}`}>
      <div className="min-w-0">
        {preview ? <Image alt="" className="aspect-[3/2] w-full bg-neutral-100 object-cover" height={asset.height} loading="lazy" src={preview.url} unoptimized width={asset.width} /> : <div aria-label="No derivative preview" className="aspect-[3/2] bg-neutral-100" />}
        <p className="mt-3 break-all font-mono text-xs text-neutral-500">{asset.id}</p>
        <p className="mt-1 text-base text-neutral-700">{asset.width} x {asset.height} · {asset.mimeType.replace("image/", "").toUpperCase()}</p>
        <p className="mt-1 text-base text-neutral-700">{preview ? `${Math.ceil(preview.byteSize / 1024)} KB preview` : "No derivative"} · {asset.referenceCount} references</p>
      </div>
      <div className="mt-5 min-w-0 space-y-4 lg:mt-0">
        {canWrite ? (
          <>
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              {(["en", "zh", "ru"] as const).map((locale) => (
                <label className="min-w-0 text-sm font-semibold" key={locale}>
                  Alt text ({locale.toUpperCase()})
                  <input aria-describedby={errors[locale] ? `${asset.id}-${locale}-error` : undefined} aria-invalid={Boolean(errors[locale])} className={inputClass} onChange={(event) => setMetadata((current) => ({ ...current, alt: { ...current.alt, [locale]: event.target.value } }))} ref={locale === "en" ? englishInput : undefined} value={metadata.alt[locale]} />
                  {errors[locale] ? <span className="mt-1 block text-base font-normal text-[var(--color-danger)]" id={`${asset.id}-${locale}-error`}>{errors[locale]}</span> : null}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[8rem_8rem_1fr] sm:items-end">
              {(["focalX", "focalY"] as const).map((field) => <label className="text-sm font-semibold" key={field}>{field === "focalX" ? "Focal X" : "Focal Y"}<input className={inputClass} max="1" min="0" onChange={(event) => setMetadata((current) => ({ ...current, [field]: Number(event.target.value) }))} step="0.01" type="number" value={metadata[field]} /></label>)}
              <button className={`${buttonClass} border border-neutral-300 bg-white hover:bg-neutral-50`} disabled={pending !== null} onClick={saveMetadata} type="button"><Save aria-hidden="true" className="size-4" />Save metadata</button>
            </div>
            <div className="flex min-w-0 flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-sm font-semibold">Replacement image<input accept="image/jpeg,image/png,image/webp,image/avif" className={`${inputClass} py-2`} onChange={(event) => setReplacement(event.target.files?.[0] ?? null)} type="file" /></label>
              <button className={`${buttonClass} border border-neutral-300 bg-white`} disabled={pending !== null} onClick={replace} type="button"><RotateCcw aria-hidden="true" className="size-4" />Replace media</button>
              <button className={`${buttonClass} border border-red-200 bg-white text-[var(--color-danger)]`} disabled={pending !== null || blockingReferences.length > 0} onClick={remove} title={blockingReferences.length > 0 ? "Remove references before deleting" : undefined} type="button"><Trash2 aria-hidden="true" className="size-4" />Delete media</button>
            </div>
          </>
        ) : (
          <dl className="grid gap-3 text-base sm:grid-cols-3">{(["en", "zh", "ru"] as const).map((locale) => <div key={locale}><dt className="text-sm font-semibold text-neutral-500">Alt text ({locale.toUpperCase()})</dt><dd className="mt-1 break-words text-base text-[var(--color-text)]">{asset.alt[locale]}</dd></div>)}<div><dt className="text-sm font-semibold text-neutral-500">Focal X</dt><dd className="mt-1 text-base text-[var(--color-text)]">{asset.focalX}</dd></div><div><dt className="text-sm font-semibold text-neutral-500">Focal Y</dt><dd className="mt-1 text-base text-[var(--color-text)]">{asset.focalY}</dd></div></dl>
        )}
        {blockingReferences.length > 0 ? <div><h3 className="text-sm font-semibold">References</h3><ul className="mt-1 space-y-1 text-base text-neutral-600">{blockingReferences.map((reference) => <li className="text-base" key={`${reference.entityType}-${reference.entityId}-${reference.field}`}>{reference.entityType} / {reference.entityId} / {reference.field}</li>)}</ul></div> : null}
        <div aria-live="polite" className="min-h-5 text-base text-neutral-600">{message}</div>
      </div>
    </article>
  );
}

export function MediaLibrary({ canWrite, initialItems }: MediaLibraryProps) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const filtered = useMemo(() => items.filter((item) => `${item.id} ${item.mimeType} ${Object.values(item.alt).join(" ")}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [items, search]);
  const change = (updated: AdminMediaAsset) => setItems((current) => current.map((item) => item.id === updated.id ? updated : item));

  return (
    <div className="min-w-0">
      {canWrite ? <UploadForm onSaved={(saved) => setItems((current) => [saved, ...current])} /> : null}
      <div className="flex min-w-0 flex-col gap-3 border-b border-neutral-200 px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="min-w-0 flex-1 text-sm font-semibold"><span className="inline-flex items-center gap-2"><Search aria-hidden="true" className="size-4" />搜索媒体</span><input className={`${inputClass} max-w-xl`} onChange={(event) => setSearch(event.target.value)} type="search" value={search} /></label>
        <div aria-label="媒体视图" className="inline-flex self-start border border-neutral-300" role="group">
          <button aria-label="网格视图" aria-pressed={view === "grid"} className="flex size-11 items-center justify-center border-r border-neutral-300 aria-pressed:bg-neutral-200" onClick={() => setView("grid")} title="网格视图" type="button"><Grid2X2 aria-hidden="true" className="size-5" /></button>
          <button aria-label="列表视图" aria-pressed={view === "list"} className="flex size-11 items-center justify-center aria-pressed:bg-neutral-200" onClick={() => setView("list")} title="列表视图" type="button"><List aria-hidden="true" className="size-5" /></button>
        </div>
      </div>
      {items.length === 0 ? <div className="border-b border-neutral-200 px-4 py-12 text-center"><ImagePlus aria-hidden="true" className="mx-auto size-8 text-neutral-400" /><h2 className="mt-3 text-lg font-semibold">暂无媒体资产</h2><p className="mt-1 text-base text-neutral-600">使用上传控件添加第一份媒体资产。</p></div> : filtered.length === 0 ? <div className="border-b border-neutral-200 px-4 py-12 text-center"><h2 className="text-lg font-semibold">没有匹配的媒体</h2></div> : <div className={view === "grid" ? "grid min-w-0 grid-cols-1 border-t border-neutral-200 xl:grid-cols-2" : "border-t border-neutral-200"}>{filtered.map((item) => <AssetEditor asset={item} canWrite={canWrite} key={item.id} onChange={change} onDelete={(id) => setItems((current) => current.filter((item) => item.id !== id))} view={view} />)}</div>}
    </div>
  );
}
