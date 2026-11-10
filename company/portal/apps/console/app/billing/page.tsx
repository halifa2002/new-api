'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usageApi, ApiError } from '@portal/api-client';
import type { UsageLog } from '@portal/types';
import { ConsoleSidebar, ConsoleTopbar } from '@/components/console-chrome';
import { ensureMoneySettings, quotaToAmount, formatNumber, formatTime } from '@/lib/format';

/**
 * 消费记录 —— md 4.2 E
 *
 * 文档要求：消费时间、模型名称、Token 用量、输入 Token、输出 Token、
 * 消费金额、请求状态、关联请求标识。
 *
 * 请求状态为什么不在一张表里混排：官方把失败调用记成 type=5 的独立日志，
 * 和消费日志（type=2）不是同一批数据，分页也各算各的。混在一张表会打乱分页，
 * 所以做成「成功 / 失败」两个页签，两边都带状态列与请求编号。
 */
type Tab = 'success' | 'failed';

export default function BillingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('success');
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [total, setTotal] = useState(0);
  const [otherTotal, setOtherTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const logType = tab === 'success' ? 2 : 5;
    const otherType = tab === 'success' ? 5 : 2;
    try {
      await ensureMoneySettings();
      const [data, other] = await Promise.all([
        usageApi.listUsageLogs({ page, page_size: pageSize, type: logType }),
        usageApi
          .listUsageLogs({ page: 1, page_size: 1, type: otherType })
          .catch(() => ({ total: 0 })),
      ]);
      setLogs(data.items ?? []);
      setTotal(data.total ?? 0);
      setOtherTotal(other.total ?? 0);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, tab, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // 换页签回第 1 页，否则会出现「第 3 页但只有 1 页数据」
  useEffect(() => {
    setPage(1);
  }, [tab]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const successCount = tab === 'success' ? total : otherTotal;
  const failedCount = tab === 'success' ? otherTotal : total;

  return (
    <div className="min-h-screen md:pl-56">
      <ConsoleSidebar />
      <ConsoleTopbar title="消费记录" />

      <main className="px-6 py-6">
        {error && (
          <div className="mb-5 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-xs text-danger">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-ink">调用明细</h2>
              <div className="flex gap-1 rounded-md border border-line p-0.5">
                <button
                  type="button"
                  onClick={() => setTab('success')}
                  className={`rounded px-2.5 py-0.5 text-xs ${
                    tab === 'success' ? 'bg-brand text-white' : 'text-ink-muted'
                  }`}
                >
                  成功 {formatNumber(successCount)}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('failed')}
                  className={`rounded px-2.5 py-0.5 text-xs ${
                    tab === 'failed' ? 'bg-brand text-white' : 'text-ink-muted'
                  }`}
                >
                  失败 {formatNumber(failedCount)}
                </button>
              </div>
            </div>
            <span className="text-xs text-ink-muted">
              {tab === 'success' ? '扣费记录' : '未扣费，悬停状态可看原因'} · 共 {formatNumber(total)} 条
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-5 py-2.5 font-normal">时间</th>
                <th className="px-5 py-2.5 font-normal">状态</th>
                <th className="px-5 py-2.5 font-normal">模型</th>
                <th className="px-5 py-2.5 font-normal">密钥</th>
                <th className="px-5 py-2.5 font-normal">输入 / 输出</th>
                <th className="px-5 py-2.5 font-normal">费用</th>
                <th className="px-5 py-2.5 font-normal">请求编号</th>
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
                    {tab === 'success' ? '还没有消费记录' : '没有失败记录，说明这段时间的调用都成功了'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const failed = tab === 'failed';
                  return (
                    <tr key={log.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 text-xs text-ink-muted">
                        {formatTime(log.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          title={failed ? log.content : undefined}
                          className={`rounded px-1.5 py-0.5 text-[11px] ${
                            failed ? 'bg-red-50 text-danger' : 'bg-green-50 text-ok'
                          }`}
                        >
                          {failed ? '失败' : '成功'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink">{log.model_name || '—'}</td>
                      <td className="px-5 py-3 text-xs text-ink-muted">{log.token_name || '—'}</td>
                      <td className="px-5 py-3 tabular-nums text-xs text-ink-muted">
                        {failed
                          ? '—'
                          : `${formatNumber(log.prompt_tokens)} / ${formatNumber(log.completion_tokens)}`}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-ink">
                        {failed ? '—' : quotaToAmount(log.quota)}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-ink-muted">
                        {log.request_id || '—'}
                      </td>
                    </tr>
                  );
                })
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
      </main>
    </div>
  );
}
