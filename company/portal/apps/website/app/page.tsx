import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { CodePreview } from '@/components/code-preview';
import { brand, loginUrl, registerUrl } from '@/lib/brand';

/**
 * 品牌官网首页 —— 对应 md 4.1「首页」九项要求：
 * ① 顶部品牌导航 ② 产品介绍 ③ 平台能力介绍 ④ 核心模型展示
 * ⑤ 服务优势 ⑥ API 接入示例 ⑦ 定价入口 ⑧ 开发者入口 ⑨ 注册登录入口
 *
 * 视觉取向参考 md 第 6 行「学习 SiliconFlow 的产品设计语言」：
 * 首屏整屏居中、大标题、流动光带背景；配色按 md 7.1 用靛蓝系。
 */

/** ⚠️ 占位数据：接入后端后改为从 /api/pricing 与 /api/user/models 读取 */
const capabilities = [
  {
    title: '一个 Key 调用多家模型',
    desc: '兼容 OpenAI、Claude、Gemini 三种主流协议，切换模型只改 model 字段，业务代码不用动。',
  },
  {
    title: '按实际用量计费',
    desc: '每次调用记录输入输出的 token 数与扣费金额，账单可逐笔追溯，不搞预存套路。',
  },
  {
    title: '多线路自动切换',
    desc: '同一模型可配置多条上游线路，单条异常时自动重试切换，业务侧无感知。',
  },
  {
    title: '额度可分级管控',
    desc: '每个 Key 可单独设额度上限与模型权限，防止某个应用把预算吃光。',
  },
];

const models = [
  { name: '通用对话', desc: '问答、写作、摘要、翻译', tag: 'Chat' },
  { name: '深度推理', desc: '复杂逻辑、数学、多步推导', tag: 'Reasoning' },
  { name: '代码生成', desc: '补全、重构、解释、单测', tag: 'Code' },
  { name: '多模态理解', desc: '图片识别、文档解析、视频摘要', tag: 'Vision' },
];

