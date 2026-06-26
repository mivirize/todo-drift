import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findTodos, daysSince, parseArgs } from "../src/cli.mjs";

// parseArgs is tested via synthetic argv arrays
describe("parseArgs", () => {
  it("returns defaults for empty argv", () => {
    const a = parseArgs(["node", "cli.mjs"]);
    assert.equal(a.dir, ".");
    assert.equal(a.maxDays, 90);
    assert.equal(a.json, false);
    assert.equal(a.tags, null);
  });

  it("parses --max-days", () => {
    const a = parseArgs(["node", "cli.mjs", "--max-days", "30"]);
    assert.equal(a.maxDays, 30);
  });

  it("parses --json flag", () => {
    const a = parseArgs(["node", "cli.mjs", "--json"]);
    assert.equal(a.json, true);
  });

  it("parses --tags as uppercase array", () => {
    const a = parseArgs(["node", "cli.mjs", "--tags", "todo,fixme"]);
    assert.deepEqual(a.tags, ["TODO", "FIXME"]);
  });

  it("accepts positional dir", () => {
    const a = parseArgs(["node", "cli.mjs", "/some/path"]);
    assert.equal(a.dir, "/some/path");
  });
});

describe("daysSince", () => {
  it("returns Infinity for 0 timestamp", () => {
    assert.equal(daysSince(0), Infinity);
  });

  it("returns 0 for now", () => {
    assert.equal(daysSince(Date.now()), 0);
  });

  it("returns ~1 for yesterday", () => {
    const yesterday = Date.now() - 86_400_000;
    assert.equal(daysSince(yesterday), 1);
  });
});
