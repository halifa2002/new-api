'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usageApi, ApiError } from '@portal/api-client';
import type { UsageLog, UsageStat } from '@portal/types';
import { ConsoleSidebar, ConsoleTopbar } from '@/components/console-chrome';
import { ensureMoneySettings, formatNumber, formatTime, moneyUnit, quotaToAmount } from '@/lib/format';

/**
 * 用量统计 —— md 4.2 D
 *
 * 覆盖要求：每日调用量 / 每日 Token / 每日消费 / 模型维度 / API Key 维度 / 调用明细。
 *
 * 关于分组统计的说明：官方后端没有"按模型/按密钥汇总"的接口（341 条路由里只有
 * /api/log/self 列表与 /api/log/self/stat 总额）。按 md 第六章"优先沿用官方接口、
 * 不轻易改后端"，这里改为从列表接口拉一批记录在前端聚合。
 * 因此分组结果的准确性受 STAT_LIMIT 限制，界面上要如实标注，不能假装是全量。
 */

const STAT_LIMIT = 500;

type RangeKey = 'today' | '7d' | '30d' | 'all';
type GroupKey = 'model' | 'token';

const RANGE_LABEL: Record<RangeKey, string> = {
  today: '今天',
  '7d': '近 7 天',
  '30d': '近 30 天',
  all: '全部',
};

/** 把范围算成秒级时间戳；all 不设边界 */
function rangeToTimestamps(range: RangeKey): {
  start_timestamp?: number;
  end_timestamp?: number;
} {
  if (range === 'all') return {};
  const now = Math.floor(Date.now() / 1000);
  if (range === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return { start_timestamp: Math.floor(d.getTime() / 1000), end_timestamp: now };
  }
  const days = range === '7d' ? 7 : 30;
  return { start_timestamp: now - days * 86400, end_timestamp: now };
}

interface AggRow {
  name: string;
  count: number;
  promptTokens: number;
  completionTokens: number;
  quota: number;
}

function aggregate(logs: UsageLog[], by: GroupKey): AggRow[] {
  const map = new Map<string, AggRow>();
  for (const log of logs) {
    const name =
      by === 'model'
        ? log.model_name || '未知模型'
        : log.token_name || '未知密钥';
    const row =
      map.get(name) ??
      ({ name, count: 0, promptTokens: 0, completionTokens: 0, quota: 0 } as AggRow);
    row.count += 1;
    row.promptTokens += Number(log.prompt_tokens ?? 0);
    row.completionTokens += Number(log.completion_tokens ?? 0);
    row.quota += Number(log.quota ?? 0);
    map.set(name, row);
  }
  return [...map.values()].sort((a, b) => b.quota - a.quota);
}

