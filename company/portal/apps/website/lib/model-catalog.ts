/**
 * 模型目录（官网侧入口）
 *
 * 2026-11-10 目录本体移到共享包 `@portal/types/src/model-catalog.ts`：
 * 控制台的模型广场（文档 4.2 B）也要用同一份分类与能力标签，
 * 两个前端各存一份迟早会漂移。
 *
 * 这里保留一层转发，官网原有的 `@/lib/model-catalog` 导入不用改。
 */
export * from '@portal/types';
