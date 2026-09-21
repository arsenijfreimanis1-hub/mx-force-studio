import assert from "node:assert/strict";
import { test } from "node:test";
import { identityPose } from "./motion.ts";
import type { Telemetry } from "./types.ts";
import {
  SHEET_FIELDS,
  clearSheetBuffer,
  createSheetBuffer,
  parseSheetCsv,
  sheetDurationS,
  sheetFilename,
  sheetToCsv,
  pushSheetRow,
  readSheetRows,
  sheetRowFromLive,
} from "./sheet.ts";
import { idlePadTrace } from "./gamepad.ts";

function sample(partial: Partial<Telemetry> = {}): Telemetry {
  return {
    rpm: 8000,
    engineTemp: 82,
    waterTemp: 74,
    gear: 3,
    fuel: 3.1,
    speedMs: 16,
    position: { x: 4, y: 2, z: 30 },
    velocity: { x: 0, y: 0, z: 16 },
    accelG: { x: 0, y: 1, z: 0.4 },
    yaw: 8,
    pitch: -22,
    roll: -12,
    yawRate: 4,
    pitchRate: -10,
    rollRate: 2,
    suspLength: [0.18, 0.19],
    suspVelocity: [0.1, -0.05],
    crashed: false,
    steer: -6,
    throttle: 1,
    frontBrake: 0,
    rearBrake: 0,
    clutch: 0,
    wheelSpeed: [2, 18],
    wheelMaterial: [0, 3],
    brakePressureKpa: [0, 0],
    steerTorqueNm: 1.2,
    time: 12,
    trackPos: 0.3,
    ...partial,
  };
}

test("sheet row records game Euler and shown pitch for a live wheelie", () => {
  const pose = { ...identityPose(), pitch: (22 * Math.PI) / 180, y: 0.01 };
  const row = sheetRowFromLive(sample(), pose, idlePadTrace(), 1000, 0, -1);
  assert.equal(row.pitch_deg, -22);
  assert.ok(Math.abs(row.deck_pitch - 22) < 0.01, `deck ${row.deck_pitch}`);
  assert.ok(Math.abs(row.shown_pitch + 22) < 0.01, `shown ${row.shown_pitch}`);
  assert.ok(Math.abs(row.err_pitch) < 0.05, `err ${row.err_pitch}`);
  assert.equal(row.speed_kph, 16 * 3.6);
  assert.equal(row.pad_rt, 0);
});

test("CSV round-trips every column through Excel-style text", () => {
  const buf = createSheetBuffer(16);
  const pad = { ...idlePadTrace(), throttle: 0.8, ly: 0.4 };
  for (let i = 0; i < 5; i++) {
    pushSheetRow(
      buf,
      sample({ throttle: 0.2 + i * 0.1, pitch: -10 - i }),
      { ...identityPose(), pitch: ((10 + i) * Math.PI) / 180 },
      i * 40,
      pad,
      -1,
    );
  }
  assert.equal(buf.len, 5);
  const csv = sheetToCsv(buf);
  assert.ok(csv.startsWith("\uFEFF"));
  for (const field of SHEET_FIELDS) assert.ok(csv.includes(field.header), field.header);
  const rows = parseSheetCsv(csv);
  assert.equal(rows.length, 5);
  assert.ok(Math.abs(rows[4].pitch_deg + 14) < 0.01);
  assert.ok(Math.abs(rows[4].throttle - 0.6) < 0.02);
  assert.ok(sheetDurationS(buf) > 0.1);
});

test("filename is spreadsheet-safe", () => {
  const name = sheetFilename("YZ250F", new Date("2026-09-21T12:00:00.000Z"));
  assert.equal(name, "mxb-force-studio_yz250f_2026-09-21T12-00-00.csv");
});

test("ring wrap keeps the newest samples", () => {
  const buf = createSheetBuffer(4);
  for (let i = 0; i < 6; i++) {
    pushSheetRow(buf, sample({ throttle: i }), identityPose(), i * 40);
  }
  const rows = readSheetRows(buf);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].throttle, 2);
  assert.equal(rows[3].throttle, 5);
  clearSheetBuffer(buf);
  assert.equal(buf.len, 0);
});
