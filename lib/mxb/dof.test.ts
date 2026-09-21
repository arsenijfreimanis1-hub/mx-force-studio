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

function run(tel: Telemetry, seconds: number, extra: Partial<typeof DEFAULT_FRAME_TRAVEL> = {}) {
  const filter = createMotionFilter();
  const travel = { ...DEFAULT_FRAME_TRAVEL, dof: 6 as const, ...extra };
  let pose = stepMotion(filter, tel, 1 / 60, travel);
  for (let t = 1 / 60; t < seconds; t += 1 / 60) {
    pose = stepMotion(filter, tel, 1 / 60, travel);
  }
  return pose;
}

test("clampDof is always 6", () => {
  assert.equal(clampDof(1), 6);
  assert.equal(clampDof(2.4), 6);
  assert.equal(clampDof(4), 6);
  assert.equal(clampDof(9), 6);
});

test("6DOF keeps every axis", () => {
  const a = dofAxes(6);
  assert.equal(a.roll && a.pitch && a.yaw && a.x && a.y && a.z, true);
});

test("maskPose no longer zeros axes", () => {
  const raw = { x: 1, y: 1, z: 1, yaw: 1, pitch: 0.2, roll: 0.3 };
  assert.deepEqual(maskPose(raw, 6), raw);
});

test("6DOF follows a berm lean", () => {
  const pose = run(sample({ roll: -28, accelG: { x: 0, y: 1, z: 1 }, throttle: 1 }), 0.7);
  assert.ok(pose.roll > 0.28, `roll ${pose.roll}`);
});

test("6DOF heave on a jump", () => {
  const pose = run(
    sample({
      accelG: { x: 0, y: 0.05, z: 1 },
      wheelMaterial: [0, 0],
      velocity: { x: 0, y: 6, z: 14 },
      position: { x: 0, y: 1.4, z: 20 },
      pitch: 8,
    }),
    0.35,
  );
  assert.ok(pose.y > 0.08, `y ${pose.y}`);
});

test("6DOF surge washout", () => {
  const pose = run(
    sample({ speedMs: 0, velocity: { x: 0, y: 0, z: 0 }, accelG: { x: 0, y: 1, z: 1 } }),
    2.4,
    { rodStroke: 1 },
  );
  assert.ok(pose.z > 0.7, `z ${pose.z}`);
});

test("6DOF keeps yaw", () => {
  const pose = run(sample({ yawRate: 90, speedMs: 12 }), 0.5);
  assert.ok(Math.abs(pose.yaw) > 0.03, `yaw ${pose.yaw}`);
});
