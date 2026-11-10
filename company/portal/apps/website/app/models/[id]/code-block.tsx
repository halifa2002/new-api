'use client';

import { useState } from 'react';

/** 带复制按钮的代码块 */
export function CodeBlock(props: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // 剪贴板不可用（非 HTTPS 等）时保持原文可手动选中复制，不做提示
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--code-surface)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs text-white/45">{props.label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded px-2 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-xs leading-relaxed text-white/85">
        <code>{props.code}</code>
      </pre>
    </div>
  );
}
