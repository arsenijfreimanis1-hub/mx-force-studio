import assert from "node:assert/strict";
import { test } from "node:test";
import { idleRider, riderFromTelemetry } from "./rider.ts";
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

test("parked rider sits upright", () => {
  const r = riderFromTelemetry(sample());
  assert.equal(r.stand, 0);
  assert.ok(Math.abs(r.lean) < 0.01);
  assert.ok(Math.abs(r.foreAft) < 0.02);
});

test("airborne rider stands", () => {
  const r = riderFromTelemetry(sample({ wheelMaterial: [0, 0], accelG: { x: 0, y: 0.2, z: 0 }, speedMs: 16 }));
  assert.ok(r.stand > 0.8, `stand ${r.stand}`);
});

test("in-game left lean hangs the dummy with the mirrored deck", () => {
  const r = riderFromTelemetry(sample({ roll: -30, speedMs: 12 }));
  assert.ok(r.lean > 0.1, `lean ${r.lean}`);
});

test("front brake sits the dummy back", () => {
  const r = riderFromTelemetry(sample({ frontBrake: 0.8, speedMs: 14, throttle: 0 }));
  assert.ok(r.foreAft < -0.04, `foreAft ${r.foreAft}`);
  assert.ok(r.stand < 0.2);
});

test("idle rider is a sit", () => {
  assert.deepEqual(idleRider(), { stand: 0, lean: 0, foreAft: 0 });
});
