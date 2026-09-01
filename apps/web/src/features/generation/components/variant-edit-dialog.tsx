"use client";
/* eslint-disable @next/next/no-img-element -- private generated asset URL */
import { useState } from "react";
import type { GenerationJobV2 } from "@icongen/shared";
import { SkeletonBlock } from "@/components/ui/page-skeletons";
type Variant = GenerationJobV2["subjects"][number]["variants"][number];

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
  onChanged: () => Promise<void>;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<"edit" | "save" | "restore" | null>(null);
  const [editStage, setEditStage] = useState<
    "submitting" | "generating" | null
  >(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ id: string; previewUrl: string } | null>(
    null,
  );
  async function submit() {
    setBusy("edit");
    setEditStage("submitting");
    setError("");
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
      if (!response.ok)
        throw new Error(body?.message ?? "Detail adjustment failed");
      for (;;) {
        await new Promise((resolve) => window.setTimeout(resolve, 1800));
        const statusResponse = await fetch(
          `/api/generation/variants/${variant.id}/edits/${body.id}`,
          { cache: "no-store" },
        );
        const status = await statusResponse.json().catch(() => null);
        if (!statusResponse.ok)
          throw new Error(
            status?.message ?? "Could not read adjustment status",
          );
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
          setDraft({ id: body.id, previewUrl: status.previewUrl });
          return;
        }
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : locale === "zh"
            ? "细节调整失败，请重试。"
            : "Detail adjustment failed.",
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
      await onChanged();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : locale === "zh"
            ? "保存修改失败，请重试。"
            : "Could not save the adjustment.",
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
        cause instanceof Error
          ? cause.message
          : locale === "zh"
            ? "还原失败，请重试。"
            : "Restore failed.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="variant-edit-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-[24px] bg-background p-5 shadow-2xl sm:p-6">
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
          </div>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xl text-muted hover:bg-surface-muted disabled:opacity-40"
            aria-label={locale === "zh" ? "关闭" : "Close"}
          >
            ×
          </button>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-[220px_1fr]">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface-muted">
            {(draft?.previewUrl ?? variant.previewUrl) ? (
              <img
                src={draft?.previewUrl ?? variant.previewUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : null}
            {busy === "edit" ? (
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="absolute inset-0 flex flex-col justify-end bg-background/88 p-4 backdrop-blur-[2px]"
              >
                <div className="space-y-3 rounded-xl border border-border bg-background/95 p-4">
                  <SkeletonBlock className="h-3 w-2/3 rounded-full" />
                  <SkeletonBlock className="h-3 w-full rounded-full" />
                  <SkeletonBlock className="h-3 w-4/5 rounded-full" />
                  <b className="block pt-1 text-center text-sm text-foreground">
                    {editStage === "submitting"
                      ? locale === "zh"
                        ? "正在提交修改"
                        : "Submitting changes"
                      : locale === "zh"
                        ? "正在调整图标"
                        : "Adjusting icon"}
                  </b>
                </div>
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
              onChange={(event) => setInstruction(event.target.value)}
              disabled={Boolean(busy) || Boolean(draft)}
              maxLength={500}
              rows={6}
              placeholder={
                locale === "zh"
                  ? "例如：把星星改得更对称，其他内容保持不变"
                  : "For example: Make the star more symmetrical and keep everything else unchanged"
              }
              className="mt-2 w-full resize-none rounded-xl border border-border bg-white p-3 text-sm outline-none focus:border-brand disabled:opacity-60"
            />
            <div className="mt-1 text-right text-xs text-muted">
              {instruction.trim().length}/500
            </div>
          </div>
        </div>
        {busy === "edit" && editStage ? (
          <div
            aria-live="polite"
            aria-busy="true"
            className="mt-4 rounded-2xl border border-border bg-surface p-4"
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
            <div className="mt-3 space-y-2">
              <SkeletonBlock className="h-2 w-full rounded-full" />
              <SkeletonBlock className="h-2 w-3/4 rounded-full" />
            </div>
            <p className="mt-2 text-xs text-muted">
              {locale === "zh"
                ? "处理期间请保持页面开启，原始版本不会被覆盖。"
                : "Keep this page open. Your original version will not be overwritten."}
            </p>
          </div>
        ) : null}
        {draft ? (
          <div
            role="status"
            className="mt-4 rounded-2xl border border-[#b8dfc7] bg-[#effaf3] p-4 text-sm text-[#176b3a]"
          >
            <b>{locale === "zh" ? "调整结果已生成" : "Adjustment ready"}</b>
            <p className="mt-1">
              {locale === "zh"
                ? "请检查预览，确认后点击“保存修改”才会替换当前方案。"
                : "Review the preview. The current option changes only after you select Save changes."}
            </p>
          </div>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-[#fff1ed] p-3 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {variant.activeRevisionId ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void restore()}
              className="mr-auto rounded-xl border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-50"
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
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {draft
              ? locale === "zh"
                ? "放弃修改"
                : "Discard"
              : locale === "zh"
                ? "取消"
                : "Cancel"}
          </button>
          {draft ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void saveDraft()}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {busy === "save"
                ? locale === "zh"
                  ? "正在保存…"
                  : "Saving…"
                : locale === "zh"
                  ? "保存修改"
                  : "Save changes"}
            </button>
          ) : (
            <button
              type="button"
              disabled={Boolean(busy) || instruction.trim().length < 5}
              onClick={() => void submit()}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
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
        </div>
      </div>
    </div>
  );
}
