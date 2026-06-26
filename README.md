# todo-drift

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success)](package.json)

Find stale TODO/FIXME/HACK comments in your codebase using `git blame`.

TODOs pile up. Nobody tracks how old they are. **todo-drift** scans your code, checks each comment's age via `git blame`, and flags anything older than your threshold. Use it in CI to enforce a "no ancient TODOs" policy.

## Install

```bash
# global
npm i -g todo-drift

# npx (no install)
npx todo-drift
```

## Usage

```bash
# Scan current directory, flag items older than 90 days (default)
todo-drift

# Scan a specific directory
todo-drift src/

# Custom threshold
todo-drift --max-days 30

# Only scan TODO and FIXME (skip HACK/XXX)
todo-drift --tags TODO,FIXME

# JSON output (for CI pipelines)
todo-drift --json
```

## Output

```
[STALE] src/auth.ts:42   TODO: refactor token refresh  (187d, alice)
[STALE] lib/db.ts:88     FIXME: handle connection pool  (134d, bob)
[ok]    src/api.ts:15     TODO: add rate limiting  (12d, carol)

3 items - 2 stale (>90d), 1 fresh
```

Exit code `1` when stale items exist — drop it into CI and forgotten TODOs become blockers.

## CI Example

```yaml
# GitHub Actions
- run: npx todo-drift --max-days 60 --json > todo-report.json
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `[dir]` | Directory to scan | `.` |
| `--max-days <n>` | Stale threshold in days | `90` |
| `--tags <list>` | Comma-separated tags | `TODO,FIXME,HACK,XXX` |
| `--json` | JSON array output | `false` |
| `-h, --help` | Show help | |

## How It Works

1. Recursively walks the target directory (skips `node_modules`, `.git`, binaries)
2. Finds lines matching `TODO`, `FIXME`, `HACK`, or `XXX` (uppercase, followed by `:` or space)
3. Runs `git blame --porcelain` on each match to get author and timestamp
4. Sorts by age (oldest first) and flags items past the threshold

## Requirements

- Node.js >= 18
- Git (for `git blame`)

## License

MIT
