# 架构（Architecture）

> 基于 `057abaa1`（官方 3.1.3）勘测，`2026-10-19` 定版。

## 1. Monorepo

```
D:\Github\ccr-1939566682\
├── packages/
│   ├── core    (@claude-code-router/core, 210 ts)  — 网关/路由/可观测/配置/存储
│   ├── electron(@claude-code-router/electron, 27)  — 桌面壳（main / preload / tray）
│   ├── ui      (@claude-code-router/ui, 49)        — 渲染进程（React + BaseUI）
│   └── cli     (@musistudio/claude-code-router)    — `ccr` CLI（含 ccr ui）
├── build/      esbuild + electron-builder 编排
├── docs/       Astro 文档站 + cognition 认知层
└── cdn/  docker/  examples/  extension/  scripts/
```

## 2. 运行时分层

```
[Agent CLI] --HTTP--> [Gateway :3456] --路由/重试/降级--> [Provider API]
                          │
                          ├── 观测：request-logs.sqlite / usage.sqlite / raw-trace-spool
                          ├── 配置：config.json（Providers / Routing / Gateway / Proxy / Observability）
                          └── 桌面：Electron main ↔ UI renderer（IPC）+ Tray + DeepLink ccr://
```

- **网关**：`packages/core/src/gateway/`（`service.ts` 启动、`core-runtime/router-plugin` 转发、`request/pipeline` 编排）。
- **路由**：`packages/core/src/routing/`（`execution-plan` + `protocol-adapter` + `model-resolution`），支持 `fallback`、多凭证、按协议重写。
- **可观测**：`packages/core/src/observability/`（`request-log-store` 统一持久化、`raw-trace-sync` 兜底、`request-log-runtime` / `admission-store` 限流）。
- **配置**：`packages/core/src/config/`（`config.ts` 解析、`default-config.ts` 缺省、`constants.ts` 路径常量）。
- **存储**：`packages/core/src/storage/sqlite-native`（`better-sqlite3`），`request-logs.sqlite` + `usage.sqlite` + `context-archive.sqlite`。

## 3. 关键路径（代码锚点）

| 路径 | 文件 | 职责 |
|---|---|---|
| 数据目录解析 | `packages/core/src/runtime/app-paths.ts` | `APP_NAME / APP_STORAGE_NAME / resolveRuntime*` |
| 常量 | `packages/core/src/config/constants.ts` | `DATADIR / REQUEST_LOGS_DB_FILE / RAW_TRACE_SPOOL_DIR` |
| Electron 入口 | `packages/electron/src/main/main.ts` | `setRuntimeAppPaths` + `app.setPath(userData)` 迁移 |
| 单实例 | `packages/electron/src/main/main-app.ts:24` | `requestSingleInstanceLock()` |
| 打包身份 | `electron-builder.json` | `appId / productName / artifactName / protocols` |
| Dev 打包 | `build/electron-builder.dev.cjs` | 产出到 `D:\SoftWare\gateway\claude-code-router-dev` |
| 构建 | `build/build.mjs` + `build/esbuild.config.mjs` | `cleanDist → buildMain/Renderer/Worker/Bridge/Styles → sync` |
| 深度链接 | `packages/core/src/contracts/deep-link.ts:15` | `appDeepLinkProtocol = "ccr"` |
| 中间件 | `packages/core/src/agents/codex/cli-middleware-runtime.ts` | `CONFIG_DIR / runCodexBotCli / runOpenCodeBotCli` |
| 网关默认 | `packages/core/src/config/default-config.ts:33/109` | `3456 / 3458` |

## 4. 包依赖方向

```
cli ──┐
      ├──▶ core ◀── electron
ui  ──┘         \
                 └─▶ gateway → providers / routing / observability
```

- `core` 不依赖 `electron` / `ui`；`electron` / `cli` 依赖 `core`。
- `ui` 通过 `IPC_CHANNELS` 与 `electron main` 通信，不直连 `core` 存储。

## 5. 已验证的本地增量（3.1.3 之后）

- **可观测性**：`raw-trace-sync.ts:requestId = clientReqId!==turnKey ? clientReqId : bundleId`（`bf35654`，Codex 同会话合并修复）。
- **软限流**：`gateway/limits/provider-window-limiter.ts` + `config.ts:parseProviderSoftRateLimits` + UI `providers.tsx` 面板。
- **中间件**：`cli-middleware-runtime.ts:StringDecoder + pending尾刷 + 标点判据`（`39810e9`）。
- **UI 熔断**：`error-boundary.tsx` + `network-logs.tsx` 分页 + `logs.ts` 大 Body 截断。
- **隔离身份**（未推）：`app-paths.ts:APP_STORAGE_NAME → claude-code-router-dev` + `electron-builder.dev.cjs` 换 `appId/productName`（`ADR-001`）。
