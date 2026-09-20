import assert from "node:assert/strict";
import { test } from "node:test";
import { restRodAngleDeg, rodBaseCorner, rodDeckLocal, rodLength } from "./rods.ts";
import { PLATFORM_HOME_Y } from "./motion.ts";

test("rest rods sit near 45 degrees to the base", () => {
  const deg = restRodAngleDeg();
  assert.ok(deg > 38 && deg < 55, `angle ${deg}`);
});

test("each rod has a usable rest stroke", () => {
  const base = rodBaseCorner(-1, 1);
  const local = rodDeckLocal(-1, 1);
  const deck = { x: local.x, y: PLATFORM_HOME_Y + local.y, z: local.z };
  const len = rodLength(base, deck);
  assert.ok(len > 0.45 && len < 1.2, `length ${len}`);
});
