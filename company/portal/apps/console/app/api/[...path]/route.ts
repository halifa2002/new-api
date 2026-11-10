/**
 * API 转发入口（catch-all）
 *
 * 为什么不用 rewrites / middleware：
 * - rewrites 匹配 :path* 时会吃掉地址末尾的斜杠，导致 /api/token/ 变成
 *   /api/token，后端 Gin 又 301 回 /api/token/，形成无限重定向。
 * - middleware 在 Next 16 里已是弃用命名（改用 proxy），行为不稳定。
 *
 * 这里直接用原始请求的 pathname（不做任何规范化），所以尾斜杠能原样保留；
 * 同时浏览器看到的是同域请求，不需要后端开 CORS，cookie 也能正常携带。
 */

const BACKEND = process.env.BACKEND_ORIGIN ?? 'http://localhost:3000';

export const dynamic = 'force-dynamic';

async function forward(req: Request): Promise<Response> {
  // 用原始 pathname，绝不用 params 重新拼接（拼接会丢掉尾斜杠）
  const incoming = new URL(req.url);
  const target = `${BACKEND}${incoming.pathname}${incoming.search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
    init.duplex = 'half';
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: `后端不可达（${target}）：${
          error instanceof Error ? error.message : 'unknown'
        }`,
        data: null,
      },
      { status: 502 },
    );
  }

  const outHeaders = new Headers(upstream.headers);
  // 这几个头由运行时重新计算，沿用会导致内容被二次解压或长度不符
  outHeaders.delete('content-encoding');
  outHeaders.delete('content-length');
  outHeaders.delete('transfer-encoding');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

export {
  forward as GET,
  forward as POST,
  forward as PUT,
  forward as PATCH,
  forward as DELETE,
  forward as OPTIONS,
  forward as HEAD,
};
