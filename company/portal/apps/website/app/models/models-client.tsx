'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { VendorLogo } from '@/components/vendor-logo';
import { CATEGORY_ORDER } from '@/lib/model-catalog';
import { formatCnyPerMillion } from '@/lib/pricing';
import type { ModelPrice, ModelView } from '@/lib/pricing';

// ─── 价格格式化 ──────────────────────────────────────────────────────────
function priceText(price: ModelPrice, kind: 'input' | 'output'): string {
  if (price.mode === 'unknown') return '以控制台为准';

  if (price.mode === 'flat') {
    const single = kind === 'input' ? price.inputPerM : price.outputPerM;
    return `${formatCnyPerMillion(single)} / 百万 tokens`;
  }

  const values = price.tiers
    .map((tier) => (kind === 'input' ? tier.inputPerM : tier.outputPerM))
    .filter((value) => value > 0);

  if (values.length === 0) return '以控制台为准';

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return `${formatCnyPerMillion(min)} / 百万 tokens`;
  return `${formatCnyPerMillion(min)}–${formatCnyPerMillion(max).replace('¥', '')} / 百万 tokens`;
}

export function ModelsClient(props: {
  models: ModelView[];
  pricingAvailable: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [activeVendor, setActiveVendor] = useState<string>('全部');
  const [search, setSearch] = useState('');

  // 只列出真正有模型的分类与厂商，不摆空标签
  const categories = useMemo(() => {
    const present = new Set(props.models.map((model) => model.category));
    return ['全部', ...CATEGORY_ORDER.filter((category) => present.has(category))];
  }, [props.models]);

  const vendors = useMemo(() => {
    const present = new Set(props.models.map((model) => model.vendorName));
    return ['全部', ...Array.from(present)];
  }, [props.models]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return props.models.filter((model) => {
      if (activeCategory !== '全部' && model.category !== activeCategory) return false;
      if (activeVendor !== '全部' && model.vendorName !== activeVendor) return false;
      if (!keyword) return true;
      return (
        model.displayName.toLowerCase().includes(keyword) ||
        model.id.toLowerCase().includes(keyword) ||
        model.vendorName.toLowerCase().includes(keyword) ||
        model.description.toLowerCase().includes(keyword) ||
        model.capabilities.some((tag) => tag.toLowerCase().includes(keyword))
      );
    });
  }, [props.models, activeCategory, activeVendor, search]);

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
        <div className="mx-auto max-w-7xl px-6 py-16 text-center md:py-20">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            <span
              style={{
                background: 'var(--gradient-brand)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              模型广场
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink/60">
            当前提供 {props.models.length} 个模型，统一 OpenAI 兼容接口，一个 Key 全部调用
          </p>

          <div className="mx-auto mt-8 flex max-w-2xl items-center overflow-hidden rounded-full border border-black/10 bg-white shadow-sm">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索模型名称、厂商、能力"
              aria-label="搜索模型"
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
        </div>
      </section>

      {/* ─── 筛选 + 卡片 ─── */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        {!props.pricingAvailable && (
          <p className="mb-6 rounded-xl border border-warn/30 bg-warn/5 px-5 py-4 text-xs leading-relaxed text-ink/70">
            价格信息暂时不可用（本次构建没有连上计费接口），页面不显示具体单价，请以控制台下单时的价格为准。
          </p>
        )}

        {categories.length > 2 && (
          <div className="flex items-start gap-4">
            <span className="mt-2 shrink-0 text-sm font-medium text-ink/60">模型分类</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm transition-colors ${
                    activeCategory === category
                      ? 'border border-brand/30 bg-brand/8 font-medium text-brand'
                      : 'border border-black/8 text-ink/60 hover:border-brand/30 hover:text-brand'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {vendors.length > 2 && (
          <div className="mt-4 flex items-start gap-4">
            <span className="mt-2 shrink-0 text-sm font-medium text-ink/60">模型厂商</span>
            <div className="flex flex-wrap gap-2">
              {vendors.map((vendor) => (
                <button
                  key={vendor}
                  type="button"
                  onClick={() => setActiveVendor(vendor)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    activeVendor === vendor
                      ? 'border-brand/30 bg-brand/8 font-medium text-brand'
                      : 'border-black/8 text-ink/60 hover:border-brand/30 hover:text-brand'
                  }`}
                >
                  {vendor !== '全部' && <VendorLogo vendor={vendor} size={14} />}
                  {vendor}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-ink/45">共 {filtered.length} 个模型</p>

        {filtered.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {filtered.map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-xl border border-black/5 bg-surface-tint-soft px-6 py-12 text-center">
            <p className="text-sm text-ink/60">
              {props.models.length === 0
                ? '暂无已接入的模型。模型接入后会自动出现在这里。'
                : '没有匹配的模型，换个关键词或筛选条件试试。'}
            </p>
          </div>
        )}

        <p className="mt-8 rounded-xl border border-black/5 bg-surface-tint-soft px-5 py-4 text-xs leading-relaxed text-ink/50">
          模型清单与单价直接读取后台计费配置生成，与下单计费一致；后台调整价格或上下架模型后，重新构建即可同步。
        </p>
      </section>
    </main>
  );
}

// ─── 模型卡片 ────────────────────────────────────────────────────────────
function ModelCard(props: { model: ModelView }) {
  const [hovered, setHovered] = useState(false);

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col rounded-xl border bg-white p-5 transition-all duration-200"
      style={{
        borderColor: hovered ? 'rgba(79,70,229,0.55)' : 'rgba(0,0,0,0.06)',
        boxShadow: hovered ? '0 4px 20px rgba(79,70,229,0.08)' : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <VendorLogo vendor={props.model.vendorName} size={18} />
          <span className="text-xs text-ink/55">{props.model.vendorName}</span>
        </div>
        <span className="shrink-0 rounded border border-brand/20 bg-brand/5 px-2 py-0.5 text-xs text-brand">
          {props.model.category}
        </span>
      </div>

      <h2 className="mt-2.5 text-base font-bold text-ink">{props.model.displayName}</h2>
      <p className="mt-0.5 font-mono text-xs text-ink/45">{props.model.id}</p>

      <p className="mt-2.5 text-sm leading-relaxed text-ink/65">{props.model.description}</p>

      <p className="mt-2 text-xs text-ink/50">
        <span className="text-ink/40">用途：</span>
        {props.model.useCase}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {props.model.capabilities.map((tag) => (
          <span
            key={tag}
            className="rounded border border-brand/15 bg-brand/5 px-2 py-0.5 text-xs text-brand/80"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto">
        <dl className="mt-4 space-y-1.5 border-t border-black/5 pt-3 text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-ink/45">输入价格</dt>
            <dd className="text-right font-medium text-ink">
              {priceText(props.model.price, 'input')}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-ink/45">输出价格</dt>
            <dd className="text-right font-medium text-ink">
              {priceText(props.model.price, 'output')}
            </dd>
          </div>
        </dl>

        <div className="mt-2.5 flex items-end justify-between gap-3">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/45">
            <span>上下文 {props.model.contextWindow}</span>
            <span>最大输出 {props.model.maxOutput}</span>
            {props.model.price.mode === 'tiered' && <span>分时计价</span>}
          </p>
          <Link
            href={`/models/${props.model.id}`}
            className="shrink-0 text-xs text-brand hover:underline"
          >
            查看详情 →
          </Link>
        </div>
      </div>
    </article>
  );
}
