import Link from 'next/link';
import { CodeBlock } from '@/components/code-block';
import { apiBase, registerUrl } from '@/lib/brand';
import type { ModelView } from '@/lib/pricing';

const NAV_GROUPS = [
  {
    title: '开始使用',
    items: [
      { id: 'quickstart', label: '快速开始' },
      { id: 'auth', label: '获取 API Key' },
      { id: 'endpoint', label: '接口说明' },
    ],
  },
  {
    title: '调用参考',
    items: [
      { id: 'models', label: '可用模型' },
      { id: 'examples', label: '调用示例' },
      { id: 'params', label: '请求参数' },
      { id: 'errors', label: '错误码' },
    ],
  },
  {
    title: '其他',
    items: [{ id: 'faq', label: '常见问题' }],
  },
];

const QUICK_START = [
  { step: '01', title: '注册账号', desc: '用手机号或邮箱注册，登录后进入控制台。' },
  { step: '02', title: '创建 API Key', desc: '在控制台左侧「API 密钥」页新建，复制完整 Key。' },
  { step: '03', title: '充值额度', desc: '按需充值，或使用体验额度先把流程跑通。' },
  { step: '04', title: '发起第一次调用', desc: '复制下方示例，换成你的 Key 直接运行。' },
];

const ENDPOINTS = [
  { method: 'POST', path: '/v1/chat/completions', desc: '对话补全，支持流式返回' },
  { method: 'GET', path: '/v1/models', desc: '查询当前可用的模型列表' },
];

const PARAM_ROWS = [
  { name: 'model', type: 'string', required: '是', note: '模型 ID，取值见本页「可用模型」' },
  {
    name: 'messages',
    type: 'array',
    required: '是',
    note: '消息数组，每项包含 role 和 content，role 支持 system / user / assistant',
  },
  { name: 'max_tokens', type: 'integer', required: '否', note: '最大输出长度，不能超过模型输出上限' },
  { name: 'stream', type: 'boolean', required: '否', note: '是否流式返回，默认 false' },
  { name: 'temperature', type: 'number', required: '否', note: '采样温度，取值 0–2，越大越随机' },
];

/** 错误码按第九章 9.2 接口验收测试的实测结果整理，不写没验证过的 */
const ERROR_ROWS = [
  {
    code: '401',
    title: '认证失败',
    desc: 'API Key 缺失、无效或已被删除。另外，Key 自身额度用尽时也返回 401。',
  },
  {
    code: '403',
    title: '余额不足',
    desc: '账户额度不足以支付本次调用，错误码 insufficient_user_quota。充值后重试。',
  },
  {
    code: '429',
    title: '请求过于频繁',
    desc: '触发了限流，稍等后重试；批量调用请降低并发或加退避。',
  },
  {
    code: '503',
    title: '模型不可用',
    desc: '模型名写错，或该模型当前没有可用渠道，错误码 model_not_found。',
  },
];

const FAQS = [
  {
    q: '原来用 OpenAI 的代码，要改多少？',
    a: '改两处：base_url 换成上面的接口地址，api_key 换成平台 Key。模型名要换成平台支持的模型 ID。其余参数和调用方式完全一样。',
  },
  {
    q: '支持哪些语言和 SDK？',
    a: '任何能发 HTTP 请求的语言都可以。官方 openai SDK（Python、Node.js、Java、Go 等）都能直接用，因为接口协议是兼容的。',
  },
  {
    q: '支持流式输出吗？',
    a: '支持。请求里传 stream: true，服务端会按 SSE 逐块返回，适合聊天类产品做打字机效果。',
  },
  {
    q: '模型名从哪里查？',
    a: '本页「可用模型」一节列出当前全部可用模型；也可以在控制台的模型列表里查看。模型名写错会返回 503。',
  },
  {
    q: '调用失败了会扣费吗？',
    a: '不会。费用按实际消耗的 token 结算，被拒绝的请求（401 / 403 / 429 / 503）不产生扣费。',
  },
  {
    q: '有并发限制吗？',
    a: '有。超过限制会返回 429，稍等后自动恢复。高并发场景建议在客户端做重试和退避。',
  },
  {
    q: '价格怎么算？',
    a: '按输入和输出的 token 数分别计价，具体单价见价格页。部分模型分时段计价。',
  },
];

