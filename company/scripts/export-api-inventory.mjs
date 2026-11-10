// 从官方 router/*.go 静态导出接口清单。
// 用法：node scripts/export-api-inventory.mjs
// 输出：docs/API-INVENTORY.md
//
// 统计口径（与 AUDIT.md 保持一致）：
//   1. 只统计 backend/router/ 下非 _test.go 文件里的注册语句；
//   2. 一条注册算一条，gin 的 Any 按 1 条计（运行时展开为多个方法）；
//   3. 循环注册的路由表（channelPermissionRoutes）与内联 handlePermissionRoute 一并计入；
//   4. 注释掉的注册语句不计；
//   5. 插件路由（plugins/tasks 下 JS 注册）属运行时动态路由，不在本清单内。

import fs from "node:fs";
import path from "node:path";
import { posix } from "node:path";

const ROOT = path.resolve(process.cwd());
const ROUTER_DIR = path.join(ROOT, "backend", "router");
const OUT_FILE = path.join(ROOT, "docs", "API-INVENTORY.md");

const METHODS = "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|Any|Handle";
const groupRe = /^\s*(\w+)\s*:?=\s*(\w+)\.Group\(\s*"([^"]*)"/;
const routeRe = new RegExp(`^\\s*(\\w+)\\.(${METHODS})\\(\\s*"([^"]*)"`);
const openRouteRe = new RegExp(`\\.(${METHODS})\\(\\s*$`);
const entryDefRe = /func\s+(register\w+)\(\s*(\w+)\s+\*gin\.RouterGroup\s*\)/;
const arrayRouteRe =
  /\{\s*method:\s*http\.Method(\w+),\s*path:\s*"([^"]*)",\s*permission:\s*([\w.]+),\s*handler:\s*([\w.]+)\s*\}/g;
const inlinePermRe =
  /handlePermissionRoute\(\s*(\w+)\.Group\(\s*"([^"]*)"[^\n]*?\),\s*http\.Method(\w+),\s*"([^"]*)"/g;

function joinPaths(absolute, relative) {
  if (!relative) return absolute || "/";
  let final = posix.normalize(posix.join(absolute || "/", relative));
  if (relative.endsWith("/") && !final.endsWith("/")) final += "/";
  return final || "/";
}

function normMethod(m) {
  if (m === "Any") return "ANY";
  if (m.startsWith("Method")) return m.slice(6).toUpperCase();
  return m.toUpperCase();
}

const files = fs
  .readdirSync(ROUTER_DIR)
  .filter((f) => f.endsWith(".go") && !f.endsWith("_test.go"))
  .sort();

// 第一遍：记录 group 声明（先不解析前缀，因为入口参数的前缀要从调用点反推）
const perFile = new Map();
for (const file of files) {
  const lines = fs.readFileSync(path.join(ROUTER_DIR, file), "utf8").split(/\r?\n/);
  const decls = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("//")) continue;
    const g = line.match(groupRe);
    if (g) decls.push({ name: g[1], parent: g[2], sub: g[3], line: i + 1 });
  }
  perFile.set(file, { lines, decls, groups: new Map() });
}

// 第二遍：参数形式的入口（registerXxx(apiRouter)），前缀从调用点反推
const entryPrefixes = new Map();
const entryDefs = [];
for (const file of files) {
  const text = perFile.get(file).lines.join("\n");
  const m = text.match(entryDefRe);
  if (m && m[2] === "apiRouter") entryDefs.push({ file, funcName: m[1], paramName: m[2] });
}
for (const def of entryDefs) {
  let found = "";
  for (const file of files) {
    for (const line of perFile.get(file).lines) {
      if (line.trim().startsWith("//")) continue;
      const call = line.match(new RegExp(`${def.funcName}\\(\\s*(\\w+)\\s*\\)`));
      if (!call) continue;
      found = perFile.get(file).groups.get(call[1]) ?? "";
      break;
    }
    if (found) break;
  }
  entryPrefixes.set(`${def.file}::${def.paramName}`, found || "/api");
}

// 第三遍：按声明顺序重算 group 前缀（入口参数用反推值兜底）
for (const file of files) {
  const { decls, groups } = perFile.get(file);
  const paramPrefix = entryPrefixes.get(`${file}::apiRouter`) ?? "";
  for (const d of decls) {
    const parentPrefix = groups.has(d.parent) ? groups.get(d.parent) : d.parent === "router" ? "" : paramPrefix;
    groups.set(d.name, joinPaths(parentPrefix, d.sub));
  }
}

const routes = [];

