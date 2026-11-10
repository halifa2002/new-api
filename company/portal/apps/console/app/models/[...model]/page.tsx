'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { modelsApi, ApiError } from '@portal/api-client';
import { ConsoleSidebar, ConsoleTopbar } from '@/components/console-chrome';
import { ensureMoneySettings, moneyUnit, usdToDisplay } from '@/lib/format';
import { pricingUrl } from '@/lib/brand';

/**
 * 模型详情页 —— md 4.2 B「模型详情 / 输入价格 / 输出价格 / API 调用代码示例」
 *
 * 价格换算（已核对 backend/common/constants.go 与 model/pricing.go）：
 *   QuotaPerUnit = 500000，即 $1 = 500000 quota；
 *   每 1K 输入 token 消耗 quota = model_ratio × 1000；
 *   因此 每 1M token 输入价（美元）= model_ratio × 2。
 *   输出价 = 输入价 × completion_ratio。
 *   quota_type = 1 时按次计费，直接用 model_price（美元/次）。
 *
 * 用 [...model] 而不是 [model]：模型名里可能带斜杠（如 vendor/model-name），
 * 单段动态路由会把斜杠当成路径分隔符。
 */

interface PricingItem {
  model_name: string;
  description?: string;
  tags?: string;
  owner_by?: string;
  quota_type: number;
  model_ratio: number;
  model_price: number;
  completion_ratio: number;
  /** flat = 按倍率；tiered_expr = 分时动态表达式（价格不在 model_ratio 里） */
  billing_mode?: string;
  billing_expr?: string;
}

/** 倍率 → 每百万 token 的价格（按后端配置的货币与汇率展示） */
function ratioToPrice(ratio: number): string {
  const value = usdToDisplay(ratio * 2);
  if (!Number.isFinite(value)) return '—';
  // 留 4 位有效小数，避免出现 0.30000000000000004 这种
  return Number(value.toFixed(4)).toString();
}

/** 货币符号：人民币显示 ¥，美元显示 $ */
function currencySign(): string {
  return moneyUnit() === '元' ? '¥' : '$';
}

