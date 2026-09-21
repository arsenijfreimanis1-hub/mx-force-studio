/**
 * Session spreadsheet: every live game / pad / deck sample as CSV rows
 * Excel and Google Sheets can open. The lesson module reads the same rows.
 */

import type { PadTrace } from "./gamepad.ts";
import { visualPitch, type Pose6 } from "./motion.ts";
import type { Telemetry } from "./types.ts";

export type SheetField = {
  key: string;
  header: string;
};

export const SHEET_FIELDS: SheetField[] = [
  { key: "t_s", header: "time_s" },
  { key: "speed_kph", header: "speed_kph" },
  { key: "throttle", header: "game_throttle" },
  { key: "front_brake", header: "game_front_brake" },
  { key: "rear_brake", header: "game_rear_brake" },
  { key: "clutch", header: "game_clutch" },
  { key: "steer_deg", header: "steer_deg" },
  { key: "roll_deg", header: "game_roll_deg" },
  { key: "pitch_deg", header: "game_pitch_deg" },
  { key: "yaw_deg", header: "game_yaw_deg" },
  { key: "yaw_rate", header: "yaw_rate_dps" },
  { key: "pitch_rate", header: "pitch_rate_dps" },
  { key: "roll_rate", header: "roll_rate_dps" },
  { key: "gx", header: "accel_g_x" },
  { key: "gy", header: "accel_g_y" },
  { key: "gz", header: "accel_g_z" },
  { key: "rpm", header: "rpm" },
  { key: "gear", header: "gear" },
  { key: "fuel", header: "fuel_l" },
  { key: "engine_temp", header: "engine_c" },
  { key: "water_temp", header: "water_c" },
  { key: "pos_x", header: "world_x_m" },
  { key: "pos_y", header: "world_y_m" },
  { key: "pos_z", header: "world_z_m" },
  { key: "vel_x", header: "vel_x_ms" },
  { key: "vel_y", header: "vel_y_ms" },
  { key: "vel_z", header: "vel_z_ms" },
  { key: "susp_f", header: "susp_front_m" },
  { key: "susp_r", header: "susp_rear_m" },
  { key: "susp_vf", header: "susp_front_ms" },
  { key: "susp_vr", header: "susp_rear_ms" },
  { key: "wheel_f", header: "wheel_front_ms" },
  { key: "wheel_r", header: "wheel_rear_ms" },
  { key: "mat_f", header: "wheel_mat_front" },
  { key: "mat_r", header: "wheel_mat_rear" },
  { key: "brk_f", header: "brake_kpa_front" },
  { key: "brk_r", header: "brake_kpa_rear" },
  { key: "steer_nm", header: "steer_nm" },
  { key: "track_pos", header: "track_pos" },
  { key: "crashed", header: "crashed" },
  { key: "pad_rt", header: "pad_rt" },
  { key: "pad_lt", header: "pad_lt" },
  { key: "pad_lb", header: "pad_lb" },
  { key: "pad_a", header: "pad_a" },
  { key: "pad_lx", header: "pad_lx" },
  { key: "pad_ly", header: "pad_ly" },
  { key: "pad_rx", header: "pad_rx" },
  { key: "pad_ry", header: "pad_ry" },
  { key: "deck_x", header: "deck_x_m" },
  { key: "deck_y", header: "deck_y_m" },
  { key: "deck_z", header: "deck_z_m" },
  { key: "deck_roll", header: "deck_roll_deg" },
  { key: "deck_pitch", header: "deck_pitch_deg" },
  { key: "deck_yaw", header: "deck_yaw_deg" },
  { key: "shown_pitch", header: "shown_pitch_deg" },
  { key: "shown_roll", header: "shown_roll_deg" },
  { key: "err_pitch", header: "pitch_error_deg" },
  { key: "err_roll", header: "roll_error_deg" },
];

const KEYS = SHEET_FIELDS.map((f) => f.key);
const HEADER_TO_KEY = new Map(SHEET_FIELDS.map((f) => [f.header, f.key]));

export type SheetRow = Record<string, number>;

export type SheetBuffer = {
  cap: number;
  len: number;
  head: number;
  t0: number;
  values: Record<string, Float32Array>;
};

export function createSheetBuffer(cap = 24000): SheetBuffer {
  const values: Record<string, Float32Array> = {};
  for (const key of KEYS) values[key] = new Float32Array(cap);
  return { cap, len: 0, head: 0, t0: 0, values };
}

export function clearSheetBuffer(buf: SheetBuffer) {
  buf.len = 0;
  buf.head = 0;
  buf.t0 = 0;
}

export function sheetIndex(buf: SheetBuffer, age: number) {
  return (buf.head - buf.len + age + buf.cap * 4) % buf.cap;
}

function radDeg(n: number) {
  return (n * 180) / Math.PI;
}

