---
name: github-repo-settings
description: 改 GitHub 仓库设置：用 PAT 直连 REST API 修改仓库描述、主页、可见性、topics、默认分支、归档状态与 issues/wiki/projects 开关。当用户要改仓库设置、改仓库描述或 topics、把仓库转私有/公开、归档仓库，而官方 GitHub MCP 没有对应工具时使用；不用于创建仓库或读写文件内容。
---

# GitHub 仓库设置

## 目的与边界

通过 `scripts/gh-repo.mjs` 调 GitHub REST API，改**已存在仓库**的设置，并给出改动前后的可核对结果。
不负责：创建/删除仓库、读写文件内容、改分支保护或协作成员——那些走官方 GitHub MCP 的 `create_repository` / `create_or_update_file` / `push_files`，或直接放弃。

## 为什么需要这个技能

官方 GitHub MCP 服务器（`https://api.githubcopilot.com/mcp/`）**没有**改仓库设置的接口：2026-10-26 实测，默认 46 个工具、开满全部 15 个 toolset 共 73 个工具，都没有 `update_repository`。上游 issue 见 [github/github-mcp-server#3588](https://github.com/github/github-mcp-server/issues/3588)。

所以模型遇到"改仓库设置"时，不要去找 MCP 工具，也不要用 `git`/`gh`，直接用本技能的脚本。**如果上游后来加了这个工具，删掉本技能。**

## 前置条件

- `GITHUB_PAT` 环境变量（与 DSH 的 GitHub MCP 共用），需要 `repo` scope；改可见性/归档需要对目标仓库有 admin 权限。
- Node 20+ 在 PATH。脚本零依赖，不需要 `npm install`。
- 本技能目录（下文记作 `$S`），按 DSH 的安装位置解析：

  ```powershell
  $S = if ($env:DSH_HOME) { Join-Path $env:DSH_HOME 'skills\github-repo-settings' }
       else { Join-Path $env:USERPROFILE '.dsh\skills\github-repo-settings' }
  ```

  命令通常在 workspace 下执行，所以脚本用**绝对路径**引用，不要依赖 cwd。

## 流程

1. **先看当前值**，别凭记忆改：

   ```powershell
   node "$S\scripts\gh-repo.mjs" show <owner>/<repo>
   ```

2. **构造改动并预演**。只有传了的字段才会被发送；`--dry-run` 只打印请求体，不发请求：

   ```powershell
   node "$S\scripts\gh-repo.mjs" edit <owner>/<repo> --description "新描述" --topics ai,mcp --dry-run
   ```

3. **高风险改动先跟用户确认**：`--visibility`（公开↔私有）、`--archived true`、`--default-branch`。这三类会影响外部链接、CI 与协作者，预演结果给用户看过再执行。

4. **执行**（去掉 `--dry-run`）：

   ```powershell
   node "$S\scripts\gh-repo.mjs" edit <owner>/<repo> --description "新描述" --topics ai,mcp
   ```

5. **复核**：再跑一次 `show`，确认返回值与预期一致，把关键字段的前后值贴给用户。

可用参数：`--description`（`""` 清空）、`--homepage`、`--visibility public|private`、`--topics a,b`（全量替换，`""` 清空）、`--default-branch`、`--archived true|false`、`--has-issues`、`--has-wiki`、`--has-projects`。
另有 `list --limit N` 列出账号下仓库。

## 坑

- **`topics` 不在仓库 PATCH 端点里**：`PATCH /repos/{owner}/{repo}` 会静默忽略 `topics` 字段，必须单独 `PUT /repos/{owner}/{repo}/topics`。脚本已经分开处理，不要自己拼 PATCH。
- **`--topics` 是全量替换**，不是追加。要保留原有 topics，先 `show` 读出，合并后再传入。
- **`--description ""` 是清空**，不是"不改"。省略参数才是不改。
- **如果 shell 里 `curl`/`git` 报 TLS 握手错误**（某些沙箱环境会因证书存储受限而失败），改用 `node` 发请求——本脚本只依赖 Node 的 OpenSSL，不受该问题影响。
- 脚本不做删除：删除仓库需要 `delete_repo` scope，且风险远高于改元数据，不应由 agent 顺手执行。

## 输出与验收

- 成功时脚本打印 `ok: patched <repo> -> {...}` 与 `ok: topics <repo> -> [...]`。
- 验收标准：`show` 返回的目标字段等于用户要求的值；不一致就报告差异，不要谎报成功。
- 回复用户时只贴改动字段的前后值，不要把整个 JSON 倒出来。

## 失败处理

| 现象 | 动作 |
|---|---|
| `HTTP 401` | `GITHUB_PAT` 失效/未设置；停下并告诉用户，不要重试 |
| `HTTP 403` | 权限不足（改可见性/归档需 admin；组织仓库可能受限）；把 `message` 原文给用户 |
| `HTTP 404` | 仓库名或 owner 拼错，或 token 看不到该仓库；先用 `list` 确认 |
| `HTTP 422` | 参数非法（如 visibility 与 fork 状态冲突、default_branch 不存在）；读 `errors` 字段定位 |
| 网络错误 | `api.github.com` 偶发不通时重试 1 次；仍失败就报告，不要改用 git/gh |

## 资源

- `scripts/gh-repo.mjs`：唯一需要的脚本（`list` / `show` / `edit`，仅 `edit` 支持 `--dry-run`）。参数说明也在脚本头部注释里。
