#!/usr/bin/env node
// todo-drift — Find stale TODO/FIXME/HACK comments via git blame

import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const TAG_RE = /\b(TODO|FIXME|HACK|XXX)\b[:\s]+(.*)/;

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "coverage",
  "__pycache__", ".turbo", ".cache", "vendor",
]);

const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2",
  ".ttf", ".eot", ".mp4", ".mp3", ".zip", ".tar", ".gz",
  ".pdf", ".exe", ".dll", ".so", ".dylib",
]);

function parseArgs(argv) {
  const args = { dir: ".", maxDays: 90, json: false, tags: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--max-days" && argv[i + 1]) args.maxDays = Number(argv[++i]);
    else if (a === "--json") args.json = true;
    else if (a === "--tags" && argv[i + 1]) args.tags = argv[++i].toUpperCase().split(",");
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
    else if (!a.startsWith("-")) args.dir = a;
  }
  return args;
}

function printHelp() {
  const msg = `
todo-drift — Find stale TODO/FIXME/HACK comments via git blame

USAGE
  todo-drift [dir] [options]

OPTIONS
  --max-days <n>   Flag items older than n days (default: 90)
  --tags <list>    Comma-separated tags to scan (default: TODO,FIXME,HACK,XXX)
  --json           Output as JSON array
  -h, --help       Show this help
`.trim();
  process.stdout.write(msg + "\n");
}

function walkFiles(dir, base) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, base));
    } else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
      if (!BINARY_EXT.has(ext)) results.push(full);
    }
  }
  return results;
}

function findTodos(filePath, tagsFilter) {
  let lines;
  try {
    lines = readFileSync(filePath, "utf8").split("\n");
  } catch { return []; }
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TAG_RE);
    if (!m) continue;
    const tag = m[1].toUpperCase();
    if (tagsFilter && !tagsFilter.includes(tag)) continue;
    hits.push({ line: i + 1, tag, text: m[2].trim() || "(no description)" });
  }
  return hits;
}

function blameLines(filePath, lineNums, base) {
  const rel = relative(base, filePath);
  const results = [];
  for (const ln of lineNums) {
    try {
      const out = execSync(
        `git blame -L ${ln},${ln} --porcelain -- "${rel}"`,
        { cwd: base, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
      );
      const tsMatch = out.match(/^author-time (\d+)/m);
      const authorMatch = out.match(/^author (.+)/m);
      const ts = tsMatch ? Number(tsMatch[1]) * 1000 : 0;
      const author = authorMatch ? authorMatch[1] : "unknown";
      results.push({ ts, author });
    } catch {
      results.push({ ts: 0, author: "unknown" });
    }
  }
  return results;
}

function daysSince(ts) {
  if (!ts) return Infinity;
  return Math.floor((Date.now() - ts) / 86_400_000);
}

function gitRoot(dir) {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd: resolve(dir), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch { return null; }
}

function run(argv) {
  const args = parseArgs(argv);
  const scanDir = resolve(args.dir);
  const root = gitRoot(scanDir);
  if (!root) {
    process.stderr.write("Error: not inside a git repository\n");
    process.exit(1);
  }

  const files = walkFiles(scanDir, scanDir);
  const items = [];

  for (const fp of files) {
    const todos = findTodos(fp, args.tags);
    if (!todos.length) continue;
    const blames = blameLines(fp, todos.map((t) => t.line), root);
    for (let i = 0; i < todos.length; i++) {
      const age = daysSince(blames[i].ts);
      const stale = age >= args.maxDays;
      items.push({
        file: relative(scanDir, fp),
        line: todos[i].line,
        tag: todos[i].tag,
        text: todos[i].text,
        author: blames[i].author,
        ageDays: age === Infinity ? null : age,
        stale,
      });
    }
  }

  items.sort((a, b) => (b.ageDays ?? 99999) - (a.ageDays ?? 99999));

  if (args.json) {
    process.stdout.write(JSON.stringify(items, null, 2) + "\n");
  } else {
    const staleCount = items.filter((i) => i.stale).length;
    const freshCount = items.length - staleCount;
    for (const it of items) {
      const marker = it.stale ? "STALE" : "ok";
      const age = it.ageDays != null ? `${it.ageDays}d` : "?d";
      process.stdout.write(
        `[${marker}] ${it.file}:${it.line}  ${it.tag}: ${it.text}  (${age}, ${it.author})\n`,
      );
    }
    process.stdout.write(`\n${items.length} items — ${staleCount} stale (>${args.maxDays}d), ${freshCount} fresh\n`);
    if (staleCount > 0) process.exit(1);
  }
}

export { findTodos, daysSince, parseArgs };

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) run(process.argv);
