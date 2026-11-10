'use client';

import { useState } from 'react';

/**
 * API 接入示例卡片 —— md 4.1 首页明确要求「API 接入示例」
 *
 * 四个协议标签对应官方支持的调用方式：
 * OpenAI 兼容（Chat）、Responses、Claude、Gemini。
 * 代码内容与真实调用格式一致，方便开发者直接复制。
 */

const TABS = ['Chat', 'Responses', 'Claude', 'Gemini'] as const;
type Tab = (typeof TABS)[number];

interface Sample {
  path: string;
  request: string;
  response: string;
}

const SAMPLES: Record<Tab, Sample> = {
  Chat: {
    path: '/v1/chat/completions',
    request: `curl -X POST "$BASE_URL/v1/chat/completions" \\
  -H "Authorization: Bearer sk-****" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "stream": true
  }'`,
    response: `{
  "choices": [{
    "message": { "content": "你好，有什么可以帮你？" }
  }],
  "usage": { "prompt_tokens": 8, "completion_tokens": 19 }
}`,
  },
  Responses: {
    path: '/v1/responses',
    request: `curl -X POST "$BASE_URL/v1/responses" \\
  -H "Authorization: Bearer sk-****" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model",
    "input": "你好"
  }'`,
    response: `{
  "output": [
    { "type": "output_text", "text": "你好，有什么可以帮你？" }
  ],
  "usage": { "total_tokens": 31 }
}`,
  },
  Claude: {
    path: '/v1/messages',
    request: `curl -X POST "$BASE_URL/v1/messages" \\
  -H "x-api-key: sk-****" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'`,
    response: `{
  "content": [{ "type": "text", "text": "你好，有什么可以帮你？" }],
  "usage": { "input_tokens": 9, "output_tokens": 18 }
}`,
  },
  Gemini: {
    path: '/v1beta/models/:model\\:generateContent',
    request: `curl -X POST "$BASE_URL/v1beta/models/your-model:generateContent" \\
  -H "x-goog-api-key: sk-****" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [{
      "parts": [{ "text": "你好" }]
    }]
  }'`,
    response: `{
  "candidates": [{
    "content": { "parts": [{ "text": "你好，有什么可以帮你？" }] }
  }],
  "usageMetadata": { "totalTokenCount": 29 }
}`,
  },
};

export function CodePreview() {
  const [tab, setTab] = useState<Tab>('Chat');
  const sample = SAMPLES[tab];

  return (
    <div className="overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-[0_18px_50px_rgba(49,46,129,0.10)]">
      {/* 协议标签 */}
      <div className="flex items-center gap-1 border-b border-black/5 px-4 pt-3">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`relative px-3 pb-2.5 text-[13px] transition-colors ${
              tab === item
                ? 'font-medium text-ink'
                : 'text-ink/45 hover:text-ink/70'
            }`}
          >
            {item}
            {tab === item && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 pb-2.5 text-[11px] text-ink/40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          200 OK
        </span>
      </div>

      {/* 请求 */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand">
            POST
          </span>
          <span className="truncate font-mono text-[11px] text-ink/50">
            {sample.path}
          </span>
        </div>
        <div className="mt-2.5 text-[10px] font-medium uppercase tracking-wider text-ink/35">
          Request
        </div>
        <pre className="mt-1.5 overflow-x-auto font-mono text-[11.5px] leading-[1.75] text-ink/85">
          <code>{highlight(sample.request)}</code>
        </pre>
      </div>

      {/* 返回 */}
      <div className="mt-3 border-t border-black/5 px-5 py-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-ink/35">
          Response
        </div>
        <pre className="mt-1.5 overflow-x-auto font-mono text-[11.5px] leading-[1.75] text-ink/85">
          <code>{highlight(sample.response)}</code>
        </pre>
      </div>

      {/* 底部状态条 */}
      <div className="flex items-center justify-between border-t border-black/5 bg-surface-tint-soft px-5 py-2.5 text-[10.5px] text-ink/40">
        <span>示例响应 · 实际以调用结果为准</span>
        <span className="font-mono">STREAM · SSE</span>
      </div>
    </div>
  );
}

/**
 * 极简着色：字符串用中性深灰，命令关键字用品牌靛蓝。
 * 不用绿色——页面整体是靛蓝系，一抹翠绿会跳出来。
 * 不引入高亮库，避免为一个静态示例增加依赖。
 */
function highlight(code: string): React.ReactNode {
  const lines = code.split('\n');
  return lines.map((line, i) => (
    <span key={i} className="block">
      {line.split(/("[^"]*")/g).map((part, j) => {
        if (!part) return null;
        if (part.startsWith('"') && part.endsWith('"')) {
          return (
            <span key={j} className="text-ink/55">
              {part}
            </span>
          );
        }
        if (/^\s*(-H|--header|-d|-X)\b/.test(part) || part === 'curl') {
          return (
            <span key={j} className="text-brand">
              {part}
            </span>
          );
        }
        return <span key={j}>{part}</span>;
      })}
    </span>
  ));
}
