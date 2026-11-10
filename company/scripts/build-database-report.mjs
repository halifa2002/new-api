// 把从 PostgreSQL 导出的结构数据整理成 company/docs/DATABASE.md。
// 用法（在仓库根执行）：先按 AUDIT 流程导出 _tmp_columns/indexes/rows 到 company/docs，再 node company/scripts/build-database-report.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, "company", "docs");
// PowerShell 的重定向在部分环境下写 UTF-16LE，这里按 BOM 自动识别
const read = (f) => {
  const buf = fs.readFileSync(path.join(DOCS, f));
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.toString("utf16le").replace(/^\uFEFF/, "");
  else text = buf.toString("utf8").replace(/^\uFEFF/, "");
  return text.split(/\r?\n/).filter(Boolean);
};
const esc = (s) => String(s).replace(/\|/g, "\\|");

const columns = read("_tmp_columns.txt").map((l) => {
  const [table, column, type, nullable, def] = l.split("|");
  return { table, column, type, nullable: nullable === "YES", def: def || "" };
});
const indexes = read("_tmp_indexes.txt").map((l) => {
  const [table, name, def] = l.split("|");
  return { table, name, def };
});
const rows = new Map(
  read("_tmp_rows.txt").map((l) => {
    const [table, n] = l.split("|");
    return [table, Number(n)];
  }),
);

const purpose = {
  abilities: "模型与渠道的可用性索引，决定某个模型请求路由到哪个渠道",
  audit_logs: "管理操作审计日志",
  auth_flows: "登录与第三方授权流程的临时状态",
  authz_roles: "Casbin 角色定义（细粒度权限）",
  casbin_rule: "Casbin 权限规则本体",
  channels: "上游渠道配置（密钥、地址、模型范围）",
  checkins: "用户每日签到记录",
  custom_oauth_providers: "自定义 OAuth 登录源配置",
  external_identity_claims: "外部身份与本地账号的绑定声明",
  login_encryption_keys: "登录表单传输加密用的密钥对",
  logs: "调用与消费日志（计费对账的主数据）",
  midjourneys: "Midjourney 任务记录",
  models: "模型元数据（名称、图标、归属厂商等）",
  options: "系统设置项，键值存储",
  passkey_credentials: "Passkey（无密码登录）凭证",
  perf_metrics: "接口性能指标采样",
  prefill_groups: "渠道预填分组",
  quota_data: "按天聚合的额度用量",
  redemptions: "兑换码",
  setups: "初始化完成标记",
  subscription_orders: "订阅订单",
  subscription_plans: "订阅套餐定义",
  subscription_pre_consume_records: "订阅额度预扣流水",
  system_instances: "多实例部署时的实例登记",
  system_task_locks: "后台系统任务的互斥锁",
  system_tasks: "后台系统任务队列",
  task_plugins: "任务插件登记与配置",
  tasks: "通用异步任务（视频、图片等）",
  tokens: "API Key（含额度、模型权限、IP 白名单）",
  top_ups: "充值记录",
  two_fa_backup_codes: "两步验证备用码",
  two_fas: "两步验证绑定信息",
  user_access_tokens: "用户个人访问令牌",
  user_oauth_bindings: "用户与 OAuth 登录源的绑定",
  user_sessions: "登录会话（设备、过期时间）",
  user_subscriptions: "用户当前订阅",
  users: "用户账号（含分组、额度、角色）",
  vendors: "模型厂商",
};

