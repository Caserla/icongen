"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Toast } from "@/components/ui/toast";

type Tab = "overview" | "users" | "jobs" | "cdkeys" | "audit";
type Overview = {
  users?: number;
  jobsToday?: number;
  queued?: number;
  processing?: number;
  failedToday?: number;
  debitedToday?: number;
  refundedToday?: number;
  cdKeyCreditsToday?: number;
  cdKeysRedeemedToday?: number;
  trend?: Array<{ date: string; jobs: number; credits: number }>;
  runtimeLimits?: {
    enforcement_enabled?: boolean;
    max_global_active_jobs?: number;
  };
};
type ListResponse = {
  items: Array<Record<string, unknown>>;
  page: number;
  pages: number;
  total: number;
};
const tabs: Array<[Tab, string, string]> = [
  ["overview", "数据总览", "Overview"],
  ["users", "用户", "Users"],
  ["jobs", "生成监控", "Generation"],
  ["cdkeys", "CD-Key", "CD-Keys"],
  ["audit", "操作审计", "Audit log"],
];

export function AdminDashboard() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [lists, setLists] = useState<
    Partial<Record<Exclude<Tab, "overview">, ListResponse>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const load = useCallback(
    async (targetTab: Tab = tab) => {
      const requestId = ++requestSequence.current;
      setLoading(true);
      setError("");
      const endpoint =
        targetTab === "overview"
          ? "/api/admin/overview"
          : `/api/admin/${targetTab === "cdkeys" ? "cd-keys" : targetTab}/query`;
      const response =
        targetTab === "overview"
          ? await fetch(endpoint, { cache: "no-store" }).catch(() => null)
          : await fetch(endpoint, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ page: 1, query: "", status: "all" }),
            }).catch(() => null);
      const data = await response?.json().catch(() => null);
      if (requestId !== requestSequence.current) return;
      if (!response?.ok)
        setError(
          data?.message ??
            (zh
              ? "数据加载失败，请重试。"
              : "Data could not be loaded. Try again."),
        );
      else if (targetTab === "overview") setOverview(data);
      else
        setLists((current) => ({
          ...current,
          [targetTab]: data,
        }));
      setLoading(false);
    },
    [tab, zh],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return (
    <div>
      {error ? <Toast message={error} variant="error" /> : null}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-brand">
            Operations
          </p>
          <h1 className="display-serif mt-2 text-4xl sm:text-5xl">
            {zh ? "运营控制台" : "Operations console"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {zh
              ? "监控用户、生成任务、点数和 CD-Key 发放。"
              : "Monitor users, generation jobs, credits, and CD-Key distribution."}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="studio-button studio-button--secondary focus-ring px-4 py-2 text-sm font-black"
        >
          {zh ? "刷新数据" : "Refresh data"}
        </button>
      </div>
      <nav className="mt-8 flex flex-wrap gap-2">
        {tabs.map(([id, zhLabel, enLabel]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`focus-ring rounded-xl px-4 py-2 text-sm font-black transition-colors ${tab === id ? "bg-[#f5f5f5] text-[#171717]" : "border border-transparent text-muted hover:bg-[#252525] hover:text-foreground"}`}
          >
            {zh ? zhLabel : enLabel}
          </button>
        ))}
      </nav>
      <section className="studio-panel mt-6 min-h-[420px] p-5 sm:p-7">
        {loading ? (
          <Loading />
        ) : tab === "overview" ? (
          <OverviewPanel data={overview} zh={zh} />
        ) : tab === "cdkeys" ? (
          <CdKeyPanel data={lists.cdkeys ?? null} reload={load} zh={zh} />
        ) : (
          <DataTable kind={tab} data={lists[tab] ?? null} zh={zh} />
        )}
      </section>
    </div>
  );
}

