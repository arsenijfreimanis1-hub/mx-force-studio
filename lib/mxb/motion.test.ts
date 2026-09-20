import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMotionFilter,
  DEFAULT_FRAME_TRAVEL,
  stepMotion,
  worldToChassis,
} from "./motion.ts";
import type { Telemetry } from "./types.ts";

function sample(partial: Partial<Telemetry> = {}): Telemetry {
  return {
    rpm: 1950,
    engineTemp: 78,
    waterTemp: 72,
    gear: 0,
    fuel: 3.8,
    speedMs: 0,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
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
    wheelSpeed: [0, 0],
    wheelMaterial: [3, 3],
    brakePressureKpa: [0, 0],
    steerTorqueNm: 0,
    time: 0,
    trackPos: 0,
    ...partial,
  };
}

function run(telemetry: Telemetry, seconds: number, travel = DEFAULT_FRAME_TRAVEL, dt = 1 / 60) {
  const filter = createMotionFilter();
  let pose = stepMotion(filter, telemetry, dt, travel);
  for (let t = dt; t < seconds; t += dt) {
    pose = stepMotion(filter, telemetry, dt, travel);
  }
  return pose;
}

test("parked bike stays at the garage origin", () => {
  const pose = run(sample(), 1.5);
  assert.ok(Math.abs(pose.x) < 0.02, `x ${pose.x}`);
  assert.ok(Math.abs(pose.y) < 0.02, `y ${pose.y}`);
  assert.ok(Math.abs(pose.z) < 0.02, `z ${pose.z}`);
});

test("forward G shoves the frame forward", () => {
  const pose = run(sample({ accelG: { x: 0, y: 1, z: 1.1 } }), 0.35);
  assert.ok(pose.z > 0.12, `z ${pose.z}`);
  assert.ok(pose.z <= 1, `z clamp ${pose.z}`);
});

test("braking G shoves the frame backward", () => {
  const pose = run(sample({ accelG: { x: 0, y: 1.2, z: -1.2 } }), 0.35);
  assert.ok(pose.z < -0.12, `z ${pose.z}`);
});

test("lateral G shoves the frame sideways", () => {
  const pose = run(sample({ accelG: { x: -0.9, y: 1, z: 0 } }), 0.35);
  assert.ok(pose.x < -0.1, `x ${pose.x}`);
});

test("a jump in world Y lifts the frame within 1 m", () => {
  const filter = createMotionFilter();
  const grounded = sample({ position: { x: 0, y: 0, z: 0 } });
  for (let i = 0; i < 30; i++) stepMotion(filter, grounded, 1 / 60);
  const air = sample({
    position: { x: 0, y: 2.4, z: 0 },
    velocity: { x: 0, y: 6, z: 0 },
    accelG: { x: 0, y: 0.05, z: 0 },
    wheelMaterial: [0, 0],
    suspLength: [0.31, 0.312],
  });
  let pose = stepMotion(filter, air, 1 / 60);
  for (let i = 0; i < 20; i++) pose = stepMotion(filter, air, 1 / 60);
  assert.ok(pose.y > 0.2, `y ${pose.y}`);
  assert.ok(pose.y <= 1, `y clamp ${pose.y}`);
});

test("a landing G spike drops the frame", () => {
  const pose = run(sample({ accelG: { x: 0, y: 2.8, z: 0 } }), 0.35);
  assert.ok(pose.y < -0.12, `y ${pose.y}`);
});

test("travel limits are adjustable", () => {
  const pose = run(sample({ accelG: { x: 0, y: 1, z: 3 } }), 0.5, {
    ...DEFAULT_FRAME_TRAVEL,
    limitZ: 0.25,
  });
  assert.ok(pose.z <= 0.25 + 1e-6, `z ${pose.z}`);
  assert.ok(pose.z > 0.1, `z ${pose.z}`);
});

test("world heading maps +X into chassis forward at yaw 90", () => {
  const mapped = worldToChassis(4, 0, 90);
  assert.ok(Math.abs(mapped.fwd - 4) < 1e-6, JSON.stringify(mapped));
  assert.ok(Math.abs(mapped.right) < 1e-6, JSON.stringify(mapped));
});

test("airborne 0G lifts the frame even if world Y is already washed out", () => {
  const pose = run(
    sample({
      position: { x: 0, y: 2.2, z: 0 },
      velocity: { x: 0, y: 0, z: 18 },
      accelG: { x: 0, y: 0.06, z: 0 },
      wheelMaterial: [0, 0],
      suspLength: [0.31, 0.31],
    }),
    0.8,
  );
  assert.ok(pose.y > 0.25, `y ${pose.y}`);
  assert.ok(pose.y <= 1, `y clamp ${pose.y}`);
});

test("steady speed does not pin the frame at the travel limit", () => {
  const pose = run(
    sample({
      speedMs: 18,
      velocity: { x: 0, y: 0, z: 18 },
      position: { x: 0, y: 0, z: 40 },
      accelG: { x: 0, y: 1, z: 0.08 },
    }),
    2.2,
  );
  assert.ok(Math.abs(pose.z) < 0.2, `z ${pose.z}`);
});
