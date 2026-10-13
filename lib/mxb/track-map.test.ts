import assert from "node:assert/strict";
import { test } from "node:test";
import { mimeForMap, trackSearchRoots } from "./track-map.ts";

test("track search roots always include Documents and Steam guesses", () => {
  const roots = trackSearchRoots();
  assert.ok(roots.length >= 2, `roots ${roots.length}`);
  assert.ok(roots.some((r) => /tracks|MX Bikes|PiBoSo/i.test(r)));
});

test("mimeForMap matches common map extensions", () => {
  assert.equal(mimeForMap("map.png"), "image/png");
  assert.equal(mimeForMap("mini.JPG"), "image/jpeg");
});
