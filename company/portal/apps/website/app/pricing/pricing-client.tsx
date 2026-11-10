'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { VendorLogo } from '@/components/vendor-logo';
import { CATEGORY_ORDER } from '@/lib/model-catalog';
import { formatCnyPerMillion } from '@/lib/pricing';
import type { ModelPrice, ModelView } from '@/lib/pricing';

type PriceKind = 'input' | 'output' | 'cache';
type PriceLine = { label: string; value: number };

/** 把一个模型的价格拆成按档位排列的若干行；拿不到价格返回 null */
function priceLines(price: ModelPrice, kind: PriceKind): PriceLine[] | null {
  if (price.mode === 'unknown') return null;

  if (price.mode === 'tiered') {
    return price.tiers.map((tier) => ({
      label: tier.label,
      value:
        kind === 'input' ? tier.inputPerM : kind === 'output' ? tier.outputPerM : tier.cacheReadPerM,
    }));
  }

  if (kind === 'cache') return null;
  return [{ label: '', value: kind === 'input' ? price.inputPerM : price.outputPerM }];
}

const FAQS = [
  {
    q: '本页价格和实际扣费一致吗？',
    a: '一致。本页单价直接读取后台计费配置生成，不是单独维护的一份展示价；后台调整价格后重新发布本页即同步。',
  },
  {
    q: '一次调用的费用怎么算？',
    a: '输入 token 数 × 输入单价 + 输出 token 数 × 输出单价。如果请求命中了上下文缓存，命中部分按更低的缓存单价计算。',
  },
  {
    q: '有最低消费或月费吗？',
    a: '没有。按实际用量结算，用多少算多少，不产生调用就不扣费。',
  },
  {
    q: '余额不足会怎样？',
    a: '余额不足时请求会被直接拒绝并返回明确错误，不会继续提供服务。由于按实际 token 用量结算，个别情况下单次调用可能使余额略微为负，充值后即可恢复。',
  },
  {
    q: '价格会变吗？',
    a: '上游厂商调价时本平台会同步调整。价格变动后本页重新发布即生效，历史调用的扣费不受影响。',
  },
];

