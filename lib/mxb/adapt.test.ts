import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyProfileToTelemetry,
  applyProfileToTravel,
  defaultProfile,
  loadProfile,
  lockParkedUnits,
  observeTelemetry,
  profileKey,
  saveProfile,
} from "./adapt.ts";
import { DEFAULT_FRAME_TRAVEL } from "./motion.ts";
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

test("parked 1 G locks units as G not m/s²", () => {
  const profile = lockParkedUnits(defaultProfile("450"), sample({ accelG: { x: 0, y: 1, z: 0 } }));
  assert.equal(profile.forceIsMs2, false);
});

test("parked 9.8 mag locks units as m/s²", () => {
  const profile = lockParkedUnits(
    defaultProfile("450"),
    sample({ accelG: { x: 0, y: 9.80665, z: 0 } }),
  );
  assert.equal(profile.forceIsMs2, true);
});

test("parked uncoordinated lean does not flip roll sign", () => {
  const profile = lockParkedUnits(
    defaultProfile("125"),
    sample({
      roll: 20,
      accelG: { x: Math.sin((20 * Math.PI) / 180), y: Math.cos((20 * Math.PI) / 180), z: 0 },
    }),
  );
  assert.equal(profile.rollSign, 1);
});

test("20 s of moving samples learns a response near 80% of travel", () => {
  let profile = defaultProfile("yz450");
  profile.bikeName = "YZ450F";
  const moving = sample({
    speedMs: 16,
    accelG: { x: -0.1, y: 1.4, z: 0.9 },
    roll: 38,
    pitchRate: 40,
  });
  for (let i = 0; i < 22; i++) {
    profile = observeTelemetry(profile, moving, 1);
  }
  assert.ok(profile.learned, "should be learned");
  assert.ok(profile.response >= 0.35 && profile.response <= 1.8, `response ${profile.response}`);
  const travel = applyProfileToTravel(DEFAULT_FRAME_TRAVEL, profile);
  assert.ok(travel.response <= DEFAULT_FRAME_TRAVEL.response * 1.8);
  assert.ok(travel.smoothTau >= 0.03);
});

test("applyProfileToTelemetry converts locked m/s² and never flips roll", () => {
  const profile = {
    ...defaultProfile("crf"),
    forceIsMs2: true as const,
    rollSign: -1 as const,
  };
  const tel = applyProfileToTelemetry(sample({ accelG: { x: 0, y: 9.80665, z: 0 }, roll: 12 }), profile);
  assert.ok(Math.abs(tel.accelG.y - 1) < 1e-6, JSON.stringify(tel.accelG));
  assert.equal(tel.roll, 12);
});

test("saved rollSign -1 is ignored on load", () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };
  storage.setItem(
    profileKey("old"),
    JSON.stringify({ ...defaultProfile("old"), rollSign: -1, learned: true }),
  );
  const loaded = loadProfile("old", "Old", storage);
  assert.equal(loaded.rollSign, 1);
});

test("profiles persist per bikeId", () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };
  const profile = { ...defaultProfile("bike-a", "A"), learned: true, response: 0.7 };
  saveProfile(profile, storage);
  const loaded = loadProfile("bike-a", "A", storage);
  assert.equal(loaded.response, 0.7);
  assert.equal(loaded.learned, true);
  const other = loadProfile("bike-b", "B", storage);
  assert.equal(other.response, 1);
});
