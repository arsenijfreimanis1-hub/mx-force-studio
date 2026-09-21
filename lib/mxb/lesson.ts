/**
 * Read a session spreadsheet (or the live sheet buffer) and turn it into
 * travel tweaks: pitch/lean sign, follow lag, bounce, cue gain.
 */

import type { FrameTravel } from "./motion.ts";
import type { SheetRow } from "./sheet.ts";

export type SheetLesson = {
  samples: number;
  movingSamples: number;
  pitchCorr: number;
  rollCorr: number;
  lagMs: number;
  bounceRms: number;
  followPitchRms: number;
  visualPitch: -1 | 1 | null;
  leanSign: -1 | 1 | null;
  visualTau: number | null;
  smoothTau: number | null;
  response: number | null;
  rateAng: number | null;
  notes: string[];
};

const MIN_MOVING = 48;
const PITCH_BUSY = 6;
const ROLL_BUSY = 10;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function num(row: SheetRow, key: string) {
  const v = row[key];
  return Number.isFinite(v) ? v : 0;
}

function mean(xs: number[]) {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 8) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  if (den < 1e-9) return 0;
  return clamp(num / den, -1, 1);
}

export function bestLagSamples(a: number[], b: number[], maxLag = 12): { lag: number; corr: number } {
  const n = Math.min(a.length, b.length);
  if (n < 16) return { lag: 0, corr: pearson(a, b) };
  let bestLag = 0;
  let best = -2;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const xa: number[] = [];
    const xb: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = i + lag;
      if (j < 0 || j >= n) continue;
      xa.push(a[i]);
      xb.push(b[j]);
    }
    const c = Math.abs(pearson(xa, xb));
    if (c > best) {
      best = c;
      bestLag = lag;
    }
  }
  return { lag: bestLag, corr: best };
}

function rms(xs: number[]) {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x * x;
  return Math.sqrt(s / xs.length);
}

function isMovingRow(row: SheetRow) {
  if (num(row, "crashed") > 0.5) return false;
  return (
    num(row, "speed_kph") > 8 ||
    Math.abs(num(row, "pitch_deg")) > PITCH_BUSY ||
    Math.abs(num(row, "roll_deg")) > ROLL_BUSY ||
    num(row, "throttle") > 0.2
  );
}

export function emptyLesson(): SheetLesson {
  return {
    samples: 0,
    movingSamples: 0,
    pitchCorr: 0,
    rollCorr: 0,
    lagMs: 0,
    bounceRms: 0,
    followPitchRms: 0,
    visualPitch: null,
    leanSign: null,
    visualTau: null,
    smoothTau: null,
    response: null,
    rateAng: null,
    notes: ["Need more riding to learn."],
  };
}

function dtMsFromRows(rows: SheetRow[]) {
  if (rows.length < 4) return 40;
  const dt = (num(rows[rows.length - 1], "t_s") - num(rows[0], "t_s")) / Math.max(1, rows.length - 1);
  return clamp(dt * 1000, 8, 120);
}

export type LessonHints = {
  visualPitch?: number;
  leanSign?: number;
  dtMs?: number;
};

function signOf(n: number | undefined, fallback: -1 | 1): -1 | 1 {
  if (n == null || !Number.isFinite(n)) return fallback;
  return n < 0 ? -1 : 1;
}

/**
 * Coach from a spreadsheet. Game pitch and shown_pitch should match
 * (both nose-down positive). Deck roll is mirrored, so game_roll vs
 * deck_roll should be anti-correlated.
 */
