import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampPoseToRodStroke,
  defaultRestRodLength,
  poseRodLengths,
  restRodAngleDeg,
  rodBaseCorner,
  rodBaseOut,
  rodDeckLocal,
  rodLength,
  rodsInStroke,
} from "./rods.ts";
import { DEFAULT_ROD_LENGTH, PLATFORM_HOME_Y, identityPose } from "./motion.ts";

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
  const rest = poseRodLengths(identityPose());
  for (const L of rest) assert.ok(Math.abs(L - defaultRestRodLength()) < 0.02, `ik ${L}`);
});

test("stroke does not move the steel base", () => {
  const a = rodBaseCorner(-1, 1);
  const b = rodBaseCorner(1, -1);
  assert.equal(rodBaseOut(), rodBaseOut());
  assert.ok(Math.abs(a.x) > 0.2 && Math.abs(b.z) > 0.2);
  const short = clampPoseToRodStroke({ ...identityPose(), y: 0.2 }, 0.1);
  const long = clampPoseToRodStroke({ ...identityPose(), y: 0.2 }, 0.5);
  assert.deepEqual(rodBaseCorner(-1, 1), a);
  assert.ok(Math.abs(long.y - 0.2) < 1e-5, `long y ${long.y}`);
  assert.ok(Math.abs(short.y) < 0.2 - 1e-4, `short y ${short.y}`);
});

test("a large pitch at tiny stroke is pulled back", () => {
  const wild = { ...identityPose(), pitch: (40 * Math.PI) / 180, y: 0.4, roll: (35 * Math.PI) / 180 };
  assert.equal(rodsInStroke(poseRodLengths(wild), 0.08), false);
  const clamped = clampPoseToRodStroke(wild, 0.08);
  assert.ok(rodsInStroke(poseRodLengths(clamped), 0.08), JSON.stringify(poseRodLengths(clamped)));
  assert.ok(Math.abs(clamped.pitch) < Math.abs(wild.pitch), `pitch ${clamped.pitch}`);
  assert.ok(Math.abs(clamped.y) < wild.y, `y ${clamped.y}`);
});

test("a small pitch stays inside a normal stroke", () => {
  const mild = { ...identityPose(), pitch: (8 * Math.PI) / 180, roll: (10 * Math.PI) / 180 };
  const out = clampPoseToRodStroke(mild, 0.28);
  assert.ok(Math.abs(out.pitch - mild.pitch) < 1e-6, `pitch ${out.pitch}`);
  assert.ok(Math.abs(out.roll - mild.roll) < 1e-6, `roll ${out.roll}`);
});
