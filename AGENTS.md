# AGENTS — Claude Code Router (ccr-1939566682) 仓库认知入口

> **面向模型**：这是仓库级认知层的唯一入口。所有任务开始前必读本文件，再按需下钻 `docs/cognition/`。
> **面向人类**：`docs/cognition/` 下的文档亦供开发者查阅，但以机器可消费为首要目标。

## 1. 先读什么（按需下钻）

| 顺序 | 文档 | 何时读 |
|---|---|---|
| 1 | `docs/cognition/MANIFEST.md` | 了解认知层有哪些文档、版本、增量规则 |
| 2 | `docs/cognition/ARCHITECTURE.md` | 改 `packages/core` / `gateway` / `observability` / `routing` 前 |
| 3 | `docs/cognition/INVARIANTS.md` | 任何涉及路径/锁/端口/数据/协议的改动前 |
| 4 | `docs/cognition/DEV_WORKFLOW.md` | 开发、构建、调试、发版前 |
| 5 | `docs/cognition/CHANGELOG.md` | 需要知道“本地改了什么、为什么” |
| 6 | `docs/cognition/decisions/ADR-*.md` | 需要理解某次关键选型的上下文 |

## 2. 本仓库一句话

本地模型网关与管控面：为 Claude Code / Codex / Grok CLI / Kimi / Kilo / OpenCode 等 agent 提供**统一本地 endpoint**（`http://127.0.0.1:3456`），在 `Providers / Routing / Tools / Logs` 上做路由、重试、降级与可观测。

## 3. 硬约束（不可违背）

- **数据目录**：Win ` %APPDATA%\claude-code-router`（Dev 版 `claude-code-router-dev`），由 `packages/core/src/runtime/app-paths.ts:APP_STORAGE_NAME` 决定，改名即换身份。
- **单实例**：`packages/electron/src/main/main-app.ts:requestSingleInstanceLock()` + `electron-builder.json:appId`，同 `appId` 的第二个实例会 `second-instance` 唤起第一个后退出。
- **端口**：默认 `3456`（网关）、`3458`（管理端 Apifox），见 `packages/core/src/config/default-config.ts`。
- **协议**：`ccr://`（`packages/core/src/contracts/deep-link.ts:appDeepLinkProtocol`），后安装的覆盖注册。
- **身份改动必显式**：`APP_STORAGE_NAME / appId / productName / artifactName` 任一改动视为“换身份”，需同步评估数据/安装/协议/更新四层隔离。
- **产物外置**：Dev 产物在 `D:\SoftWare\gateway\claude-code-router-dev`（`build/electron-builder.dev.cjs`），不污染源码目录。

## 4. 产物与分支

- **本仓库**：`https://github.com/1939566682/Claude-Code-Router.git`，`main` 分支，本地 Dev 身份（见上）。
- **上游**：`https://github.com/musistudio/claude-code-router`（`057abaa1` 为本地 3.1.3 基准）。
- **原版/Dev 并存**：原版 `%APPDATA%\claude-code-router` + `win-unpacked` 直跑；Dev 版 `%APPDATA%\claude-code-router-dev` + `D:\SoftWare\gateway\claude-code-router-dev\win-unpacked`。详见 `docs/cognition/DEV_WORKFLOW.md`。
