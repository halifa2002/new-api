import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { brand } from '@/lib/brand';
import { MODEL_CATALOG } from '@/lib/model-catalog';
import { loadModelList } from '@/lib/pricing';

export const metadata = { title: '关于' };

const PRINCIPLES = [
  {
    title: '一个接口',
    desc: '不做各家 SDK 的搬运工，把差异收在网关里，业务侧只面对一套协议。',
  },
  {
    title: '账要算清',
    desc: '每次调用消耗多少 token、扣多少钱，用户自己能查得到，不用问客服。',
  },
  {
    title: '只上真能用的',
    desc: '没接通的模型不摆上货架，页面上写着的模型，接口就真的能调。',
  },
];

/**
 * 关于我们。
 *
 * 只写能确认的事实：平台现状的数字从后端实时算，没确认的公司信息（成立时间、
 * 团队规模等）不编，统一走 brand 里的占位字段。
 */
export default async function AboutPage() {
  const { models } = await loadModelList(MODEL_CATALOG);
  const vendorCount = new Set(models.map((model) => model.vendorName)).size;

  const facts = [
    { label: '已接入模型', value: models.length > 0 ? `${models.length}` : '—' },
    { label: '上游厂商', value: vendorCount > 0 ? `${vendorCount}` : '—' },
    { label: '接口协议', value: 'OpenAI 兼容' },
    { label: '计费方式', value: '按量计费' },
  ];

  return (
    <>
      <SiteHeader />

      <main>
        {/* ─── Hero ─── */}
        <section
          className="relative overflow-hidden border-b border-black/5"
          style={{
            background:
              'var(--gradient-hero)',
          }}
        >
          <div className="relative mx-auto max-w-4xl px-6 py-20 text-center md:py-24">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-white/70 px-3.5 py-1 text-xs font-medium tracking-wide text-brand">
              ABOUT · 关于我们
            </span>

            <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              <span className="text-ink">{brand.tagline}</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-ink/60 md:text-base">
              {brand.description}
            </p>
          </div>
        </section>

        {/* ─── 我们做什么 ─── */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-2xl font-bold text-ink">我们做什么</h2>
          <div className="mt-5 space-y-4 text-[15px] leading-[1.9] text-ink/65">
            <p>
              {brand.name} 是一个 AI 模型 API 聚合平台。上游接各家大模型，
              下面对开发者提供一个统一的、兼容 OpenAI 的接口—— 换模型只改一个
              字符串，不用重写业务代码。
            </p>
            <p>
              平台的定位很具体：不自己训练模型，而是把「接哪家、怎么计费、用量怎么看」
              这些琐碎的事收进网关，让业务侧只关心自己的产品。
            </p>
            <p>
              价格和模型清单直接来自后台的计费配置，页面上写多少，下单就扣多少；
              后台改了价格，站点重新发布即同步。
            </p>
          </div>
        </section>

        {/* ─── 平台现状（数字来自后端，不是写死的宣传语） ─── */}
        <section className="border-y border-black/5 bg-white py-12">
          <div className="mx-auto max-w-4xl px-6">
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dd className="text-2xl font-bold text-ink">{fact.value}</dd>
                  <dt className="mt-1 text-xs text-ink/45">{fact.label}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs text-ink/40">
              以上数字实时取自平台模型目录，不包含未接入的模型。
            </p>
          </div>
        </section>

        {/* ─── 原则 ─── */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-bold text-ink">我们坚持的几件事</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <div key={item.title} className="rounded-xl border border-black/5 bg-surface-tint-soft p-6">
                <h3 className="text-base font-bold text-ink">{item.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink/60">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 联系 ─── */}
        <section className="mx-auto max-w-4xl px-6 pb-20">
          <div className="rounded-2xl bg-[var(--dark-surface)] p-8 text-white md:p-10">
            <h2 className="text-xl font-bold">联系我们</h2>
            <div className="mt-5 grid gap-2.5 text-sm text-white/70 sm:grid-cols-2">
              <p>公司：{brand.company}</p>
              <p>
                邮箱：
                <a href={`mailto:${brand.email}`} className="text-white/90 hover:underline">
                  {brand.email}
                </a>
              </p>
              <p>备案：{brand.icp}</p>
            </div>
            <p className="mt-6 text-xs text-white/40">
              公司主体、备案号与联系邮箱待公司资料确认后替换。
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
