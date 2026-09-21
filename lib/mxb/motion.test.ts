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
  HUMAN_ANG_RS,
  HUMAN_LIN_MS,
  identityPose,
  limitShownPose,
  PLATFORM_HOME_Y,
  specificForceG,
  stepMotion,
  STUDIO_TRAVEL,
  visualPitch,
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

test("braking G shoves the frame backward without a parked nod", () => {
  const pose = run(sample({ accelG: { x: 0, y: 1.2, z: -1.2 }, pitch: -8, frontBrake: 1 }), 2.4);
  assert.ok(pose.z <= -0.98, `z ${pose.z}`);
  assert.ok(pose.z >= -1, `z clamp ${pose.z}`);
  assert.ok(Math.abs(pose.pitch) < 0.04, `pitch ${pose.pitch}`);
});

test("lateral G shoves the frame sideways 1 m per G", () => {
  const pose = run(sample({ accelG: { x: -0.9, y: 1, z: 0 } }), 2.5, {
    ...DEFAULT_FRAME_TRAVEL,
    limitX: 2,
  });
  assert.ok(Math.abs(pose.x - -0.9) < 0.05, `x ${pose.x}`);
});

test("coordinated lean rolls the platform with the bike", () => {
  const pose = run(sample({ speedMs: 12, roll: -32, accelG: { x: 0.08, y: 1.05, z: 0.1 } }), 0.6);
  assert.ok(pose.roll > 0.45, `roll ${pose.roll}`);
  assert.ok(pose.roll <= DEFAULT_FRAME_TRAVEL.limitRoll + 1e-6, `clamp ${pose.roll}`);
  assert.ok(Math.abs(pose.x) < 0.15, `sway ${pose.x}`);
});

test("a jump rises then falls on a parabola", () => {
  const filter = createMotionFilter();
  const dt = 1 / 60;
  const v0 = 8;
  let peak = -Infinity;
  let yAtRise = 0;
  let yAtFall = 0;
  for (let i = 0; i < 90; i++) {
    const t = i * dt;
    const vy = v0 - GRAVITY * t;
    const py = v0 * t - 0.5 * GRAVITY * t * t;
    const pose = stepMotion(
      filter,
      sample({
        accelG: { x: 0, y: 0.05, z: 0 },
        wheelMaterial: [0, 0],
        velocity: { x: 0, y: vy, z: 14 },
        position: { x: 0, y: py, z: 20 },
        pitch: 6,
      }),
      dt,
    );
    if (i === 18) yAtRise = pose.y;
    if (pose.y > peak) peak = pose.y;
    if (i === 70) yAtFall = pose.y;
  }
  assert.ok(yAtRise > 0.12, `rise ${yAtRise}`);
  assert.ok(peak > yAtRise, `peak ${peak}`);
  assert.ok(yAtFall < peak - 0.08, `fall ${yAtFall} vs peak ${peak}`);
});

test("falling airtime drops the deck instead of hovering", () => {
  const pose = run(
    sample({
      accelG: { x: 0, y: 0.04, z: 0 },
      pitch: 8,
      wheelMaterial: [0, 0],
      velocity: { x: 0, y: -6, z: 12 },
      position: { x: 0, y: -1.2, z: 10 },
    }),
    0.35,
  );
  assert.ok(pose.y < -0.15, `y ${pose.y}`);
});

