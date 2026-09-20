import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMotionFilter,
  clearPoseFromFloor,
  DEFAULT_FRAME_TRAVEL,
  detectForceUnitsMs2,
  FLOOR_CLEAR_Y,
  FRAME_HALF_SPAN,
  FRAME_LOW_Y,
  PLATFORM_HOME_Y,
  specificForceG,
  stepMotion,
  washoutStepResponse,
  worldToChassis,
} from "./motion.ts";
import { rzRoll } from "./attitude.ts";
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

test("parked bike stays at the garage origin with level deck", () => {
  const pose = run(sample(), 2.5);
  assert.ok(Math.abs(pose.x) < 0.01, `x ${pose.x}`);
  assert.ok(Math.abs(pose.y) < 0.01, `y ${pose.y}`);
  assert.ok(Math.abs(pose.z) < 0.01, `z ${pose.z}`);
  assert.ok(Math.abs(pose.roll) < 0.02, `roll ${pose.roll}`);
  assert.ok(Math.abs(pose.pitch) < 0.02, `pitch ${pose.pitch}`);
  assert.ok(Math.abs(pose.yaw) < 0.02, `yaw ${pose.yaw}`);
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
  assert.ok(Math.abs(pose.z - expected) < 0.02, `z ${pose.z} vs ${expected}`);
});

test("braking G shoves the frame backward and pitches the deck", () => {
  const pose = run(sample({ accelG: { x: 0, y: 1.2, z: -1.2 }, pitch: -8 }), 2.4);
  assert.ok(pose.z <= -0.98, `z ${pose.z}`);
  assert.ok(pose.z >= -1, `z clamp ${pose.z}`);
  assert.ok(pose.pitch < -0.08, `pitch ${pose.pitch}`);
});

test("lateral G shoves the frame sideways 1 m per G", () => {
  const pose = run(sample({ accelG: { x: -0.9, y: 1, z: 0 } }), 2.5, {
    ...DEFAULT_FRAME_TRAVEL,
    limitX: 2,
  });
  assert.ok(Math.abs(pose.x - -0.9) < 0.05, `x ${pose.x}`);
});

test("coordinated lean rolls the platform with the bike", () => {
  const pose = run(sample({ roll: 32, accelG: { x: -0.08, y: 1.05, z: 0.1 } }), 0.6);
  assert.ok(pose.roll > 0.45, `roll ${pose.roll}`);
  assert.ok(pose.roll <= DEFAULT_FRAME_TRAVEL.limitRoll + 1e-6, `clamp ${pose.roll}`);
  assert.ok(Math.abs(pose.x) < 0.15, `sway ${pose.x}`);
});

test("jump 0G drops the seat within 250 ms", () => {
  const pose = run(
    sample({
      accelG: { x: 0, y: 0.04, z: 0 },
      pitch: 8,
      wheelMaterial: [0, 0],
    }),
    0.25,
  );
  assert.ok(pose.y < -0.5, `onset y ${pose.y}`);
});

test("jump 0G unloads the seat — platform drops, not lifts", () => {
  const pose = run(
    sample({
      accelG: { x: 0, y: 0.04, z: 0 },
      pitch: 8,
      wheelMaterial: [0, 0],
      position: { x: 0, y: 2.2, z: 0 },
    }),
    2.5,
  );
  assert.ok(pose.y < -0.85, `y ${pose.y}`);
  assert.ok(pose.y >= -1, `y clamp ${pose.y}`);
  assert.ok(pose.pitch > 0.05, `pitch ${pose.pitch}`);
});