export function learnFromRows(rows: SheetRow[], hints: LessonHints | number = {}): SheetLesson {
  const opts: LessonHints = typeof hints === "number" ? { dtMs: hints } : hints;
  const currentPitch = signOf(opts.visualPitch, -1);
  const currentLean = signOf(opts.leanSign, -1);
  const lesson = emptyLesson();
  lesson.samples = rows.length;
  const moving = rows.filter(isMovingRow);
  lesson.movingSamples = moving.length;
  if (moving.length < MIN_MOVING) {
    lesson.notes = [`Only ${moving.length} moving samples — keep riding.`];
    return lesson;
  }

  const gamePitch = moving.map((r) => num(r, "pitch_deg"));
  const shownPitch = moving.map((r) => num(r, "shown_pitch"));
  const gameRoll = moving.map((r) => num(r, "roll_deg"));
  const deckRoll = moving.map((r) => num(r, "deck_roll"));
  const errPitch = moving.map((r) => num(r, "err_pitch"));

  lesson.pitchCorr = pearson(gamePitch, shownPitch);
  lesson.rollCorr = pearson(gameRoll, deckRoll);
  lesson.followPitchRms = rms(errPitch);

  const busyPitch = moving.filter((r) => Math.abs(num(r, "pitch_deg")) >= PITCH_BUSY);
  if (busyPitch.length >= 24) {
    const corr = pearson(
      busyPitch.map((r) => num(r, "pitch_deg")),
      busyPitch.map((r) => num(r, "shown_pitch")),
    );
    lesson.pitchCorr = corr;
    if (corr <= -0.35) lesson.visualPitch = currentPitch < 0 ? 1 : -1;
    else if (corr >= 0.35) lesson.visualPitch = currentPitch;
  }

  const busyRoll = moving.filter((r) => Math.abs(num(r, "roll_deg")) >= ROLL_BUSY);
  if (busyRoll.length >= 24) {
    const corr = pearson(
      busyRoll.map((r) => num(r, "roll_deg")),
      busyRoll.map((r) => num(r, "deck_roll")),
    );
    lesson.rollCorr = corr;
    if (corr >= 0.35) lesson.leanSign = currentLean < 0 ? 1 : -1;
    else if (corr <= -0.35) lesson.leanSign = currentLean;
  }

  const sampleMs = opts.dtMs ?? dtMsFromRows(moving);
  const pitchLag = bestLagSamples(gamePitch, shownPitch, 16);
  lesson.lagMs = Math.round(pitchLag.lag * sampleMs);

  const bounce = moving
    .filter(
      (r) =>
        Math.abs(num(r, "pitch_rate")) < 25 &&
        Math.abs(num(r, "vel_y")) < 0.5 &&
        num(r, "mat_f") > 0 &&
        num(r, "mat_r") > 0,
    )
    .map((r) => num(r, "deck_y"));
  lesson.bounceRms = rms(bounce);

  const notes: string[] = [];
  if (lesson.visualPitch === 1) notes.push("Wheelie was drawing the wrong way — flipping pitch.");
  else if (lesson.visualPitch === -1) notes.push("Pitch follows the game.");
  else notes.push("Not enough wheelie/stoppie to judge pitch sign.");

  if (lesson.leanSign === 1) notes.push("Lean was camera-flipped — mirroring it.");
  else if (lesson.leanSign === -1) notes.push("Lean follows in-game left/right.");

  if (lesson.lagMs > 90) {
    lesson.visualTau = 0.028;
    lesson.smoothTau = 0.045;
    lesson.rateAng = 2.05;
    notes.push(`Lag ${lesson.lagMs} ms — tightening follow.`);
  } else if (lesson.lagMs > 55) {
    lesson.visualTau = 0.04;
    lesson.smoothTau = 0.06;
    notes.push(`Lag ${lesson.lagMs} ms — a bit snappier.`);
  } else if (lesson.bounceRms > 0.055) {
    lesson.visualTau = 0.07;
    lesson.smoothTau = 0.1;
    lesson.response = 0.82;
    notes.push(`Bounce ${lesson.bounceRms.toFixed(3)} m — calming heave.`);
  } else if (lesson.followPitchRms > 8 && Math.abs(lesson.pitchCorr) > 0.55) {
    lesson.visualTau = 0.038;
    notes.push(`Pitch error ${lesson.followPitchRms.toFixed(1)}° — catching up.`);
  } else {
    notes.push(`Lag ${lesson.lagMs} ms · bounce ${lesson.bounceRms.toFixed(3)} m.`);
  }

  const peakGamePitch = Math.max(...busyPitch.map((r) => Math.abs(num(r, "pitch_deg"))), 0);
  const peakDeckPitch = Math.max(...busyPitch.map((r) => Math.abs(num(r, "deck_pitch"))), 0);
  if (peakGamePitch > 16 && peakDeckPitch < 8 && lesson.response == null) {
    lesson.response = 1.15;
    notes.push("Wheelies look small — adding a little response.");
  }

  lesson.notes = notes;
  return lesson;
}

function slew(current: number, target: number, a: number) {
  return current + (target - current) * a;
}

export function describeLesson(lesson: SheetLesson): string {
  if (lesson.movingSamples < MIN_MOVING) return lesson.notes[0] ?? "Need more riding to learn.";
  return lesson.notes.join(" ");
}

export function applyLesson(
  travel: FrameTravel,
  lesson: SheetLesson,
  opts: { allowSignFlip?: boolean; slew?: number } = {},
): FrameTravel {
  const a = clamp(opts.slew ?? 0.28, 0.05, 1);
  const next = { ...travel };
  if (opts.allowSignFlip) {
    if (lesson.visualPitch != null) next.visualPitch = lesson.visualPitch;
    if (lesson.leanSign != null) next.leanSign = lesson.leanSign;
  }
  if (lesson.visualTau != null) next.visualTau = clamp(slew(travel.visualTau, lesson.visualTau, a), 0.008, 0.25);
  if (lesson.smoothTau != null) next.smoothTau = clamp(slew(travel.smoothTau, lesson.smoothTau, a), 0.008, 0.4);
  if (lesson.response != null) next.response = clamp(slew(travel.response, lesson.response, a), 0.05, 4);
  if (lesson.rateAng != null) next.rateAng = clamp(slew(travel.rateAng, lesson.rateAng, a), 0.15, 8);
  return next;
}
