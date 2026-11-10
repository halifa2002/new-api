'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, tokensApi, usageApi, ApiError } from '@portal/api-client';
import type { SelfUser, UsageLog } from '@portal/types';
import { ConsoleSidebar, ConsoleTopbar } from '@/components/console-chrome';
import {
  ensureMoneySettings,
  formatNumber,
  formatTime,
  groupLabel,
  moneyUnit,
  quotaToAmount,
} from '@/lib/format';
import { docsUrl } from '@/lib/brand';

/**
 * 控制台概览 —— md 4.2 A
 *
 * 文档要求的 9 项：账户余额、今日消费、本月消费、总调用次数、Token 使用量、
 * API Key 数量、最近调用记录、常用模型、消费趋势图。
 *
 * 数据口径（md 亦要求"数据真实来自后端，不允许静态模拟"）：
 * · 余额、今日消费、本月消费、每日趋势 —— 全部由后端按时间区间求和（/api/log/self/stat），
 *   前端只把 quota 换算成金额，不自己相减或累加。
 * · Token 用量与常用模型 —— 官方没有按模型/按天的聚合接口（341 条路由里只有
 *   /api/log/self 列表与 /api/log/self/stat 总额），只能按近 7 天调用明细汇总，
 *   因此卡片与列表都标注"近 7 天"，并在页脚写明口径，不冒充全量。
 */

const WEEK_DAYS = 7;
/** 拉取明细的上限，超出时页面标注"仅统计前 N 条" */
const LOG_LIMIT = 500;
const GUIDE_HIDDEN_KEY = 'console.overview.guide.hidden';

interface WeekDay {
  label: string;
  start: number;
  end: number;
}

