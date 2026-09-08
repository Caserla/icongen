"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { SkeletonBlock } from "@/components/ui/page-skeletons";
import { PageState } from "@/components/ui/page-state";
import { Toast } from "@/components/ui/toast";
import type {
  CreditHistoryKind,
  CreditHistoryResponse,
  CreditLedgerEntryType,
} from "@/lib/credits";
import { isCreditCodeShapeValid, normalizeCreditCode } from "@/lib/credits";

const tabs: CreditHistoryKind[] = ["all", "usage", "topup"];

export default function CreditHistoryPage() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [kind, setKind] = useState<CreditHistoryKind>("all");
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<CreditHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemMessage, setRedeemMessage] = useState("");
  const requestSequence = useRef(0);

  const loadHistory = useCallback(
    async (nextKind: CreditHistoryKind, nextPage: number) => {
      const sequence = ++requestSequence.current;
      setLoading(true);
      setLoadError(false);
      const response = await fetch("/api/account/credits/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: nextKind, page: nextPage }),
      }).catch(() => null);
      if (sequence !== requestSequence.current) return;
      if (!response?.ok) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      const data = (await response.json()) as CreditHistoryResponse;
      setHistory(data);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHistory("all", 1), 0);
    return () => {
      window.clearTimeout(timer);
      requestSequence.current += 1;
    };
  }, [loadHistory]);

  function switchKind(nextKind: CreditHistoryKind) {
    setKind(nextKind);
    setPage(1);
    void loadHistory(nextKind, 1);
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    void loadHistory(kind, nextPage);
  }

  async function redeem(event: FormEvent) {
    event.preventDefault();
    setRedeemError("");
    setRedeemMessage("");
    if (!isCreditCodeShapeValid(code)) {
      setRedeemError(zh ? "请输入有效的 CD-Key。" : "Enter a valid CD-Key.");
      return;
    }
    setRedeeming(true);
    const response = await fetch("/api/account/credits/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as {
          error?: string;
          credits?: number;
        } | null)
      : null;
    setRedeeming(false);
    if (!response?.ok) {
      const messages: Record<string, string> = zh
        ? {
            INVALID_CD_KEY: "这个 CD-Key 无效，请检查后重试。",
            CD_KEY_DISABLED: "这个 CD-Key 已停用。",
            CD_KEY_ALREADY_REDEEMED: "这个 CD-Key 已被使用。",
            CD_KEY_EXPIRED: "这个 CD-Key 已过期。",
          }
        : {
            INVALID_CD_KEY: "This CD-Key is invalid.",
            CD_KEY_DISABLED: "This CD-Key is no longer available.",
            CD_KEY_ALREADY_REDEEMED: "This CD-Key has already been redeemed.",
            CD_KEY_EXPIRED: "This CD-Key has expired.",
          };
      setRedeemError(
        messages[data?.error ?? ""] ??
          (zh
            ? "兑换失败，请稍后重试。"
            : "Redemption failed. Please try again."),
      );
      return;
    }
    setCode("");
    setRedeemMessage(
      zh
        ? `兑换成功，已到账 ${data?.credits ?? 0} 点。`
        : `${data?.credits ?? 0} credits added to your account.`,
    );
    setKind("all");
    setPage(1);
    await loadHistory("all", 1);
  }

  const labels: Record<CreditHistoryKind, string> = zh
    ? { all: "全部", usage: "消耗记录", topup: "充值记录" }
    : { all: "All", usage: "Usage", topup: "Top-ups" };

  return (
    <div className="account-copy-scale">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/account"
            className="focus-ring text-sm font-bold text-brand hover:text-brand-strong"
          >
            ← {zh ? "返回账户" : "Back to account"}
          </Link>
          <h1 className="display-serif mt-4 text-4xl font-medium tracking-[-.045em] sm:text-5xl">
            {zh ? "点数记录" : "Credit history"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {zh
              ? "查看点数去向，或使用 CD-Key 充值。"
              : "See where your credits went, or redeem a CD-Key."}
          </p>
        </div>
        <div className="studio-panel px-5 py-3 text-right">
          <p className="text-xs font-black uppercase tracking-[.1em] text-muted">
            {zh ? "当前余额" : "Balance"}
          </p>
          <strong className="mt-1 block text-3xl tracking-[-.04em] text-brand">
            {history?.balance ?? "—"}
          </strong>
        </div>
      </header>

      <section className="studio-panel mt-8 p-5 sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <form onSubmit={redeem}>
            <label htmlFor="credit-code" className="text-sm font-black">
              {zh ? "CD-Key 充值" : "Redeem a CD-Key"}
            </label>
            <p className="mt-1 text-xs text-muted">
              {zh
                ? "输入兑换码，点数会立即加入当前账户。"
                : "Enter a code to add credits to this account."}
            </p>
            <div className="mt-3 flex max-w-2xl flex-col gap-3 sm:flex-row">
              <input
                id="credit-code"
                value={code}
                maxLength={23}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) =>
                  setCode(normalizeCreditCode(event.target.value))
                }
                placeholder="BAM-XXXX-XXXX-XXXX-XXXX"
                className="focus-ring min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-[#222226] px-4 font-mono text-sm uppercase tracking-[.08em] text-foreground outline-none transition-colors placeholder:text-muted focus:border-white/25"
              />
              <button
                disabled={redeeming || !code}
                className="studio-button studio-button--primary focus-ring min-h-12 shrink-0 px-6 font-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {redeeming
                  ? zh
                    ? "兑换中…"
                    : "Redeeming…"
                  : zh
                    ? "立即兑换"
                    : "Redeem"}
              </button>
            </div>
            {redeemError ? (
              <Toast message={redeemError} variant="error" />
            ) : null}
            {redeemMessage ? (
              <p role="status" className="mt-3 text-sm font-bold text-success">
                {redeemMessage}
              </p>
            ) : null}
          </form>
          <Link
            href="/pricing"
            className="focus-ring text-sm font-black text-brand underline decoration-2 underline-offset-4 hover:text-brand-strong"
          >
            {zh ? "购买点数" : "Buy credits"}
          </Link>
        </div>
      </section>

      <section className="studio-panel mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div
            className="flex gap-1"
            role="tablist"
            aria-label={zh ? "点数记录筛选" : "Credit history filters"}
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={kind === tab}
                onClick={() => switchKind(tab)}
                className={`focus-ring min-h-10 rounded-xl px-4 text-sm font-black transition-colors ${kind === tab ? "bg-[#f5f5f5] text-[#171717]" : "text-muted hover:bg-[#252525] hover:text-foreground"}`}
              >
                {labels[tab]}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">
            {history
              ? zh
                ? `共 ${history.total} 条`
                : `${history.total} records`
              : ""}
          </span>
        </div>

        {loading ? (
          <PageState />
        ) : loadError ? (
          <PageState kind="error" onRetry={()=>void loadHistory(kind,page)}/>
        ) : history?.items.length ? (
          <>
            <div className="divide-y divide-border">
              {history.items.map((item) => (
                <HistoryRow key={item.id} item={item} locale={locale} />
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 border-t border-border px-4 py-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
                className="studio-button studio-button--secondary focus-ring min-h-9 px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-35"
              >
                ← {zh ? "上一页" : "Previous"}
              </button>
              <span className="text-xs font-bold text-muted">
                {history.page} / {history.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= history.totalPages}
                onClick={() => changePage(page + 1)}
                className="studio-button studio-button--secondary focus-ring min-h-9 px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-35"
              >
                {zh ? "下一页" : "Next"} →
              </button>
            </div>
          </>
        ) : (
          <div className="px-5 py-16 text-center">
            <p className="font-black">
              {zh ? "暂无点数记录" : "No credit records yet"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {zh
                ? "生成图标或完成充值后，记录会出现在这里。"
                : "Generation and top-up activity will appear here."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function HistoryRow({
  item,
  locale,
}: {
  item: CreditHistoryResponse["items"][number];
  locale: "en" | "zh";
}) {
  const zh = locale === "zh";
  const names: Record<CreditLedgerEntryType, string> = zh
    ? {
        purchase: "购买点数",
        generation_debit: "生成图标",
        generation_refund: "生成失败退回",
        admin_adjustment: "人工调整",
        signup_bonus: "新用户赠送",
        cd_key_redemption: "CD-Key 充值",
      }
    : {
        purchase: "Credit purchase",
        generation_debit: "Icon generation",
        generation_refund: "Generation refund",
        admin_adjustment: "Account adjustment",
        signup_bonus: "Welcome credits",
        cd_key_redemption: "CD-Key top-up",
      };
  const date = new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(item.createdAt));
  return (
    <article className="grid gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6 sm:px-5">
      <div className="min-w-0">
        <p className="font-black">{names[item.entryType] ?? item.entryType}</p>
        <p className="mt-1 truncate text-xs text-muted">{item.note || date}</p>
      </div>
      <div className="text-xs text-muted sm:text-right">
        <span className="sm:hidden">{zh ? "时间：" : "Date: "}</span>
        {date}
        <span className="ml-3 sm:block sm:ml-0 sm:mt-1">
          {zh ? `余额 ${item.balanceAfter}` : `Balance ${item.balanceAfter}`}
        </span>
      </div>
      <strong
        className={`text-lg tabular-nums sm:min-w-16 sm:text-right ${item.amount > 0 ? "text-success" : "text-foreground"}`}
      >
        {item.amount > 0 ? "+" : ""}
        {item.amount}
      </strong>
    </article>
  );
}

function HistorySkeleton() {
  return (
    <div className="divide-y divide-border" aria-label="Loading credit records">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="grid gap-3 px-5 py-5 sm:grid-cols-[1fr_10rem_4rem] sm:items-center"
        >
          <div>
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="mt-2 h-3 w-48" />
          </div>
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-5 w-12 sm:justify-self-end" />
        </div>
      ))}
    </div>
  );
}
