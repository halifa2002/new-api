'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authApi, setAccessToken } from '@portal/api-client';
import { brand, docsUrl, pricingUrl, siteUrl } from '@/lib/brand';

/**
 * 控制台侧边导航
 * 对应 md 4.2 的 A–G 七个模块
 *
 * 2026-11-10 改版：原来每项是「标题 + 一行说明」两行，七个两行块堆在一起
 * 显得又高又碎。参考站的做法是单行 + 小图标 + 均匀行距，扫起来快一倍。
 * 说明文字没有删，挪到 title 里，鼠标停一下还能看到。
 */
const items = [
  {
    href: '/',
    label: '概览',
    hint: '余额、消费、调用量',
    icon: (
      <path d="M3 13h4l2.5-7 3.5 12 2.5-5H21" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: '/models',
    label: '可用模型',
    hint: '你能调用的模型与价格',
    icon: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
      </>
    ),
  },
  {
    href: '/keys',
    label: 'API 密钥',
    hint: '创建与管理 Key',
    icon: (
      <>
        <circle cx="8" cy="12" r="4" />
        <path d="M12 12h9m-3 0v3m-3-3v2" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: '/usage',
    label: '用量统计',
    hint: '按天/模型/Key',
    icon: (
      <>
        <path d="M4 20V10m5 10V5m5 15v-7m5 7V8" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: '/billing',
    label: '消费记录',
    hint: '逐笔明细',
    icon: (
      <>
        <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h6" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: '/wallet',
    label: '充值',
    section: '账户',
    hint: '余额与充值',
    icon: (
      <>
        <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
        <path d="M3.5 10h17" />
        <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    href: '/settings',
    label: '账户设置',
    section: '账户',
    hint: '资料与安全',
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" strokeLinecap="round" />
      </>
    ),
  },
] as const;

/**
 * 品牌首字来自 lib/brand.ts，与官网 lib/brand.ts 的 name 对应。
 * 此前写死「智」，改名后控制台还挂着旧品牌。
 */
const BRAND_INITIAL = brand.initial;

/**
 * 顶栏站点导航，与官网顶栏**逐项一致**（首页 · 控制台 · 模型广场 · 价格 · 文档 · 生态合作 · 关于）。
 *
 * 为什么必须一致：用户在官网和控制台之间来回跳，两套不同的菜单等于要重新认一次路。
 * 参考站就是这么做的——站点导航在两边保持同一套项目与顺序。
 *
 * 左侧栏的「模型广场」已改名「可用模型」，避免和顶栏的站点页同名不同去向。
 * 站点链接一律新标签页打开：控制台不卸载，登录态与手头进度都不受影响。
 */
const SITE_LINKS = [
  { label: '首页', href: siteUrl },
  { label: '模型广场', href: `${siteUrl}/models` },
  { label: '价格', href: pricingUrl },
  { label: '文档', href: docsUrl },
  { label: '生态合作', href: `${siteUrl}/partner` },
  { label: '关于', href: `${siteUrl}/about` },
];

/** 取某一项所属的小节名；没有声明小节的项目归到上一组 */
function sectionOf(entry: (typeof items)[number]): string | undefined {
  return 'section' in entry ? (entry as { section?: string }).section : undefined;
}

export function ConsoleSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed bottom-0 left-0 top-16 hidden w-56 border-r border-line bg-surface md:block">
      <nav className="px-3 py-4">
        {items.map((item, index) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          // 只在分组变化时打一次小标题（参考站那种「聊天 / 常规 / 个人」的节奏）
          const section = sectionOf(item);
          const previous = index > 0 ? sectionOf(items[index - 1]) : undefined;
          const showSection = Boolean(section) && section !== previous;

          return (
            <div key={item.href}>
              {showSection && (
                <div className="mx-3 mb-1 mt-4 text-[11.5px] font-medium text-ink-muted">{section}</div>
              )}
              <Link
                href={item.href}
                title={item.hint}
                className={`mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-[10px] text-[14.5px] transition-colors ${
                  active
                    ? 'bg-surface-subtle font-medium text-ink'
                    : 'text-ink-muted hover:bg-surface-subtle/70 hover:text-ink'
                }`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden
                  className={active ? 'text-ink' : 'text-ink-muted'}
                >
                  {item.icon}
                </svg>
                <span className="truncate">{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export function ConsoleTopbar({
  title,
  balance,
}: {
  title: string;
  balance?: string;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick() {
      setMenuOpen(false);
    }
    // 延后一拍绑定，否则打开菜单的这次点击会立刻把它关掉
    const timer = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onDocClick);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authApi.logout();
    } catch {
      // 后端登出失败也要让本地退出，否则页面卡住
    } finally {
      setAccessToken(null);
      router.replace('/login');
    }
  }

  return (
    <>
      {/*
        全宽固定顶栏，版式与官网顶栏保持一致：
        品牌靠左 · 导航居中 · 账户靠右，字号同为 16px。
        之前导航紧贴 logo 左边、字号 15px，和官网不成一套。
      */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6 2xl:h-[72px] 2xl:px-10">
          <a href={siteUrl} className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-sm font-semibold text-white">
              {BRAND_INITIAL}
            </span>
            <span className="hidden text-[18px] font-bold tracking-tight text-ink sm:inline">
              {brand.name}
            </span>
          </a>

          <nav className="hidden items-center gap-9 md:flex 2xl:gap-11">
            {/* 首页 → 控制台（当前）→ 其余站点页，与官网顶栏顺序完全一致 */}
            <a
              href={siteUrl}
              target="_blank"
              rel="noreferrer"
              className="py-1 text-[16px] text-ink-muted transition-colors 2xl:text-[17px] hover:text-ink"
            >
              首页
            </a>
            <Link
              href="/"
              className="relative py-1 text-[16px] font-medium text-brand 2xl:text-[17px]"
            >
              控制台
              <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-brand" />
            </Link>
            {SITE_LINKS.slice(1).map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="py-1 text-[16px] text-ink-muted transition-colors 2xl:text-[17px] hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4 text-sm text-ink-muted">
          <span className="hidden sm:inline">余额 {balance ?? '—'}</span>

          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="账户菜单"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-subtle text-xs text-ink-muted transition-colors hover:bg-brand-soft hover:text-brand"
            >
              我
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-10 w-36 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg"
              >
                <Link
                  href="/settings"
                  role="menuitem"
                  className="block px-3 py-2 text-xs text-ink transition-colors hover:bg-surface-subtle"
                >
                  账户设置
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                  className="block w-full px-3 py-2 text-left text-xs text-danger transition-colors hover:bg-surface-subtle disabled:opacity-60"
                >
                  {signingOut ? '退出中…' : '退出登录'}
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </header>

      {/* 给固定顶栏让位；页面标题跟随内容滚动，不占用固定高度 */}
      <div className="h-16" />
      <div className="mb-5 mt-6 px-6">
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
      </div>
    </>
  );
}