export function DocsContent(props: { models: ModelView[] }) {
  const primaryModelId = props.models[0]?.id ?? 'your-model';

  const curlExample = [
    `curl ${apiBase}/v1/chat/completions \\`,
    '  -H "Authorization: Bearer $API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    `    \"model\": \"${primaryModelId}\",`,
    '    "messages": [{"role": "user", "content": "你好"}],',
    '    "stream": false',
    "  }'",
  ].join('\n');

  const curlStreamExample = [
    `curl -N ${apiBase}/v1/chat/completions \\`,
    '  -H "Authorization: Bearer $API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    `    \"model\": \"${primaryModelId}\",`,
    '    "messages": [{"role": "user", "content": "你好"}],',
    '    "stream": true',
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
    `    model="${primaryModelId}",`,
    '    messages=[{"role": "user", "content": "你好"}],',
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
    `  model: '${primaryModelId}',`,
    "  messages: [{ role: 'user', content: '你好' }],",
    '});',
    '',
    'console.log(resp.choices[0].message.content);',
  ].join('\n');

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <div className="grid gap-12 lg:grid-cols-[200px_1fr]">
        {/* ─── 左侧目录（按用途分组） ─── */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-6 text-sm">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="mb-2 text-xs font-semibold text-ink">{group.title}</div>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block rounded-md px-2.5 py-1.5 text-[13px] text-ink/60 transition-colors hover:bg-surface-tint hover:text-brand"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* ─── 正文 ─── */}
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">开发者文档</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/60">
            接口与 OpenAI 完全兼容：把 base_url 换成下面的地址、API Key 换成平台 Key，
            原有代码基本不用改。
          </p>

          {/* 快速开始 */}
          <section id="quickstart" className="mt-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-ink">快速开始</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {QUICK_START.map((item) => (
                <div key={item.step} className="rounded-xl border border-black/5 bg-surface-tint-soft p-5">
                  <span className="font-mono text-xs text-brand">{item.step}</span>
                  <h3 className="mt-2 text-base font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 获取 API Key */}
          <section id="auth" className="mt-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-ink">获取 API Key</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/60">
              登录控制台 → 左侧「API 密钥」→ 新建 → 复制完整 Key。Key
              只完整显示一次，请立即保存；一旦怀疑泄露，请立刻删除并重建。
            </p>
            <Link
              href={registerUrl}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              去注册账号 →
            </Link>
          </section>

          {/* 接口说明 */}
          <section id="endpoint" className="mt-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-ink">接口说明</h2>
            <dl className="mt-4 divide-y divide-black/5 rounded-xl border border-black/5 bg-white text-sm">
              <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-6">
                <dt className="w-24 shrink-0 text-ink/45">接口地址</dt>
                <dd className="font-mono text-[13px] text-ink">{apiBase}/v1</dd>
              </div>
              <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-6">
                <dt className="w-24 shrink-0 text-ink/45">鉴权方式</dt>
                <dd className="font-mono text-[13px] text-ink">Authorization: Bearer &lt;你的 API Key&gt;</dd>
              </div>
              <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-6">
                <dt className="w-24 shrink-0 text-ink/45">协议</dt>
                <dd className="text-ink/80">OpenAI 兼容，可直接使用 openai 官方 SDK</dd>
              </div>
              <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-6">
                <dt className="w-24 shrink-0 text-ink/45">内容类型</dt>
                <dd className="font-mono text-[13px] text-ink">Content-Type: application/json</dd>
              </div>
            </dl>

            <h3 className="mt-6 text-sm font-semibold text-ink">支持的接口</h3>
            <div className="mt-2 overflow-hidden rounded-xl border border-black/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-tint text-left text-xs text-ink/60">
                    <th className="px-4 py-2.5 font-medium">方法</th>
                    <th className="px-4 py-2.5 font-medium">路径</th>
                    <th className="px-4 py-2.5 font-medium">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {ENDPOINTS.map((item) => (
                    <tr key={item.path} className="border-t border-black/5">
                      <td className="px-4 py-2.5 font-mono text-xs text-brand">{item.method}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink">{item.path}</td>
                      <td className="px-4 py-2.5 text-ink/60">{item.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 可用模型 */}
          <section id="models" className="mt-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-ink">可用模型</h2>
            <p className="mt-2 text-sm text-ink/55">
              下面这些模型当前已经接入并可用，调用时 model 字段填「模型 ID」那一列。
            </p>

            {props.models.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {props.models.map((model) => (
                  <Link
                    key={model.id}
                    href={`/models/${model.id}`}
                    className="rounded-xl border border-black/5 bg-white p-4 transition-colors hover:border-brand/40"
                  >
                    <div className="text-sm font-semibold text-ink">{model.displayName}</div>
                    <code className="mt-1 block font-mono text-xs text-brand">{model.id}</code>
                    <p className="mt-1.5 text-xs text-ink/45">
                      上下文 {model.contextWindow} · 最大输出 {model.maxOutput}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-black/5 bg-surface-tint-soft px-5 py-4 text-sm text-ink/55">
                暂无已接入的模型，模型接入后会自动出现在这里。
              </p>
            )}
          </section>

          {/* 调用示例 */}
          <section id="examples" className="mt-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-ink">调用示例</h2>
            <p className="mt-2 text-sm text-ink/55">
              示例里的模型名取自上方「可用模型」，把 API Key 换成你自己的就能直接运行。
            </p>

            <div className="mt-4 space-y-3">
              <CodeBlock label="cURL" code={curlExample} />
              <CodeBlock label="cURL（流式输出）" code={curlStreamExample} />
              <CodeBlock label="Python（OpenAI SDK）" code={pythonExample} />
              <CodeBlock label="Node.js（openai npm 包）" code={nodeExample} />
            </div>
          </section>

          {/* 请求参数 */}
          <section id="params" className="mt-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-ink">请求参数</h2>
            <p className="mt-2 text-sm text-ink/55">
              /v1/chat/completions 的主要参数，其余 OpenAI 同名参数同样支持。
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-black/5">
              <table className="w-full min-w-[560px] text-sm">
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

          {/* 错误码 */}
          <section id="errors" className="mt-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-ink">错误码</h2>
            <p className="mt-2 text-sm text-ink/55">
              下面是接口实际会返回的状态码，按平台接口验收测试的实测结果整理。
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-black/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-tint text-left text-xs text-ink/60">
                    <th className="px-4 py-2.5 font-medium">状态码</th>
                    <th className="px-4 py-2.5 font-medium">含义</th>
                    <th className="px-4 py-2.5 font-medium">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_ROWS.map((row) => (
                    <tr key={row.code} className="border-t border-black/5 align-top">
                      <td className="px-4 py-3 font-mono text-xs text-ink">{row.code}</td>
                      <td className="px-4 py-3 text-xs font-medium text-ink">{row.title}</td>
                      <td className="px-4 py-3 text-xs leading-relaxed text-ink/60">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 常见问题 */}
          <section id="faq" className="mt-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-ink">常见问题</h2>
            <div className="mt-4 space-y-3">
              {FAQS.map((item) => (
                <details
                  key={item.q}
                  className="rounded-xl border border-black/5 bg-white px-5 py-3.5"
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-ink marker:hidden">
                    {item.q}
                  </summary>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink/60">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <p className="mt-10 rounded-xl border border-black/5 bg-surface-tint-soft px-5 py-4 text-xs leading-relaxed text-ink/50">
            本页示例中的接口地址当前是占位域名。正式域名确定后，设置环境变量
            <code className="mx-1 font-mono text-ink/70">NEXT_PUBLIC_API_BASE_URL</code>
            即可全站替换，示例就能直接复制运行。
          </p>
        </div>
      </div>
    </main>
  );
}
