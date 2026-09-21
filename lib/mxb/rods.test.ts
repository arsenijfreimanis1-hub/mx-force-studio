import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultRestRodLength,
  restRodAngleDeg,
  rodBaseCorner,
  rodBaseOut,
  rodDeckLocal,
  rodLength,
} from "./rods.ts";
import { DEFAULT_ROD_LENGTH, PLATFORM_HOME_Y } from "./motion.ts";

test("rest rods sit near 45 degrees to the base", () => {
  const deg = restRodAngleDeg();
  assert.ok(deg > 38 && deg < 55, `angle ${deg}`);
});

test("each rod has a usable rest stroke", () => {
  const base = rodBaseCorner(-1, 1);
  const local = rodDeckLocal(-1, 1);
  const deck = { x: local.x, y: PLATFORM_HOME_Y + local.y, z: local.z };
  const len = rodLength(base, deck);
  assert.ok(len > 0.6 && len < 1.6, `length ${len}`);
  assert.ok(Math.abs(len - DEFAULT_ROD_LENGTH) < 0.08, `default ${len} vs ${DEFAULT_ROD_LENGTH}`);
});

test("longer rest length widens the base", () => {
  const short = rodBaseOut(0.7);
  const long = rodBaseOut(1.4);
  assert.ok(long > short + 0.15, `out ${short} → ${long}`);
  assert.ok(defaultRestRodLength() > 0.6);
});
