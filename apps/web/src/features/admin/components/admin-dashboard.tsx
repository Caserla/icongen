"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

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
const tabs: Array<[Tab, string]> = [
  ["overview", "数据总览"],
  ["users", "用户"],
  ["jobs", "生成监控"],
  ["cdkeys", "CD-Key"],
  ["audit", "操作审计"],
];

export function AdminDashboard() {
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
      if (!response?.ok) setError(data?.message ?? "数据加载失败，请重试。");
      else if (targetTab === "overview") setOverview(data);
      else
        setLists((current) => ({
          ...current,
          [targetTab]: data,
        }));
      setLoading(false);
    },
    [tab],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-brand">
            Operations
          </p>
          <h1 className="display-serif mt-2 text-4xl sm:text-5xl">
            运营控制台
          </h1>
          <p className="mt-2 text-sm text-muted">
            监控用户、生成任务、点数和 CD-Key 发放。
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="focus-ring rounded-full border border-border bg-surface px-4 py-2 text-sm font-black"
        >
          刷新数据
        </button>
      </div>
      <nav className="mt-8 flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`focus-ring rounded-full px-4 py-2 text-sm font-black ${tab === id ? "bg-foreground text-white" : "border border-border bg-surface text-muted"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <section className="mt-6 min-h-[420px] rounded-[12px] border border-border bg-surface p-5 sm:p-7">
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} retry={load} />
        ) : tab === "overview" ? (
          <OverviewPanel data={overview} />
        ) : tab === "cdkeys" ? (
          <CdKeyPanel data={lists.cdkeys ?? null} reload={load} />
        ) : (
          <DataTable kind={tab} data={lists[tab] ?? null} />
        )}
      </section>
    </div>
  );
}

