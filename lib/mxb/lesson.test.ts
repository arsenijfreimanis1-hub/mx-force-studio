import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLesson, describeLesson, learnFromRows, pearson } from "./lesson.ts";
import { STUDIO_TRAVEL } from "./motion.ts";
import type { SheetRow } from "./sheet.ts";

function movingRow(i: number, extra: Partial<SheetRow> = {}): SheetRow {
  const pitch = -18 * Math.sin(i / 9);
  const shown = pitch;
  return {
    t_s: i * 0.04,
    speed_kph: 50,
    throttle: 0.8,
    pitch_deg: pitch,
    shown_pitch: shown,
    deck_pitch: -pitch,
    err_pitch: shown - pitch,
    roll_deg: -22 * Math.sin(i / 11),
    deck_roll: 22 * Math.sin(i / 11),
    pitch_rate: 8,
    vel_y: 0.02,
    mat_f: 3,
    mat_r: 3,
    deck_y: 0.01,
    crashed: 0,
    ...extra,
  };
}

test("pearson is 1 for a matching pair and -1 when flipped", () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.ok(pearson(a, a) > 0.99);
  assert.ok(pearson(a, a.map((n) => -n)) < -0.99);
});

test("a matching live sheet keeps wheelie nose-up and calms nothing extra", () => {
  const rows = Array.from({ length: 80 }, (_, i) => movingRow(i));
  const lesson = learnFromRows(rows, { visualPitch: -1, leanSign: -1, dtMs: 40 });
  assert.ok(lesson.movingSamples >= 48);
  assert.equal(lesson.visualPitch, -1);
  assert.equal(lesson.leanSign, -1);
  assert.ok(lesson.pitchCorr > 0.9, `pitchCorr ${lesson.pitchCorr}`);
  assert.ok(lesson.rollCorr < -0.9, `rollCorr ${lesson.rollCorr}`);
  assert.ok(describeLesson(lesson).includes("Pitch follows"));
});

test("a flipped shown pitch asks to invert the wheelie sign", () => {
  const rows = Array.from({ length: 80 }, (_, i) => {
    const row = movingRow(i);
    row.shown_pitch = -row.pitch_deg;
    row.err_pitch = row.shown_pitch - row.pitch_deg;
    return row;
  });
  const lesson = learnFromRows(rows, { visualPitch: -1, dtMs: 40 });
  assert.equal(lesson.visualPitch, 1);
  assert.ok(lesson.notes.some((n) => n.toLowerCase().includes("wrong")));
});

test("delayed pitch follow tightens visual tau", () => {
  const rows = Array.from({ length: 90 }, (_, i) => {
    const src = movingRow(Math.max(0, i - 8));
    const now = movingRow(i);
    return { ...now, shown_pitch: src.pitch_deg, err_pitch: src.pitch_deg - now.pitch_deg };
  });
  const lesson = learnFromRows(rows, { visualPitch: -1, dtMs: 40 });
  assert.ok(lesson.lagMs > 90, `lag ${lesson.lagMs}`);
  assert.ok(lesson.visualTau != null && lesson.visualTau < 0.04, `tau ${lesson.visualTau}`);
});

test("bouncy heave lowers response", () => {
  const rows = Array.from({ length: 80 }, (_, i) => movingRow(i, { deck_y: i % 2 === 0 ? 0.12 : -0.12, pitch_rate: 2 }));
  const lesson = learnFromRows(rows, { dtMs: 40 });
  assert.ok(lesson.bounceRms > 0.055, `bounce ${lesson.bounceRms}`);
  assert.ok(lesson.response != null && lesson.response < 1);
  const next = applyLesson(STUDIO_TRAVEL, lesson, { slew: 1 });
  assert.ok(next.response < STUDIO_TRAVEL.response);
});

test("parked rows do not invent a lesson", () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({
    t_s: i * 0.04,
    speed_kph: 0,
    throttle: 0,
    pitch_deg: 0.4,
    shown_pitch: 0.2,
    roll_deg: 1,
    deck_roll: -1,
    crashed: 0,
  }));
  const lesson = learnFromRows(rows);
  assert.equal(lesson.visualPitch, null);
  assert.ok(describeLesson(lesson).toLowerCase().includes("keep riding"));
});
