import assert from "node:assert/strict";
import { test } from "node:test";
import { detectCrash, isAirborne, isParked, isStopped } from "./crash.ts";
import type { Telemetry } from "./types.ts";

function sample(partial: Partial<Telemetry> = {}): Telemetry {
  return {
    rpm: 0,
    engineTemp: 70,
    waterTemp: 70,
    gear: 0,
    fuel: 3,
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
    suspLength: [0.2, 0.2],
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

test("plugin crashed flag is a crash", () => {
  assert.equal(detectCrash(sample({ crashed: true })), true);
});

test("a high-side roll is a crash even if the flag lags", () => {
  assert.equal(detectCrash(sample({ roll: 80, speedMs: 8 })), true);
});

test("an upright bike is not a crash", () => {
  assert.equal(detectCrash(sample({ roll: 18, speedMs: 12 })), false);
});

test("a still bike with IMU noise is stopped", () => {
  assert.equal(isStopped(sample({ accelG: { x: 0.04, y: 1.02, z: -0.03 }, roll: 1.2 })), true);
});

test("a berm lean is not treated as stopped", () => {
  assert.equal(isStopped(sample({ roll: -28, speedMs: 0 })), false);
});

test("parked m/s² accel and a 10° Euler bias are still stopped", () => {
  assert.equal(
    isStopped(sample({ accelG: { x: 0.2, y: 9.7, z: -0.15 }, roll: 10, pitch: -4 })),
    true,
  );
});

test("holding the brake while parked is still parked", () => {
  assert.equal(
    isParked(sample({ frontBrake: 1, accelG: { x: 0, y: 1.1, z: -1 }, speedMs: 0 })),
    true,
  );
  assert.equal(isParked(sample({ speedMs: 12, frontBrake: 1 })), false);
});

test("parked wheels reporting air are not a jump", () => {
  assert.equal(isAirborne(sample({ wheelMaterial: [0, 0], speedMs: 0 })), false);
  assert.equal(isAirborne(sample({ wheelMaterial: [0, 0], velocity: { x: 0, y: 6, z: 12 } })), true);
});
