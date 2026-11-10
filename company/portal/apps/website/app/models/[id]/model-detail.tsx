import Link from 'next/link';
import { VendorLogo } from '@/components/vendor-logo';
import { apiBase } from '@/lib/brand';
import { formatCnyPerMillion } from '@/lib/pricing';
import type { ModelView } from '@/lib/pricing';
import { CodeBlock } from '@/components/code-block';

const PARAM_ROWS = [
  { name: 'model', type: 'string', required: '是', note: '模型名称，填本页的模型 ID' },
  { name: 'messages', type: 'array', required: '是', note: '消息数组，支持 system / user / assistant 三种角色' },
  { name: 'max_tokens', type: 'integer', required: '否', note: '最大输出长度，不能超过该模型的输出上限' },
  { name: 'stream', type: 'boolean', required: '否', note: '是否流式返回，默认 false' },
  { name: 'temperature', type: 'number', required: '否', note: '采样温度，取值 0–2' },
];

export function ModelDetail(props: { model: ModelView }) {
  const model = props.model;
  const price = model.price;

  const tieredPrice = price.mode === 'tiered' ? price : null;
  const flatPrice = price.mode === 'flat' ? price : null;
  const hasCachePrice =
    tieredPrice?.tiers.some((tier) => tier.cacheReadPerM > 0) ?? false;

  const requestExample = [
    `POST ${apiBase}/v1/chat/completions`,
    'Authorization: Bearer <你的 API Key>',
    'Content-Type: application/json',
  ].join('\n');

  const curlExample = [
    `curl ${apiBase}/v1/chat/completions \\`,
    '  -H "Authorization: Bearer $API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    `    \"model\": \"${model.id}\",`,
    '    "messages": [{"role": "user", "content": "你好，介绍一下你自己"}],',
    '    "max_tokens": 512',
    "  }'",
  ].join('\n');

  const pythonExample = [
    'from openai import OpenAI',
    '',
    'client = OpenAI(',
    '    api_key="你的 API Key",',
    `    base_url="${apiBase}/v1",`,
    ')',
    '',
    'resp = client.chat.completions.create(',
    `    model="${model.id}",`,
    '    messages=[{"role": "user", "content": "你好，介绍一下你自己"}],',
    '    max_tokens=512,',
    ')',
    '',
    'print(resp.choices[0].message.content)',
  ].join('\n');

  const nodeExample = [
    "import OpenAI from 'openai';",
    '',
    'const client = new OpenAI({',
    '  apiKey: process.env.API_KEY,',
    `  baseURL: '${apiBase}/v1',`,
    '});',
    '',
    'const resp = await client.chat.completions.create({',
    `  model: '${model.id}',`,
    "  messages: [{ role: 'user', content: '你好，介绍一下你自己' }],",
    '  max_tokens: 512,',
    '});',
    '',
    'console.log(resp.choices[0].message.content);',
  ].join('\n');

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/models" className="text-sm text-ink/50 transition-colors hover:text-brand">
        ← 返回模型广场
      </Link>

      {/* ─── 概要 ─── */}
      <header className="mt-6">
        <div className="flex items-center gap-2">
          <VendorLogo vendor={model.vendorName} size={20} />
          <span className="text-sm text-ink/55">{model.vendorName}</span>
          <span className="rounded border border-brand/20 bg-brand/5 px-2 py-0.5 text-xs text-brand">
            {model.category}
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          {model.displayName}
        </h1>
        <p className="mt-1 font-mono text-sm text-ink/45">{model.id}</p>

        <p className="mt-4 text-base leading-relaxed text-ink/70">{model.description}</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {model.capabilities.map((tag) => (
            <span
              key={tag}
              className="rounded border border-brand/15 bg-brand/5 px-2 py-0.5 text-xs text-brand/80"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      {/* ─── 规格 ─── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">模型规格</h2>
        <dl className="mt-3 divide-y divide-black/5 rounded-xl border border-black/5 bg-white text-sm">
          <SpecRow label="上下文长度" value={model.contextWindow} />
          <SpecRow label="最大输出" value={model.maxOutput} />
          <SpecRow label="模型用途" value={model.useCase} />
          <SpecRow
            label="计费方式"
            value={tieredPrice ? '按 token 计费，分时定价' : '按 token 计费'}
          />
          <SpecRow label="接口协议" value="OpenAI 兼容（/v1/chat/completions）" />
        </dl>
      </section>

      {/* ─── 价格 ─── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">价格</h2>
        <p className="mt-1 text-xs text-ink/45">单位：人民币 / 百万 tokens</p>

        {tieredPrice && (
          <>
            <div className="mt-3 overflow-hidden rounded-xl border border-black/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-tint text-left text-xs text-ink/60">
                    <th className="px-5 py-3 font-medium">时段</th>
                    <th className="px-5 py-3 font-medium">输入</th>
                    <th className="px-5 py-3 font-medium">输出</th>
                    {hasCachePrice && <th className="px-5 py-3 font-medium">缓存命中</th>}
                  </tr>
                </thead>
                <tbody>
                  {tieredPrice.tiers.map((tier) => (
                    <tr key={tier.key} className="border-t border-black/5">
                      <td className="px-5 py-3 text-ink/70">{tier.label}</td>
                      <td className="px-5 py-3 font-medium text-ink">
                        {formatCnyPerMillion(tier.inputPerM)}
                      </td>
                      <td className="px-5 py-3 font-medium text-ink">
                        {formatCnyPerMillion(tier.outputPerM)}
                      </td>
                      {hasCachePrice && (
                        <td className="px-5 py-3 text-ink/70">
                          {formatCnyPerMillion(tier.cacheReadPerM)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tieredPrice.schedule && (
              <p className="mt-2 text-xs leading-relaxed text-ink/50">{tieredPrice.schedule}</p>
            )}
          </>
        )}

        {flatPrice && (
          <div className="mt-3 overflow-hidden rounded-xl border border-black/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-tint text-left text-xs text-ink/60">
                  <th className="px-5 py-3 font-medium">输入</th>
                  <th className="px-5 py-3 font-medium">输出</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-black/5">
                  <td className="px-5 py-3 font-medium text-ink">
                    {formatCnyPerMillion(flatPrice.inputPerM)}
                  </td>
                  <td className="px-5 py-3 font-medium text-ink">
                    {formatCnyPerMillion(flatPrice.outputPerM)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {price.mode === 'unknown' && (
          <p className="mt-3 rounded-xl border border-black/5 bg-surface-tint-soft px-5 py-4 text-xs leading-relaxed text-ink/55">
            价格信息暂时不可用，请以控制台下单时的价格为准。
          </p>
        )}

        <p className="mt-2 text-xs leading-relaxed text-ink/45">
          价格直接读取后台计费配置生成，与下单计费一致；后台调整价格后，重新构建即可同步。
        </p>
      </section>

      {/* ─── API 调用方式 ─── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">API 调用方式</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink/60">
          接口与 OpenAI 完全兼容。把 API 地址指向本平台、把模型名填成本页的模型 ID，就能直接复用现有的 OpenAI
          SDK 或客户端。
        </p>
        <div className="mt-3">
          <CodeBlock label="请求地址与请求头" code={requestExample} />
        </div>

        <h3 className="mt-6 text-sm font-semibold text-ink">主要请求参数</h3>
        <div className="mt-2 overflow-hidden rounded-xl border border-black/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-tint text-left text-xs text-ink/60">
                <th className="px-4 py-2.5 font-medium">参数</th>
                <th className="px-4 py-2.5 font-medium">类型</th>
                <th className="px-4 py-2.5 font-medium">必填</th>
                <th className="px-4 py-2.5 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {PARAM_ROWS.map((row) => (
                <tr key={row.name} className="border-t border-black/5">
                  <td className="px-4 py-2.5 font-mono text-xs text-ink">{row.name}</td>
                  <td className="px-4 py-2.5 text-xs text-ink/55">{row.type}</td>
                  <td className="px-4 py-2.5 text-xs text-ink/55">{row.required}</td>
                  <td className="px-4 py-2.5 text-xs leading-relaxed text-ink/60">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── 代码示例 ─── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">代码示例</h2>
        <div className="mt-3 space-y-3">
          <CodeBlock label="cURL" code={curlExample} />
          <CodeBlock label="Python（OpenAI SDK）" code={pythonExample} />
          <CodeBlock label="Node.js（openai npm 包）" code={nodeExample} />
        </div>

        <p className="mt-3 text-xs leading-relaxed text-ink/45">
          API Key 在控制台的「API Key 管理」里创建。示例里的
          <code className="mx-1 font-mono text-ink/65">{apiBase}</code>
          是占位地址，正式域名确定后会替换。
        </p>
      </section>
    </main>
  );
}

function SpecRow(props: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="w-28 shrink-0 text-ink/45">{props.label}</dt>
      <dd className="text-ink/80">{props.value}</dd>
    </div>
  );
}