function OverviewPanel({ data }: { data: Overview | null }) {
  const cards = [
    ["用户总数", data?.users],
    ["今日任务", data?.jobsToday],
    ["排队中", data?.queued],
    ["处理中", data?.processing],
    ["今日失败", data?.failedToday],
    ["今日消耗点数", data?.debitedToday],
    ["今日返还", data?.refundedToday],
    ["CD-Key 到账", data?.cdKeyCreditsToday],
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article
            key={String(label)}
            className="rounded-[10px] border border-border bg-background p-5"
          >
            <p className="text-sm font-bold text-muted">{label}</p>
            <strong className="mt-3 block text-3xl">
              {Number(value ?? 0).toLocaleString()}
            </strong>
          </article>
        ))}
      </div>
      <TrendChart data={data?.trend ?? []} />
      <div className="mt-5 flex items-center justify-between rounded-[10px] bg-foreground p-5 text-white">
        <div>
          <p className="font-black">成本熔断</p>
          <p className="mt-1 text-sm text-white/60">
            全局并发上限 {data?.runtimeLimits?.max_global_active_jobs ?? "—"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${data?.runtimeLimits?.enforcement_enabled ? "bg-success" : "bg-warning text-foreground"}`}
        >
          {data?.runtimeLimits?.enforcement_enabled ? "已启用" : "观察模式"}
        </span>
      </div>
    </>
  );
}

function TrendChart({
  data,
}: {
  data: Array<{ date: string; jobs: number; credits: number }>;
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
    <article className="mt-5 rounded-[10px] border border-border bg-background p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-black">近 14 天运营趋势</h2>
          <p className="mt-1 text-sm text-muted">按 UTC 自然日统计</p>
        </div>
        <div className="flex gap-4 text-xs font-bold text-muted">
          <span className="flex items-center gap-2">
            <i className="size-2.5 rounded-full bg-brand" />
            生成任务
          </span>
          <span className="flex items-center gap-2">
            <i className="size-2.5 rounded-full bg-warning" />
            消耗点数
          </span>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[680px] w-full"
          role="img"
          aria-label="近十四天生成任务和点数消耗趋势曲线"
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
                <title>{`${point.date}：${point.value} 个任务，${creditPoints[index]?.value ?? 0} 点`}</title>
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
}: {
  data: ListResponse | null;
  reload: () => Promise<void>;
}) {
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
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
      setMessage(result?.message ?? "生成失败");
      return;
    }
    setCodes(result.codes ?? []);
    setMessage(
      `已生成 ${result.codes?.length ?? 0} 个兑换码。明文仅本次显示，请立即导出。`,
    );
    await reload();
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
        <h2 className="text-xl font-black">生成兑换码</h2>
        <form onSubmit={create} className="mt-5 grid gap-4">
          <Field name="name" label="批次名称" required />
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="credits"
              label="每码点数"
              type="number"
              min="1"
              max="10000"
              defaultValue="20"
            />
            <Field
              name="count"
              label="数量"
              type="number"
              min="1"
              max="500"
              defaultValue="10"
            />
          </div>
          <Field name="expiresAt" label="有效期" type="date" />
          <Field name="channel" label="发放渠道" />
          <Field name="note" label="内部备注" />
          <button
            disabled={busy}
            className="focus-ring min-h-12 rounded-[8px] bg-brand px-5 font-black text-white disabled:opacity-50"
          >
            {busy ? "正在生成…" : "生成 CD-Key"}
          </button>
        </form>
        {message ? (
          <p role="status" className="mt-4 text-sm font-bold text-muted">
            {message}
          </p>
        ) : null}
        {codes.length ? (
          <button
            onClick={download}
            className="focus-ring mt-3 w-full rounded-[8px] border border-foreground px-4 py-3 font-black"
          >
            立即导出 CSV
          </button>
        ) : null}
      </div>
      <div>
        <h2 className="text-xl font-black">发放批次</h2>
        <BatchTable data={data} reload={reload} />
      </div>
    </div>
  );
}

function BatchTable({
  data,
  reload,
}: {
  data: ListResponse | null;
  reload: () => Promise<void>;
}) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th>批次</th>
            <th>点数/数量</th>
            <th>兑换</th>
            <th>渠道</th>
            <th>创建时间</th>
            <th>状态</th>
            <th className="text-right">操作</th>
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
                <td>{formatDate(item.created_at)}</td>
                <td>{item.disabled_at ? "已禁用" : "正常"}</td>
                <td className="py-2 text-right">
                  {item.disabled_at ? (
                    "—"
                  ) : (
                    <DisableBatchButton
                      batchId={String(item.id)}
                      reload={reload}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!data?.items.length ? <Empty /> : null}
    </div>
  );
}

function DisableBatchButton({
  batchId,
  reload,
}: {
  batchId: string;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function disable() {
    if (reason.trim().length < 3) {
      setMessage("请填写停用原因");
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
      setMessage(result?.message ?? "停用失败");
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
        className="focus-ring rounded-full border border-border px-3 py-1.5 text-xs font-black text-muted transition hover:border-foreground hover:text-foreground"
      >
        停用
      </button>
    );
  return (
    <div className="ml-auto flex max-w-[300px] flex-wrap justify-end gap-2">
      <input
        aria-label="停用原因"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="停用原因"
        className="focus-ring min-h-9 w-40 rounded-[7px] border border-border bg-background px-3 text-xs"
      />
      <button
        type="button"
        disabled={busy}
        onClick={disable}
        className="focus-ring rounded-full bg-red-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
      >
        {busy ? "处理中…" : "确认"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setEditing(false);
          setMessage("");
        }}
        className="focus-ring rounded-full border border-border px-3 py-1.5 text-xs font-black"
      >
        取消
      </button>
      {message ? (
        <span
          role="alert"
          className="w-full text-right text-xs font-bold text-red-600"
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}

function DataTable({ kind, data }: { kind: Tab; data: ListResponse | null }) {
  const columns =
    kind === "users"
      ? ["用户", "状态", "点数", "注册时间"]
      : kind === "jobs"
        ? ["任务", "用户", "状态", "主体", "进度", "创建时间"]
        : ["操作", "目标", "管理员", "时间"];
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">
          {kind === "users"
            ? "用户列表"
            : kind === "jobs"
              ? "生成任务"
              : "审计记录"}
        </h2>
        <span className="text-sm text-muted">共 {data?.total ?? 0} 条</span>
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
                      <b>{String(item.display_name ?? "未设置昵称")}</b>
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
                    <td>{formatDate(item.created_at)}</td>
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
                    <td>{formatDate(item.created_at)}</td>
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
                    <td>{formatDate(item.created_at)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.items.length ? <Empty /> : null}
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
        className="mt-2 min-h-11 w-full rounded-[7px] border border-border bg-background px-3 font-normal"
      />
    </label>
  );
}
function Loading() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="skeleton-block h-28 rounded-[10px]" />
      ))}
    </div>
  );
}
function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => Promise<void>;
}) {
  return (
    <div className="py-20 text-center">
      <p className="font-black text-danger">{message}</p>
      <button
        onClick={() => void retry()}
        className="mt-4 font-black underline"
      >
        重新加载
      </button>
    </div>
  );
}
function Empty() {
  return <p className="py-16 text-center text-sm text-muted">暂无数据</p>;
}
function formatDate(value: unknown) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(String(value)))
    : "—";
}
