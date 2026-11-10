'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, ApiError } from '@portal/api-client';
import { brand, siteUrl } from '@/lib/brand';

/** 登录页 —— md 第十章 Phase 2 第 1 步 */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.login({ username, password });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white">
            {brand.initial}
          </span>
          <h1 className="mt-4 text-xl font-semibold text-ink">登录控制台</h1>
          <p className="mt-1.5 text-xs text-ink-muted">
            使用平台账号登录，管理密钥与用量
          </p>
          {/* 登录页也要能回官网：新访客点错入口时不该被关在这里 */}
          <a
            href={siteUrl}
            className="mt-3 inline-block text-xs text-ink-muted transition-colors hover:text-brand"
          >
            ← 返回官网
          </a>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-panel border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
        >
          <label className="block text-xs font-medium text-ink">
            用户名
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
              placeholder="请输入用户名"
            />
          </label>

          <label className="mt-4 block text-xs font-medium text-ink">
            密码
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
              placeholder="请输入密码"
            />
          </label>

          {error && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-md bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {loading ? '登录中…' : '登录'}
          </button>

          <p className="mt-4 text-center text-xs text-ink-muted">
            还没有账号？
            <Link href="/register" className="ml-1 text-brand">
              立即注册
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
