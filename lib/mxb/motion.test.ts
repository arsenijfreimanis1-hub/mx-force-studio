import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMotionFilter,
  DEFAULT_FRAME_TRAVEL,
  stepMotion,
  washoutStepResponse,
  worldToChassis,
} from "./motion.ts";
import { GRAVITY } from "./bike.ts";
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
  const pose = run(sample(), 2.5);
  assert.ok(Math.abs(pose.x) < 0.01, `x ${pose.x}`);
  assert.ok(Math.abs(pose.y) < 0.01, `y ${pose.y}`);
  assert.ok(Math.abs(pose.z) < 0.01, `z ${pose.z}`);
});

test("1 G of surge settles at 1 m (ω² = g)", () => {
  const seconds = 2.6;
  const pose = run(sample({ accelG: { x: 0, y: 1, z: 1 } }), seconds, {
    ...DEFAULT_FRAME_TRAVEL,
    limitZ: 2,
  });
  const expected = washoutStepResponse(GRAVITY, seconds);
  assert.ok(Math.abs(expected - 1) < 0.02, `closed form ${expected}`);
  assert.ok(Math.abs(pose.z - expected) < 0.03, `z ${pose.z} vs ${expected}`);
});

test("integrator matches the critically damped closed form at 1 s", () => {
  const seconds = 1;
  const pose = run(sample({ accelG: { x: 0, y: 1, z: 1 } }), seconds, {
    ...DEFAULT_FRAME_TRAVEL,
    limitZ: 2,
  });
  const expected = washoutStepResponse(GRAVITY, seconds);
  assert.ok(expected > 0.78 && expected < 0.86, `expected ${expected}`);
  assert.ok(Math.abs(pose.z - expected) < 0.02, `z ${pose.z} vs ${expected}`);
});

test("forward G shoves the frame forward", () => {
  const pose = run(sample({ accelG: { x: 0, y: 1, z: 1.1 } }), 0.4);
  assert.ok(pose.z > 0.25, `z ${pose.z}`);
  assert.ok(pose.z <= 1, `z clamp ${pose.z}`);
});

test("braking G shoves the frame backward and clamps at the travel limit", () => {
  const pose = run(sample({ accelG: { x: 0, y: 1.2, z: -1.2 } }), 2.4);
  assert.ok(pose.z <= -0.98, `z ${pose.z}`);
  assert.ok(pose.z >= -1, `z clamp ${pose.z}`);
});

test("lateral G shoves the frame sideways 1 m per G", () => {
  const pose = run(sample({ accelG: { x: -0.9, y: 1, z: 0 } }), 2.5, {
    ...DEFAULT_FRAME_TRAVEL,
    limitX: 2,
  });
  assert.ok(Math.abs(pose.x - -0.9) < 0.05, `x ${pose.x}`);
});

test("a jump in world Y lifts the frame 1:1 then clamps at 1 m", () => {
  const filter = createMotionFilter();
  const grounded = sample({ position: { x: 0, y: 0.02, z: 0 } });
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
  assert.ok(pose.y > 0.98, `y ${pose.y}`);
  assert.ok(pose.y <= 1, `y clamp ${pose.y}`);
});

test("airborne height is not washed out to zero", () => {
  const pose = run(
    sample({
      position: { x: 0, y: 2.2, z: 0 },
      velocity: { x: 0, y: 0, z: 18 },
      accelG: { x: 0, y: 0.06, z: 0 },
      wheelMaterial: [0, 0],
      suspLength: [0.31, 0.31],
    }),
    2.5,
  );
  assert.ok(pose.y > 0.98, `y ${pose.y}`);
  assert.ok(pose.y <= 1, `y clamp ${pose.y}`);
});

test("weightlessness still lifts when world Y is missing", () => {
  const pose = run(
    sample({
      position: { x: 0, y: 0, z: 0 },
      accelG: { x: 0, y: 0.02, z: 0 },
      wheelMaterial: [0, 0],
    }),
    2.5,
  );
  assert.ok(pose.y > 0.9, `y ${pose.y}`);
  assert.ok(pose.y <= 1, `y clamp ${pose.y}`);
});

test("a landing G spike drops the frame toward -1 m", () => {
  const pose = run(sample({ accelG: { x: 0, y: 2.8, z: 0 } }), 2.4);
  assert.ok(pose.y < -0.98, `y ${pose.y}`);
  assert.ok(pose.y >= -1, `y clamp ${pose.y}`);
});

test("travel limits are adjustable", () => {
  const pose = run(sample({ accelG: { x: 0, y: 1, z: 3 } }), 1.2, {
    ...DEFAULT_FRAME_TRAVEL,
    limitZ: 0.25,
  });
  assert.ok(pose.z <= 0.25 + 1e-6, `z ${pose.z}`);
  assert.ok(pose.z > 0.2, `z ${pose.z}`);
});

test("world heading maps +X into chassis forward at yaw 90", () => {
  const mapped = worldToChassis(4, 0, 90);
  assert.ok(Math.abs(mapped.fwd - 4) < 1e-6, JSON.stringify(mapped));
  assert.ok(Math.abs(mapped.right) < 1e-6, JSON.stringify(mapped));
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
  assert.ok(Math.abs(pose.z) < 0.12, `z ${pose.z}`);
});

test("when surge G returns to zero the frame comes home", () => {
  const filter = createMotionFilter();
  const accel = sample({ accelG: { x: 0, y: 1, z: 1 } });
  const coast = sample({ accelG: { x: 0, y: 1, z: 0 } });
  for (let i = 0; i < 150; i++) stepMotion(filter, accel, 1 / 60);
  assert.ok(filter.shown.z > 0.85, `loaded ${filter.shown.z}`);
  let pose = filter.shown;
  for (let i = 0; i < 180; i++) pose = stepMotion(filter, coast, 1 / 60);
  assert.ok(Math.abs(pose.z) < 0.12, `home ${pose.z}`);
});
