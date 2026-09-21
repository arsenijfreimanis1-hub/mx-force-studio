import assert from "node:assert/strict";
import { test } from "node:test";
import { describeHarness, idleHarness, stepHarness } from "./harness.ts";
import { riderFromTelemetry } from "./rider.ts";
import type { Telemetry } from "./types.ts";

function sample(partial: Partial<Telemetry> = {}): Telemetry {
  return {
    rpm: 4000,
    engineTemp: 80,
    waterTemp: 72,
    gear: 3,
    fuel: 3,
    speedMs: 14,
    position: { x: 4, y: 2, z: 20 },
    velocity: { x: 0, y: 0, z: 14 },
    accelG: { x: 0, y: 1, z: 0.1 },
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
    throttle: 0.4,
    frontBrake: 0,
    rearBrake: 0,
    clutch: 0,
    wheelSpeed: [14, 14],
    wheelMaterial: [3, 3],
    brakePressureKpa: [0, 0],
    steerTorqueNm: 0,
    time: 4,
    trackPos: 0.2,
    ...partial,
  };
}

test("idle belts sit slack-ish on the pegs", () => {
  const h = stepHarness(sample({ speedMs: 0, throttle: 0, velocity: { x: 0, y: 0, z: 0 } }));
  assert.equal(h.mode, "idle");
  assert.ok(h.frontBelt < 0.25 && h.rearBelt < 0.25);
  assert.ok(h.inward < 0.05);
});

test("throttle loads the rear belt, front brake loads the front", () => {
  const gas = stepHarness(sample({ throttle: 1, pitch: -18 }));
  const stop = stepHarness(sample({ throttle: 0, frontBrake: 1, pitch: 12 }));
  assert.equal(gas.mode, "ride");
  assert.ok(gas.rearBelt > gas.frontBelt, `gas F ${gas.frontBelt} R ${gas.rearBelt}`);
  assert.ok(stop.frontBelt > stop.rearBelt, `stop F ${stop.frontBelt} R ${stop.rearBelt}`);
});

test("a berm lean hugs the rider into the bike", () => {
  const tel = sample({ roll: -32 });
  const rider = riderFromTelemetry(tel);
  const h = stepHarness(tel, rider);
  assert.ok(h.inward > 0.45, `inward ${h.inward}`);
  assert.ok(Math.abs(h.chest.x) < Math.abs(rider.lean * 0.12) - 0.01, `chest ${h.chest.x} lean ${rider.lean}`);
  assert.ok(describeHarness(h).includes("ride"));
});

test("jumps slack both belts", () => {
  const h = stepHarness(
    sample({
      wheelMaterial: [0, 0],
      accelG: { x: 0, y: 0.15, z: 0.2 },
      velocity: { x: 0, y: 6, z: 16 },
      speedMs: 16,
    }),
  );
  assert.equal(h.mode, "air");
  assert.ok(h.frontBelt < 0.08 && h.rearBelt < 0.08, JSON.stringify(h));
});

test("landing pulls both belts down after air", () => {
  const airTel = sample({
    wheelMaterial: [0, 0],
    accelG: { x: 0, y: 0.2, z: 0 },
    velocity: { x: 0, y: 5, z: 14 },
    speedMs: 16,
  });
  const air = stepHarness(airTel);
  assert.equal(air.mode, "air");
  const land = stepHarness(sample({ speedMs: 12, accelG: { x: 0, y: 1.4, z: 0 } }), riderFromTelemetry(sample()), undefined, air, 1 / 60);
  assert.equal(land.mode, "land");
  assert.ok(land.frontBelt > 0.7 && land.rearBelt > 0.7, JSON.stringify(land));
  assert.ok(land.chest.y < air.chest.y, `y ${land.chest.y} vs ${air.chest.y}`);
});

test("crash dumps the hug", () => {
  const h = stepHarness(sample({ crashed: true, roll: 90 }));
  assert.equal(h.mode, "crash");
  assert.equal(h.inward, 0);
});

test("idleHarness is a quiet sit", () => {
  const h = idleHarness();
  assert.equal(h.mode, "idle");
  assert.ok(h.frontBelt > 0 && h.frontBelt < 0.2);
});