/** 最近 7 天，含今天；每段是 [当天 00:00, 次日 00:00) */
function buildWeek(): WeekDay[] {
  const days: WeekDay[] = [];
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  for (let offset = WEEK_DAYS - 1; offset >= 0; offset -= 1) {
    const dayStart = new Date(midnight);
    dayStart.setDate(dayStart.getDate() - offset);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    days.push({
      label: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`,
      start: Math.floor(dayStart.getTime() / 1000),
      end: Math.floor(dayEnd.getTime() / 1000) - 1,
    });
  }

  return days;
}

function monthStartTs(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SelfUser | null>(null);
  const [todayQuota, setTodayQuota] = useState<number | null>(null);
  const [monthQuota, setMonthQuota] = useState<number | null>(null);
  const [trend, setTrend] = useState<{ label: string; quota: number }[]>([]);
  const [keyCount, setKeyCount] = useState<number | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guideHidden, setGuideHidden] = useState(false);

  useEffect(() => {
    setGuideHidden(window.localStorage.getItem(GUIDE_HIDDEN_KEY) === '1');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const week = buildWeek();
    const todayStart = week[WEEK_DAYS - 1].start;
    const nowTs = Math.floor(Date.now() / 1000);

    try {
      // 金额要靠后端汇率换算，先把这个参数拿到再渲染
      await ensureMoneySettings();

      const [me, todayStat, monthStat, weekStats, keys, recent] = await Promise.all([
        authApi.getSelf(),
        usageApi
          .getUsageStat({ start_timestamp: todayStart, end_timestamp: nowTs })
          .catch(() => null),
        usageApi
          .getUsageStat({ start_timestamp: monthStartTs(), end_timestamp: nowTs })
          .catch(() => null),
        Promise.all(
          week.map((day) =>
            usageApi
              .getUsageStat({
                start_timestamp: day.start,
                end_timestamp: Math.min(day.end, nowTs),
              })
              .catch(() => null),
          ),
        ),
        tokensApi.listTokens({ page: 1, page_size: 1 }).catch(() => null),
        usageApi
          .listUsageLogs({
            page: 1,
            page_size: LOG_LIMIT,
            type: 2,
            start_timestamp: week[0].start,
            end_timestamp: nowTs,
          })
          .catch(() => null),
      ]);

      setUser(me);
      setTodayQuota(todayStat ? Number(todayStat.quota ?? 0) : null);
      setMonthQuota(monthStat ? Number(monthStat.quota ?? 0) : null);
      setTrend(week.map((day, index) => ({
        label: day.label,
        quota: Number(weekStats[index]?.quota ?? 0),
      })));
      setKeyCount(keys ? keys.total : null);
      setLogs(recent?.items ?? []);
      setLogTotal(recent?.total ?? 0);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Token 用量与模型分布只能按明细汇总，口径固定为近 7 天 */
  const aggregate = useMemo(() => {
    let tokens = 0;
    const byModel = new Map<string, { name: string; calls: number; quota: number }>();

    for (const log of logs) {
      tokens += Number(log.prompt_tokens ?? 0) + Number(log.completion_tokens ?? 0);
      const name = log.model_name || '未记录模型';
      const row = byModel.get(name) ?? { name, calls: 0, quota: 0 };
      row.calls += 1;
      row.quota += Math.abs(Number(log.quota ?? 0));
      byModel.set(name, row);
    }

    const models = [...byModel.values()].sort((a, b) => b.calls - a.calls).slice(0, 5);
    return { tokens, models };
  }, [logs]);

  const weekTotal = trend.reduce((sum, item) => sum + item.quota, 0);
  const trendMax = trend.reduce((max, item) => Math.max(max, item.quota), 0);
  const modelMax = aggregate.models.reduce((max, item) => Math.max(max, item.calls), 0);
  const logTruncated = logTotal > logs.length;

  const steps = [
    {
      title: '创建 API 密钥',
      hint: '密钥是调用接口的唯一凭据，创建后只完整显示一次',
      action: '去创建',
      href: '/keys',
      done: (keyCount ?? 0) > 0,
      external: false,
    },
    {
      title: '添加额度',
      hint: '充值后余额可用于调用，额度不足时请求会被拒绝',
      action: '去充值',
      href: '/wallet',
      done: (user?.quota ?? 0) > 0 || (user?.used_quota ?? 0) > 0,
      external: false,
    },
    {
      title: '发送第一个请求',
      hint: '按文档复制一条 chat/completions 示例，替换成自己的密钥',
      action: '看示例',
      href: docsUrl,
      done: (user?.request_count ?? 0) > 0,
      external: true,
    },
  ];
  const doneSteps = steps.filter((step) => step.done).length;
  const showGuide = !guideHidden && doneSteps < steps.length;

  const cards: { label: string; value: string; unit?: string; foot: string }[] = [
    {
      label: '账户余额',
      value: quotaToAmount(user?.quota),
      unit: moneyUnit(),
      foot: '充值后可用于调用',
    },
    {
      label: '今日消费',
      value: todayQuota === null ? '—' : quotaToAmount(todayQuota),
      unit: moneyUnit(),
      foot: '今日 00:00 起',
    },
    {
      label: '本月消费',
      value: monthQuota === null ? '—' : quotaToAmount(monthQuota),
      unit: moneyUnit(),
      foot: '本月 1 日起',
    },
    {
      label: '总调用次数',
      value: formatNumber(user?.request_count),
      unit: '次',
      foot: '开户至今累计',
    },
    {
      label: 'Token 使用量',
      value: formatNumber(aggregate.tokens),
      unit: 'Token',
      foot: logTruncated ? `近 7 天，前 ${formatNumber(logs.length)} 条` : '近 7 天汇总',
    },
    {
      label: 'API 密钥',
      value: keyCount === null ? '—' : formatNumber(keyCount),
      unit: '个',
      foot: '当前账号下的密钥数',
    },
  ];

  return (
    <div className="min-h-screen md:pl-56">
      <ConsoleSidebar />
      <ConsoleTopbar title="概览" balance={user ? quotaToAmount(user.quota) : undefined} />

      <main className="px-6 py-6">
        {error && (
          <div className="mb-5 flex items-center justify-between rounded-card border border-red-200 bg-red-50 px-4 py-3 text-xs text-danger">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded border border-red-300 px-2 py-0.5"
            >
              重试
            </button>
          </div>
        )}

        {loading ? (
          <div className="rounded-card border border-line bg-surface px-4 py-16 text-center text-xs text-ink-muted">
            加载中…
          </div>
        ) : (
          <>
            {showGuide && (
              <section className="mb-4 rounded-panel border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-medium text-ink">开始使用</h2>
                    <p className="mt-1 text-xs text-ink-muted">
                      三步把第一条请求发出去，已完成 {doneSteps}/{steps.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/keys"
                      className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
                    >
                      创建 API 密钥
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem(GUIDE_HIDDEN_KEY, '1');
                        setGuideHidden(true);
                      }}
                      className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
                    >
                      隐藏
                    </button>
                  </div>
                </div>

                <ol className="mt-4 grid gap-3 md:grid-cols-3">
                  {steps.map((step, index) => {
                    const body = (
                      <>
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                            step.done
                              ? 'bg-brand text-white'
                              : 'border border-line text-ink-muted'
                          }`}
                        >
                          {step.done ? '✓' : index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span
                              className={`text-sm ${step.done ? 'text-ink-muted line-through' : 'text-ink'}`}
                            >
                              {step.title}
                            </span>
                            <span className="text-[11px] text-brand">
                              {step.done ? '已完成' : step.action}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                            {step.hint}
                          </span>
                        </span>
                        <span className="shrink-0 text-ink-muted">→</span>
                      </>
                    );
                    const className =
                      'flex items-start gap-3 rounded-card border border-line bg-surface-subtle px-4 py-3 transition-colors hover:border-brand/40';

                    return (
                      <li key={step.title}>
                        {step.external ? (
                          <a
                            href={step.href}
                            target="_blank"
                            rel="noreferrer"
                            className={className}
                          >
                            {body}
                          </a>
                        ) : (
                          <Link href={step.href} className={className}>
                            {body}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((item) => (
                <div
                  key={item.label}
                  className="rounded-card border border-line bg-surface p-5"
                >
                  <div className="text-xs text-ink-muted">{item.label}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold tabular-nums text-ink">
                      {item.value}
                    </span>
                    {item.unit && (
                      <span className="text-xs text-ink-muted">{item.unit}</span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">{item.foot}</div>
                </div>
              ))}
            </div>

            {user && (
              <div className="mt-3 text-[11px] text-ink-muted">
                当前账号 <span className="text-ink">{user.username}</span>
                {user.display_name && user.display_name !== user.username
                  ? `（${user.display_name}）`
                  : ''}
                <span className="mx-3 text-line">|</span>
                计费档位 <span className="text-ink">{groupLabel(user.group)}</span>
                <span className="mx-3 text-line">|</span>
                角色{' '}
                <span className="text-ink">
                  {user.role >= 100 ? '超级管理员' : user.role >= 10 ? '管理员' : '普通用户'}
                </span>
              </div>
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <section className="rounded-card border border-line bg-surface lg:col-span-2">
                <div className="flex items-center justify-between border-b border-line px-5 py-3">
                  <div>
                    <h2 className="text-sm font-medium text-ink">消费趋势</h2>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      近 7 天合计 {quotaToAmount(weekTotal)} {moneyUnit()}，按天后端求和
                    </p>
                  </div>
                  <Link href="/billing" className="text-xs text-brand hover:underline">
                    查看记录
                  </Link>
                </div>

                <div className="px-5 py-5">
                  {trendMax === 0 ? (
                    <div className="py-10 text-center text-xs text-ink-muted">
                      近 7 天还没有消费记录
                    </div>
                  ) : (
                    <div className="flex h-40 items-stretch gap-2">
                      {trend.map((point) => {
                        const height =
                          point.quota > 0
                            ? Math.max(4, (point.quota / trendMax) * 100)
                            : 0;
                        return (
                          <div
                            key={point.label}
                            className="flex flex-1 flex-col items-center gap-2"
                            title={`${point.label}：${quotaToAmount(point.quota)} ${moneyUnit()}`}
                          >
                            {/* 柱子的百分比高度以这块剩余空间为准，避免把日期标签挤出卡片 */}
                            <div className="flex w-full flex-1 items-end">
                              <div
                                className={`w-full rounded-t ${point.quota > 0 ? 'bg-brand/85' : 'bg-line'}`}
                                style={{ height: `${height}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-ink-muted">{point.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-card border border-line bg-surface">
                <div className="flex items-center justify-between border-b border-line px-5 py-3">
                  <div>
                    <h2 className="text-sm font-medium text-ink">常用模型</h2>
                    <p className="mt-0.5 text-[11px] text-ink-muted">近 7 天调用次数</p>
                  </div>
                  <Link href="/usage" className="text-xs text-brand hover:underline">
                    用量统计
                  </Link>
                </div>

                <div className="px-5 py-4">
                  {aggregate.models.length === 0 ? (
                    <div className="py-10 text-center text-xs text-ink-muted">
                      近 7 天还没有调用
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {aggregate.models.map((model) => (
                        <div key={model.name}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-sm text-ink">{model.name}</span>
                            <span className="shrink-0 tabular-nums text-xs text-ink-muted">
                              {formatNumber(model.calls)} 次 · {quotaToAmount(model.quota)} {moneyUnit()}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{
                                width: `${Math.max(2, (model.calls / modelMax) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <section className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <div>
                  <h2 className="text-sm font-medium text-ink">最近调用记录</h2>
                  <p className="mt-0.5 text-[11px] text-ink-muted">最新 5 条消费调用</p>
                </div>
                <Link href="/usage" className="text-xs text-brand hover:underline">
                  全部记录
                </Link>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    <th className="px-5 py-2.5 font-normal">时间</th>
                    <th className="px-5 py-2.5 font-normal">模型</th>
                    <th className="px-5 py-2.5 font-normal">密钥</th>
                    <th className="px-5 py-2.5 font-normal">Token</th>
                    <th className="px-5 py-2.5 font-normal">费用</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-xs text-ink-muted">
                        还没有调用记录，按上方「开始使用」发一条试试
                      </td>
                    </tr>
                  ) : (
                    logs.slice(0, 5).map((log) => (
                      <tr key={log.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3 text-ink-muted">{formatTime(log.created_at)}</td>
                        <td className="px-5 py-3 text-ink">{log.model_name || '—'}</td>
                        <td className="px-5 py-3 text-ink-muted">{log.token_name || '—'}</td>
                        <td className="px-5 py-3 tabular-nums text-ink-muted">
                          {formatNumber(
                            Number(log.prompt_tokens ?? 0) + Number(log.completion_tokens ?? 0),
                          )}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-ink-muted">
                          {quotaToAmount(Math.abs(Number(log.quota ?? 0)))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
              数据口径：余额与调用次数取自账号信息；今日/本月消费与消费趋势由后端按时间区间求和
              （金额按后端配置的 quota 系数与汇率换算）；Token 使用量与常用模型按近 7
              天调用明细汇总{logTruncated ? `（仅前 ${formatNumber(logs.length)} 条）` : ''}，
              官方暂未提供按模型聚合的统计接口。
            </p>
          </>
        )}
      </main>
    </div>
  );
}
