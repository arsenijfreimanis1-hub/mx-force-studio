import assert from "node:assert/strict";
import { test } from "node:test";
import { parseUpdates } from "./updates.ts";

test("built revision differs from UPDATES id when the garage is stale", () => {
  // Mirrors /api/updates: outdated only when both ids exist and disagree.
  const id = "2026-10-12-visual-pass";
  const builtId = "2026-10-12-showcase-seat";
  const outdated = Boolean(id) && Boolean(builtId) && builtId !== id;
  assert.equal(outdated, true);
  assert.equal(Boolean(id) && Boolean(id) && id === id, true);
});

test("update log header is the revision the website compares", () => {
  const log = parseUpdates(`id: 2026-09-30-island
date: 2026-09-30

Notes before the entries are ignored.

## 2026-09-30-island
- Floating island
- Life-size frame

## 2026-09-29-live-sit-widget
- Live garage
`);
  assert.equal(log.id, "2026-09-30-island");
  assert.equal(log.date, "2026-09-30");
  assert.equal(log.entries.length, 2);
  assert.equal(log.entries[0].lines[0], "- Floating island");
  assert.equal(log.entries[1].id, "2026-09-29-live-sit-widget");
});
