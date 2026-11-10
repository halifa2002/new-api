'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tokensApi, modelsApi, ApiError } from '@portal/api-client';
import type { Token } from '@portal/types';
import { ConsoleSidebar, ConsoleTopbar } from '@/components/console-chrome';
import { amountToQuota, ensureMoneySettings, formatTime, moneyUnit, quotaToAmount, quotaToAmountValue } from '@/lib/format';

/**
 * API 密钥管理 —— md 4.2 C
 *
 * 覆盖要求：创建 / 删除 / 状态 / 名称 / 额度 / 模型权限 / 创建时间 / 最后使用时间 /
 * 只完整展示一次 / 删除二次确认 / 后端校验。
 *
 * 额度换算：官方用整数 quota 记账；1 单位货币折算多少 quota、是否再乘汇率，
 * 都从后端 /api/status 取（见 lib/format.ts 的 ensureMoneySettings）。
 * 用户按界面显示的单位填金额，提交前由 amountToQuota 换算回 quota。
 */

const STATUS_LABEL: Record<number, string> = {
  1: '启用',
  2: '禁用',
  3: '已过期',
  4: '额度耗尽',
};

interface Draft {
  id?: number;
  name: string;
  unlimited: boolean;
  amount: string;
  limitModels: boolean;
  selected: string[];
  /** IP 白名单，一行一个，支持 CIDR；空表示不限制来源 */
  allowIps: string;
  /** 过期天数：-1 永不过期，0 保持原到期时间，正数表示从现在起 N 天 */
  expireDays: number;
  /** 编辑时原来的到期时间戳，expireDays=0 时原样写回 */
  originalExpire: number;
}

const EMPTY_DRAFT: Draft = {
  name: '',
  unlimited: true,
  amount: '',
  limitModels: false,
  selected: [],
  allowIps: '',
  expireDays: -1,
  originalExpire: -1,
};

/** 把后端存的到期时间换算成下拉框的天数；对不上预设就归到「保持原到期时间」 */
const EXPIRE_PRESETS = [7, 30, 90] as const;

function expireDaysFromToken(expiredTime: number): number {
  if (!expiredTime || expiredTime < 0) return -1;
  const days = (expiredTime * 1000 - Date.now()) / 86_400_000;
  const preset = EXPIRE_PRESETS.find((item) => Math.abs(item - days) < 1.5);
  return preset ?? 0;
}