for (const file of files) {
  const { lines, groups } = perFile.get(file);
  const paramPrefix = entryPrefixes.get(`${file}::apiRouter`) ?? "";
  const prefixOf = (name) => {
    if (groups.has(name)) return groups.get(name);
    if (name === "router") return "";
    return paramPrefix;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim().startsWith("//")) continue;
    let line = raw;

    // 跨行注册：xxx.POST( 换行后才是路径
    if (openRouteRe.test(line) && i + 1 < lines.length) {
      line = line + lines[i + 1].trim();
    }

    const r = line.match(routeRe);
    if (r) {
      const [, groupName, method, sub] = r;
      let chunk = line;
      let depth = (chunk.match(/\(/g) || []).length - (chunk.match(/\)/g) || []).length;
      let j = i;
      while (depth > 0 && j + 1 < lines.length && j - i < 15) {
        j++;
        chunk += "\n" + lines[j];
        depth += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
      }
      const handlers = [...chunk.matchAll(/controller\.(\w+)/g)].map((m) => m[1]);
      routes.push({
        file,
        line: i + 1,
        method: normMethod(method),
        path: joinPaths(prefixOf(groupName), sub),
        handler: handlers.length ? handlers[handlers.length - 1] : "",
      });
      continue;
    }

    for (const m of raw.matchAll(inlinePermRe)) {
      const [, groupName, sub, method, routePath] = m;
      routes.push({
        file,
        line: i + 1,
        method: normMethod(method),
        path: joinPaths(joinPaths(prefixOf(groupName), sub), routePath),
        handler: "",
        note: "Casbin 权限路由",
      });
    }
  }

  // 循环注册的路由表
  const text = lines.join("\n");
  const channelPrefixMatch = text.match(/channelRoute\s*:?=\s*\w+\.Group\(\s*"([^"]*)"/);
  if (channelPrefixMatch) {
    const base = joinPaths(paramPrefix, channelPrefixMatch[1]);
    for (const m of text.matchAll(arrayRouteRe)) {
      routes.push({
        file,
        line: text.slice(0, m.index).split("\n").length,
        method: normMethod(m[1]),
        path: joinPaths(base, m[2]),
        handler: m[4].replace(/^controller\./, ""),
        note: "循环注册",
      });
    }
  }
}

// 去重
const seen = new Map();
const unique = [];
let dupCount = 0;
for (const r of routes) {
  const key = r.method + " " + r.path;
  if (seen.has(key)) {
    dupCount++;
    continue;
  }
  seen.set(key, r);
  unique.push(r);
}
unique.sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)));

function sectionOf(p) {
  const [first, second] = p.split("/").filter(Boolean);
  if (first === "api") return "管理接口 /api";
  if (first === "v1" || first === "v1beta") return "模型调用与转发 /v1、/v1beta";
  if (first === "dashboard") return "旧版计费接口 /dashboard";
  if (first === "pg") return "Playground /pg";
  if (first === "mj") return "Midjourney 兼容 /mj";
  if (first === "authz") return "权限管理 /authz";
  if (!first) return "根路径";
  return `其他 /${first}${second ? "/" + second : ""}`;
}

const sections = new Map();
for (const r of unique) {
  const s = sectionOf(r.path);
  if (!sections.has(s)) sections.set(s, []);
  sections.get(s).push(r);
}

const byMethod = {};
for (const r of unique) byMethod[r.method] = (byMethod[r.method] || 0) + 1;
const byFile = {};
for (const r of unique) byFile[r.file] = (byFile[r.file] || 0) + 1;

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const out = [];
out.push("# 官方接口清单");
out.push("");
out.push("> 对应领导文档第十章 Phase 0 交付物「官方 API 接口清单」。");
out.push("> 由 `scripts/export-api-inventory.mjs` 从 `backend/router/*.go` 静态导出，不是手抄。");
out.push(`> 生成时间：${stamp}　｜　基线：官方 v1.0.0-rc.49（commit 48a6c87）`);
out.push("");
out.push("## 统计口径");
out.push("");
out.push(`- 共 **${unique.length} 条**注册路由（同一方法同一路径只保留一条，重复 ${dupCount} 条已合并）。`);
out.push("- 一条注册算一条；gin 的 `Any` 按 1 条计（运行时展开为多个 HTTP 方法）。");
out.push("- 循环注册的路由表（`channelPermissionRoutes`，44 条）与内联 `handlePermissionRoute`（2 条）已计入。");
out.push("- 注释掉的注册语句不计；插件路由（`plugins/tasks/` 下 JS 运行时注册）不在清单内。");
out.push("- 路径为 gin 实际注册路径，含 `:id`/`*path` 占位符与尾斜杠。");
out.push("");
out.push("## 按方法分布");
out.push("");
out.push("| 方法 | 条数 |");
out.push("| --- | ---: |");
for (const [m, c] of Object.entries(byMethod).sort((a, b) => b[1] - a[1])) out.push(`| ${m} | ${c} |`);
out.push(`| **合计** | **${unique.length}** |`);
out.push("");
out.push("## 按文件分布");
out.push("");
out.push("| 文件 | 条数 |");
out.push("| --- | ---: |");
for (const [f, c] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) out.push(`| \`${f}\` | ${c} |`);
out.push("");

for (const [name, list] of sections) {
  out.push(`## ${name}（${list.length} 条）`);
  out.push("");
  out.push("| 方法 | 路径 | 处理函数 | 定义位置 | 备注 |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const r of list) {
    const loc = `\`${r.file}:${r.line}\``;
    const handler = r.handler ? `\`${r.handler}\`` : "";
    out.push(`| ${r.method} | \`${r.path}\` | ${handler} | ${loc} | ${r.note || ""} |`);
  }
  out.push("");
}

out.push("## 维护方式");
out.push("");
out.push("官方升级后重新跑一次：");
out.push("");
out.push("```powershell");
out.push("node scripts/export-api-inventory.mjs");
out.push("```");
out.push("");
out.push("导出的条数与官方代码里实际注册数应一致；条数变化时先确认 `backend/` 是否已同步到新版本。");
out.push("");

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, out.join("\n"), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      total: unique.length,
      raw: routes.length,
      dupCount,
      byMethod,
      byFile,
      sections: Object.fromEntries([...sections].map(([k, v]) => [k, v.length])),
      entryPrefixes: Object.fromEntries(entryPrefixes),
      out: OUT_FILE,
    },
    null,
    2,
  ),
);