export default function UsagePage() {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>('7d');
  const [groupBy, setGroupBy] = useState<GroupKey>('model');
  const [stat, setStat] = useState<UsageStat | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [statLogs, setStatLogs] = useState<UsageLog[]>([]);
  const [statTruncated, setStatTruncated] = useState(false);
  const [total, setTotal] = useState(0);
  /** 区间内失败请求数（日志 type=5），用来算成功率 */
  const [failedCalls, setFailedCalls] = useState(0);
  const [trendMetric, setTrendMetric] = useState<'quota' | 'calls' | 'tokens'>('quota');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const ts = rangeToTimestamps(range);
    try {
      await ensureMoneySettings();
      const [s, l, batch, failed] = await Promise.all([
        usageApi.getUsageStat({ type: 2, ...ts }).catch(() => null),
        usageApi.listUsageLogs({ page, page_size: pageSize, type: 2, ...ts }),
        usageApi
          .listUsageLogs({ page: 1, page_size: STAT_LIMIT, type: 2, ...ts })
          .catch(() => ({ items: [] as UsageLog[], total: 0 })),
        // 失败调用记在 type=5 的日志里，只要总数，page_size 取 1 最省
        usageApi
          .listUsageLogs({ page: 1, page_size: 1, type: 5, ...ts })
          .catch(() => ({ total: 0 })),
      ]);
      setStat(s);
      setLogs(l.items ?? []);
      setTotal(l.total ?? 0);
      setFailedCalls(failed.total ?? 0);
      const batchItems = batch.items ?? [];
      setStatLogs(batchItems);
      setStatTruncated((batch.total ?? 0) > batchItems.length);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, range, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // 换筛选条件时回到第 1 页，否则会出现"第 3 页但只有 1 页数据"的空表
  useEffect(() => {
    setPage(1);
  }, [range]);

  const agg = useMemo(() => aggregate(statLogs, groupBy), [statLogs, groupBy]);
  const aggMax = agg.length > 0 ? agg[0].quota : 0;
  const totalCalls = statLogs.length;
  const totalTokens = statLogs.reduce(
    (acc, log) => acc + Number(log.prompt_tokens ?? 0) + Number(log.completion_tokens ?? 0),
    0,
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /**
   * 每日趋势：把明细分按本地日期归组。
   * 官方没有按天聚合的接口，明细又最多取 500 条，所以这一块的口径写死在标题上，
   * 不让它看起来像全量统计。
   */
  const daily = useMemo(() => {
    const map = new Map<
      number,
      { ts: number; label: string; calls: number; tokens: number; quota: number }
    >();
    for (const log of statLogs) {
      const day = new Date(log.created_at * 1000);
      day.setHours(0, 0, 0, 0);
      const ts = day.getTime();
      const row =
        map.get(ts) ??
        {
          ts,
          label: `${day.getMonth() + 1}/${day.getDate()}`,
          calls: 0,
          tokens: 0,
          quota: 0,
        };
      row.calls += 1;
      row.tokens += Number(log.prompt_tokens ?? 0) + Number(log.completion_tokens ?? 0);
      row.quota += Math.abs(Number(log.quota ?? 0));
      map.set(ts, row);
    }
    return [...map.values()].sort((a, b) => a.ts - b.ts);
  }, [statLogs]);

  const dailyMax = daily.reduce((max, row) => Math.max(max, row[trendMetric]), 0);
  /** 成功率 = 成功（type=2）÷（成功 + 失败（type=5）），两个数都来自后端分页总数 */
  const successRate =
    total + failedCalls > 0 ? (total / (total + failedCalls)) * 100 : null;

  return (
    <div className="min-h-screen md:pl-56">
      <ConsoleSidebar />
      <ConsoleTopbar title="用量统计" />

      <main className="px-6 py-6">
        {error && (
          <div className="mb-5 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-xs text-danger">
            {error}
          </div>
        )}

        {/* 时间范围 */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">时间范围</span>
          <div className="flex gap-1 rounded-md border border-line bg-surface p-1">
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={`rounded px-3 py-1 text-xs transition-colors ${
                  range === key
                    ? 'bg-brand text-white'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {RANGE_LABEL[key]}
              </button>
            ))}
          </div>
        </div>

        {/* 汇总 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="区间消费" value={stat ? quotaToAmount(stat.quota) : '—'} />
          <Metric label="调用次数" value={statTruncated ? `${formatNumber(totalCalls)}+` : formatNumber(totalCalls)} />
          <Metric label="Token 用量" value={statTruncated ? `${formatNumber(totalTokens)}+` : formatNumber(totalTokens)} />
          <Metric
            label="请求成功率"
            value={successRate === null ? '—' : `${successRate.toFixed(1)}%`}
            hint={`成功 ${formatNumber(total)} 次 · 失败 ${formatNumber(failedCalls)} 次`}
          />
        </div>

        {/* 每日趋势 —— 文档 4.2 D 要求「每日调用量 / 每日 Token / 每日消费」 */}
        <div className="mt-6 rounded-card border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div>
              <h2 className="text-sm font-medium text-ink">每日趋势</h2>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                按天汇总，来自最近 {formatNumber(statLogs.length)} 条调用记录
                {statTruncated && '（超出部分未计入）'}
              </p>
            </div>
            <div className="flex gap-1 rounded-md border border-line p-0.5">
              {(
                [
                  ['quota', '消费'],
                  ['calls', '调用次数'],
                  ['tokens', 'Token'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTrendMetric(key)}
                  className={`rounded px-2.5 py-0.5 text-xs ${
                    trendMetric === key ? 'bg-brand text-white' : 'text-ink-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-5">
            {daily.length === 0 ? (
              <div className="py-10 text-center text-xs text-ink-muted">这段时间没有调用记录</div>
            ) : (
              <div className="flex h-40 items-stretch gap-1.5">
                {daily.map((row) => {
                  const value = row[trendMetric];
                  const height = dailyMax > 0 ? Math.max(value > 0 ? 4 : 0, (value / dailyMax) * 100) : 0;
                  const text =
                    trendMetric === 'quota'
                      ? `${quotaToAmount(row.quota)} ${moneyUnit()}`
                      : trendMetric === 'calls'
                        ? `${row.calls} 次`
                        : `${formatNumber(row.tokens)} Token`;
                  return (
                    <div
                      key={row.ts}
                      className="flex min-w-0 flex-1 flex-col items-center gap-2"
                      title={`${row.label}：${text}`}
                    >
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={`w-full rounded-t ${value > 0 ? 'bg-brand/85' : 'bg-line'}`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="truncate text-[11px] text-ink-muted">{row.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 分组统计 */}
        <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-ink">分布统计</h2>
              <div className="flex gap-1 rounded-md border border-line p-0.5">
                <button
                  type="button"
                  onClick={() => setGroupBy('model')}
                  className={`rounded px-2.5 py-0.5 text-xs ${
                    groupBy === 'model' ? 'bg-brand text-white' : 'text-ink-muted'
                  }`}
                >
                  按模型
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy('token')}
                  className={`rounded px-2.5 py-0.5 text-xs ${
                    groupBy === 'token' ? 'bg-brand text-white' : 'text-ink-muted'
                  }`}
                >
                  按密钥
                </button>
              </div>
            </div>
            <span className="text-[11px] text-ink-muted">
              基于最近 {formatNumber(statLogs.length)} 条记录汇总
              {statTruncated && '（超出部分未计入）'}
            </span>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-xs text-ink-muted">加载中…</div>
          ) : agg.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-ink-muted">
              这段时间没有调用记录
            </div>
          ) : (
            <div className="divide-y divide-line">
              {agg.map((row) => (
                <div key={row.name} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="truncate text-sm text-ink">{row.name}</span>
                    <span className="shrink-0 tabular-nums text-xs text-ink-muted">
                      {row.count} 次 · {quotaToAmount(row.quota)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${aggMax > 0 ? Math.max(2, (row.quota / aggMax) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    输入 {formatNumber(row.promptTokens)} · 输出{' '}
                    {formatNumber(row.completionTokens)} Token
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 调用明细 */}
        <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-sm font-medium text-ink">调用明细</h2>
            <span className="text-xs text-ink-muted">共 {total} 条</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-5 py-2.5 font-normal">时间</th>
                <th className="px-5 py-2.5 font-normal">模型</th>
                <th className="px-5 py-2.5 font-normal">密钥</th>
                <th className="px-5 py-2.5 font-normal">输入</th>
                <th className="px-5 py-2.5 font-normal">输出</th>
                <th className="px-5 py-2.5 font-normal">费用</th>
                <th className="px-5 py-2.5 font-normal">耗时</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-xs text-ink-muted">
                    加载中…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-xs text-ink-muted">
                    这段时间没有调用记录
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-xs text-ink-muted">
                      {formatTime(log.created_at)}
                    </td>
                    <td className="px-5 py-3 text-ink">{log.model_name || '—'}</td>
                    <td className="px-5 py-3 text-xs text-ink-muted">
                      {log.token_name || '—'}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-ink-muted">
                      {formatNumber(log.prompt_tokens)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-ink-muted">
                      {formatNumber(log.completion_tokens)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-ink-muted">
                      {quotaToAmount(log.quota)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-ink-muted">
                      {log.use_time ? `${log.use_time}s` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-ink-muted">
              <span>
                第 {page} / {totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-line px-3 py-1 disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border border-line px-3 py-1 disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
        {/* 统计口径 —— md 4.2 D 要求写清时间范围、时区、口径与分页规则 */}
        <section className="mt-6 rounded-card border border-line bg-surface px-5 py-4 text-[11px] leading-relaxed text-ink-muted">
          <h2 className="mb-2 text-xs font-medium text-ink">统计口径</h2>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              时间按本机时区切分：「今天」从本机 0 点起算；「近 7 / 30 天」是从现在往前推的滚动窗口，不是自然周 / 自然月。
            </li>
            <li>
              金额 = quota ÷ 配额单位 × 汇率，两个参数取自 /api/status；后台改了换算参数这里跟着变，历史记录不回溯。
            </li>
            <li>成功率 = 成功调用 ÷（成功 + 失败）；失败调用记在错误日志里，不扣费。</li>
            <li>明细每页 20 条；趋势与分布基于最近 500 条记录，超出部分未计入，趋势图只用来看形状。</li>
          </ul>
          <p className="mt-2">完整定义见仓库 docs/METRICS.md，改口径必须同步那份文件。</p>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-muted">{hint}</div>}
    </div>
  );
}
