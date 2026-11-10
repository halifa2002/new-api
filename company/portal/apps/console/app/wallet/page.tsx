'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, billingApi, ApiError } from '@portal/api-client';
import type { SelfUser } from '@portal/types';
import { ConsoleSidebar, ConsoleTopbar } from '@/components/console-chrome';
import { ensureMoneySettings, quotaToAmount } from '@/lib/format';

/** 充值与余额 —— md 4.2 G（优先沿用官方充值能力） */
export default function WalletPage() {
  const router = useRouter();
  const [user, setUser] = useState<SelfUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await ensureMoneySettings();
      const me = await authApi.getSelf();
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRedeem(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setRedeeming(true);
    setError('');
    setNotice('');
    try {
      await billingApi.redeemTopUpCode(code.trim());
      setCode('');
      setNotice('兑换成功，余额已更新');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '兑换失败');
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="min-h-screen md:pl-56">
      <ConsoleSidebar />
      <ConsoleTopbar title="充值" balance={user ? quotaToAmount(user.quota) : undefined} />

      <main className="px-6 py-6">
        {error && (
          <div className="mb-5 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-xs text-danger">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-5 rounded-card border border-green-200 bg-green-50 px-4 py-3 text-xs text-ok">
            {notice}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="text-xs text-ink-muted">当前余额</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-ink">
              {loading ? '…' : user ? quotaToAmount(user.quota) : '—'}
            </div>
          </div>
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="text-xs text-ink-muted">累计已用</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-ink">
              {loading ? '…' : user ? quotaToAmount(user.used_quota) : '—'}
            </div>
          </div>
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="text-xs text-ink-muted">累计请求</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-ink">
              {loading ? '…' : user ? user.request_count : '—'}
            </div>
          </div>
        </div>

        {/* 兑换码充值 */}
        <div className="mt-6 rounded-card border border-line bg-surface p-6">
          <h2 className="text-sm font-medium text-ink">使用兑换码充值</h2>
          <p className="mt-1.5 text-xs text-ink-muted">
            向管理员获取兑换码，输入后额度立即到账。
          </p>
          <form onSubmit={handleRedeem} className="mt-4 flex flex-wrap gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="输入兑换码"
              className="w-72 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={redeeming || !code.trim()}
              className="rounded-md bg-brand px-5 py-2 text-sm text-white disabled:opacity-50"
            >
              {redeeming ? '兑换中…' : '立即兑换'}
            </button>
          </form>
        </div>

        {/* 在线支付说明 */}
        <div className="mt-6 rounded-card border border-line bg-surface-subtle p-6">
          <h2 className="text-sm font-medium text-ink">在线支付</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            官方后端内置多种支付通道（Epay / Stripe / Creem / Waffo 等），
            是否开启取决于管理员在后台的配置。开启后此页会出现对应支付入口；
            未开启时请使用上面的兑换码方式。
          </p>
        </div>
      </main>
    </div>
  );
}
