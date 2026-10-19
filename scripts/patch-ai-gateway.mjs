#!/usr/bin/env node
/**
 * patch-ai-gateway.mjs — 修复 @the-next-ai/ai-gateway 的流式提前封盘 bug
 *
 * 病根（2026-10-19 实盘定位）：
 *   CodeCraft 中转（gpt-5.6-sol 等）的 Chat SSE 流式行为不合规：先发
 *   `finish_reason` + usage 的块，之后才发真正的内容块。ai-gateway 的
 *   emitOpenAIResponsesFramesFromChatChunk 见到 `finishReason && usage`
 *   立即 finalize 并置 state.finished=true，后续 chunk 被
 *   `if (state.finished) return []` 全部丢弃 → 每条消息/推理步的尾部落差。
 *
 * 修复：
 *   禁用该提前 finalize。驱动循环 relayOpenAIResponsesFromOpenAIStream
 *   本来就会在 [DONE] / 流结束时 finalize，提前封盘是多余且有害的。
 *   已验证：标准顺序 / tool_calls 顺序零回归，finish 后内容的尾包完整回归。
 *
 * 补丁形状：`<state>.finishReason && <usage> && <frames>.push(...finalize(<state>))`
 *   → 前缀 `0&&` 禁用。压缩变量名随 bundle 构建而异，用 VARIANTS 列表逐一匹配，
 *   每个文件必须命中且仅命中一个变体。
 *
 * 目标文件（存在才处理，全部幂等）：
 *   1. node_modules/@the-next-ai/ai-gateway/dist/index.js（构建输入源码）
 *   2. packages/cli/dist/main/next-ai-gateway.js（CLI 运行时加载）
 *   3. packages/core/dist/main/next-ai-gateway.js（Electron 运行时加载）
 *   4. argv 追加的任意路径（如 app.asar 解包后的副本）
 *
 * 由 build:assets 自动调用；也可手动 node scripts/patch-ai-gateway.mjs [extra paths...]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 已知压缩变体（旧 → 新）。新增 bundle 版本时若匹配失败，按报错补充即可。
const VARIANTS = [
  ["e.finishReason&&s&&d.push(...hm(e))", "0&&e.finishReason&&s&&d.push(...hm(e))"],
  ["e.finishReason&&s&&f.push(...ha(e))", "0&&e.finishReason&&s&&f.push(...ha(e))"],
];
// 幂等标记：任一已打补丁形态
const PATCHED_MARKER = "0&&e.finishReason&&s&&";
// bug 形状：finishReason && <usage> && <frames>.push(...)（Chat→Responses 提前封盘）
// 若源包已打过 0&& 补丁，esbuild 打包时会把整条死代码消除 —— 产物里不再有该形状，
// 这属于“已修复”，不应报错。
const BUG_SHAPE = /finishReason&&[A-Za-z_$][\w$]*&&[A-Za-z_$][\w$]*\.push\(/;

const defaultTargets = [
  path.join(repoRoot, "node_modules", "@the-next-ai", "ai-gateway", "dist", "index.js"),
  path.join(repoRoot, "packages", "cli", "dist", "main", "next-ai-gateway.js"),
  path.join(repoRoot, "packages", "core", "dist", "main", "next-ai-gateway.js"),
];
const targets = [...defaultTargets, ...process.argv.slice(2).map((p) => path.resolve(p))];

let patched = 0;
let already = 0;
let missing = 0;
const failures = [];

for (const file of targets) {
  const rel = path.relative(repoRoot, file) || file;
  if (!fs.existsSync(file)) {
    missing += 1;
    console.log(`[skip] ${rel}（不存在）`);
    continue;
  }
  const before = fs.readFileSync(file, "utf8");
  if (before.includes(PATCHED_MARKER)) {
    already += 1;
    console.log(`[ok]   ${rel}（已打过补丁）`);
    continue;
  }
  const matched = VARIANTS.filter(([old]) => before.split(old).length - 1 === 1);
  if (matched.length !== 1) {
    if (!BUG_SHAPE.test(before)) {
      // 补丁点不存在：源包已打过补丁并在打包时被死代码消除，等价于已修复。
      already += 1;
      console.log(`[ok]   ${rel}（补丁点已被死代码消除，视为已修复）`);
      continue;
    }
    const counts = VARIANTS.map(([old]) => before.split(old).length - 1).join("/");
    failures.push(`${rel}: 变体命中数 ${counts}（需恰好一个为 1；bundle 版本可能已变，需人工核对）`);
    console.log(`[FAIL] ${rel}: 补丁点命中 ${counts}，跳过`);
    continue;
  }
  const [oldStr, newStr] = matched[0];
  fs.writeFileSync(file, before.replace(oldStr, newStr), "utf8");
  // 语法校验，防止补丁破坏 bundle
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    failures.push(`${rel}: 补丁后 node --check 失败: ${error.message}`);
    console.log(`[FAIL] ${rel}: node --check 未通过，请人工检查`);
    continue;
  }
  patched += 1;
  console.log(`[patch] ${rel}`);
}

console.log(`\n结果: ${patched} 个已打补丁, ${already} 个先前已打, ${missing} 个不存在`);
if (failures.length > 0) {
  console.error("\n失败项:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}
