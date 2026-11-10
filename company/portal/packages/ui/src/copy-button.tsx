'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CopyButtonProps {
  /** 要复制的内容 */
  text: string;
  /** 按钮文案，默认「复制」 */
  label?: string;
  /** 复制成功后的提示，默认「已复制」 */
  copiedLabel?: string;
  className?: string;
}

/**
 * 通用复制按钮：官网的代码示例、控制台的 API Key 都会用。
 *
 * 放在 packages/ui 是因为两个 app 各有一套同样的实现；这里收一份，
 * 以后新增页面直接用，不再各写一遍。
 */
export function CopyButton({
  text,
  label = '复制',
  copiedLabel = '已复制',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 非安全上下文（http）或无剪贴板权限时静默失败，不打断页面
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-live="polite"
      className={
        'rounded-md border border-line px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-tint ' +
        className
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