test("landing compresses the deck and does not hop up", () => {
  const filter = createMotionFilter();
  const dt = 1 / 60;
  let pose = identityPose();
  for (let i = 0; i < 55; i++) {
    const t = i * dt;
    pose = stepMotion(
      filter,
      sample({
        accelG: { x: 0, y: 0.05, z: 0 },
        wheelMaterial: [0, 0],
        velocity: { x: 0, y: 5 - GRAVITY * t, z: 14 },
        position: { x: 0, y: 5 * t - 0.5 * GRAVITY * t * t, z: 16 },
      }),
      dt,
    );
  }
  let maxLand = -Infinity;
  let minLand = Infinity;
  let settledLand = 0;
  for (let i = 0; i < 36; i++) {
    pose = stepMotion(
      filter,
      sample({
        accelG: { x: 0, y: 2.8, z: 0 },
        pitch: -6,
        wheelMaterial: [3, 3],
        velocity: { x: 0, y: -2, z: 10 },
        suspLength: [0.11, 0.12],
      }),
      dt,
    );
    if (i === 8) settledLand = pose.y;
    if (i >= 8) {
      maxLand = Math.max(maxLand, pose.y);
      minLand = Math.min(minLand, pose.y);
    }
  }
  assert.ok(settledLand <= 0.02, `touchdown leftover ${settledLand}`);
  assert.ok(maxLand < 0.12, `landing hop ${maxLand}`);
  assert.ok(minLand < -0.05, `compress ${minLand}`);
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

test("moving world XYZ drives the deck on the Cartesian frame", () => {
  const filter = createMotionFilter();
  const dt = 1 / 60;
  let z = 80;
  const cruise = 14;
  let pose = identityPose();
  for (let i = 0; i < 90; i++) {
    z += cruise * dt;
    pose = stepMotion(
      filter,
      sample({
        speedMs: cruise,
        position: { x: 6, y: 3.2, z },
        velocity: { x: 0, y: 0, z: cruise },
        accelG: { x: 0, y: 1, z: 0 },
      }),
      dt,
    );
  }
  assert.ok(Math.abs(pose.z) < 0.16, `cruise z ${pose.z}`);
  let surge = -Infinity;
  let v = cruise;
  for (let i = 0; i < 40; i++) {
    v += 8 * dt;
    z += v * dt;
    pose = stepMotion(
      filter,
      sample({
        speedMs: v,
        position: { x: 6, y: 3.2, z },
        velocity: { x: 0, y: 0, z: v },
        accelG: { x: 0, y: 1, z: 0.35 },
      }),
      dt,
    );
    surge = Math.max(surge, pose.z);
  }
  assert.ok(surge > 0.04, `cartesian surge ${surge}`);
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

test("PiBoSo in-game left (negative roll) leans the deck the other way on cam", () => {
  const pose = run(sample({ speedMs: 12, roll: -28, accelG: { x: 0, y: 1, z: 0 } }), 0.8);
  assert.ok(pose.roll > 0.35, `roll ${pose.roll}`);
});

test("PiBoSo in-game right (positive roll) leans the opposite deck side", () => {
  const pose = run(sample({ speedMs: 12, roll: 28, accelG: { x: 0, y: 1, z: 0 } }), 0.8);
  assert.ok(pose.roll < -0.35, `roll ${pose.roll}`);
});

test("plugin Euler lean wins over a heading-looking matrix", () => {
  const pose = run(
    sample({ speedMs: 12, roll: -28, rot: rzRoll(32), accelG: { x: 0, y: 1, z: 0 } }),
    0.8,
  );
  assert.ok(pose.roll > 0.35, `euler lean ${pose.roll}`);
});

test("throttle lifts the front, front brake drops it", () => {
  const gas = run(sample({ speedMs: 12, throttle: 1, accelG: { x: 0, y: 1, z: 0.8 }, pitch: 10 }), 0.8);
  const brake = run(sample({ speedMs: 12, frontBrake: 1, accelG: { x: 0, y: 1.1, z: -1 }, pitch: -10 }), 0.8);
  assert.ok(gas.pitch > 0.12, `gas pitch ${gas.pitch}`);
  assert.ok(brake.pitch < -0.12, `brake pitch ${brake.pitch}`);
});

test("parked full brake does not nod or lean the deck", () => {
  const pose = run(
    sample({
      speedMs: 0,
      frontBrake: 1,
      rearBrake: 0.4,
      accelG: { x: 0.15, y: 1.1, z: -1 },
      pitch: -10,
      roll: 6,
    }),
    1.2,
  );
  assert.ok(Math.abs(pose.pitch) < 0.03, `pitch ${pose.pitch}`);
  assert.ok(Math.abs(pose.roll) < 0.03, `roll ${pose.roll}`);
});

test("compressed shocks lift the deck on a 1 G whoop", () => {
  const pose = run(sample({ suspLength: [0.12, 0.12], speedMs: 15, accelG: { x: 0, y: 1, z: 0 } }), 1.1);
  assert.ok(pose.y > 0.08, `y ${pose.y}`);
});

test("noisy roll rate does not shake a steady lean", () => {
  const filter = createMotionFilter();
  const dt = 1 / 100;
  let pose = identityPose();
  for (let i = 0; i < 50; i++) {
    pose = stepMotion(filter, sample({ speedMs: 12, roll: -24, rollRate: 0, accelG: { x: 0, y: 1, z: 0 } }), dt);
  }
  let min = pose.roll;
  let max = pose.roll;
  for (let i = 0; i < 180; i++) {
    const rate = i % 2 === 0 ? 160 : -160;
    pose = stepMotion(filter, sample({ speedMs: 12, roll: -24, rollRate: rate, accelG: { x: 0, y: 1, z: 0 } }), dt);
    min = Math.min(min, pose.roll);
    max = Math.max(max, pose.roll);
  }
  assert.ok(max - min < 0.08, `roll wander ${max - min}`);
});

test("standing still on track does not lean or walk the deck", () => {
  const pose = run(
    sample({
      speedMs: 0,
      position: { x: 82, y: 4.1, z: -140 },
      velocity: { x: 0.02, y: 0, z: 0.03 },
      accelG: { x: 0.12, y: 9.7, z: -0.1 },
      roll: 9,
      pitch: -3,
      yaw: 40,
    }),
    1.4,
  );
  assert.ok(Math.abs(pose.x) < 0.04, `x ${pose.x}`);
  assert.ok(Math.abs(pose.z) < 0.04, `z ${pose.z}`);
  assert.ok(Math.abs(pose.roll) < 0.04, `roll ${pose.roll}`);
  assert.ok(Math.abs(pose.pitch) < 0.05, `pitch ${pose.pitch}`);
});

test("stopped IMU noise does not jitter the deck", () => {
  const pose = run(
    sample({
      accelG: { x: 0.08, y: 1.04, z: -0.06 },
      roll: 1.4,
      pitch: -1.1,
      yawRate: 8,
    }),
    1.6,
  );
  assert.ok(Math.abs(pose.x) < 0.04, `x ${pose.x}`);
  assert.ok(Math.abs(pose.z) < 0.04, `z ${pose.z}`);
  assert.ok(Math.abs(pose.roll) < 0.05, `roll ${pose.roll}`);
  assert.ok(Math.abs(pose.pitch) < 0.05, `pitch ${pose.pitch}`);
});

test("a crash lays the bike over instead of snapping upright", () => {
  const pose = run(sample({ crashed: true, roll: 86, pitch: -20, speedMs: 3 }), 0.45);
  assert.ok(Math.abs(pose.roll) > 0.5, `crash roll ${pose.roll}`);
  assert.ok(pose.y < -0.05, `crash y ${pose.y}`);
});

test("one-step pose change is capped like a rider is on the frame", () => {
  const filter = createMotionFilter();
  const dt = 1 / 60;
  const pose = stepMotion(
    filter,
    sample({
      roll: -40,
      pitch: 18,
      accelG: { x: 0, y: 1, z: 2 },
      throttle: 1,
      speedMs: 20,
      wheelMaterial: [3, 3],
    }),
    dt,
  );
  assert.ok(Math.hypot(pose.x, pose.y, pose.z) <= HUMAN_LIN_MS * dt + 1e-6, `lin ${JSON.stringify(pose)}`);
  assert.ok(Math.abs(pose.roll) <= HUMAN_ANG_RS * dt + 1e-6, `roll ${pose.roll}`);
  assert.ok(Math.abs(pose.pitch) <= HUMAN_ANG_RS * dt + 1e-6, `pitch ${pose.pitch}`);
});

test("limitShownPose never jumps more than the human rate", () => {
  const next = limitShownPose(
    identityPose(),
    { x: 2, y: -2, z: 2, yaw: 1, pitch: -1, roll: 1 },
    1 / 60,
  );
  assert.ok(Math.abs(next.x) <= HUMAN_LIN_MS / 60 + 1e-9);
  assert.ok(Math.abs(next.y) <= HUMAN_LIN_MS / 60 + 1e-9);
  assert.ok(Math.abs(next.roll) <= HUMAN_ANG_RS / 60 + 1e-9);
});

test("accel unit lock does not flicker across the 4.2 G edge", () => {
  assert.equal(detectForceUnitsMs2(9.8, null), true);
  assert.equal(detectForceUnitsMs2(1, null), false);
  assert.equal(detectForceUnitsMs2(3.9, true), true);
  assert.equal(detectForceUnitsMs2(5.5, false), false);
  const locked = specificForceG({ x: 0, y: 3.9, z: 0 }, true);
  assert.ok(Math.abs(locked.y - 3.9 / 9.80665) < 1e-6, JSON.stringify(locked));
});

test("Three.js pitch is inverted so a PiBoSo wheelie draws nose-up", () => {
  assert.equal(visualPitch(0.3), -0.3);
  assert.equal(visualPitch(-0.2, -1), 0.2);
  assert.equal(visualPitch(0.3, 1), 0.3);
  const gas = run(sample({ speedMs: 12, throttle: 1, accelG: { x: 0, y: 1, z: 0.8 }, pitch: 14 }), 0.8);
  assert.ok(gas.pitch > 0.12, `pose pitch ${gas.pitch}`);
  assert.ok(visualPitch(gas.pitch) < -0.12, `visual pitch ${visualPitch(gas.pitch)}`);
});

test("pad demo wheelie at standstill still pitches when park lock is off", () => {
  const locked = run(sample({ speedMs: 0, pitch: 22, throttle: 0.2 }), 0.7);
  assert.ok(Math.abs(locked.pitch) < 0.04, `live parked ${locked.pitch}`);
  const demo = run(sample({ speedMs: 0, pitch: 22, throttle: 0.2 }), 0.7, {
    ...DEFAULT_FRAME_TRAVEL,
    parkLock: false,
  });
  assert.ok(demo.pitch > 0.2, `demo wheelie ${demo.pitch}`);
  assert.ok(visualPitch(demo.pitch) < -0.2, `demo visual ${visualPitch(demo.pitch)}`);
});

test("studio 6DOF travel unlocks heave surge sway and yaw", () => {
  assert.equal(STUDIO_TRAVEL.dof, 6);
  assert.ok(STUDIO_TRAVEL.limitX > 0.5 && STUDIO_TRAVEL.limitY > 0.5 && STUDIO_TRAVEL.limitZ > 0.5);
  assert.ok(STUDIO_TRAVEL.limitYaw > 0.2 && STUDIO_TRAVEL.rateLin > HUMAN_LIN_MS);
  const tilt = run(
    sample({
      speedMs: 14,
      yawRate: 70,
      accelG: { x: 0, y: 1, z: 0 },
      pitch: 12,
      roll: -20,
      suspLength: [0.12, 0.12],
    }),
    0.9,
    STUDIO_TRAVEL,
  );
  assert.ok(Math.abs(tilt.roll) > 0.15, `roll ${tilt.roll}`);
  assert.ok(Math.abs(tilt.pitch) > 0.08, `pitch ${tilt.pitch}`);
  assert.ok(Math.abs(tilt.y) > 0.04, `heave ${tilt.y}`);
  assert.ok(Math.abs(tilt.yaw) > 0.02, `yaw ${tilt.yaw}`);
  const shove = run(
    sample({ speedMs: 0, velocity: { x: 0, y: 0, z: 0 }, accelG: { x: -0.5, y: 1, z: 0.7 } }),
    1.2,
    STUDIO_TRAVEL,
  );
  assert.ok(shove.z > 0.2, `surge ${shove.z}`);
  assert.ok(shove.x < -0.15, `sway ${shove.x}`);
});