export function PricingClient(props: { models: ModelView[]; pricingAvailable: boolean }) {
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return props.models;
    return props.models.filter(
      (model) =>
        model.displayName.toLowerCase().includes(q) ||
        model.id.toLowerCase().includes(q) ||
        model.vendorName.toLowerCase().includes(q)
    );
  }, [props.models, keyword]);

  // 按分类分组，只渲染真正有模型的分类
  const groups = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      models: filtered.filter((model) => model.category === category),
    })).filter((group) => group.models.length > 0);
  }, [filtered]);

  const hasCachePrice = props.models.some(
    (model) =>
      model.price.mode === 'tiered' &&
      model.price.tiers.some((tier) => tier.cacheReadPerM > 0)
  );

  const showSearch = props.models.length >= 5;

  return (
    <main>
      {/* ─── Hero ─── */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'var(--gradient-hero)',
        }}
      >
        <div className="mx-auto max-w-5xl px-6 py-16 text-center md:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-white/70 px-3.5 py-1 text-xs font-medium tracking-wide text-brand">
            PRICING · 价格中心
          </span>

          <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
            <span className="text-ink">模型</span>
            <span
              style={{
                background: 'var(--gradient-brand)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              价格总览
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink/60">
            一屏对比各模型的输入、输出与缓存命中单价，价格与下单扣费一致。
          </p>

          {showSearch && (
            <div className="mx-auto mt-8 flex max-w-2xl items-center overflow-hidden rounded-full border border-black/10 bg-white shadow-sm">
              <input
                type="text"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索模型名称或厂商"
                aria-label="搜索模型价格"
                className="flex-1 border-0 bg-transparent px-6 py-3.5 text-sm text-ink outline-none placeholder:text-ink/35"
              />
              <span
                className="mr-1.5 flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium text-white"
                style={{ background: 'var(--gradient-primary, var(--brand-primary))' }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                搜索
              </span>
            </div>
          )}

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink/55">
            {['价格与实时计费同步', '只展示已接入可用模型', '按厂商与分类快速定位'].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-brand"
                  aria-hidden
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── 价格表 ─── */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        {!props.pricingAvailable && (
          <p className="mb-6 rounded-xl border border-warn/30 bg-warn/5 px-5 py-4 text-xs leading-relaxed text-ink/70">
            价格信息暂时不可用（本次构建没有连上计费接口），下表不显示具体单价，请以控制台下单时的价格为准。
          </p>
        )}

        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.category} className="mb-10 last:mb-0">
              <h2 className="text-xl font-bold text-ink">{group.category}模型</h2>

              <div className="mt-4 hidden overflow-x-auto rounded-xl border border-black/5 md:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="bg-surface-tint text-left text-xs text-ink/60">
                      <th className="px-5 py-3 font-medium">厂商</th>
                      <th className="px-5 py-3 font-medium">模型</th>
                      <th className="px-5 py-3 font-medium">输入价格（每百万 token）</th>
                      <th className="px-5 py-3 font-medium">输出价格（每百万 token）</th>
                      {hasCachePrice && (
                        <th className="px-5 py-3 font-medium">缓存命中（每百万 token）</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {group.models.map((model) => (
                      <tr key={model.id} className="border-t border-black/5 align-top">
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-2 text-ink/70">
                            <VendorLogo vendor={model.vendorName} size={16} />
                            {model.vendorName}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/models/${model.id}`}
                            className="font-medium text-ink transition-colors hover:text-brand"
                          >
                            {model.displayName}
                          </Link>
                          <p className="mt-0.5 font-mono text-xs text-ink/40">{model.id}</p>
                          <p className="mt-1 text-xs text-ink/45">上下文 {model.contextWindow}</p>
                          {model.price.mode === 'tiered' && model.price.schedule && (
                            <p className="mt-1 text-xs leading-relaxed text-brand/70">
                              分时计价：{model.price.schedule}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <PriceCell lines={priceLines(model.price, 'input')} />
                        </td>
                        <td className="px-5 py-4">
                          <PriceCell lines={priceLines(model.price, 'output')} />
                        </td>
                        {hasCachePrice && (
                          <td className="px-5 py-4">
                            <PriceCell lines={priceLines(model.price, 'cache')} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 手机端：卡片式，避免横向滚动 */}
              <div className="mt-4 space-y-3 md:hidden">
                {group.models.map((model) => (
                  <MobilePriceCard key={model.id} model={model} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-black/5 bg-surface-tint-soft px-6 py-12 text-center text-sm text-ink/60">
            {props.models.length === 0
              ? '暂无已接入的模型。模型接入后价格会自动出现在这里。'
              : '没有匹配的模型，换个关键词试试。'}
          </div>
        )}
      </section>

      {/* ─── 计费规则 ─── */}
      <section className="mx-auto max-w-7xl px-6 pb-4">
        <h2 className="text-xl font-bold text-ink">计费规则</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              title: '按 Token 计量',
              desc: '以实际消耗的 token 数量结算，输入与输出分别计价，没有最低消费。',
            },
            {
              title: '缓存命中单独计价',
              desc: '命中上下文缓存的输入部分按更低的缓存单价计费，未命中的按输入价。',
            },
            {
              title: '余额不足即拦截',
              desc: '账户余额不足以支付预估费用时请求会被直接拒绝，不会产生持续欠费。',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-black/5 bg-surface-tint-muted p-6">
              <h3 className="text-base font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 价格说明 ─── */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <h2 className="text-xl font-bold text-ink">价格说明</h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink/60">
          {[
            '表中单价均为人民币，计价单位为每百万 token；实际扣费按实际 token 数等比换算。',
            '单价由后台计费配置生成，与下单时的扣费规则一致，不是单独维护的展示价。',
            '模型上下架、价格调整都会同步反映到本页，页面更新前产生的调用按当时的规则结算。',
            '不同模型的计费方式可能不同（如按 token 分时计价、按次计价等），具体以模型详情页为准。',
          ].map((line) => (
            <li key={line} className="flex gap-2.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand/60" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* ─── FAQ ─── */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <h2 className="text-xl font-bold text-ink">常见问题</h2>
        <div className="mt-4 space-y-3">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-black/5 bg-white px-6 py-4"
            >
              <summary className="cursor-pointer list-none text-sm font-medium text-ink marker:hidden">
                {item.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink/60">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

function PriceCell(props: { lines: PriceLine[] | null }) {
  if (!props.lines) {
    return <span className="text-ink/35">—</span>;
  }

  if (props.lines.length === 1 && !props.lines[0].label) {
    return <span className="font-medium text-ink">{formatCnyPerMillion(props.lines[0].value)}</span>;
  }

  return (
    <div className="space-y-1">
      {props.lines.map((line) => (
        <div key={line.label} className="flex items-baseline gap-2">
          <span className="w-16 shrink-0 text-xs text-ink/40">{line.label}</span>
          <span className="font-medium text-ink">{formatCnyPerMillion(line.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** 手机端价格卡：窄屏下表格塞不下，改成每个模型一张卡 */
function MobilePriceCard(props: { model: ModelView }) {
  const model = props.model;

  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      <div className="flex items-center gap-2">
        <VendorLogo vendor={model.vendorName} size={16} />
        <span className="text-xs text-ink/50">{model.vendorName}</span>
      </div>

      <Link
        href={`/models/${model.id}`}
        className="mt-1.5 block text-sm font-semibold text-ink"
      >
        {model.displayName}
      </Link>
      <p className="font-mono text-xs text-ink/40">{model.id}</p>

      <dl className="mt-3 space-y-2 border-t border-black/5 pt-3 text-xs">
        <MobilePriceRow label="输入" lines={priceLines(model.price, 'input')} />
        <MobilePriceRow label="输出" lines={priceLines(model.price, 'output')} />
        <MobilePriceRow label="缓存命中" lines={priceLines(model.price, 'cache')} />
      </dl>

      <p className="mt-2.5 text-xs text-ink/45">
        上下文 {model.contextWindow}
        {model.price.mode === 'tiered' && model.price.schedule && (
          <span className="mt-1 block leading-relaxed text-brand/70">
            分时计价：{model.price.schedule}
          </span>
        )}
      </p>
    </div>
  );
}

function MobilePriceRow(props: { label: string; lines: PriceLine[] | null }) {
  if (!props.lines || props.lines.length === 0) return null;

  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink/45">{props.label}</dt>
      <dd className="text-right">
        {props.lines.map((line) => (
          <div key={line.label || 'single'} className="flex items-baseline justify-end gap-2">
            {line.label && <span className="text-ink/40">{line.label}</span>}
            <span className="font-medium text-ink">{formatCnyPerMillion(line.value)}</span>
          </div>
        ))}
      </dd>
    </div>
  );
}
