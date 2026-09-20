import assert from "node:assert/strict";
import { test } from "node:test";
import { clampDof, dofAxes, maskPose } from "./dof.ts";
import { createMotionFilter, DEFAULT_FRAME_TRAVEL, stepMotion } from "./motion.ts";
import type { Telemetry } from "./types.ts";

function sample(partial: Partial<Telemetry> = {}): Telemetry {
  return {
    rpm: 1950,
    engineTemp: 78,
    waterTemp: 72,
    gear: 0,
    fuel: 3.8,
    speedMs: 12,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 8 },
    accelG: { x: 0, y: 1, z: 0 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    yawRate: 0,
    pitchRate: 0,
    rollRate: 0,
    suspLength: [0.205, 0.208],
    suspVelocity: [0, 0],
    crashed: false,
    steer: 0,
    throttle: 0,
    frontBrake: 0,
    rearBrake: 0,
    clutch: 0,
    wheelSpeed: [12, 12],
    wheelMaterial: [3, 3],
    brakePressureKpa: [0, 0],
    steerTorqueNm: 0,
    time: 0,
    trackPos: 0,
    ...partial,
  };
}

function run(tel: Telemetry, seconds: number, dof: 2 | 3 | 4 | 5 | 6) {
  const filter = createMotionFilter();
  const travel = { ...DEFAULT_FRAME_TRAVEL, dof };
  let pose = stepMotion(filter, tel, 1 / 60, travel);
  for (let t = 1 / 60; t < seconds; t += 1 / 60) {
    pose = stepMotion(filter, tel, 1 / 60, travel);
  }
  return pose;
}

test("clampDof stays on the 2–6 ladder", () => {
  assert.equal(clampDof(1), 2);
  assert.equal(clampDof(2.4), 2);
  assert.equal(clampDof(4), 4);
  assert.equal(clampDof(9), 6);
});

test("2DOF is lean and pitch only", () => {
  const a = dofAxes(2);
  assert.equal(a.roll && a.pitch, true);
  assert.equal(a.x || a.y || a.z || a.yaw, false);
});

test("maskPose zeros axes the current DOF has not unlocked", () => {
  const raw = { x: 1, y: 1, z: 1, yaw: 1, pitch: 0.2, roll: 0.3 };
  const two = maskPose(raw, 2);
  assert.equal(two.x, 0);
  assert.equal(two.y, 0);
  assert.equal(two.z, 0);
  assert.equal(two.yaw, 0);
  assert.equal(two.pitch, 0.2);
  assert.equal(two.roll, 0.3);
  assert.ok(maskPose(raw, 3).y === 1);
  assert.ok(maskPose(raw, 4).z === 1);
  assert.ok(maskPose(raw, 5).x === 1);
  assert.ok(maskPose(raw, 6).yaw === 1);
});

test("2DOF follows a berm lean and ignores surge", () => {
  const pose = run(sample({ roll: -28, accelG: { x: 0, y: 1, z: 1 }, throttle: 1 }), 0.7, 2);
  assert.ok(pose.roll > 0.28, `roll ${pose.roll}`);
  assert.ok(Math.abs(pose.x) < 0.02, `x ${pose.x}`);
  assert.ok(Math.abs(pose.z) < 0.02, `z ${pose.z}`);
  assert.ok(Math.abs(pose.y) < 0.02, `y ${pose.y}`);
  assert.ok(Math.abs(pose.yaw) < 0.02, `yaw ${pose.yaw}`);
});

test("3DOF adds heave on a jump and still ignores surge", () => {
  const pose = run(
    sample({
      accelG: { x: 0, y: 0.05, z: 1 },
      wheelMaterial: [0, 0],
      velocity: { x: 0, y: 6, z: 14 },
      position: { x: 0, y: 1.4, z: 20 },
      pitch: 8,
    }),
    0.35,
    3,
  );
  assert.ok(pose.y > 0.08, `y ${pose.y}`);
  assert.ok(Math.abs(pose.z) < 0.02, `z ${pose.z}`);
});

test("4DOF unlocks surge washout", () => {
  const pose = run(sample({ speedMs: 0, velocity: { x: 0, y: 0, z: 0 }, accelG: { x: 0, y: 1, z: 1 } }), 2.4, 4);
  assert.ok(pose.z > 0.7, `z ${pose.z}`);
  assert.ok(Math.abs(pose.x) < 0.05, `x ${pose.x}`);
});
