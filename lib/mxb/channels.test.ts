import assert from "node:assert/strict";
import { test } from "node:test";
import { chassisCues, heaveFromCues } from "./channels.ts";
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

test("parked cues are a level 1 G bike on sag", () => {
  const c = chassisCues(sample(), 0.205, 0.208);
  assert.equal(c.airborne, false);
  assert.equal(c.heaveG, 0);
  assert.ok(Math.abs(c.bumpM) < 1e-9);
  assert.equal(heaveFromCues(c, 1), 0);
});

test("airborne heave is left to the ballistic path", () => {
  const c = chassisCues(
    sample({ accelG: { x: 0, y: 0.04, z: 0 }, wheelMaterial: [0, 0], velocity: { x: 0, y: -2, z: 12 } }),
    0.205,
    0.208,
  );
  assert.equal(c.airborne, true);
  assert.equal(c.climbMs, -2);
  assert.equal(heaveFromCues(c, 1), 0);
});

test("landing G is absorbed — no upward punch", () => {
  const c = chassisCues(sample({ accelG: { x: 0, y: 2.8, z: 0 } }), 0.205, 0.208);
  assert.ok(heaveFromCues(c, 1) < 0.08, `heave ${heaveFromCues(c, 1)}`);
});

test("compressed shocks lift without a G spike", () => {
  const c = chassisCues(sample({ suspLength: [0.12, 0.12], speedMs: 14 }), 0.205, 0.208);
  assert.ok(c.bumpM > 0.08);
  assert.ok(heaveFromCues(c, 1) > 0.1);
});
