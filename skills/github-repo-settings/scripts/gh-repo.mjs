#!/usr/bin/env node
// Change GitHub repository settings through the REST API with the same PAT that
// DSH's GitHub MCP server uses. Needed because the official GitHub MCP server
// exposes no repository-settings update tool (verified 2026-10-26: all 15
// toolsets = 73 tools, none of them edit repo settings).
//
// Usage:
//   node gh-repo.mjs list [--limit N]
//   node gh-repo.mjs show <owner/repo>
//   node gh-repo.mjs edit <owner/repo> [options]
//
// Edit options (only the ones you pass are sent):
//   --description "text"        repository description ("" clears it)
//   --homepage "url"            homepage URL
//   --visibility public|private change visibility
//   --topics a,b,c              replace the topic list ("" clears it)
//   --default-branch main       rename/point the default branch
//   --archived true|false       archive or unarchive
//   --has-issues true|false     enable/disable issue tracker
//   --has-wiki true|false       enable/disable wiki
//   --has-projects true|false   enable/disable projects
//   --dry-run                   print the PATCH body and exit
//
// Auth: GITHUB_PAT (falls back to GH_TOKEN / GITHUB_TOKEN).
import https from 'node:https';

const TOKEN = process.env.GITHUB_PAT || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('missing token: set GITHUB_PAT (or GH_TOKEN / GITHUB_TOKEN)');
  process.exit(2);
}

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const headers = {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'dsh-gh-repo',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request({ host: 'api.github.com', path, method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let parsed;
        try { parsed = raw ? JSON.parse(raw) : undefined; } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

function fail(r) {
  const msg = r.body && typeof r.body === 'object' ? r.body.message ?? JSON.stringify(r.body) : String(r.body ?? '');
  const detail = r.body && typeof r.body === 'object' && r.body.errors ? ` (${JSON.stringify(r.body.errors)})` : '';
  console.error(`HTTP ${r.status}: ${msg}${detail}`);
  process.exit(1);
}

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    if (key === 'dry-run') { flags[key] = true; continue; }
    flags[key] = rest[++i];
  } else positional.push(a);
}

const bool = (v) => v === 'true' || v === '1';

if (cmd === 'list') {
  const limit = Number(flags.limit ?? 20);
  const r = await api('GET', `/user/repos?per_page=${Math.min(limit, 100)}&sort=updated`);
  if (r.status !== 200) fail(r);
  for (const x of r.body) {
    console.log([x.full_name, x.private ? 'private' : 'public', `default=${x.default_branch}`,
      `topics=${(x.topics ?? []).join('|') || '-'}`, `archived=${x.archived}`,
      `desc=${x.description ? JSON.stringify(x.description) : '-'}`].join('\t'));
  }
} else if (cmd === 'show') {
  const [repo] = positional;
  if (!repo || !repo.includes('/')) { console.error('usage: show <owner/repo>'); process.exit(2); }
  const r = await api('GET', `/repos/${repo}`);
  if (r.status !== 200) fail(r);
  const x = r.body;
  console.log(JSON.stringify({
    full_name: x.full_name, private: x.private, visibility: x.visibility,
    description: x.description, homepage: x.homepage, topics: x.topics,
    default_branch: x.default_branch, archived: x.archived,
    has_issues: x.has_issues, has_wiki: x.has_wiki, has_projects: x.has_projects,
    fork: x.fork, created_at: x.created_at, pushed_at: x.pushed_at,
  }, null, 2));
} else if (cmd === 'edit') {
  const [repo] = positional;
  if (!repo || !repo.includes('/')) { console.error('usage: edit <owner/repo> [options]'); process.exit(2); }
  const body = {};
  if (flags.description !== undefined) body.description = flags.description;
  if (flags.homepage !== undefined) body.homepage = flags.homepage;
  if (flags.visibility !== undefined) body.visibility = flags.visibility;
  if (flags.topics !== undefined) body.topics = flags.topics === '' ? [] : flags.topics.split(',').map((s) => s.trim()).filter(Boolean);
  if (flags['default-branch'] !== undefined) body.default_branch = flags['default-branch'];
  if (flags.archived !== undefined) body.archived = bool(flags.archived);
  if (flags['has-issues'] !== undefined) body.has_issues = bool(flags['has-issues']);
  if (flags['has-wiki'] !== undefined) body.has_wiki = bool(flags['has-wiki']);
  if (flags['has-projects'] !== undefined) body.has_projects = bool(flags['has-projects']);
  if (Object.keys(body).length === 0) { console.error('nothing to change; pass at least one option'); process.exit(2); }

  // The topics endpoint is separate from the repo PATCH endpoint.
  const { topics, ...repoPatch } = body;
  if (flags['dry-run']) {
    console.log('PATCH /repos/' + repo, JSON.stringify(repoPatch));
    if (topics !== undefined) console.log('PUT /repos/' + repo + '/topics', JSON.stringify({ names: topics }));
    process.exit(0);
  }
  if (Object.keys(repoPatch).length > 0) {
    const r = await api('PATCH', `/repos/${repo}`, repoPatch);
    if (r.status !== 200) fail(r);
    console.log(`ok: patched ${repo} -> ${JSON.stringify(repoPatch)}`);
  }
  if (topics !== undefined) {
    const r = await api('PUT', `/repos/${repo}/topics`, { names: topics });
    if (r.status !== 200) fail(r);
    console.log(`ok: topics ${repo} -> ${JSON.stringify(r.body.names ?? topics)}`);
  }
} else {
  console.error('commands: list | show <owner/repo> | edit <owner/repo> [options]');
  process.exit(2);
}