function finite(n: unknown, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function sheetRowFromLive(
  tel: Telemetry,
  pose: Pose6,
  pad: PadTrace | undefined,
  timeMs: number,
  t0: number,
  visualPitchSign = -1,
): SheetRow {
  const shownPitch = radDeg(visualPitch(pose.pitch, visualPitchSign));
  const shownRoll = radDeg(pose.roll);
  return {
    t_s: (timeMs - t0) / 1000,
    speed_kph: tel.speedMs * 3.6,
    throttle: tel.throttle,
    front_brake: tel.frontBrake,
    rear_brake: tel.rearBrake,
    clutch: tel.clutch,
    steer_deg: tel.steer,
    roll_deg: tel.roll,
    pitch_deg: tel.pitch,
    yaw_deg: tel.yaw,
    yaw_rate: tel.yawRate,
    pitch_rate: tel.pitchRate,
    roll_rate: tel.rollRate,
    gx: tel.accelG.x,
    gy: tel.accelG.y,
    gz: tel.accelG.z,
    rpm: tel.rpm,
    gear: tel.gear,
    fuel: tel.fuel,
    engine_temp: tel.engineTemp,
    water_temp: tel.waterTemp,
    pos_x: tel.position.x,
    pos_y: tel.position.y,
    pos_z: tel.position.z,
    vel_x: tel.velocity.x,
    vel_y: tel.velocity.y,
    vel_z: tel.velocity.z,
    susp_f: tel.suspLength[0],
    susp_r: tel.suspLength[1],
    susp_vf: tel.suspVelocity[0],
    susp_vr: tel.suspVelocity[1],
    wheel_f: tel.wheelSpeed[0],
    wheel_r: tel.wheelSpeed[1],
    mat_f: tel.wheelMaterial[0],
    mat_r: tel.wheelMaterial[1],
    brk_f: tel.brakePressureKpa[0],
    brk_r: tel.brakePressureKpa[1],
    steer_nm: tel.steerTorqueNm,
    track_pos: tel.trackPos,
    crashed: tel.crashed ? 1 : 0,
    pad_rt: pad?.throttle ?? 0,
    pad_lt: pad?.frontBrake ?? 0,
    pad_lb: pad?.rearBrake ?? 0,
    pad_a: pad?.clutch ?? 0,
    pad_lx: pad?.lx ?? 0,
    pad_ly: pad?.ly ?? 0,
    pad_rx: pad?.rx ?? 0,
    pad_ry: pad?.ry ?? 0,
    deck_x: pose.x,
    deck_y: pose.y,
    deck_z: pose.z,
    deck_roll: shownRoll,
    deck_pitch: radDeg(pose.pitch),
    deck_yaw: radDeg(pose.yaw),
    shown_pitch: shownPitch,
    shown_roll: shownRoll,
    err_pitch: shownPitch - tel.pitch,
    err_roll: shownRoll - tel.roll * -1,
  };
}

export function pushSheetRow(
  buf: SheetBuffer,
  tel: Telemetry,
  pose: Pose6,
  timeMs: number,
  pad?: PadTrace,
  visualPitchSign = -1,
) {
  if (buf.len === 0) buf.t0 = timeMs;
  const row = sheetRowFromLive(tel, pose, pad, timeMs, buf.t0, visualPitchSign);
  const i = buf.head;
  for (const key of KEYS) {
    buf.values[key][i] = finite(row[key]);
  }
  buf.head = (i + 1) % buf.cap;
  if (buf.len < buf.cap) buf.len += 1;
}

export function readSheetRows(buf: SheetBuffer, max = buf.len): SheetRow[] {
  const n = Math.min(buf.len, Math.max(0, max));
  const start = buf.len - n;
  const rows: SheetRow[] = [];
  for (let a = start; a < buf.len; a++) {
    const i = sheetIndex(buf, a);
    const row: SheetRow = {};
    for (const key of KEYS) row[key] = buf.values[key][i];
    rows.push(row);
  }
  return rows;
}

function csvCell(n: number) {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 100 || Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10000) / 10000);
}

export function sheetToCsv(buf: SheetBuffer): string {
  const header = SHEET_FIELDS.map((f) => f.header).join(",");
  const lines = [header];
  for (let a = 0; a < buf.len; a++) {
    const i = sheetIndex(buf, a);
    lines.push(KEYS.map((key) => csvCell(buf.values[key][i])).join(","));
  }
  return `\uFEFF${lines.join("\n")}\n`;
}

export function parseSheetCsv(text: string): SheetRow[] {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const keys = headers.map((h) => HEADER_TO_KEY.get(h) ?? h);
  const rows: SheetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: SheetRow = {};
    for (let c = 0; c < keys.length; c++) {
      const key = keys[c];
      if (!key) continue;
      row[key] = finite(cells[c]);
    }
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function sheetFilename(bikeName = "session", at = new Date()) {
  const safe = (bikeName || "session")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "session";
  const stamp = at.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `mxb-force-studio_${safe}_${stamp}.csv`;
}

export function downloadSheetCsv(csv: string, filename: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const AUTO_LEARN_KEY = "mxb-force-studio.auto-learn";

export function loadAutoLearn(fallback = true): boolean {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(AUTO_LEARN_KEY);
    if (raw == null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

export function saveAutoLearn(on: boolean) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(AUTO_LEARN_KEY, on ? "1" : "0");
  } catch {
    // quota / private mode
  }
}

export function sheetDurationS(buf: SheetBuffer): number {
  if (buf.len < 2) return 0;
  const first = buf.values.t_s[sheetIndex(buf, 0)];
  const last = buf.values.t_s[sheetIndex(buf, buf.len - 1)];
  return Math.max(0, last - first);
}
