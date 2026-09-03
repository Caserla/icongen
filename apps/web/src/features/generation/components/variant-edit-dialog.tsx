"use client";
import { useCallback, useEffect, useState } from "react";
import type { GenerationJobV2 } from "@icongen/shared";
import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";
import { SkeletonBlock } from "@/components/ui/page-skeletons";
type Variant = GenerationJobV2["subjects"][number]["variants"][number];

function instructionStorageKey(variantId: string) {
  return `icongen:variant-edit-instruction:${variantId}`;
}

async function fetchWithNetworkRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  attempts = 3,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, 450 * (attempt + 1)),
        );
      }
    }
  }
  throw lastError;
}

function readableRequestError(error: unknown, locale: "zh" | "en") {
  if (error instanceof TypeError) {
    return locale === "zh"
      ? "网络连接中断，请检查服务后重试。"
      : "The connection was interrupted. Check the service and try again.";
  }
  return error instanceof Error
    ? error.message
    : locale === "zh"
      ? "请求失败，请重试。"
      : "The request failed. Please try again.";
}

export function VariantEditDialog({
  variant,
  subjectName,
  locale,
  onClose,
  onChanged,
}: {
  variant: Variant;
  subjectName: string;
  locale: "zh" | "en";
  onClose: () => void;
  onChanged: (change?: {
    variantId: string;
    activeRevisionId: string;
    previewUrl: string;
  }) => Promise<void>;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<"edit" | "save" | "restore" | null>(null);
  const [editStage, setEditStage] = useState<
    "submitting" | "generating" | null
  >(null);
  const [error, setError] = useState("");
  const [latestFailure, setLatestFailure] = useState<{
    id: string;
    message: string | null;
  } | null>(null);
  const [draft, setDraft] = useState<{ id: string; previewUrl: string } | null>(
    null,
  );
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(
    variant.previewUrl ?? "",
  );
  const [checkingDraft, setCheckingDraft] = useState(true);
  const [remainingDetailEdits, setRemainingDetailEdits] = useState<
    number | null
  >(null);
  const [selectedVersion, setSelectedVersion] = useState<"previous" | "new">(
    "new",
  );
  const [comparisonLoaded, setComparisonLoaded] = useState<Set<string>>(
    () => new Set(),
  );
  const comparisonSources = draft
    ? [currentPreviewUrl, draft.previewUrl].filter(
        (source): source is string => Boolean(source),
      )
    : [];
  const comparisonReady =
    comparisonSources.length === 2 &&
    comparisonSources.every((source) => comparisonLoaded.has(source));
  const pollEdit = useCallback(async (
    editId: string,
    isCancelled: () => boolean = () => false,
  ) => {
    for (;;) {
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
      if (isCancelled()) return;
      const statusResponse = await fetchWithNetworkRetry(
        `/api/generation/variants/${variant.id}/edits/${editId}`,
        { cache: "no-store" },
      );
      const status = await statusResponse.json().catch(() => null);
      if (!statusResponse.ok)
        throw new Error(status?.message ?? "Could not read adjustment status");
      if (status.status === "failed")
        throw new Error(
          status.error_message ??
            (locale === "zh"
              ? "细节调整失败，请重试。"
              : "Detail adjustment failed."),
        );
      if (status.status === "processing") setEditStage("generating");
      if (status.status === "completed") {
        if (!status.previewUrl)
          throw new Error(
            locale === "zh"
              ? "调整结果预览尚未就绪。"
              : "The adjusted preview is not ready.",
          );
        setDraft({ id: editId, previewUrl: status.previewUrl });
        setRemainingDetailEdits((current) =>
          current === null ? null : Math.max(0, current - 1),
        );
        setSelectedVersion("new");
        return;
      }
    }
  }, [locale, variant.id]);
  useEffect(() => {
    let cancelled = false;
    const storedInstruction = sessionStorage.getItem(
      instructionStorageKey(variant.id),
    );
    if (storedInstruction) {
      queueMicrotask(() => {
        if (!cancelled) setInstruction(storedInstruction);
      });
    }
    void fetchWithNetworkRetry(`/api/generation/variants/${variant.id}/edits`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((body) => {
        if (!cancelled && typeof body?.remainingDetailEdits === "number")
          setRemainingDetailEdits(body.remainingDetailEdits);
        if (!cancelled && typeof body?.lastInstruction === "string")
          setInstruction((current) => current || body.lastInstruction);
        if (!cancelled && typeof body?.currentPreviewUrl === "string")
          setCurrentPreviewUrl(body.currentPreviewUrl);
        if (!cancelled && body?.latestFailure?.id) {
          setLatestFailure({
            id: body.latestFailure.id,
            message:
              typeof body.latestFailure.message === "string"
                ? body.latestFailure.message
                : null,
          });
        }
        if (!cancelled && body?.inProgress?.id) {
          if (typeof body.inProgress.instruction === "string")
            setInstruction(body.inProgress.instruction);
          setBusy("edit");
          setEditStage(
            body.inProgress.status === "processing"
              ? "generating"
              : "submitting",
          );
          setCheckingDraft(false);
          return pollEdit(body.inProgress.id, () => cancelled)
            .catch((cause) => {
              if (!cancelled) setError(readableRequestError(cause, locale));
            })
            .finally(() => {
              if (!cancelled) {
                setBusy(null);
                setEditStage(null);
              }
            });
        }
        if (!cancelled && body?.draft?.id && body?.draft?.previewUrl) {
          setDraft(body.draft);
          setSelectedVersion("new");
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(readableRequestError(cause, locale));
      })
      .finally(() => {
        if (!cancelled) setCheckingDraft(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, pollEdit, variant.id]);
  async function submit() {
    setBusy("edit");
    setEditStage("submitting");
    setError("");
    setLatestFailure(null);
    try {
      const response = await fetch(
        `/api/generation/variants/${variant.id}/edits`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ instruction }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (body?.error === "VARIANT_EDIT_LIMIT_REACHED")
          throw new Error(
            locale === "zh"
              ? "这个方案赠送的 3 次细节调整已用完。"
              : "This option has used all 3 included detail adjustments.",
          );
        throw new Error(body?.message ?? "Detail adjustment failed");
      }
      await pollEdit(body.id);
    } catch (cause) {
      setError(
        readableRequestError(cause, locale),
      );
    } finally {
      setBusy(null);
      setEditStage(null);
    }
  }
  async function saveDraft() {
    if (!draft) return;
    setBusy("save");
    setError("");
    try {
      const response = await fetch(
        `/api/generation/variants/${variant.id}/edits/${draft.id}/apply`,
        { method: "POST" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Save failed");
      await onChanged({
        variantId: variant.id,
        activeRevisionId: body.activeRevisionId,
        previewUrl: draft.previewUrl,
      });
      sessionStorage.removeItem(instructionStorageKey(variant.id));
      onClose();
    } catch (cause) {
      setError(
        readableRequestError(cause, locale),
      );
    } finally {
      setBusy(null);
    }
  }
  async function discardDraft() {
    if (!draft) return;
    setBusy("restore");
    setError("");
    try {
      const response = await fetch(
        `/api/generation/variants/${variant.id}/edits/${draft.id}`,
        { method: "DELETE" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Restore failed");
      sessionStorage.removeItem(instructionStorageKey(variant.id));
      onClose();
    } catch (cause) {
      setError(
        readableRequestError(cause, locale),
      );
    } finally {
      setBusy(null);
    }
  }
  async function restore() {
    setBusy("restore");
    setError("");
    try {
      const response = await fetch(
        `/api/generation/variants/${variant.id}/restore`,
        { method: "POST" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Restore failed");
      await onChanged();
      onClose();
    } catch (cause) {
      setError(
        readableRequestError(cause, locale),
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <section
      role="region"
      aria-labelledby="variant-edit-title"
      className="mx-auto w-full max-w-3xl"
    >
      <button
        type="button"
        disabled={busy === "save" || busy === "restore"}
        onClick={onClose}
        className="mb-5 inline-flex items-center gap-2 rounded-[4px] border border-border bg-background px-4 py-2.5 text-sm font-bold disabled:opacity-40"
      >
        <span aria-hidden="true">←</span>
        {locale === "zh" ? "返回生成结果" : "Back to results"}
      </button>
      <div className="paper-panel rounded-[6px] border border-border p-4 shadow-[4px_4px_0_rgba(11,23,50,.12)] sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="variant-edit-title" className="text-xl font-black">
              {locale === "zh" ? "调整图标细节" : "Adjust icon details"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {subjectName} ·{" "}
              {locale === "zh"
                ? `方案 ${variant.slot}`
                : `Option ${variant.slot}`}
            </p>
            {remainingDetailEdits !== null ? (
              <p className="mt-2 text-xs font-bold text-brand">
                {locale === "zh"
                  ? `本方案剩余 ${remainingDetailEdits} 次免费细节调整`
                  : `${remainingDetailEdits} free detail edits left for this option`}
              </p>
            ) : null}
          </div>
        </div>
        {checkingDraft ? (
          <div
            role="status"
            aria-label={
              locale === "zh"
                ? "正在加载细节调整页面"
                : "Loading detail adjustment page"
            }
            aria-busy="true"
            className="mt-5"
          >
            <div className="grid items-start gap-5 sm:grid-cols-[240px_minmax(0,1fr)]">
              <SkeletonBlock className="aspect-square w-full max-w-[240px] rounded-[6px]" />
              <div>
                <SkeletonBlock className="h-5 w-28 rounded-md" />
                <SkeletonBlock className="mt-2 h-36 w-full rounded-[4px]" />
                <SkeletonBlock className="ml-auto mt-2 h-3 w-12 rounded-md" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <SkeletonBlock className="h-10 w-16 rounded-[4px]" />
              <SkeletonBlock className="h-10 w-28 rounded-[4px]" />
            </div>
          </div>
        ) : null}
        {!checkingDraft && !draft ? <div className="mt-5 grid items-start gap-5 sm:grid-cols-[240px_minmax(0,1fr)]">
          <div className="relative aspect-square w-full max-w-[240px] overflow-hidden rounded-[6px] bg-surface-muted">
            {currentPreviewUrl ? (
              <ImageWithSkeleton
                src={currentPreviewUrl}
                alt=""
                className="h-full w-full"
                showSkeleton={false}
                failureLabel={locale === "zh" ? "加载失败" : "Failed to load"}
              />
            ) : null}
            {busy === "edit" && editStage === "generating" ? (
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="absolute inset-0 grid place-items-center bg-[#f6edda]/94 p-4"
              >
                <b className="rounded-[3px] border border-border bg-surface px-4 py-2 text-center text-sm text-foreground shadow-[3px_3px_0_rgba(11,23,50,.14)]">
                  {locale === "zh" ? "正在调整图标" : "Adjusting icon"}
                </b>
              </div>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="variant-edit-instruction"
              className="text-sm font-bold"
            >
              {locale === "zh" ? "需要修改什么？" : "What should change?"}
            </label>
            <textarea
              id="variant-edit-instruction"
              value={instruction}
              onChange={(event) => {
                const value = event.target.value;
                setInstruction(value);
                if (value)
                  sessionStorage.setItem(instructionStorageKey(variant.id), value);
                else
                  sessionStorage.removeItem(instructionStorageKey(variant.id));
              }}
              disabled={Boolean(busy) || Boolean(draft)}
              maxLength={500}
              rows={6}
              placeholder={
                locale === "zh"
                  ? "例如：把星星改得更对称，其他内容保持不变"
                  : "For example: Make the star more symmetrical and keep everything else unchanged"
              }
              className="mt-2 w-full resize-none rounded-[4px] border border-border bg-white p-3 text-sm outline-none focus:border-brand disabled:opacity-60"
            />
            <div className="mt-1 text-right text-xs text-muted">
              {instruction.trim().length}/500
            </div>
          </div>
        </div> : null}
        {!checkingDraft && draft ? (
          <fieldset className="mx-auto mt-4 w-full max-w-[480px]">
            <legend className="text-sm font-bold">
              {locale === "zh" ? "选择要保留的版本" : "Choose a version"}
            </legend>
            <div className="relative mt-2">
              {!comparisonReady ? (
                <div className="absolute inset-0 z-10 grid gap-3 sm:grid-cols-2" aria-label={locale === "zh" ? "正在加载版本图片" : "Loading version images"} aria-busy="true">
                  <SkeletonBlock className="aspect-square rounded-[4px]" />
                  <SkeletonBlock className="aspect-square rounded-[4px]" />
                </div>
              ) : null}
              <div className={`grid gap-3 sm:grid-cols-2 ${comparisonReady ? "visible" : "invisible"}`}>
              {[
                {
                  id: "previous" as const,
                  src: currentPreviewUrl,
                  label:
                    locale === "zh" ? "原图" : "Original",
                },
                {
                  id: "new" as const,
                  src: draft.previewUrl,
                  label: locale === "zh" ? "新图" : "New",
                },
              ].map((option) => {
                const selected = selectedVersion === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={Boolean(busy)}
                    onClick={() => setSelectedVersion(option.id)}
                    className={`overflow-hidden rounded-[4px] border-2 p-1.5 text-left transition-colors disabled:opacity-50 ${
                      selected
                        ? "border-brand bg-brand/5"
                        : "border-border bg-background hover:border-brand/40"
                    }`}
                  >
                    <span className="relative block aspect-square overflow-hidden rounded-[4px] bg-surface-muted">
                      {option.src ? (
                        <ImageWithSkeleton
                          src={option.src}
                          alt=""
                          className="h-full w-full"
                          showSkeleton={false}
                          onLoad={() =>
                            setComparisonLoaded((current) => {
                              if (current.has(option.src!)) return current;
                              const next = new Set(current);
                              next.add(option.src!);
                              return next;
                            })
                          }
                          onError={() =>
                            setComparisonLoaded((current) => {
                              if (current.has(option.src!)) return current;
                              const next = new Set(current);
                              next.add(option.src!);
                              return next;
                            })
                          }
                          failureLabel={
                            locale === "zh" ? "加载失败" : "Failed to load"
                          }
                        />
                      ) : null}
                    </span>
                    <span className="mt-1.5 flex items-center justify-between gap-2 px-1 pb-0.5 text-sm font-bold">
                      {option.label}
                      <span
                        aria-hidden="true"
                        className={`grid size-5 place-items-center rounded-full border ${
                          selected
                            ? "border-brand bg-brand text-white"
                            : "border-border"
                        }`}
                      >
                        {selected ? "✓" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
          </fieldset>
        ) : null}
        {busy === "edit" && editStage ? (
          <div
            aria-live="polite"
            aria-busy="true"
            className="mt-4 rounded-[6px] border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <b>
                {editStage === "submitting"
                  ? locale === "zh"
                    ? "正在提交修改要求"
                    : "Submitting your instructions"
                  : locale === "zh"
                    ? "正在生成并处理新版本"
                    : "Generating and processing a new version"}
              </b>
              <span className="text-xs font-bold text-muted">
                {editStage === "submitting" ? "1/3" : "2/3"}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={editStage === "submitting" ? 1 : 2}
              className="draft-progress mt-3 h-2"
            >
              <span
                className={`block h-full bg-brand transition-[width] duration-500 ${editStage === "submitting" ? "w-1/3" : "w-2/3"}`}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {locale === "zh"
                ? "正在调整中...."
                : "Adjusting...."}
            </p>
          </div>
        ) : null}
        {draft ? (
          <div
            role="status"
            className="mx-auto mt-4 w-full max-w-[480px] rounded-[6px] border border-[#b8dfc7] bg-[#effaf3] p-4 text-sm text-[#176b3a]"
          >
            <b>{locale === "zh" ? "调整结果已生成" : "Adjustment ready"}</b>
            <p className="mt-1">
              {locale === "zh"
                ? "对比并选择要保留的版本。选择新图后更新，选择上一次的图则保留原版本。"
                : "Compare both versions. Update to use the new image, or restore to keep the previous one."}
            </p>
          </div>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-[4px] bg-[#fff1ed] p-3 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
        {!checkingDraft && !busy && !draft && latestFailure ? (
          <div
            role="alert"
            className="mt-4 rounded-[4px] border border-[#f3c3b8] bg-[#fff1ed] p-3 text-sm text-danger"
          >
            <b>{locale === "zh" ? "细节调整生成失败" : "Detail adjustment failed"}</b>
            <p className="mt-1">
              {latestFailure.message ||
                (locale === "zh"
                  ? "上一次细节调整未能生成，请修改要求后重试。"
                  : "The previous adjustment could not be generated. Update the instructions and try again.")}
            </p>
          </div>
        ) : null}
        {!checkingDraft ? <div className={`mt-5 flex flex-wrap justify-end gap-2 ${draft ? "mx-auto w-full max-w-[480px]" : ""}`}>
          {variant.activeRevisionId && !draft ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void restore()}
              className="mr-auto rounded-[4px] border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {busy === "restore"
                ? locale === "zh"
                  ? "正在还原…"
                  : "Restoring…"
                : locale === "zh"
                  ? "还原上一次修改"
                  : "Restore previous version"}
            </button>
          ) : null}
          {!draft ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={onClose}
              className="rounded-[4px] border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {locale === "zh" ? "取消" : "Cancel"}
            </button>
          ) : null}
          {draft ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => {
                if (selectedVersion === "new") void saveDraft();
                else void discardDraft();
              }}
              className="mechanical-button bg-brand px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {selectedVersion === "previous"
                ? busy === "restore"
                  ? locale === "zh"
                    ? "正在还原…"
                    : "Restoring…"
                  : locale === "zh"
                    ? "还原"
                    : "Restore"
                : busy === "save"
                ? locale === "zh"
                  ? "正在保存…"
                  : "Saving…"
                : locale === "zh"
                  ? "更新"
                  : "Update"}
            </button>
          ) : (
            <button
              type="button"
              disabled={Boolean(busy) || instruction.trim().length < 5 || remainingDetailEdits === 0}
              onClick={() => void submit()}
              className="mechanical-button bg-brand px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {busy === "edit"
                ? locale === "zh"
                  ? "正在调整…"
                  : "Adjusting…"
                : locale === "zh"
                  ? "生成调整结果"
                  : "Generate adjustment"}
            </button>
          )}
        </div> : null}
      </div>
    </section>
  );
}
