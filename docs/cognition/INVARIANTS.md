# 不可变约束（Invariants）

> 改以下任一项视为“换身份”或“破约束”，必须先读本文并在 `CHANGELOG` + `ADR` 留痕。

## I-1 数据目录（文件隔离）

- **常量**：`packages/core/src/runtime/app-paths.ts:APP_STORAGE_NAME`
  - 官方：`"claude-code-router"` → Win `%APPDATA%\claude-code-router`（`resolveRuntimeConfigDir()`）
  - Dev（本仓当前）：`"claude-code-router-dev"` → `%APPDATA%\claude-code-router-dev`
- **推导**：`DATADIR = resolveRuntimeDataDir()` → `config.json / request-logs.sqlite / usage.sqlite / context-archive.sqlite / certs / raw-trace-spool / provider-icons`
- **环境变量后门**：`CCR_INTERNAL_USER_DATA_DIR / CCR_INTERNAL_APP_DATA_DIR / CCR_INTERNAL_HOME_DIR`（`app-paths.ts:6`）可临时覆写，`cli-middleware` 另有 `CCR_CONFIG_DIR / CODEXL_HOME`。
- **约束**：两套 `APP_STORAGE_NAME` 的 DB 互不兼容（`softRateLimits` 列、`request_logs` 迁移差异），**不可共用目录**。

## I-2 进程身份（单实例锁）

- **代码**：`packages/electron/src/main/main-app.ts:24` `app.requestSingleInstanceLock()`，`second-instance` 事件唤起首实例后退出。
- **配置**：`electron-builder.json:appId`（官方 `com.claudecoderouter.desktop`，Dev `com.claudecoderouter.desktop.dev`）。
- **约束**：同 `appId` 的两个 exe 不能同时跑；不同 `appId` 可并存，但共享端口仍会 `EADDRINUSE`（见 I-3）。

## I-3 网络（端口）

- **缺省**：`packages/core/src/config/default-config.ts:33` `gateway.port=3456`，管理端 `3458`（`packages/core/src/entrypoints/server.ts:105`）。
- **约束**：两实例同机并存需改其一端口，否则后起的 `EADDRINUSE`。本仓 Dev 串行使用，故未改端口，靠单实例锁防误双开。

## I-4 系统注册（安装/协议/更新）

- **安装**：`electron-builder.json:productName` 决定 `NSIS` 安装目录/开始菜单/卸载项；Dev 改为 `Claude Code Router Dev` 后可与原版并存。
- **协议**：`packages/core/src/contracts/deep-link.ts:15` `appDeepLinkProtocol="ccr"`，`electron-builder.json:protocols` 注册；后安装的覆盖。Dev 仍为 `ccr://`，串行无感，协议隔离需改 `ccr-dev://`。
- **更新**：`electron-builder.json:publish` 指向 `musistudio/claude-code-router`；Dev 同 `appId` 会被当作同一 App 自动升回原版，Dev 应关自动更新或换 `repo`。

## I-5 产物外置

- **源码**：`D:\Github\ccr-1939566682`
- **Dev 产物**：`D:\SoftWare\gateway\claude-code-router-dev`（`build/electron-builder.dev.cjs:directories.output`），含 `win-unpacked/Claude Code Router Dev.exe` + `resources/app.asar`。
- **约束**：源码目录的 `release/` / `dist/` 不作为 Dev 交付物；`D:\SoftWare\gateway\claude-code-router-dev` 不入仓（`.gitignore` 占位说明）。

## I-6 构建契约

- **开发态**：`npm run dev:electron` 读 `packages/*/src`，HMR 热更，**不更新** `win-unpacked`。
- **生产构建**：`node build/build.mjs` → `packages/*/dist`；`electron-builder --dir` → `win-unpacked`；`--win` → `NSIS .exe`。
- **Dev 快捷**：`npm run build:dev`（`scripts/build-dev.ps1`，`--dir` 免安装）、`npm run build:dev:install`（`--win` 安装包）。

## I-7 中间件契约

- **CONFIG_DIR**：`packages/core/src/agents/codex/cli-middleware-runtime.ts:resolveConfigDir()`，与 `APP_STORAGE_NAME` 同源，Dev 自动隔离。
- **多字节**：`chunk.toString("utf8")` 会切断跨包中文/emoji，必须 `StringDecoder("utf8") + decoder.end()`。
- **行协议**：`/\r?\n/g` 不可写成 `/\n?\n/g`（`String.raw` 模板里 `\r` 易被编辑器吞掉）。
