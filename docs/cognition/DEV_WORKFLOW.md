# 开发/构建/调试手册（Dev Workflow）

## 1. 环境

- **Node** `>=22`（`package.json:engines`），建议 `nvm use 22.20.0`
- **包管理器**：`npm`（`package-lock.json` 主用）与 `pnpm` 并存，日常用 `npm install`
- **Win 打包**：必须 `win32 x64` + `npm`，否则 `build/windows-package-preflight.mjs` 阻断（`better-sqlite3` 需本机编译）
- **源码**：`D:\Github\ccr-1939566682`（Dev 身份）
- **产物**：`D:\SoftWare\gateway\claude-code-router-dev`（`build/electron-builder.dev.cjs` 外置，不污染源码）

## 2. 常用命令

| 场景 | 命令 | 说明 |
|---|---|---|
| 安装依赖 | `npm install` | 根 `package.json` + `workspaces` |
| 开发态（热更） | `npm run dev:electron` | 主进程+渲染进程 HMR，改 `packages/*/src` 存盘即生效 |
| 开发态 CLI | `npm run dev:cli` | `ccr ui` 同款，无 Electron |
| 开发态 UI | `npm run dev:ui` | 仅渲染进程 |
| 生产编译 | `npm run build:assets` | `node build/build.mjs` → `packages/*/dist` |
| 预览 | `npm run preview` | `build:assets && electron .` |
| Dev 免安装 | `npm run build:dev` | `build:assets` + `electron-builder --dir` → `D:\SoftWare\gateway\claude-code-router-dev\win-unpacked` |
| Dev 安装包 | `npm run build:dev:install` | 同上 `--win` → `NSIS .exe` |
| 官方安装包 | `npm run build:app:win` | `windows-package-preflight + build:assets + electron-builder --win` |

> `build:dev` 本质：`powershell -ExecutionPolicy Bypass -File scripts/build-dev.ps1`（见 `scripts/build-dev.ps1` 注释）。

## 3. 产物区分

| 产物 | 位置 | 数据目录 | 身份 |
|---|---|---|---|
| 原版已安装 | `C:\Program Files\Claude Code Router\` | `%APPDATA%\claude-code-router` | `appId=com.claudecoderouter.desktop` |
| Dev 免安装 | `D:\SoftWare\gateway\claude-code-router-dev\win-unpacked\Claude Code Router Dev.exe` | `%APPDATA%\claude-code-router-dev` | `appId=com.claudecoderouter.desktop.dev` |
| Dev 开发态 | `npm run dev:electron` 内存 | 同 Dev 产物 | 同 Dev |

- **热更 vs 产物**：`dev:electron` 读源码，**不更新** `win-unpacked\resources\app.asar`；`build:dev` 才落盘。
- **串行使用**：`requestSingleInstanceLock()` 保证同 `appId` 只能起一个，后起的唤起前者后退出；Dev 与原版 `appId` 不同可并存，但端口 `3456/3458` 仍会 `EADDRINUSE`，故建议串行（先关一个再起另一个）。

## 4. 数据与迁移

- **首次起 Dev**：`%APPDATA%\claude-code-router-dev` 为空，需手动拷种子（可选）：
  ```powershell
  xcopy "%APPDATA%\claude-code-router" "%APPDATA%\claude-code-router-dev" /E /I /Y
  ```
- **DB**：`request-logs.sqlite / usage.sqlite / context-archive.sqlite` 由 `better-sqlite3` 打开，`WAL` 模式，多进程同目录写会 `SQLITE_BUSY`，隔离目录即隔离 DB。
- **重置**：删 `%APPDATA%\claude-code-router-dev` 即重置 Dev 数据，不影响原版。

## 5. 调试

- **日志**：管理端 `Logs` / `request-logs.sqlite`；`DEBUG=*` / `CCR_*` 环境变量（见 `packages/core/src/observability`）。
- **网关**：`http://127.0.0.1:3456`（`gateway.port`），管理端 `http://127.0.0.1:3458` 或 `3456` 的内置服务。
- **测试**：`npm test`（`test:packages + test:architecture`）、`npm run test:core / test:ui / test:electron`、`npm run test:e2e`（`playwright`）。

## 6. 发版注意

- Dev `APP_STORAGE_NAME` 已改为 `claude-code-router-dev`（`packages/core/src/runtime/app-paths.ts:5`），推 `1939566682/Claude-Code-Router` 会公开 Dev 身份，合上游 `musistudio/main` 时需 `rebase` 冲突 1 行改回。
- `ccr://` 协议仍共用，后装的抢注册；免安装 `--dir` 不注册，无感。
- 自动更新 `electron-updater` 指向 `publish.repo`，同 `appId` 会被当同一 App 升回原版，Dev 应关更新或换 `repo`。
