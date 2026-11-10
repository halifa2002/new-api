'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { brand, loginUrl, nav, registerUrl } from '@/lib/brand';

/** 顶部导航：品牌区 + 导航项 + 登录入口 */
export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // 切换页面时收起手机端菜单
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6 2xl:h-[72px] 2xl:px-10">
        {/* 品牌区：图形 logo + 中英双行 */}
        <Link href="/" className="group flex items-center gap-2.5">
          <LogoMark />
          <span className="flex flex-col leading-none">
            <span className="text-[18px] font-bold tracking-tight text-ink 2xl:text-[20px]">
              {brand.name}
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-ink/35">
              {brand.shortName}
            </span>
          </span>
        </Link>

        {/* 导航项：当前页高亮 + hover 下划线 */}
        <nav className="hidden items-center gap-9 md:flex 2xl:gap-11">
          {nav.map((item) => {
            const active =
              !item.external &&
              (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href));

            const linkClass = `group relative py-1 text-[16px] transition-colors 2xl:text-[17px] ${
              active ? 'font-medium text-brand' : 'text-ink/70 hover:text-ink'
            }`;

            const underline = (
              <span
                className={`absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-brand transition-transform duration-300 ${
                  active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            );

            // 控制台在独立地址上，用普通 <a>，不走 Next 路由
            if (item.external) {
              return (
                <a key={item.href} href={item.href} className={linkClass}>
                  {item.label}
                  {underline}
                </a>
              );
            }

            return (
              <Link key={item.href} href={item.href} className={linkClass}>
                {item.label}
                {underline}
              </Link>
            );
          })}
        </nav>

        {/* 右侧：注册 + 登录 + 手机端菜单按钮 */}
        <div className="flex items-center gap-2">
          <Link
            href={registerUrl}
            className="hidden rounded-full px-4 py-2 text-[15px] text-ink/70 transition-colors hover:text-brand sm:block"
          >
            注册
          </Link>
          <Link
            href={loginUrl}
            className="rounded-full px-5 py-2 text-[15px] font-medium text-white 2xl:px-7 2xl:py-2.5 shadow-[0_6px_18px_rgba(79,70,229,0.28)] transition-all duration-300 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(79,70,229,0.34)]"
            style={{ background: 'var(--gradient-primary)' }}
          >
            登录
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-ink/70 transition-colors hover:border-brand/30 hover:text-brand md:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* 手机端下拉菜单：md 以下才出现 */}
      {menuOpen && (
        <div id="mobile-nav" className="border-t border-black/5 bg-white md:hidden">
          <nav className="mx-auto flex max-w-[1600px] flex-col px-6 py-3">
            {nav.map((item) => {
              const active =
                !item.external &&
                (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href));

              const itemClass = `rounded-lg px-2 py-3 text-[15px] transition-colors ${
                active ? 'font-medium text-brand' : 'text-ink/70 hover:bg-surface-tint'
              }`;

              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={itemClass}
                  >
                    {item.label}
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={itemClass}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href={registerUrl}
              onClick={() => setMenuOpen(false)}
              className="mt-1 rounded-lg border-t border-black/5 px-2 py-3 text-[15px] text-ink/70 sm:hidden"
            >
              注册
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

/** 品牌图形：靛蓝圆角方块 + 白色 Z 折线 */
function LogoMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] transition-transform duration-300 group-hover:scale-105">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 7h12L6 17h12"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** 页脚 */
export function SiteFooter() {
  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 7h12L6 17h12"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-sm font-bold text-ink">{brand.name}</span>
            </div>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-ink/55">
              {brand.description}
            </p>
          </div>

          <FooterColumn
            title="产品"
            links={[
              { label: '模型广场', href: '/models' },
              { label: '价格说明', href: '/pricing' },
              { label: '开发者文档', href: '/docs' },
            ]}
          />
          <FooterColumn
            title="支持"
            links={[
              { label: '常见问题', href: '/faq' },
              { label: '生态合作', href: '/partner' },
              { label: '服务状态', href: '/status' },
            ]}
          />
          <FooterColumn
            title="条款"
            links={[
              { label: '服务协议', href: '/terms' },
              { label: '隐私政策', href: '/privacy' },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-black/5 pt-6 text-xs text-ink/45 md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {brand.company}
          </span>
          {/* ⚠️ AGPL 要求：对外提供服务需提供源码获取入口，此处待接 */}
          <span className="flex gap-5">
            <span>{brand.icp}</span>
            <span>基于开源项目构建</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold tracking-wide text-ink">{title}</h3>
      <ul className="mt-3.5 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-xs text-ink/55 transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
