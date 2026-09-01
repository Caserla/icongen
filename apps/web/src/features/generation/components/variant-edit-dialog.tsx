"use client";
/* eslint-disable @next/next/no-img-element -- private generated asset URL */
import { useState } from "react";
import type { GenerationJobV2 } from "@icongen/shared";
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
  const [busy, setBusy] = useState<"edit" | "restore" | null>(null);
  const [editStage, setEditStage] = useState<
    "submitting" | "generating" | "saving" | null
  >(null);
  const [error, setError] = useState("");
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
          setEditStage("saving");
          break;
        }
      }
      await onChanged();
      onClose();
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
            {variant.previewUrl ? (
              <img
                src={variant.previewUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : null}
            {busy === "edit" ? (
              <div className="absolute inset-0 grid place-items-center bg-black/45 text-white backdrop-blur-[2px]">
                <div className="grid place-items-center gap-3 text-center">
                  <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  <b className="text-sm">
                    {editStage === "submitting"
                      ? locale === "zh"
                        ? "正在提交修改"
                        : "Submitting changes"
                      : editStage === "saving"
                        ? locale === "zh"
                          ? "正在刷新结果"
                          : "Refreshing result"
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
              disabled={Boolean(busy)}
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
            className="mt-4 rounded-2xl border border-brand/20 bg-brand/5 p-4"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <b>
                {editStage === "submitting"
                  ? locale === "zh"
                    ? "正在提交修改要求"
                    : "Submitting your instructions"
                  : editStage === "generating"
                    ? locale === "zh"
                      ? "正在生成并处理新版本"
                      : "Generating and processing a new version"
                    : locale === "zh"
                      ? "新版本已生成，正在刷新页面"
                      : "New version ready, refreshing the page"}
              </b>
              <span className="text-xs font-bold text-brand">
                {editStage === "submitting"
                  ? "1/3"
                  : editStage === "generating"
                    ? "2/3"
                    : "3/3"}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand/15">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{
                  width:
                    editStage === "submitting"
                      ? "20%"
                      : editStage === "generating"
                        ? "70%"
                        : "100%",
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {locale === "zh"
                ? "处理期间请保持页面开启，原始版本不会被覆盖。"
                : "Keep this page open. Your original version will not be overwritten."}
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
                  ? "还原初始版本"
                  : "Restore original"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {locale === "zh" ? "取消" : "Cancel"}
          </button>
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
        </div>
      </div>
    </div>
  );
}
