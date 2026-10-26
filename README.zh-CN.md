# dsh-github-skills

中文 | [English](README.md)

给 DeepSeek Harness 用的 GitHub 技能集，补官方 GitHub MCP 服务器没有暴露的能力。

## 为什么需要

官方 GitHub MCP 服务器（`https://api.githubcopilot.com/mcp/`）能创建仓库，但创建之后改不了它的元数据。2026-10-26 实测：默认工具集 46 个工具，开满全部 15 个 toolset 共 73 个，**没有一个能改仓库设置**。结果就是 agent 建完仓库，想补个描述或 topics 就得离开 MCP 去绕路。

已在上游提了 [github/github-mcp-server#3588](https://github.com/github/github-mcp-server/issues/3588)。如果上游实现了，这里的技能就可以退休。

## 技能列表

| 技能 | 作用 | 依赖 |
|---|---|---|
| [`github-repo-settings`](skills/github-repo-settings/SKILL.md) | 读取与修改仓库元数据：描述、主页、可见性、topics、默认分支、归档状态，以及 issues/wiki/projects 开关 | `GITHUB_PAT`（`repo` scope）、Node 20+ |

## 安装

技能放在 `$DSH_HOME/skills/<name>`（默认 `~/.dsh/skills`），只扫描根目录下一层。把需要的技能拷过去：

```powershell
# Windows PowerShell
$dest = if ($env:DSH_HOME) { Join-Path $env:DSH_HOME 'skills' } else { Join-Path $env:USERPROFILE '.dsh\skills' }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item .\skills\github-repo-settings -Destination $dest -Recurse -Force
```

```bash
# macOS / Linux
dest="${DSH_HOME:-$HOME/.dsh}/skills"
mkdir -p "$dest"
cp -R skills/github-repo-settings "$dest/"
```

DSH 在下一个模型步骤就会识别到，不需要重启。目录里会出现 `github-repo-settings`，也可以 `/github-repo-settings` 显式调用。

## 依赖

- 环境变量 **`GITHUB_PAT`** —— 和你 GitHub MCP 服务器用的是同一个 token。经典 token 需要 `repo` scope；改可见性或归档状态还需要对目标仓库有 admin 权限。
- **Node 20+**。脚本零依赖，不需要 `npm install`。

## 说明

- 脚本只访问 `https://api.github.com`，不联系其它任何地址，也不会把 token 写进磁盘。
- 这些技能刻意不提供删除仓库。删除需要 `delete_repo` scope，风险远高于改元数据，不应该作为 agent 任务的副作用发生。

## 许可证

[MIT](LICENSE)