test("landing G spike punches the platform up into the rider", () => {
  const pose = run(sample({ accelG: { x: 0, y: 2.8, z: 0 }, pitch: -6 }), 2.4);
  assert.ok(pose.y > 0.98, `y ${pose.y}`);
  assert.ok(pose.y <= 1, `y clamp ${pose.y}`);
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

test("m/s² accelerometer readings are converted to G", () => {
  const g = specificForceG({ x: 0, y: 9.80665, z: 0 });
  assert.ok(Math.abs(g.y - 1) < 1e-6, JSON.stringify(g));
  const alreadyG = specificForceG({ x: 0, y: 1, z: 0 });
  assert.ok(Math.abs(alreadyG.y - 1) < 1e-9, JSON.stringify(alreadyG));
});

test("yaw rate yaws the deck then washes out", () => {
  const filter = createMotionFilter();
  const turning = sample({ yawRate: 80 });
  let pose = stepMotion(filter, turning, 1 / 60);
  for (let i = 0; i < 40; i++) pose = stepMotion(filter, turning, 1 / 60);
  assert.ok(Math.abs(pose.yaw) > 0.04, `onset ${pose.yaw}`);
  const straight = sample({ yawRate: 0 });
  for (let i = 0; i < 180; i++) pose = stepMotion(filter, straight, 1 / 60);
  assert.ok(Math.abs(pose.yaw) < 0.05, `home ${pose.yaw}`);
});

test("40° roll at −1 m heave stays above the garage pad", () => {
  const pose = clearPoseFromFloor({
    x: 0,
    y: -1,
    z: 0,
    yaw: 0,
    pitch: 0,
    roll: (40 * Math.PI) / 180,
  });
  const drop = FRAME_HALF_SPAN * Math.abs(Math.sin(pose.roll));
  const lowest = PLATFORM_HOME_Y + pose.y + FRAME_LOW_Y - drop;
  assert.ok(lowest >= FLOOR_CLEAR_Y - 1e-9, `lowest ${lowest}`);
});

test("floor clamp lifts a low home so tubes clear 0.12 m", () => {
  const pose = clearPoseFromFloor(
    {
      x: 0,
      y: -1,
      z: 0,
      yaw: 0,
      pitch: 0,
      roll: (40 * Math.PI) / 180,
    },
    0.4,
  );
  const drop = FRAME_HALF_SPAN * Math.abs(Math.sin(pose.roll));
  const lowest = 0.4 + pose.y + FRAME_LOW_Y - drop;
  assert.ok(lowest >= FLOOR_CLEAR_Y - 1e-6, `lowest ${lowest}`);
  assert.ok(pose.y > -1, `lifted y ${pose.y}`);
});

test("jump drop still reaches −0.5 m inside 0.25 s with live EMA", () => {
  const pose = run(
    sample({
      accelG: { x: 0, y: 0.04, z: 0 },
      pitch: 8,
      wheelMaterial: [0, 0],
    }),
    0.25,
    { ...DEFAULT_FRAME_TRAVEL, smoothTau: 0.05 },
  );
  assert.ok(pose.y < -0.5, `onset y ${pose.y}`);
});

test("positive MX Bikes roll is a left lean on the deck", () => {
  const pose = run(sample({ roll: 28, accelG: { x: 0, y: 1, z: 0 } }), 0.8);
  assert.ok(pose.roll > 0.35, `roll ${pose.roll}`);
});

test("MaxTM chassis matrix lean wins over a stale Euler roll", () => {
  const pose = run(
    sample({ roll: -28, rot: rzRoll(28), accelG: { x: 0, y: 1, z: 0 } }),
    0.8,
  );
  assert.ok(pose.roll > 0.35, `matrix lean ${pose.roll}`);
});

test("noisy roll rate does not shake a steady lean", () => {
  const filter = createMotionFilter();
  const dt = 1 / 100;
  let pose = stepMotion(filter, sample({ roll: 24, rollRate: 0 }), dt);
  let min = pose.roll;
  let max = pose.roll;
  for (let i = 0; i < 180; i++) {
    const rate = i % 2 === 0 ? 160 : -160;
    pose = stepMotion(filter, sample({ roll: 24, rollRate: rate, accelG: { x: 0, y: 1, z: 0 } }), dt);
    min = Math.min(min, pose.roll);
    max = Math.max(max, pose.roll);
  }
  assert.ok(max - min < 0.08, `roll wander ${max - min}`);
});

test("accel unit lock does not flicker across the 4.2 G edge", () => {
  assert.equal(detectForceUnitsMs2(9.8, null), true);
  assert.equal(detectForceUnitsMs2(1, null), false);
  assert.equal(detectForceUnitsMs2(3.9, true), true);
  assert.equal(detectForceUnitsMs2(5.5, false), false);
  const locked = specificForceG({ x: 0, y: 3.9, z: 0 }, true);
  assert.ok(Math.abs(locked.y - 3.9 / 9.80665) < 1e-6, JSON.stringify(locked));
});
