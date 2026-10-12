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
import {
  DEFAULT_ROD_LENGTH,
  DEFAULT_ROD_STROKE,
  PLATFORM_HOME_Y,
  STUDIO_TRAVEL,
  identityPose,
} from "./motion.ts";

test("rest rods sit near 45 degrees to the base", () => {
  const deg = restRodAngleDeg();
  assert.ok(deg > 38 && deg < 55, `angle ${deg}`);
});

test("each rod has a usable rest stroke", () => {
  const base = rodBaseCorner(-1, 1);
  const local = rodDeckLocal(-1, 1);
  const deck = { x: local.x, y: PLATFORM_HOME_Y + local.y, z: local.z };
  const len = rodLength(base, deck);
  // Compact MX cradle: stubby actuators, not the old 1.24 m stilts.
  assert.ok(len > 0.35 && len < 0.8, `length ${len}`);
  assert.ok(Math.abs(len - DEFAULT_ROD_LENGTH) < 0.08, `default ${len} vs ${DEFAULT_ROD_LENGTH}`);
  const rest = poseRodLengths(identityPose());
  for (const L of rest) assert.ok(Math.abs(L - defaultRestRodLength()) < 0.02, `ik ${L}`);
});

test("the whole machine fits a shop bay", () => {
  const fl = rodBaseCorner(-1, 1);
  const width = Math.abs(fl.x) * 2;
  const depth = Math.abs(fl.z) * 2;
  assert.ok(width < 1.2, `width ${width}`);
  assert.ok(depth < 1.5, `depth ${depth}`);
});

test("stock stroke carries a berm lean, a jump face, and a whoop", () => {
  const berm = { ...identityPose(), roll: (42 * Math.PI) / 180 };
  assert.ok(rodsInStroke(poseRodLengths(berm)), `berm ${poseRodLengths(berm)}`);
  const face = { ...identityPose(), pitch: (38 * Math.PI) / 180 };
  assert.ok(rodsInStroke(poseRodLengths(face)), `face ${poseRodLengths(face)}`);
  const whoop = { ...identityPose(), y: 0.22 };
  assert.ok(rodsInStroke(poseRodLengths(whoop)), `whoop ${poseRodLengths(whoop)}`);
});

test("the actuator is a cylinder a supplier could quote", () => {
  // Retracted pivot-to-pivot has to hold the full stroke plus end caps.
  // Without this the geometry asks for a strut shorter than its own barrel.
  const retracted = defaultRestRodLength() - DEFAULT_ROD_STROKE;
  assert.ok(retracted >= DEFAULT_ROD_STROKE * 2 + 0.12, `retracted ${retracted}`);
});

test("the advertised studio envelope is inside the rod stroke", () => {
  const corners = [
    { ...identityPose(), roll: STUDIO_TRAVEL.limitRoll },
    { ...identityPose(), pitch: STUDIO_TRAVEL.limitPitch },
    { ...identityPose(), pitch: -STUDIO_TRAVEL.limitPitch },
    { ...identityPose(), y: STUDIO_TRAVEL.limitY },
    { ...identityPose(), y: -STUDIO_TRAVEL.limitY },
  ];
  for (const pose of corners) {
    assert.ok(rodsInStroke(poseRodLengths(pose)), `spec ${JSON.stringify(pose)}`);
  }
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

test("surge sway and yaw stay on the inner stage", () => {
  const slid = { ...identityPose(), x: 0.8, z: -1, yaw: 0.4 };
  const rest = poseRodLengths(identityPose());
  const moved = poseRodLengths(slid);
  for (let i = 0; i < rest.length; i++) {
    assert.ok(Math.abs(rest[i] - moved[i]) < 1e-6, `rod ${i} ${moved[i]}`);
  }
  const clamped = clampPoseToRodStroke(slid, 0.08);
  assert.equal(clamped.x, slid.x);
  assert.equal(clamped.z, slid.z);
  assert.equal(clamped.yaw, slid.yaw);
});

test("a small pitch stays inside a normal stroke", () => {
  const mild = { ...identityPose(), pitch: (8 * Math.PI) / 180, roll: (10 * Math.PI) / 180 };
  const out = clampPoseToRodStroke(mild, 0.28);
  assert.ok(Math.abs(out.pitch - mild.pitch) < 1e-6, `pitch ${out.pitch}`);
  assert.ok(Math.abs(out.roll - mild.roll) < 1e-6, `roll ${out.roll}`);
});
