/**
 * 品牌常量
 *
 * ⚠️ 全部为占位值，等公司定名后只改这一个文件。
 */

export const brand = {
  /** 平台名（待定） */
  name: '虫洞 AI',
  /** 英文名/短标识（待定），显示在中文名下方 */
  shortName: 'CHONGDONG AI',
  /** 一句话定位（待定） */
  tagline: '统一接口，接入主流 AI 模型',
  /** 副标题说明 */
  description:
    '一个 Key 调用多家模型，按量计费，用量透明。为企业与开发者提供稳定的 AI 能力接入。',
  /** 公司主体（待定） */
  company: '待定公司名称',
  /** 备案号（待定） */
  icp: '待定',
  /** 客服邮箱（待定） */
  email: 'support@example.com',
} as const;

/**
 * 用户控制台地址
 *
 * 开发时控制台跑在独立端口；上线后应改为同域路径（例如 /console），
 * 改这里一处即可，不用翻页面。
 */
export const consoleBase =
  process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3002';

/**
 * API 网关地址（文档与代码示例里展示的地址）
 *
 * 上线换成正式域名后只改这一处。
 */
export const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.example.com';

/** 登录入口 */
export const loginUrl = `${consoleBase}/login`;
/** 注册入口：后端 register_enabled = true，用户可自助注册 */
export const registerUrl = `${consoleBase}/register`;
/** 控制台首页（未登录时控制台自己跳登录） */
export const consoleUrl = consoleBase;

export interface NavItem {
  label: string;
  href: string;
  /** 站外链接（控制台在独立域名/端口），用 <a> 渲染且不参与当前页高亮 */
  external?: boolean;
}

/**
 * 顶部导航。
 *
 * 「首页」放最前：不是所有访客都知道点 logo 能回首页（参考站省掉首页是赌用户习惯，
 * 我们的访客不是天天泡这类站的开发者，这个赌不值得打）。
 * 「控制台」放第二位：紧跟首页，是产品的实际入口，越靠前越容易被点到；
 * 后面的模型广场/价格/文档/生态合作/关于属于内容页。
 */
export const nav: ReadonlyArray<NavItem> = [
  { label: '首页', href: '/' },
  { label: '控制台', href: consoleUrl, external: true },
  { label: '模型广场', href: '/models' },
  { label: '价格', href: '/pricing' },
  { label: '文档', href: '/docs' },
  { label: '生态合作', href: '/partner' },
  { label: '关于', href: '/about' },
];
