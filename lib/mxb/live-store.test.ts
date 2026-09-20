import assert from "node:assert/strict";
import { test } from "node:test";
import { isLive, mergeEvent, normalizeTelemetry, STALE_MS } from "./live-store.ts";
import type { LivePacket, Telemetry } from "./types.ts";

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

test("empty bikeName does not clobber a selected bike", () => {
  const prev = mergeEvent(undefined, { bikeName: "Honda CRF450R", bikeId: "crf450" });
  const next = mergeEvent(prev, { bikeName: "", bikeId: "" });
  assert.equal(next.bikeName, "Honda CRF450R");
  assert.equal(next.bikeId, "crf450");
});

test("whitespace bikeName keeps previous", () => {
  const prev = mergeEvent(undefined, { bikeName: "YZ250F" });
  const next = mergeEvent(prev, { bikeName: "   " });
  assert.equal(next.bikeName, "YZ250F");
});

test("a real name switch is kept for any selected bike", () => {
  const prev = mergeEvent(undefined, { bikeName: "50cc auto" });
  const next = mergeEvent(prev, { bikeName: "450 4-stroke" });
  assert.equal(next.bikeName, "450 4-stroke");
});

test("live window is 150 ms", () => {
  assert.equal(STALE_MS, 150);
  const fresh = { receivedAt: Date.now() - 80 } as LivePacket;
  const stale = { receivedAt: Date.now() - 400 } as LivePacket;
  assert.equal(isLive(fresh), true);
  assert.equal(isLive(stale), false);
});

test("normalizeTelemetry fills holes from the previous packet", () => {
  const prev = sample({ rpm: 9000, steer: -12, clutch: 0.4 });
  const next = normalizeTelemetry(
    sample({ rpm: Number.NaN, steer: Number.NaN, clutch: Number.NaN, speedMs: 14 }),
    prev,
  );
  assert.equal(next.rpm, 9000);
  assert.equal(next.steer, -12);
  assert.equal(next.clutch, 0.4);
  assert.equal(next.speedMs, 14);
});