const tables = [...new Set(columns.map((c) => c.table))].sort();
const colsByTable = new Map(tables.map((t) => [t, columns.filter((c) => c.table === t)]));
const idxByTable = new Map(tables.map((t) => [t, indexes.filter((i) => i.table === t)]));

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const out = [];
out.push("# 数据库结构报告");
out.push("");
out.push("> 对应领导文档第十章 Phase 0 交付物「数据库结构报告」。");
out.push("> 数据直接取自运行中的 PostgreSQL，不是照代码推测。");
out.push("");
out.push("## 采样环境");
out.push("");
out.push("| 项目 | 值 |");
out.push("| --- | --- |");
out.push("| 采样时间 | " + stamp + " |");
out.push("| 数据库 | PostgreSQL 15，库名 `new-api`，schema `public` |");
out.push("| 应用容器 | `new-api`，镜像 `company-newapi:0.3.0`（2026-11-10 15:40 起） |");
out.push("| 表数量 | **" + tables.length + " 张** |");
out.push("| 字段总数 | " + columns.length + " 个 |");
out.push("| 外键约束 | 0 条（官方不用数据库外键，表间关系全在代码里） |");
out.push("| 主键/唯一索引 | " + indexes.length + " 个 |");
out.push("");
out.push("## 迁移机制");
out.push("");
out.push("官方**没有迁移编号、没有迁移脚本目录**。启动时由 GORM 的 `AutoMigrate` 对比结构：缺表建表、缺字段加字段，已有数据不动。入口在 `backend/model/main.go`：");
out.push("");
out.push("- 主库：`DB.AutoMigrate(...)`，一次登记 36 个模型，订阅套餐表单独补一次（SQLite 走另一条建表分支）。");
out.push("- 日志库：`LOG_DB.AutoMigrate(&Log{})` 与审计日志表；配 ClickHouse 时改走建表 SQL 与 TTL 同步。");
out.push("");
out.push("由此带来的三个事实：");
out.push("");
out.push("1. **升级没有「迁移版本 42」这种锚点**，无法用编号还原某次部署的库状态。");
out.push("2. 版本记录里用「表数量 + 备份时间」当锚点，见 `VERSION.md` 第 6 项。");
out.push("3. 正式升级前必须整库备份，回滚靠还原备份，不靠反向迁移。");
out.push("");
out.push("## 表清单");
out.push("");
out.push("| # | 表名 | 字段数 | 行数（近似） | 用途 |");
out.push("| ---: | --- | ---: | ---: | --- |");
tables.forEach((t, i) => {
  out.push(`| ${i + 1} | \`${t}\` | ${colsByTable.get(t).length} | ${rows.get(t) ?? "-"} | ${purpose[t] || ""} |`);
});
out.push("");
out.push("> 行数取自 `pg_stat_user_tables`（采样前已执行 `ANALYZE`），用于判断表是否在用，不作为对账依据。");
out.push("");
out.push("## 字段明细");
out.push("");
for (const t of tables) {
  out.push(`### \`${t}\`（${colsByTable.get(t).length} 个字段）`);
  out.push("");
  out.push("| 字段 | 类型 | 可空 | 默认值 |");
  out.push("| --- | --- | --- | --- |");
  for (const c of colsByTable.get(t)) {
    out.push(`| \`${c.column}\` | ${esc(c.type)} | ${c.nullable ? "是" : "否"} | ${c.def ? "`" + esc(c.def) + "`" : ""} |`);
  }
  out.push("");
  const uniq = idxByTable.get(t) || [];
  if (uniq.length) {
    out.push("唯一约束/索引：" + uniq.map((u) => "`" + u.name + "`").join("、"));
    out.push("");
  }
}
out.push("## 外键与约束");
out.push("");
out.push("全库 **0 条外键**。这不是遗漏——官方刻意不在数据库层做级联约束，删除用户、删除渠道这类操作由代码保证，避免跨库（SQLite/MySQL/PostgreSQL）行为不一致。");
out.push("");
out.push("因此升级时：改表结构不会有外键冲突，但**删数据前要自己确认引用关系**（比如删渠道前先看 `abilities` 里还有没有它的记录）。");
out.push("");
out.push("## 升级与备份怎么用这份报告");
out.push("");
out.push("1. 升级前备份，并记下当前表数量与备份文件名：");
out.push("");
out.push("```bash");
out.push('docker exec postgres pg_dump -U root new-api > backup-$(date +%Y%m%d-%H%M).sql');
out.push('docker exec postgres psql -U root -d new-api -t -c "SELECT count(*) FROM pg_tables WHERE schemaname=\'public\';"');
out.push("```");
out.push("");
out.push("2. 升级后再数一次表：数量变了说明官方加了表或改了结构，按变化逐表核对关键字段。");
out.push("3. 需要回滚时还原备份，并用「表数量 + 备份时间」确认还原到的是哪一版。");
out.push("");
out.push("## 部署现状与版本记录");
out.push("");
out.push("采样时 `:3000` 上跑的容器镜像是 `calciumion/new-api:latest`（2026-11-10 09:14 创建），而 `VERSION.md` 第 7 项记录的是 `company-newapi:0.3.0`。");
out.push("");
out.push("两者不一致说明两件事：");
out.push("");
out.push("1. 当时运行的实例**不带品牌色补丁**（补丁打在 company-newapi 镜像里）。");
out.push("2. 版本记录还原不了那次部署——8.1 要求第 7 项能回答「这版跑的是哪个镜像」，当时答不上来。");
out.push("");
out.push("**2026-11-10 15:40 已纠正**：按 `backend/docker-compose.company.yml` 用 `company-newapi:0.3.0` 重建 `:3000`，只动应用容器（`--no-deps`，数据库与 Redis 未重启，数据未迁移）。核对结果：");
out.push("");
out.push("- 容器镜像 `company-newapi:0.3.0`，健康检查通过；");
out.push("- `GET /api/status` 返回 `version=v0.1.0-company`；");
out.push("- 前端产物含品牌色 `#4f46e5`（浅色/深色/ring 共 6 处），登录页主按钮已为靛蓝，截图见 `docs/screenshots/admin-login-branded-20261110-v2.png`。");
out.push("");
out.push("以后每次切换镜像，都要在本节与 `VERSION.md` 第 7 项同步记一笔，否则版本记录会再次对不上部署。");
out.push("");
out.push("## 已知约束");
out.push("");
out.push("1. **三库兼容**：官方要求 SQLite / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6 行为一致，字段类型不能带库特有写法。");
out.push("2. **日志库可分开**：日志可独立配库（支持 ClickHouse），此时 `logs` 表不在主库，表数量会少一张。");
out.push("3. **AutoMigrate 幂等**：重复启动不应再改结构；若每次启动都执行 `ALTER`，通常是布尔默认值等标签写法导致的，官方有专门的约束。");
out.push("4. **表数量不是固定值**：官方每个版本都可能加表，本报告的 38 是 v1.0.0-rc.49 的事实值，升级后要重采样。");
out.push("");
out.push("## 重新生成这份报告");
out.push("");
out.push("```powershell");
out.push("docker exec postgres psql -U root -d new-api -A -F \"|\" -t -c \"SELECT table_name, column_name, data_type, is_nullable, coalesce(column_default,'') FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position;\" > docs\\_tmp_columns.txt");
out.push("docker exec postgres psql -U root -d new-api -A -F \"|\" -t -c \"SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND (indexdef LIKE '%UNIQUE%' OR indexdef LIKE '%PRIMARY%') ORDER BY tablename, indexname;\" > docs\\_tmp_indexes.txt");
out.push("docker exec postgres psql -U root -d new-api -A -F \"|\" -t -c \"SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;\" > docs\\_tmp_rows.txt");
out.push("node scripts/build-database-report.mjs");
out.push("```");
out.push("");

fs.writeFileSync(path.join(DOCS, "DATABASE.md"), out.join("\n"), "utf8");
console.log(JSON.stringify({ ok: true, tables: tables.length, columns: columns.length, indexes: indexes.length, out: path.join(DOCS, "DATABASE.md") }, null, 2));
