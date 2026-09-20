import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_TRACE_IDS,
  TRACE_CHANNELS,
  clearTraceBuffer,
  createTraceBuffer,
  flattenTelemetry,
  newestTraceValue,
  pushTraceSample,
  toggleTraceGroup,
  toggleTraceId,
  traceIndex,
} from "./trace.ts";
import { idlePadTrace } from "./gamepad.ts";
import type { Telemetry } from "./types.ts";

function sample(partial: Partial<Telemetry> = {}): Telemetry {
  return {
    rpm: 1950,
    engineTemp: 78,
    waterTemp: 72,
    gear: 0,
    fuel: 3.8,
    speedMs: 10,
    position: { x: 1, y: 2, z: 3 },
    velocity: { x: 0.1, y: 0.2, z: 4 },
    accelG: { x: 0.2, y: 1, z: -0.3 },
    yaw: 12,
    pitch: -4,
    roll: -18,
    yawRate: 5,
    pitchRate: 1,
    rollRate: -2,
    suspLength: [0.2, 0.21],
    suspVelocity: [0.1, -0.2],
    crashed: false,
    steer: -8,
    throttle: 0.6,
    frontBrake: 0.1,
    rearBrake: 0,
    clutch: 0,
    wheelSpeed: [10, 11],
    wheelMaterial: [3, 3],
    brakePressureKpa: [100, 0],
    steerTorqueNm: 2,
    time: 1,
    trackPos: 0.25,
    ...partial,
  };
}

test("flattenTelemetry exposes every game channel", () => {
  const flat = flattenTelemetry(sample());
  assert.equal(flat.throttle, 0.6);
  assert.equal(flat.roll, -18);
  assert.equal(flat.gx, 0.2);
  assert.ok(Math.abs(flat.speed - 36) < 0.01);
  for (const ch of TRACE_CHANNELS) {
    assert.equal(typeof flat[ch.id], "number", ch.id);
  }
});

test("ring buffer keeps the newest samples after wrap", () => {
  const buf = createTraceBuffer(4);
  for (let i = 0; i < 6; i++) {
    pushTraceSample(buf, sample({ throttle: i / 10 }), i * 50);
  }
  assert.equal(buf.len, 4);
  assert.ok(Math.abs(newestTraceValue(buf, "throttle") - 0.5) < 1e-5);
  assert.ok(Math.abs(buf.values.throttle[traceIndex(buf, 0)] - 0.2) < 1e-5);
});

test("clearTraceBuffer drops history", () => {
  const buf = createTraceBuffer(8);
  pushTraceSample(buf, sample(), 1);
  clearTraceBuffer(buf);
  assert.equal(buf.len, 0);
  assert.equal(newestTraceValue(buf, "throttle"), 0);
});

test("pad overlay is logged next to the game pedals", () => {
  const buf = createTraceBuffer(4);
  const pad = { ...idlePadTrace(), throttle: 1, frontBrake: 0.4, lx: -0.5, rx: 0.8 };
  pushTraceSample(buf, sample({ throttle: 0.55 }), 20, pad);
  assert.ok(Math.abs(newestTraceValue(buf, "padThr") - 1) < 1e-5);
  assert.ok(Math.abs(newestTraceValue(buf, "throttle") - 0.55) < 1e-5);
  assert.ok(Math.abs(newestTraceValue(buf, "padLX") + 0.5) < 1e-5);
});

test("channel chips toggle one id or a whole group", () => {
  let ids = [...DEFAULT_TRACE_IDS];
  ids = toggleTraceId(ids, "throttle");
  assert.equal(ids.includes("throttle"), false);
  ids = toggleTraceId(ids, "throttle");
  assert.equal(ids.includes("throttle"), true);
  const none = toggleTraceGroup([], "inputs");
  assert.ok(none.includes("steer") && none.includes("frontBrake"));
  const gone = toggleTraceGroup(none, "inputs");
  assert.equal(gone.some((id) => ["throttle", "steer"].includes(id)), false);
});
