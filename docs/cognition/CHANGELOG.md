# 本地变更日志（Changelog）

> 追加式：只增不改，记录“在官方 3.1.3 之上改了什么、为什么、影响哪”。认知层本身的变更亦记于此。

## [v1] 2026-10-19 — 认知层建立 + 3 次修复 + 隔离身份（未推）

### 基准
- 官方 `3.1.3`（`057abaa1`，`3b0aebf3 Release v3.1.3`）。

### 变更

#### 1) 可观测性 — Codex 日志合并修复（`bf35654`，已推）
- **文件**：`packages/core/src/observability/raw-trace-sync.ts:1650`
- **前**：`requestId = x-client-request-id || turnKey || bundleId`，同会话 `turnKey` 复用致 `UPDATE WHERE requestId=turnKey` 把 N 次请求坍缩为 1 行。
- **后**：`clientReqId!==turnKey ? clientReqId : bundleId`，会话级 `turnKey` 不再当 `requestId`，保证 `N bundle → N 行`。
- **验证**：会话 `01a14ad1` 修复前 70 bundle→1 行，修复后 N→N。

#### 2) 中间件 — 多字节/丢帧/标点回归修复（`39810e9`，已推）
- **文件**：`packages/core/src/agents/codex/cli-middleware-runtime.ts`
- **多字节**：`chunk.toString("utf8")` → `StringDecoder("utf8") + decoder.end()` 冲刷，修中文/emoji 跨包 `�`。
- **丢帧**：`if(elapsed<700) return` → `pending + setTimeout(flush)` 尾刷不丢中间帧（`OpenCodeBotWorker` / `CodexBotWorker` 各一套，`700ms` 节流）。
- **正则**：`String.raw` 模板里 `/\r?\n/g` 被写成真实换行致 `/\n?\n/g`，`\r` 残留使 `JSON.parse` 失败，3 处改回 `/\r?\n/g`。
- **漏声明**：`runOpenCodeBotCli` 丢 `let pendingJson=""` 致 `ReferenceError`，补回（`let pendingJson` 现 2 处）。
- **标点**：`/[。？！]$/ → /[。？！.!?]$/`，英文/代码 `hello!` 不再误加 `。`（见 ADR-003）。

#### 3) 隔离身份 — Dev 与原版并存（未推，本地 `build/electron-builder.dev.cjs + app-paths.ts`）
- **文件**：`packages/core/src/runtime/app-paths.ts:5` `APP_STORAGE_NAME: claude-code-router → claude-code-router-dev`；`build/electron-builder.dev.cjs` 新建（`appId/productName/artifactName/directories.output` 换 Dev）。
- **产物**：`D:\SoftWare\gateway\claude-code-router-dev\win-unpacked\Claude Code Router Dev.exe` 外置。
- **数据**：`%APPDATA%\claude-code-router`（原版） vs `claude-code-router-dev`（Dev）物理隔离；`better-sqlite3` 不再抢 `WAL`。
- **安装**：`appId/productName` 不同，`NSIS` 可并存；`--dir` 免安装本身不写注册表。
- **协议**：仍 `ccr://`，后装抢注册，串行无感（见 ADR-001）。

#### 4) 已合入但未单列的本地增量（随 3.1.3 之后快照）

- **软限流**：`gateway/limits/provider-window-limiter.ts`（新）、`config.ts:parseProviderSoftRateLimits`、`contracts/app.ts:ProviderSoftRateLimitConfig`、`gateway/upstream/executor.ts:acquireProviderWindow`、`ui/providers.tsx:ProviderSoftRateLimitSection` 等（`110174` 行 `models.json` 刷新为生成物，不列为手改）。
- **UI 熔断**：`error-boundary.tsx`（新）+ `network-logs.tsx` 分页/`ErrorBoundary` + `logs.ts` 大 Body 截断/`streamed_data 500`。
- **中间件**：`gateway/request/pipeline.ts:errors 策略`、`config/default-config.ts:requestLogBodyCapture all→errors`、`gateway/http/io.ts:zcode→ZCode`。

## [v0] 2026-10-19 — 清理（`367db00a`，已推）
- 删 `work/` 13 脚本 + `*.bak` 大备份（`50MB`），` .gitignore` 追加 `work/ / *.bak / *.bak-*`，仓库体积 `-50MB`。

---
**下一条如何记**：追加 `## [vN] YYYY-MM-DD — 标题`，列“文件-前-后-影响”，约束变更同步更新 `INVARIANTS.md` 并新增 `ADR`。
