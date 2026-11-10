'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { modelsApi, systemApi, ApiError } from '@portal/api-client';
import {
  computePrice,
  summarizePrice,
  type Conversion,
  type ModelPrice,
  type PricingRow,
} from '@portal/pricing';
import { CATEGORY_ORDER, findCatalogEntry } from '@portal/types';
import { ConsoleSidebar, ConsoleTopbar } from '@/components/console-chrome';

/**
 * 模型广场（控制台内）—— md 4.2 B
 *
 * 文档要求：全部模型、模型分类、模型搜索、模型能力标签、输入/输出价格、
 * 模型详情、API 调用代码示例。
 * 模型是否存在以 /api/user/models 为准；分类与能力标签来自共享模型目录
 * （@portal/types 的 MODEL_CATALOG），目录里没有的模型归入「其他」，
 * 不编造标签。
 */
export default function ConsoleModelsPage() {
  const router = useRouter();
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>('全部');
  /** 模型名 → 解析后的价格（分时模型含多个档位） */
  const [prices, setPrices] = useState<Map<string, ModelPrice>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, status, pricing] = await Promise.all([
        modelsApi.listUserModels(),
        systemApi.getStatus().catch(() => null),
        modelsApi.listPricing().catch(() => null),
      ]);
      setModels(Array.isArray(data) ? data : []);

      // 价格：换算参数取自 /api/status，单价取自 /api/pricing 的计费表达式
      const conv: Conversion = {
        quotaPerUsd: Number(status?.quota_per_unit) || 500_000,
        usdToCny: Number(status?.usd_exchange_rate) || 7.3,
      };
      const raw = pricing as unknown;
      const pricingRows: PricingRow[] = Array.isArray(raw)
        ? (raw as PricingRow[])
        : ((raw as { data?: PricingRow[] })?.data ??
          (raw as { models?: PricingRow[] })?.models ??
          []);
      const priceMap = new Map<string, ModelPrice>();
      for (const row of pricingRows) {
        priceMap.set(row.model_name, computePrice(row, conv));
      }
      setPrices(priceMap);
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

  /** 模型名 → 目录条目；目录里没有就是 undefined（新接入但还没登记资料） */
  const rows = useMemo(
    () => models.map((name) => ({ name, entry: findCatalogEntry(name) })),
    [models],
  );

  /** 只显示真的有模型的分类，不摆一排空标签 */
  const categories = useMemo(() => {
    const present = new Set(rows.map((row) => row.entry?.category ?? '其他'));
    return [
      '全部',
      ...CATEGORY_ORDER.filter((item) => present.has(item)),
      ...(present.has('其他') ? ['其他'] : []),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (category !== '全部' && (row.entry?.category ?? '其他') !== category) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        (row.entry?.displayName ?? '').toLowerCase().includes(q) ||
        (row.entry?.vendorName ?? '').toLowerCase().includes(q) ||
        (row.entry?.capabilities ?? []).some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [rows, keyword, category]);

  return (
    <div className="min-h-screen md:pl-56">
      <ConsoleSidebar />
      <ConsoleTopbar title="模型广场" />

      <main className="px-6 py-6">
        {error && (
          <div className="mb-5 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-xs text-danger">
            {error}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索模型名称、厂商、能力"
            className="w-72 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <span className="text-xs text-ink-muted">
            可用模型 {loading ? '…' : filtered.length} 个
          </span>
        </div>

        {categories.length > 2 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-muted">模型分类</span>
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  category === item
                    ? 'border-brand bg-brand text-white'
                    : 'border-line text-ink-muted hover:text-ink'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="rounded-card border border-line bg-surface px-5 py-16 text-center text-xs text-ink-muted">
            加载中…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-card border border-line bg-surface px-5 py-16 text-center text-xs text-ink-muted">
            {models.length === 0
              ? '当前分组下还没有可用模型，请联系管理员在后台配置渠道'
              : '没有匹配的模型'}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => {
              const price = summarizePrice(prices.get(row.name) ?? { mode: 'unknown' });
              return (
              <Link
                key={row.name}
                href={`/models/${encodeURIComponent(row.name)}`}
                className="group rounded-card border border-line bg-surface p-4 transition-colors hover:border-brand/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {row.entry?.displayName ?? row.name}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">
                      {row.name}
                    </div>
                  </div>
                  <span className="shrink-0 rounded bg-brand-soft px-2 py-0.5 text-[11px] text-brand">
                    {row.entry?.category ?? '其他'}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                  <span>{row.entry?.vendorName ?? '未登记厂商'}</span>
                  {row.entry?.contextWindow && (
                    <>
                      <span className="text-line">·</span>
                      <span>上下文 {row.entry.contextWindow}</span>
                    </>
                  )}
                </div>

                <div className="mt-2 flex min-h-[22px] flex-wrap gap-1">
                  {(row.entry?.capabilities ?? []).slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold tabular-nums text-ink">
                    {price.text}
                  </span>
                  {price.hint && (
                    <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] text-ink-muted">
                      {price.hint}
                    </span>
                  )}
                </div>

                <div className="mt-2 text-[11px] text-brand opacity-0 transition-opacity group-hover:opacity-100">
                  查看价格与调用示例 →
                </div>
              </Link>
              );
            })}
          </div>
        )}

        <p className="mt-6 rounded-card border border-line bg-surface-subtle px-5 py-4 text-xs leading-relaxed text-ink-muted">
          这里列出的是你所在分组实际可调用的模型（来自
          <code className="mx-1 font-mono">/api/user/models</code>）。
          价格与倍率需要在后台「模型」中配置，前端不写死。
        </p>
      </main>
    </div>
  );
}
