/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = {
  children: React.ReactNode
}

/**
 * 认证页外壳。
 *
 * 布局参考公司官网预览页（apps/website/preview/home）的视觉语言：
 * 浅色云图品牌侧栏 + 浅色表单区，主色用品牌靛蓝，留白充足。
 * 小屏（< lg）收起侧栏，只保留顶部品牌行，避免表单被挤到首屏之外。
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  const highlights = [
    t('Three protocols share one endpoint'),
    t('Usage and billing stay in sync with the backend'),
    t('Self-hosted: your data stays yours'),
  ]

  return (
    <div className='grid min-h-svh lg:grid-cols-[1.1fr_1fr]'>
      <aside className='relative hidden flex-col justify-between overflow-hidden bg-slate-50 px-12 py-14 text-slate-900 lg:flex'>
        {/* 复用官网首屏那张云图（apps/website/public/hero/canvas-cool.webp），
            压一层深蓝渐变后当暗底纹理，与官网「收尾 CTA」的做法一致。 */}
        <div
          aria-hidden='true'
          className='absolute inset-0 bg-cover bg-center bg-no-repeat'
          style={{ backgroundImage: "url('/login-hero.webp')" }}
        />
        <div
          aria-hidden='true'
          className='absolute inset-0 bg-gradient-to-br from-white/45 via-white/15 to-indigo-900/25'
        />
        {/* 底部压暗：保住「管理后台 · 仅限授权人员」这行小字的对比度 */}
        <div
          aria-hidden='true'
          className='absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-white/80 via-white/35 to-transparent'
        />

        <Link
          to='/'
          className='relative z-10 flex items-center gap-3 transition-opacity hover:opacity-90'
        >
          <div className='flex size-11 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200'>
            {loading ? (
              <Skeleton className='size-full' />
            ) : (
              <img
                src={logo}
                alt={t('Logo')}
                className='size-full object-cover'
              />
            )}
          </div>
          <div className='leading-tight'>
            {loading ? (
              <Skeleton className='h-5 w-28' />
            ) : (
              <p className='text-lg font-semibold tracking-tight'>
                {systemName}
              </p>
            )}
            <p className='text-[11px] font-medium tracking-[0.18em] text-slate-500'>
              CHONGDONG AI
            </p>
          </div>
        </Link>

        <div className='relative z-10 space-y-6'>
          <h2 className='max-w-md text-3xl leading-snug font-semibold tracking-tight text-slate-900'>
            {t('Unified access to mainstream AI models')}
          </h2>
          <ul className='space-y-3 text-sm text-slate-600'>
            {highlights.map((item) => (
              <li key={item} className='flex items-start gap-2.5'>
                <span
                  aria-hidden='true'
                  className='mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-500'
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className='relative z-10 text-xs font-medium text-slate-600'>
          {t('Admin console · authorized staff only')}
        </p>
      </aside>

      <main className='bg-background flex flex-col justify-center px-6 py-12 sm:px-10'>
        <div className='mx-auto w-full max-w-[26rem]'>
          <div className='mb-8 flex items-center gap-2.5 lg:hidden'>
            <div className='size-9 overflow-hidden rounded-lg'>
              <img src={logo} alt={t('Logo')} className='size-full object-cover' />
            </div>
            <p className='text-base font-semibold'>{systemName}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

