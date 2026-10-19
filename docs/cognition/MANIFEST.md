# 认知层清单（Manifest）

- **版本**：`v1`（2026-10-19）
- **基准**：官方 `3.1.3`（`057abaa1`）+ 本地 3 次修复（`bf35654` / `39810e9` / 隔离身份未推）
- **维护规则**：见本文 §4。

## 1. 清单

| # | 文档 | 职责 | 稳定性 |
|---|---|---|---|
| 0 | `AGENTS.md`（仓根） | 认知入口与硬约束 | 稳定 |
| 1 | `docs/cognition/MANIFEST.md` | 本清单与增量规则 | 稳定 |
| 2 | `docs/cognition/ARCHITECTURE.md` | 架构、包边界、关键路径 | 随重构更新 |
| 3 | `docs/cognition/INVARIANTS.md` | 不可变约束与隔离模型 | 稳定，改约束需 ADR |
| 4 | `docs/cognition/DEV_WORKFLOW.md` | 开发/构建/调试/发版手册 | 随工具链更新 |
| 5 | `docs/cognition/CHANGELOG.md` | 本地增量（3 类主特性外）的事实记录 | 追加式 |
| 6 | `docs/cognition/decisions/ADR-001.md` | Dev 与原版隔离选型 | 稳定 |
| 7 | `docs/cognition/decisions/ADR-002.md` | `requestId` 归一（Codex 日志合并） | 稳定 |
| 8 | `docs/cognition/decisions/ADR-003.md` | `cli-middleware` 多字节/丢帧修复取舍 | 稳定 |
| 9 | `docs/cognition/_templates/ADR.md` | ADR 模板 | 稳定 |
| 10 | `docs/cognition/_templates/INVARIANT.md` | 约束条目模板 | 稳定 |

## 2. 版本化

- 认知层与代码同仓同分支（`main`），`git log` 可追溯。
- 每次**改约束、换身份、重构包边界**必须同步更新对应文档并记 `CHANGELOG`。
- `MANIFEST` 的 `版本/基准` 随 `CHANGELOG` 的最新条目递增。

## 3. 可增量更新

- **追加式**：`CHANGELOG` / `decisions/ADR-*.md` 永不覆写旧条，只追加。
- **原地修正**：`ARCHITECTURE` / `INVARIANTS` / `DEV_WORKFLOW` 允许原地更新，但需在 `CHANGELOG` 留痕。
- **模板化**：新增决策用 `decisions/ADR-*.md` 模板，保持“背景-决策-后果-替代”四段式。

## 4. 维护者义务（给模型的指令）

1. 任务开始前先读 `AGENTS.md` + 本清单，再按需读 `ARCHITECTURE/INVARIANTS/DEV_WORKFLOW`。
2. 改动涉及 `app-paths / electron-builder / deep-link / default-config` 任一时，必须先读 `INVARIANTS.md`。
3. 完成任务后若产生新约束或选型，追加 `CHANGELOG` 并在必要时新增 `ADR`。
4. 禁止在认知层写“计划/待办”——只写已落地的事实与约束。
