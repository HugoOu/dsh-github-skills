# dsh-github-skills

[中文](README.zh-CN.md) | English

DeepSeek Harness skills for GitHub operations that the official GitHub MCP server does not expose.

## Why this exists

The official GitHub MCP server (`https://api.githubcopilot.com/mcp/`) can create a repository but cannot change its metadata afterwards. Verified 2026-10-26: the default toolset exposes 46 tools, and enabling all 15 toolsets exposes 73 — none of them updates repository settings. An agent can scaffold a repo, then cannot fix its description or topics without leaving the MCP surface.

Tracked upstream as [github/github-mcp-server#3588](https://github.com/github/github-mcp-server/issues/3588). If that gets implemented, the skill here becomes redundant.

## Skills

| Skill | What it does | Needs |
|---|---|---|
| [`github-repo-settings`](skills/github-repo-settings/SKILL.md) | Read and change repository metadata: description, homepage, visibility, topics, default branch, archived state, and the issues/wiki/projects feature flags | `GITHUB_PAT` with `repo` scope, Node 20+ |

## Install

Skills live in `$DSH_HOME/skills/<name>` (default `~/.dsh/skills`), one directory level deep. Copy the skill you want:

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

DSH picks the skill up on the next model step — no restart needed. It shows up in the skill catalog as `github-repo-settings`; you can also invoke it explicitly with `/github-repo-settings`.

## Requirements

- **`GITHUB_PAT`** in the environment — the same token your GitHub MCP server uses. Classic token needs the `repo` scope; changing visibility or archived state additionally needs admin permission on the target repository.
- **Node 20+**. The bundled script has no dependencies — no `npm install` step.

## Notes

- The scripts talk to `https://api.github.com` only. Nothing else is contacted, and the token is never written to disk.
- These skills deliberately do not offer repository deletion. That needs the `delete_repo` scope and is far riskier than metadata edits; it should not happen as a side effect of an agent task.

## License

[MIT](LICENSE)