const steps = [
  { no: '01', title: '注册并获取 Key', desc: '登录控制台，在「API 密钥」页新建一个 Key。' },
  { no: '02', title: '替换地址与密钥', desc: '把 base_url 指向本平台，API Key 换成平台密钥。' },
  { no: '03', title: '直接调用', desc: '沿用原有 SDK 与代码，不需要改调用逻辑。' },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main>
        {/*
          首屏：小屏铺满视口，大屏封顶 880px。
          不封顶的话，27 寸以上屏幕会是 1100+px 高，内容只占中间一小块，
          四周全是空白，看起来"区块很大但很空"。
        */}
        <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden 2xl:min-h-[880px]">
          {/* 背景：生成的丝带光带图 + 调色提亮层 */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {/*
              背景图是正方形（1024×1024），宽屏用 cover 会把左右丝带裁光，
              所以用 100% 100% 拉伸铺满——丝带是柔和抽象形状，横向拉长反而更像流动光带。
            */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "url('/hero-bg.jpg')",
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
            {/* 压淡整体，统一到靛蓝色调（太厚会把丝带盖没） */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(238,242,255,0.20) 52%, rgba(255,255,255,0.88) 100%)',
              }}
            />
            {/* 中心提亮：保证文字压在上面仍然清晰 */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(52% 46% at 50% 44%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0) 76%)',
              }}
            />
            {/* 靛蓝薄雾，把偏天的蓝拉回品牌色 */}
            <div
              className="absolute inset-0 opacity-45"
              style={{
                background:
                  'radial-gradient(70% 60% at 20% 20%, rgba(99,102,241,0.20) 0%, transparent 60%), radial-gradient(65% 55% at 85% 75%, rgba(79,70,229,0.16) 0%, transparent 62%)',
              }}
            />
          </div>

          {/* 中央文案 */}
          <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-20 text-center md:py-24">
            {/*
              字号随视口宽度缩放（clamp），否则在 27 寸 / 4K 屏上标题会显得很小、
              被大片留白淹没。上限定在 84px，避免超宽屏上撑破版面。
            */}
            <h1
              className="font-bold leading-[1.1] tracking-tight text-ink"
              style={{ fontSize: 'clamp(38px, 5.4vw, 84px)' }}
            >
              统一 API 网关
              <br />
              <span className="text-brand">接入主流 AI 模型</span>
            </h1>

            <p
              className="mx-auto mt-7 max-w-2xl leading-relaxed text-ink/60"
              style={{ fontSize: 'clamp(15px, 1.1vw, 19px)' }}
            >
              {brand.description}
            </p>

            <div className="mt-11 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={registerUrl}
                className="inline-flex items-center gap-2 rounded-xl px-9 py-4 text-[15px] font-semibold text-white shadow-[0_14px_36px_rgba(79,70,229,0.34)] transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: 'var(--gradient-primary)' }}
              >
                开始使用
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/docs"
                className="rounded-xl border border-black/10 bg-white/80 px-7 py-4 text-[15px] font-medium text-ink backdrop-blur transition-colors hover:border-brand/30 hover:text-brand"
              >
                查看文档
              </Link>
            </div>

            {/* 常见应用支持 */}
            <div className="mt-16">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/35">
                常见应用支持
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {['Cherry Studio', 'CC Switch', 'NextChat', '更多'].map((app) => (
                  <span
                    key={app}
                    className="rounded-full border border-black/5 bg-white/70 px-3.5 py-1.5 text-xs text-ink/55 backdrop-blur"
                  >
                    {app}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============ API 接入示例（md 明确要求）============ */}
        <section
          id="api-example"
          className="relative scroll-mt-20 border-b border-black/5 bg-white pb-24 pt-6"
        >
          <div className="mx-auto max-w-4xl px-6">
            <div className="text-center">
              <span className="inline-block rounded-full border border-black/5 bg-surface-tint px-3 py-1 text-[11px] font-medium tracking-wide text-brand">
                API 接入示例
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink md:text-[32px]">
                四种协议，一套调用方式
              </h2>
              <p className="mt-3 text-sm text-ink/55">
                复制下面的示例，把地址和密钥换成你自己的就能跑
              </p>
            </div>
            <div className="mt-9">
              <CodePreview />
            </div>
          </div>
        </section>

        {/* ============ 产品介绍 + 平台能力 ============ */}
        <section className="border-b border-black/5 bg-white py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
                我们提供什么
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink/60">
                把多家模型厂商的接口统一成一套协议，按实际用量收费，
                让团队不用为每一家单独对接、单独对账。
              </p>
            </div>

            <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2">
              {capabilities.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 8.5 6.2 11.5 13 4.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink/55">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ 核心模型展示 ============ */}
        <section className="border-b border-black/5 bg-surface-tint py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
                  覆盖常见使用场景
                </h2>
                <p className="mt-3 text-base text-ink/60">
                  具体可用模型以控制台「模型广场」为准，价格与计费保持同步
                </p>
              </div>
              <Link
                href="/models"
                className="shrink-0 text-sm font-medium text-brand transition-colors hover:text-brand-hover"
              >
                查看全部模型 →
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {models.map((model) => (
                <div
                  key={model.name}
                  className="group rounded-[18px] border border-black/5 bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_12px_32px_rgba(49,46,129,0.08)]"
                >
                  <span className="inline-block rounded bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                    {model.tag}
                  </span>
                  <h3 className="mt-3.5 text-base font-semibold text-ink">
                    {model.name}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink/55">
                    {model.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ 服务优势 / 接入三步 ============ */}
        <section className="border-b border-black/5 bg-white py-20">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
              三步接入，不用重写代码
            </h2>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.no}
                  className="rounded-[20px] border border-black/5 bg-surface-tint-soft p-7 transition-colors duration-300 hover:border-brand/20"
                >
                  <span className="font-mono text-xs font-semibold text-brand">
                    {step.no}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/55">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[20px] bg-[var(--dark-surface)] p-8 md:p-10">
              <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    已经有现成代码？只改两行配置
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-white/60">
                    把 base_url 换成本平台地址、API Key 换成平台密钥，
                    其他调用逻辑一律不动。原有 SDK 继续用。
                  </p>
                </div>
                <Link
                  href="/docs"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15"
                >
                  查看接入文档 →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 定价入口 + 注册入口 ============ */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
              按实际用量付费，没有最低消费
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink/60">
              注册后即可查看实时价格表，每一次调用消耗多少、扣了多少，都能在控制台逐笔核对。
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={registerUrl}
                className="rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(79,70,229,0.3)]"
                style={{ background: 'var(--gradient-primary)' }}
              >
                进入控制台
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-black/10 bg-white px-8 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-brand/30 hover:text-brand"
              >
                查看定价
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