export default function KeysPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | number>('all');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await ensureMoneySettings();
      const [list, models] = await Promise.all([
        tokensApi.listTokens({ page: 1, page_size: 100 }),
        modelsApi.listUserModels().catch(() => [] as string[]),
      ]);
      setTokens(list.items ?? []);
      setAvailableModels(Array.isArray(models) ? models : []);
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

  /**
   * 官方 /api/token/ 只有分页、没有按名称或状态的筛选参数，
   * 因此一次取前 100 个在页面里筛，再本地分页。
   */
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return tokens.filter((token) => {
      if (statusFilter !== 'all' && token.status !== statusFilter) return false;
      if (!keyword) return true;
      return (
        token.name.toLowerCase().includes(keyword) ||
        token.key.toLowerCase().includes(keyword)
      );
    });
  }, [tokens, query, statusFilter]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /** 过期时间：-1 表示永不过期，其余按时间显示 */
  function expireText(expiredTime: number): string {
    if (!expiredTime || expiredTime < 0) return '永不过期';
    const expired = expiredTime * 1000 < Date.now();
    return expired ? '已过期' : formatTime(expiredTime);
  }

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT });
    setError('');
  }

  function openEdit(token: Token) {
    setDraft({
      id: token.id,
      name: token.name,
      unlimited: token.unlimited_quota,
      amount: token.unlimited_quota ? '' : quotaToAmountValue(token.remain_quota).toFixed(2),
      limitModels: token.model_limits_enabled,
      selected: token.model_limits_enabled
        ? token.model_limits.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      allowIps: token.allow_ips ?? '',
      expireDays: expireDaysFromToken(token.expired_time),
      originalExpire: token.expired_time,
    });
    setError('');
  }

  async function handleSave() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError('请填写名称');
      return;
    }
    if (!draft.unlimited && !(Number(draft.amount) > 0)) {
      setError('请填写大于 0 的额度，或勾选不限额度');
      return;
    }
    if (draft.limitModels && draft.selected.length === 0) {
      setError('选择了「仅指定模型」时，至少要选一个模型');
      return;
    }

    const payload = {
      name,
      unlimited_quota: draft.unlimited,
      remain_quota: draft.unlimited ? 0 : amountToQuota(Number(draft.amount)),
      expired_time:
        draft.expireDays === -1
          ? -1
          : draft.expireDays === 0
            ? draft.originalExpire
            : Math.floor(Date.now() / 1000) + draft.expireDays * 86400,
      model_limits_enabled: draft.limitModels,
      model_limits: draft.limitModels ? draft.selected.join(',') : '',
      allow_ips: draft.allowIps.trim(),
    };

    setSaving(true);
    setError('');
    try {
      if (draft.id) {
        await tokensApi.updateToken({ id: draft.id, ...payload });
      } else {
        await tokensApi.createToken(payload);
      }
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleReveal(token: Token) {
    try {
      const data = await tokensApi.revealTokenKey(token.id);
      setRevealed({ name: token.name, key: data.key });
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法读取密钥');
    }
  }

  async function handleDelete(token: Token) {
    // md 安全要求：删除必须二次确认
    if (!window.confirm(`确定删除「${token.name}」？删除后使用该密钥的应用会立即失效。`)) {
      return;
    }
    try {
      await tokensApi.deleteToken(token.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  return (
    <div className="min-h-screen md:pl-56">
      <ConsoleSidebar />
      <ConsoleTopbar title="API 密钥" />

      <main className="px-6 py-6">
        <div className="mx-auto max-w-[1400px]">
          {error && !draft && (
            <div className="mb-5 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-xs text-danger">
              {error}
            </div>
          )}

          {/* 页面头部 */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">管理调用凭证</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
                应用通过密钥调用本平台。可以给每个密钥单独限额、限制可用模型，
                因此给不同应用各建一个，出问题好定位。
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="shrink-0 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              新建密钥
            </button>
          </div>

          {/* 完整密钥（仅一次） */}
          {revealed && (
            <div className="mb-5 rounded-card border border-amber-300 bg-amber-50 p-5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                  !
                </span>
                <div>
                  <div className="text-sm font-medium text-ink">
                    「{revealed.name}」的完整密钥
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">
                    这是唯一一次完整显示，关掉后就看不到了。
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-amber-200 bg-white px-3 py-2.5 font-mono text-xs text-ink">
                  {revealed.key}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(revealed.key);
                    setCopied(true);
                  }}
                  className="rounded-md bg-brand px-4 py-2.5 text-xs font-medium text-white"
                >
                  {copied ? '已复制' : '复制'}
                </button>
                <button
                  type="button"
                  onClick={() => setRevealed(null)}
                  className="rounded-md border border-black/10 px-4 py-2.5 text-xs text-ink transition-colors hover:bg-white"
                >
                  我已保存
                </button>
              </div>
            </div>
          )}

          {/* 列表：表格式，字段与官方 Token 结构对齐（参考站同款信息密度） */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="按名称或密钥搜索"
                className="w-56 rounded-md border border-line px-3 py-1.5 text-xs outline-none transition-colors focus:border-brand"
              />
              <select
                value={String(statusFilter)}
                onChange={(e) => {
                  const value = e.target.value;
                  setStatusFilter(value === 'all' ? 'all' : Number(value));
                  setPage(1);
                }}
                className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand"
              >
                <option value="all">全部状态</option>
                <option value="1">启用</option>
                <option value="2">禁用</option>
                <option value="3">已过期</option>
                <option value="4">额度耗尽</option>
              </select>
            </div>
            <span className="text-xs text-ink-muted">
              {loading
                ? '加载中…'
                : filtered.length === tokens.length
                  ? `共 ${tokens.length} 个`
                  : `筛选出 ${filtered.length} 个 / 共 ${tokens.length} 个`}
            </span>
          </div>

          <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    <th className="px-4 py-2.5 font-normal">名称</th>
                    <th className="px-4 py-2.5 font-normal">状态</th>
                    <th className="px-4 py-2.5 font-normal">密钥</th>
                    <th className="px-4 py-2.5 font-normal">额度</th>
                    <th className="px-4 py-2.5 font-normal">分组</th>
                    <th className="px-4 py-2.5 font-normal">模型</th>
                    <th className="px-4 py-2.5 font-normal">创建时间</th>
                    <th className="px-4 py-2.5 font-normal">最后使用</th>
                    <th className="px-4 py-2.5 font-normal">过期</th>
                    <th className="px-4 py-2.5 text-right font-normal">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-xs text-ink-muted">
                        加载中…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-xs text-ink-muted">
                        {tokens.length === 0
                          ? '还没有密钥，点右上角「新建密钥」开始'
                          : '没有匹配的密钥'}
                      </td>
                    </tr>
                  ) : (
                    paged.map((token) => {
                      const limited = token.model_limits.split(',').filter(Boolean).length;
                      return (
                        <tr
                          key={token.id}
                          className="border-b border-line last:border-0 hover:bg-surface-subtle/60"
                        >
                          <td className="px-4 py-3 text-ink">{token.name}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={token.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <code className="max-w-[170px] truncate rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                                {token.key}
                              </code>
                              <button
                                type="button"
                                onClick={() => void handleReveal(token)}
                                className="shrink-0 text-xs text-brand transition-colors hover:text-brand-hover"
                              >
                                查看
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-ink-muted">
                            {token.unlimited_quota ? '不限额' : quotaToAmount(token.remain_quota)}
                          </td>
                          <td className="px-4 py-3 text-xs text-ink-muted">
                            {token.group || 'default'}
                          </td>
                          <td className="px-4 py-3 text-xs text-ink-muted">
                            {token.model_limits_enabled ? `限定 ${limited} 个` : '全部'}
                          </td>
                          <td className="px-4 py-3 text-xs text-ink-muted">
                            {token.created_time ? formatTime(token.created_time) : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-ink-muted">
                            {token.accessed_time ? formatTime(token.accessed_time) : '从未使用'}
                          </td>
                          <td className="px-4 py-3 text-xs text-ink-muted">
                            {expireText(token.expired_time)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => openEdit(token)}
                                className="text-xs text-brand transition-colors hover:text-brand-hover"
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(token)}
                                className="text-xs text-danger transition-opacity hover:opacity-70"
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-muted">
                <span>
                  第 {currentPage} / {totalPages} 页，每页 {pageSize} 条
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="rounded border border-line px-3 py-1 disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    className="rounded border border-line px-3 py-1 disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 新建 / 编辑弹窗 */}
      {draft && (
        <KeyDialog
          draft={draft}
          setDraft={setDraft}
          models={availableModels}
          saving={saving}
          error={error}
          onCancel={() => setDraft(null)}
          onSave={() => void handleSave()}
        />
      )}
    </div>
  );
}

function KeyDialog({
  draft,
  setDraft,
  models,
  saving,
  error,
  onCancel,
  onSave,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  models: string[];
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  const isEdit = Boolean(draft.id);
  const hint = useMemo(() => {
    if (draft.unlimited) return '不限制这个密钥能花多少，受账户余额约束';
    if (!draft.amount) return `填${moneyUnit()}金额，例如 5 表示这个密钥总共只能花 5 ${moneyUnit()}`;
    return `约 ${Number(draft.amount || 0).toFixed(2)} ${moneyUnit()}`;
  }, [draft.unlimited, draft.amount]);

  function toggleModel(name: string) {
    const has = draft.selected.includes(name);
    setDraft({
      ...draft,
      selected: has
        ? draft.selected.filter((m) => m !== name)
        : [...draft.selected, name],
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="my-8 w-full max-w-lg rounded-panel border border-line bg-surface p-6 shadow-xl">
        <h3 className="text-base font-semibold text-ink">
          {isEdit ? '编辑密钥' : '新建密钥'}
        </h3>
        <p className="mt-1 text-xs text-ink-muted">
          {isEdit ? '改完立刻生效，正在使用该密钥的应用不用改动。' : '密钥创建后只完整显示一次。'}
        </p>

        {/* 名称 */}
        <label className="mt-5 block">
          <span className="block text-xs font-medium text-ink">名称</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="例如：生产环境"
            autoFocus
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
          />
        </label>

        {/* 额度 */}
        <div className="mt-5">
          <div className="text-xs font-medium text-ink">额度上限</div>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                checked={draft.unlimited}
                onChange={() => setDraft({ ...draft, unlimited: true })}
                className="accent-[var(--brand-primary)]"
              />
              不限额度
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                checked={!draft.unlimited}
                onChange={() => setDraft({ ...draft, unlimited: false })}
                className="accent-[var(--brand-primary)]"
              />
              限制额度
              <input
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                disabled={draft.unlimited}
                inputMode="decimal"
                placeholder={`金额（${moneyUnit()}）`}
                className="w-32 rounded-md border border-line px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-brand disabled:bg-surface-subtle disabled:text-ink-muted"
              />
            </label>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-muted">{hint}</p>
        </div>

        {/* 模型权限 */}
        <div className="mt-5">
          <div className="text-xs font-medium text-ink">可用模型</div>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                checked={!draft.limitModels}
                onChange={() => setDraft({ ...draft, limitModels: false })}
                className="accent-[var(--brand-primary)]"
              />
              全部模型
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                checked={draft.limitModels}
                onChange={() => setDraft({ ...draft, limitModels: true })}
                className="accent-[var(--brand-primary)]"
              />
              仅指定模型
            </label>
          </div>

          {draft.limitModels && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-line p-2">
              {models.length === 0 ? (
                <p className="py-3 text-center text-xs text-ink-muted">
                  当前分组下没有可用模型
                </p>
              ) : (
                models.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-ink hover:bg-surface-subtle"
                  >
                    <input
                      type="checkbox"
                      checked={draft.selected.includes(m)}
                      onChange={() => toggleModel(m)}
                      className="accent-[var(--brand-primary)]"
                    />
                    <span className="truncate font-mono">{m}</span>
                  </label>
                ))
              )}
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-ink-muted">
            限定模型后，用这个密钥调其它模型会被拒绝。
          </p>
        </div>

        {/* IP 白名单 —— 官方 token.allow_ips 字段，防盗用最直接的一道 */}
        <div className="mt-5">
          <div className="text-xs font-medium text-ink">IP 白名单</div>
          <textarea
            value={draft.allowIps}
            onChange={(e) => setDraft({ ...draft, allowIps: e.target.value })}
            rows={3}
            placeholder={'一行一个 IP 或网段，例如：\n203.0.113.45\n198.51.100.0/24'}
            className="mt-1.5 w-full resize-y rounded-md border border-line px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-brand"
          />
          <p className="mt-1.5 text-[11px] text-ink-muted">
            留空表示不限制来源；填了之后只有这些地址能用这把密钥，适合放在固定服务器上的应用。
          </p>
        </div>

        {/* 过期时间 —— 之前只能显示不能设，现在可选档位 */}
        <div className="mt-5">
          <label className="block">
            <span className="block text-xs font-medium text-ink">过期时间</span>
            <select
              value={draft.expireDays}
              onChange={(e) => setDraft({ ...draft, expireDays: Number(e.target.value) })}
              className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
            >
              <option value={-1}>永不过期</option>
              <option value={7}>7 天后自动失效</option>
              <option value={30}>30 天后自动失效</option>
              <option value={90}>90 天后自动失效</option>
              {isEdit && draft.expireDays === 0 && (
                <option value={0}>保持原到期时间（{formatTime(draft.originalExpire)}）</option>
              )}
            </select>
          </label>
          <p className="mt-1.5 text-[11px] text-ink-muted">
            到期后这把密钥自动失效，适合给测试或外包临时使用。
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-subtle"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {saving ? '保存中…' : isEdit ? '保存修改' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  const isActive = status === 1;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] ${
        isActive ? 'bg-green-50 text-ok' : 'bg-surface-subtle text-ink-muted'
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