function OverviewPanel({ data, zh }: { data: Overview | null; zh: boolean }) {
  const cards = [
    [zh ? "用户总数" : "Total users", data?.users],
    [zh ? "今日任务" : "Jobs today", data?.jobsToday],
    [zh ? "排队中" : "Queued", data?.queued],
    [zh ? "处理中" : "Processing", data?.processing],
    [zh ? "今日失败" : "Failures today", data?.failedToday],
    [zh ? "今日消耗点数" : "Credits used today", data?.debitedToday],
    [zh ? "今日返还" : "Credits refunded today", data?.refundedToday],
    [zh ? "CD-Key 到账" : "CD-Key credits today", data?.cdKeyCreditsToday],
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article
            key={String(label)}
            className="rounded-[16px] border border-border bg-[#1d1d1d] p-5"
          >
            <p className="text-sm font-bold text-muted">{label}</p>
            <strong className="mt-3 block text-3xl">
              {Number(value ?? 0).toLocaleString()}
            </strong>
          </article>
        ))}
      </div>
      <TrendChart data={data?.trend ?? []} zh={zh} />
      <div className="mt-5 flex items-center justify-between rounded-[16px] border border-border bg-[#1d1d1d] p-5 text-foreground">
        <div>
          <p className="font-black">
            {zh ? "成本熔断" : "Cost circuit breaker"}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {zh ? "全局并发上限" : "Global concurrency limit"}{" "}
            {data?.runtimeLimits?.max_global_active_jobs ?? "—"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${data?.runtimeLimits?.enforcement_enabled ? "bg-success" : "bg-warning text-foreground"}`}
        >
          {data?.runtimeLimits?.enforcement_enabled
            ? zh
              ? "已启用"
              : "Enabled"
            : zh
              ? "观察模式"
              : "Observe only"}
        </span>
      </div>
    </>
  );
}

function TrendChart({
  data,
  zh,
}: {
  data: Array<{ date: string; jobs: number; credits: number }>;
  zh: boolean;
}) {
  const width = 920;
  const height = 280;
  const padding = { top: 24, right: 24, bottom: 42, left: 38 };
  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [item.jobs, item.credits]),
  );
  const points = (key: "jobs" | "credits") =>
    data.map((item, index) => ({
      x:
        padding.left +
        (index / Math.max(1, data.length - 1)) *
          (width - padding.left - padding.right),
      y:
        padding.top +
        (1 - item[key] / maxValue) * (height - padding.top - padding.bottom),
      value: item[key],
      date: item.date,
    }));
  const jobPoints = points("jobs");
  const creditPoints = points("credits");
  const path = (series: ReturnType<typeof points>) => {
    if (!series.length) return "";
    return series.slice(1).reduce((result, point, index) => {
      const previous = series[index];
      const middle = (previous.x + point.x) / 2;
      return `${result} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
    }, `M ${series[0].x} ${series[0].y}`);
  };
  return (
    <article className="mt-5 rounded-[16px] border border-border bg-[#1d1d1d] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-black">
            {zh ? "近 14 天运营趋势" : "14-day operations trend"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {zh ? "按 UTC 自然日统计" : "Grouped by UTC calendar day"}
          </p>
        </div>
        <div className="flex gap-4 text-xs font-bold text-muted">
          <span className="flex items-center gap-2">
            <i className="size-2.5 rounded-full bg-brand" />
            {zh ? "生成任务" : "Generation jobs"}
          </span>
          <span className="flex items-center gap-2">
            <i className="size-2.5 rounded-full bg-warning" />
            {zh ? "消耗点数" : "Credits used"}
          </span>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[680px] w-full"
          role="img"
          aria-label={
            zh
              ? "近十四天生成任务和点数消耗趋势曲线"
              : "Generation jobs and credit usage over the last 14 days"
          }
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y =
              padding.top + ratio * (height - padding.top - padding.bottom);
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-border"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted text-[10px]"
                >
                  {Math.round(maxValue * (1 - ratio))}
                </text>
              </g>
            );
          })}
          <path
            d={`${path(jobPoints)} L ${jobPoints.at(-1)?.x ?? padding.left} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`}
            className="fill-brand/10"
          />
          <path
            d={path(jobPoints)}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className="text-brand"
          />
          <path
            d={path(creditPoints)}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="8 7"
            className="text-warning"
          />
          {jobPoints.map((point, index) => (
            <g key={point.date}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                className="fill-brand stroke-background stroke-2"
              >
                <title>
                  {zh
                    ? `${point.date}：${point.value} 个任务，${creditPoints[index]?.value ?? 0} 点`
                    : `${point.date}: ${point.value} jobs, ${creditPoints[index]?.value ?? 0} credits`}
                </title>
              </circle>
              {(index === 0 ||
                index === data.length - 1 ||
                index % 3 === 0) && (
                <text
                  x={point.x}
                  y={height - 16}
                  textAnchor="middle"
                  className="fill-muted text-[10px]"
                >
                  {point.date.slice(5)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </article>
  );
}

function CdKeyPanel({
  data,
  reload,
  zh,
}: {
  data: ListResponse | null;
  reload: () => Promise<void>;
  zh: boolean;
}) {
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setCopyMessage("");
    setCodes([]);
    const form = new FormData(event.currentTarget);
    const expires = String(form.get("expiresAt") ?? "");
    const response = await fetch("/api/admin/cd-keys/batches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        credits: Number(form.get("credits")),
        count: Number(form.get("count")),
        expiresAt: expires
          ? new Date(`${expires}T23:59:59Z`).toISOString()
          : null,
        channel: form.get("channel"),
        note: form.get("note"),
      }),
    });
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setMessage(
        result?.message ?? (zh ? "生成失败" : "Could not generate CD-Keys"),
      );
      return;
    }
    setCodes(result.codes ?? []);
    setMessage(
      zh
        ? `已生成 ${result.codes?.length ?? 0} 个兑换码。明文仅本次显示，请立即导出。`
        : `${result.codes?.length ?? 0} codes generated. Plain-text codes are shown only once; export them now.`,
    );
    await reload();
  }
  async function copyAll() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopyMessage(zh ? "已复制全部 CD-Key。" : "All CD-Keys copied.");
    } catch {
      setCopyMessage(
        zh
          ? "复制失败，请手动选择下方内容。"
          : "Copy failed. Select the codes below manually.",
      );
    }
  }
  function download() {
    const csv = `code\n${codes.map((code) => `"${code}"`).join("\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv" }),
    );
    link.download = `cd-keys-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <div className="grid gap-7 xl:grid-cols-[380px_1fr]">
      <div>
        <h2 className="text-xl font-black">
          {zh ? "生成兑换码" : "Generate CD-Keys"}
        </h2>
        <form onSubmit={create} className="mt-5 grid gap-4">
          <Field name="name" label={zh ? "批次名称" : "Batch name"} required />
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="credits"
              label={zh ? "每码点数" : "Credits per code"}
              type="number"
              min="1"
              max="10000"
              defaultValue="20"
            />
            <Field
              name="count"
              label={zh ? "数量" : "Quantity"}
              type="number"
              min="1"
              max="500"
              defaultValue="10"
            />
          </div>
          <Field
            name="expiresAt"
            label={zh ? "有效期" : "Expiration date"}
            type="date"
          />
          <Field
            name="channel"
            label={zh ? "发放渠道" : "Distribution channel"}
          />
          <Field name="note" label={zh ? "内部备注" : "Internal note"} />
          <button
            disabled={busy}
            className="studio-button studio-button--primary focus-ring min-h-12 px-5 font-black disabled:opacity-50"
          >
            {busy
              ? zh
                ? "正在生成…"
                : "Generating…"
              : zh
                ? "生成 CD-Key"
                : "Generate CD-Keys"}
          </button>
        </form>
        {message ? (
          <p role="status" className="mt-4 text-sm font-bold text-muted">
            {message}
          </p>
        ) : null}
        {codes.length ? (
          <section
            aria-label={zh ? "本次生成的 CD-Key" : "Newly generated CD-Keys"}
            className="studio-panel mt-4 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black">
                {zh
                  ? `本次生成（${codes.length} 个）`
                  : `Generated now (${codes.length})`}
              </h3>
              <span className="text-xs font-bold text-danger">
                {zh ? "仅本次可见" : "Shown once"}
              </span>
            </div>
            <textarea
              readOnly
              value={codes.join("\n")}
              aria-label={zh ? "CD-Key 明文列表" : "Plain-text CD-Key list"}
              onFocus={(event) => event.currentTarget.select()}
              className="focus-ring mt-3 h-48 w-full resize-y rounded-xl border border-border bg-[#222226] px-3 py-2 font-mono text-sm leading-7"
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void copyAll()}
                className="studio-button studio-button--primary focus-ring px-4 py-3 font-black"
              >
                {zh ? "复制全部" : "Copy all"}
              </button>
              <button
                type="button"
                onClick={download}
                className="studio-button studio-button--secondary focus-ring px-4 py-3 font-black"
              >
                {zh ? "导出 CSV" : "Export CSV"}
              </button>
            </div>
            {copyMessage ? (
              <p role="status" className="mt-3 text-sm font-bold text-muted">
                {copyMessage}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
      <div>
        <h2 className="text-xl font-black">
          {zh ? "发放批次" : "Distribution batches"}
        </h2>
        <BatchTable data={data} reload={reload} zh={zh} />
      </div>
    </div>
  );
}

function BatchTable({
  data,
  reload,
  zh,
}: {
  data: ListResponse | null;
  reload: () => Promise<void>;
  zh: boolean;
}) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th>{zh ? "批次" : "Batch"}</th>
            <th>{zh ? "点数/数量" : "Credits / quantity"}</th>
            <th>{zh ? "兑换" : "Redeemed"}</th>
            <th>{zh ? "渠道" : "Channel"}</th>
            <th>{zh ? "创建时间" : "Created"}</th>
            <th>{zh ? "状态" : "Status"}</th>
            <th className="text-right">{zh ? "操作" : "Action"}</th>
          </tr>
        </thead>
        <tbody>
          {(data?.items ?? []).map((item) => {
            const codes =
              (item.credit_redemption_codes as Array<{
                redeemed_at?: string;
              }>) ?? [];
            return (
              <tr key={String(item.id)} className="border-t border-border">
                <td className="py-4 font-black">{String(item.name)}</td>
                <td>
                  {String(item.credits_per_code)} × {String(item.code_count)}
                </td>
                <td>
                  {codes.filter((code) => code.redeemed_at).length}/
                  {codes.length}
                </td>
                <td>{String(item.channel ?? "—")}</td>
                <td>{formatDate(item.created_at, zh)}</td>
                <td>
                  {item.disabled_at
                    ? zh
                      ? "已禁用"
                      : "Disabled"
                    : zh
                      ? "正常"
                      : "Active"}
                </td>
                <td className="py-2 text-right">
                  {item.disabled_at ? (
                    "—"
                  ) : (
                    <DisableBatchButton
                      batchId={String(item.id)}
                      reload={reload}
                      zh={zh}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!data?.items.length ? <Empty zh={zh} /> : null}
    </div>
  );
}

function DisableBatchButton({
  batchId,
  reload,
  zh,
}: {
  batchId: string;
  reload: () => Promise<void>;
  zh: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function disable() {
    if (reason.trim().length < 3) {
      setMessage(
        zh ? "请填写停用原因" : "Enter a reason for disabling this batch",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    const response = await fetch(
      `/api/admin/cd-keys/batches/${batchId}/disable`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      },
    );
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setMessage(
        result?.message ?? (zh ? "停用失败" : "Could not disable this batch"),
      );
      return;
    }
    setEditing(false);
    await reload();
  }
  if (!editing)
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="studio-button studio-button--secondary focus-ring px-3 py-1.5 text-xs font-black text-muted"
      >
        {zh ? "停用" : "Disable"}
      </button>
    );
  return (
    <div className="ml-auto flex max-w-[300px] flex-wrap justify-end gap-2">
      <input
        aria-label={zh ? "停用原因" : "Reason for disabling"}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={zh ? "停用原因" : "Reason for disabling"}
        className="focus-ring min-h-9 w-40 rounded-xl border border-border bg-[#222226] px-3 text-xs"
      />
      <button
        type="button"
        disabled={busy}
        onClick={disable}
        className="studio-button focus-ring bg-[#c2413b] px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
      >
        {busy ? (zh ? "处理中…" : "Working…") : zh ? "确认" : "Confirm"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setEditing(false);
          setMessage("");
        }}
        className="studio-button studio-button--secondary focus-ring px-3 py-1.5 text-xs font-black"
      >
        {zh ? "取消" : "Cancel"}
      </button>
      {message ? (
        <Toast message={message} variant="error" />
      ) : null}
    </div>
  );
}

function DataTable({
  kind,
  data,
  zh,
}: {
  kind: Tab;
  data: ListResponse | null;
  zh: boolean;
}) {
  const columns =
    kind === "users"
      ? zh
        ? ["用户", "状态", "点数", "注册时间"]
        : ["User", "Status", "Credits", "Registered"]
      : kind === "jobs"
        ? zh
          ? ["任务", "用户", "状态", "主体", "进度", "创建时间"]
          : ["Job", "User", "Status", "Subjects", "Progress", "Created"]
        : zh
          ? ["操作", "目标", "管理员", "时间"]
          : ["Action", "Target", "Administrator", "Time"];
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">
          {kind === "users"
            ? zh
              ? "用户列表"
              : "Users"
            : kind === "jobs"
              ? zh
                ? "生成任务"
                : "Generation jobs"
              : zh
                ? "审计记录"
                : "Audit log"}
        </h2>
        <span className="text-sm text-muted">
          {zh ? `共 ${data?.total ?? 0} 条` : `${data?.total ?? 0} records`}
        </span>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={String(item.id)} className="border-t border-border">
                {kind === "users" ? (
                  <>
                    <td className="py-4">
                      <b>
                        {String(
                          item.display_name ??
                            (zh ? "未设置昵称" : "No nickname"),
                        )}
                      </b>
                      <small className="block text-muted">
                        {String(item.email ?? item.id)}
                      </small>
                    </td>
                    <td>{String(item.status)}</td>
                    <td>
                      {String(
                        (item.credit_accounts as { balance?: number })
                          ?.balance ?? 0,
                      )}
                    </td>
                    <td>{formatDate(item.created_at, zh)}</td>
                  </>
                ) : kind === "jobs" ? (
                  <>
                    <td className="py-4 font-mono text-xs">
                      {String(item.id).slice(0, 8)}…
                    </td>
                    <td>
                      {String(
                        (item.profiles as { email?: string })?.email ??
                          item.user_id,
                      )}
                    </td>
                    <td>{String(item.status)}</td>
                    <td>{String(item.subject_count ?? 0)}</td>
                    <td>{String(item.progress_percent ?? 0)}%</td>
                    <td>{formatDate(item.created_at, zh)}</td>
                  </>
                ) : (
                  <>
                    <td className="py-4 font-black">{String(item.action)}</td>
                    <td>
                      {String(item.target_type)} ·{" "}
                      {String(item.target_id).slice(0, 10)}
                    </td>
                    <td className="font-mono text-xs">
                      {String(item.actor_user_id ?? "system").slice(0, 8)}
                    </td>
                    <td>{formatDate(item.created_at, zh)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.items.length ? <Empty zh={zh} /> : null}
      </div>
    </div>
  );
}

function Field(props: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm font-black">
      {props.label}
      <input
        name={props.name}
        type={props.type}
        required={props.required}
        min={props.min}
        max={props.max}
        defaultValue={props.defaultValue}
        className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-border bg-[#222226] px-3 font-normal"
      />
    </label>
  );
}
function Loading() {
  return (
    <div
      className="admin-dashboard-skeleton"
      role="status"
      aria-label="Loading operations data"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="rounded-[16px] bg-[#1d1d1d] p-5"
          >
            <span className="skeleton-block block h-3 w-20 rounded-md" />
            <span className="skeleton-block mt-4 block h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-[16px] bg-[#1d1d1d] p-5">
        <span className="skeleton-block block h-4 w-28 rounded-md" />
        <span className="skeleton-block mt-5 block h-40 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading operations data…</span>
    </div>
  );
}
function Empty({ zh }: { zh: boolean }) {
  return (
    <p className="py-16 text-center text-sm text-muted">
      {zh ? "暂无数据" : "No data yet"}
    </p>
  );
}
function formatDate(value: unknown, zh: boolean) {
  return value
    ? new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(String(value)))
    : "—";
}