export default function ModelDetailPage() {
  const router = useRouter();
  const params = useParams<{ model: string[] }>();
  const modelName = decodeURIComponent(
    Array.isArray(params.model) ? params.model.join('/') : (params.model as string) ?? '',
  );

  const [item, setItem] = useState<PricingItem | null>(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'curl' | 'node' | 'python'>('curl');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await ensureMoneySettings();
      const [pricing, models] = await Promise.all([
        modelsApi.listPricing().catch(() => null),
        modelsApi.listUserModels().catch(() => [] as string[]),
      ]);
      // http.get 已经把 { success, data } 的信封拆掉了，这里拿到的是数组本身；
      // 之前按 pricing.data 取，等于又拆了一次，所以永远找不到模型。
      const raw = pricing as unknown;
      const list: PricingItem[] = Array.isArray(raw)
        ? (raw as PricingItem[])
        : (((raw as { data?: PricingItem[] })?.data ??
            (raw as { models?: PricingItem[] })?.models ??
            []) as PricingItem[]);
      const found = list.find((p) => p.model_name === modelName) ?? null;
      setItem(found);
      setAvailable(Array.isArray(models) && models.includes(modelName));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [modelName, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const isPerCall = item?.quota_type === 1;
  /** 分时动态计费：价格写在表达式里，model_ratio 不是真实单价，不能拿来展示 */
  const isTiered = item?.billing_mode === 'tiered_expr';
  const inputPrice = item ? ratioToPrice(item.model_ratio) : '—';
  const outputPrice = item
    ? ratioToPrice(item.model_ratio * item.completion_ratio)
    : '—';

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://你的域名';

  const samples = {
    curl: `curl -X POST "${baseUrl}/v1/chat/completions" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'`,
    node: `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.API_KEY,
  baseURL: '${baseUrl}/v1',
});

const res = await client.chat.completions.create({
  model: '${modelName}',
  messages: [{ role: 'user', content: '你好' }],
  stream: true,
});`,
    python: `from openai import OpenAI

client = OpenAI(
    api_key=os.environ["API_KEY"],
    base_url="${baseUrl}/v1",
)

resp = client.chat.completions.create(
    model="${modelName}",
    messages=[{"role": "user", "content": "你好"}],
    stream=True,
)`,
  };

  return (
    <div className="min-h-screen md:pl-56">
      <ConsoleSidebar />
      <ConsoleTopbar title="模型详情" />

      <main className="px-6 py-6">
        <Link href="/models" className="text-xs text-ink-muted hover:text-brand">
          ← 返回模型广场
        </Link>

        {error && (
          <div className="mt-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-xs text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 text-center text-xs text-ink-muted">加载中…</div>
        ) : !item ? (
          <div className="mt-8 rounded-card border border-line bg-surface px-5 py-16 text-center">
            <p className="text-sm text-ink">没有找到模型「{modelName}」</p>
            <p className="mt-2 text-xs text-ink-muted">
              可能是价格表里没有这个模型，或管理员尚未配置它的价格。
            </p>
          </div>
        ) : (
          <>
            {/* 头部 */}
            <div className="mt-4 rounded-card border border-line bg-surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-mono text-lg font-semibold text-ink">
                    {item.model_name}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
                    {item.description || '管理员未填写模型说明。'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Tag
                      ok={available}
                      text={available ? '当前可用' : '当前不可用'}
                    />
                    {item.owner_by && <Tag text={`来源 ${item.owner_by}`} />}
                    {item.tags
                      ?.split(/[,;]/)
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .map((tag) => <Tag key={tag} text={tag} />)}
                  </div>
                </div>
              </div>
            </div>

            {/* 价格 */}
            <div className="mt-6 rounded-card border border-line bg-surface p-6">
              <h2 className="text-sm font-medium text-ink">计费方式</h2>
              {isTiered ? (
                <div className="mt-4 rounded-card border border-line bg-surface-subtle px-4 py-3 text-xs leading-relaxed text-ink-muted">
                  该模型按
                  <span className="mx-1 font-medium text-ink">分时动态计费</span>
                  （高峰期与空闲时段单价不同），单价随时段变化，这里不摆固定数字，
                  以免和实际扣费对不上。
                  <a
                    href={pricingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 text-brand hover:underline"
                  >
                    查看价格页 →
                  </a>
                </div>
              ) : isPerCall ? (
                <div className="mt-4">
                  <div className="text-xs text-ink-muted">按次计费</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                    {currencySign()}
                    {Number(usdToDisplay(item.model_price).toFixed(4))}
                    <span className="ml-1 text-xs font-normal text-ink-muted">/ 次</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-ink-muted">输入价格</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                      {currencySign()}
                      {inputPrice}
                      <span className="ml-1 text-xs font-normal text-ink-muted">
                        / 百万 Token
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted">输出价格</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                      {currencySign()}
                      {outputPrice}
                      <span className="ml-1 text-xs font-normal text-ink-muted">
                        / 百万 Token
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
                价格由管理员在后台配置，可能与上游厂商标价不同；
                实际扣费以调用后的用量记录为准。
              </p>
            </div>

            {/* 调用示例 */}
            <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <h2 className="text-sm font-medium text-ink">调用示例</h2>
                <div className="flex gap-1 rounded border border-line p-0.5">
                  {(
                    [
                      ['curl', 'cURL'],
                      ['node', 'Node.js'],
                      ['python', 'Python'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`rounded px-2.5 py-0.5 text-xs ${
                        tab === key ? 'bg-brand text-white' : 'text-ink-muted'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <pre className="overflow-x-auto bg-[#0F172A] px-5 py-4 text-[12px] leading-relaxed text-[#E2E8F0]">
                <code>{samples[tab]}</code>
              </pre>
              <p className="border-t border-line px-5 py-2.5 text-[11px] text-ink-muted">
                把 $API_KEY 换成你在「API 密钥」页创建的密钥。
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Tag({ text, ok }: { text: string; ok?: boolean }) {
  const cls =
    ok === undefined
      ? 'border-line bg-surface-subtle text-ink-muted'
      : ok
        ? 'border-green-200 bg-green-50 text-ok'
        : 'border-line bg-surface-subtle text-ink-muted';
  return (
    <span className={`rounded border px-2 py-0.5 text-[11px] ${cls}`}>{text}</span>
  );
}
