import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeTelemetry } from "./live-store.ts";
import { sanitizeTelemetry, unit01 } from "./sanitize.ts";
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

test("unit01 drops uninitialized plugin junk and keeps a real pedal", () => {
  assert.equal(unit01(0.6), 0.6);
  assert.equal(unit01(0), 0);
  assert.equal(unit01(0.015), 0);
  assert.equal(unit01(12.4), 0);
  assert.equal(unit01(-8), 0);
  assert.equal(unit01(Number.NaN, 0.3), 0.3);
});

test("garbage throttle and brake become zero instead of sticking on the HUD", () => {
  const dirty = sample({
    throttle: 847,
    frontBrake: -40,
    rearBrake: 1.9,
    clutch: 99,
    steer: 400,
    rpm: 1e6,
    speedMs: 240,
  });
  const clean = sanitizeTelemetry(dirty);
  assert.equal(clean.throttle, 0);
  assert.equal(clean.frontBrake, 0);
  assert.equal(clean.rearBrake, 0);
  assert.equal(clean.clutch, 0);
  assert.equal(clean.steer, 0);
  assert.equal(clean.rpm, 0);
  assert.equal(clean.speedMs, 0);
});

test("a real 0.6 throttle stays 0.6 after sanitize", () => {
  const clean = sanitizeTelemetry(sample({ throttle: 0.6, frontBrake: 0.35, clutch: 0.2 }));
  assert.equal(clean.throttle, 0.6);
  assert.equal(clean.frontBrake, 0.35);
  assert.equal(clean.clutch, 0.2);
});

test("normalizeTelemetry sanitizes junk pedals and still fills holes", () => {
  const prev = sample({ rpm: 9000, steer: -12, clutch: 0.4, throttle: 0.55 });
  const next = normalizeTelemetry(
    sample({
      rpm: Number.NaN,
      steer: Number.NaN,
      clutch: Number.NaN,
      throttle: 512,
      frontBrake: 77,
      speedMs: 14,
    }),
    prev,
  );
  assert.equal(next.rpm, 9000);
  assert.equal(next.steer, -12);
  assert.equal(next.clutch, 0.4);
  assert.equal(next.throttle, 0);
  assert.equal(next.frontBrake, 0);
  assert.equal(next.speedMs, 14);
});
