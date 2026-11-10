'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, ApiError } from '@portal/api-client';
import { brand, siteUrl } from '@/lib/brand';

/**
 * 注册页 —— md 第十章 Phase 2 第 1 步
 *
 * 后端当前状态（实测 /api/status）：
 *   register_enabled = true、password_register_enabled = true、email_verification = false
 * 所以只需要用户名 + 密码；若管理员日后开启邮箱验证，这里要补邮箱与验证码字段。
 */
export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (password !== password2) {
      setError('两次输入的密码不一致');
      return;
    }
    if (username.trim().length > 20) {
      setError('用户名最多 20 个字符');
      return;
    }
    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        username: username.trim(),
        password,
        password2,
      });
      // 注册成功后直接登录，省掉再输一次
      await authApi.login({ username: username.trim(), password });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '注册失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white">
            {brand.initial}
          </span>
          <h1 className="mt-4 text-xl font-semibold text-ink">创建账号</h1>
          <p className="mt-1.5 text-xs text-ink-muted">
            注册后即可创建 API 密钥、查看用量与账单
          </p>
          {/* 注册页同样要能回官网 */}
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
          <Field
            label="用户名"
            type="text"
            value={username}
            onChange={setUsername}
            placeholder="用于登录，注册后不可修改"
            autoComplete="username"
            maxLength={20}
          />
          <Field
            label="密码"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="至少 8 位"
            autoComplete="new-password"
            className="mt-4"
          />
          <Field
            label="确认密码"
            type="password"
            value={password2}
            onChange={setPassword2}
            placeholder="再输入一次"
            autoComplete="new-password"
            className="mt-4"
          />

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
            {loading ? '注册中…' : '注册并登录'}
          </button>

          <p className="mt-4 text-center text-xs text-ink-muted">
            已有账号？
            <Link href="/login" className="ml-1 text-brand">
              直接登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  maxLength,
  className,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <label className={`block text-xs font-medium text-ink ${className ?? ''}`}>
      {label}
      <input
        type={type}
        required
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
      />
    </label>
  );
}
