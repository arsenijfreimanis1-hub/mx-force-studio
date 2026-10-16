import assert from "node:assert/strict";
import test from "node:test";
import {
  createGaugeMapper,
  formatGaugeLine,
  mapTelemetry,
  parseGaugeLine,
} from "./gauge-map.mjs";

const limits = { maxRpm: 14000, gears: 5 };

test("maps the six needles onto 0–180", () => {
  const angles = mapTelemetry(
    { speedMs: 15, rpm: 4962.5, throttle: 1, frontBrake: 0, gear: 1, roll: 0 },
    limits,
  );
  assert.deepEqual(angles, [90, 45, 180, 0, 36, 90]);
  assert.equal(formatGaugeLine(angles), "90,45,180,0,36,90\n");
  assert.deepEqual(parseGaugeLine("90,45,180,0,36,90\n"), angles);
});

test("clamps speed, brake, and roll", () => {
  const angles = mapTelemetry(
    { speedMs: 40, rpm: 0, throttle: -1, frontBrake: 2, gear: 9, roll: 80 },
    limits,
  );
  assert.deepEqual(angles, [180, 0, 0, 180, 180, 180]);
  assert.equal(
    mapTelemetry({ speedMs: 0, rpm: 1950, throttle: 0, frontBrake: 0, gear: 0, roll: -60 }, limits)[5],
    0,
  );
});

test("uses cached redline and gear count", () => {
  const mapper = createGaugeMapper();
  const full = JSON.stringify({
    state: 2,
    event: { maxRpm: 10000, gears: 4 },
    telemetry: { speedMs: 0, rpm: 10000, throttle: 0, frontBrake: 0, gear: 4, roll: 0 },
  });
  assert.equal(mapper.offer(full, 0), "0,180,0,0,180,90\n");
  const thin = JSON.stringify({
    state: 2,
    telemetry: { speedMs: 0, rpm: 1950, throttle: 0, frontBrake: 0, gear: 2, roll: 0 },
  });
  assert.equal(mapper.offer(thin, 50), "0,0,0,0,90,90\n");
});

test("ignores a dead redline and repairs nan", () => {
  const mapper = createGaugeMapper();
  const packet = JSON.stringify({
    state: 2,
    event: { maxRpm: 0, gears: 5 },
    telemetry: { speedMs: 0, rpm: "nan", throttle: 0.5, frontBrake: 0, gear: 0, roll: 0 },
  }).replace('"nan"', "nan");
  assert.equal(mapper.offer(packet, 0), "0,0,90,0,0,90\n");
});

test("skips menus, bad json, and packets inside 50 ms", () => {
  const mapper = createGaugeMapper();
  const live = JSON.stringify({
    state: 2,
    telemetry: { speedMs: 0, rpm: 1950, throttle: 0, frontBrake: 0, gear: 0, roll: 0 },
  });
  assert.equal(mapper.offer(live, 1000), "0,0,0,0,0,90\n");
  assert.equal(mapper.offer(live, 1049), null);
  assert.equal(mapper.offer(live, 1050), "0,0,0,0,0,90\n");
  assert.equal(mapper.offer('{"state":0}', 2000), null);
  assert.equal(mapper.offer('{"state":2}', 2100), null);
  assert.equal(mapper.offer("not-json", 2200), null);
  assert.equal(parseGaugeLine("1,2,3"), null);
  assert.equal(parseGaugeLine("0,0,0,0,0,181"), null);
});
