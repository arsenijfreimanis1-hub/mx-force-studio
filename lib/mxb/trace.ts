import type { PadTrace } from "./gamepad.ts";
import type { Telemetry } from "./types.ts";

export type TraceGroup = "pad" | "inputs" | "attitude" | "gforce" | "world" | "suspension" | "engine";

export type TraceChannel = {
  id: string;
  label: string;
  group: TraceGroup;
  color: string;
  /** Absolute value that fills half the plot. */
  span: number;
  unit: string;
};

export const TRACE_GROUPS: { id: TraceGroup; label: string }[] = [
  { id: "pad", label: "Pad" },
  { id: "inputs", label: "Game" },
  { id: "attitude", label: "Attitude" },
  { id: "gforce", label: "G" },
  { id: "world", label: "World" },
  { id: "suspension", label: "Susp" },
  { id: "engine", label: "Engine" },
];

export const TRACE_CHANNELS: TraceChannel[] = [
  { id: "padThr", label: "RT", group: "pad", color: "#4ade80", span: 1, unit: "" },
  { id: "padFbrk", label: "LT", group: "pad", color: "#fb7185", span: 1, unit: "" },
  { id: "padRbrk", label: "LB", group: "pad", color: "#f9a8d4", span: 1, unit: "" },
  { id: "padClh", label: "A", group: "pad", color: "#e2e8f0", span: 1, unit: "" },
  { id: "padLX", label: "LX", group: "pad", color: "#c4b5fd", span: 1, unit: "" },
  { id: "padLY", label: "LY", group: "pad", color: "#a78bfa", span: 1, unit: "" },
  { id: "padRX", label: "RX", group: "pad", color: "#67e8f9", span: 1, unit: "" },
  { id: "padRY", label: "RY", group: "pad", color: "#22d3ee", span: 1, unit: "" },
  { id: "throttle", label: "Thr", group: "inputs", color: "#34d399", span: 1, unit: "" },
  { id: "frontBrake", label: "F brk", group: "inputs", color: "#fb7185", span: 1, unit: "" },
  { id: "rearBrake", label: "R brk", group: "inputs", color: "#f9a8d4", span: 1, unit: "" },
  { id: "clutch", label: "Clh", group: "inputs", color: "#cbd5e1", span: 1, unit: "" },
  { id: "steer", label: "Steer", group: "inputs", color: "#a78bfa", span: 40, unit: "°" },
  { id: "roll", label: "Roll", group: "attitude", color: "#38bdf8", span: 45, unit: "°" },
  { id: "pitch", label: "Pitch", group: "attitude", color: "#fbbf24", span: 25, unit: "°" },
  { id: "yaw", label: "Yaw", group: "attitude", color: "#94a3b8", span: 180, unit: "°" },
  { id: "yawRate", label: "Yaw°/s", group: "attitude", color: "#7dd3fc", span: 120, unit: "°/s" },
  { id: "pitchRate", label: "Pit°/s", group: "attitude", color: "#fcd34d", span: 120, unit: "°/s" },
  { id: "rollRate", label: "Rol°/s", group: "attitude", color: "#67e8f9", span: 120, unit: "°/s" },
  { id: "gx", label: "Gx", group: "gforce", color: "#22d3ee", span: 1.5, unit: "G" },
  { id: "gy", label: "Gy", group: "gforce", color: "#4ade80", span: 2, unit: "G" },
  { id: "gz", label: "Gz", group: "gforce", color: "#f97316", span: 1.5, unit: "G" },
  { id: "speed", label: "Speed", group: "engine", color: "#e2e8f0", span: 80, unit: "km/h" },
  { id: "rpm", label: "RPM", group: "engine", color: "#fb923c", span: 13000, unit: "" },
  { id: "gear", label: "Gear", group: "engine", color: "#fde68a", span: 5, unit: "" },
  { id: "fuel", label: "Fuel", group: "engine", color: "#86efac", span: 8, unit: "L" },
  { id: "engineTemp", label: "Eng °C", group: "engine", color: "#f87171", span: 120, unit: "°C" },
  { id: "waterTemp", label: "H2O °C", group: "engine", color: "#60a5fa", span: 120, unit: "°C" },
  { id: "px", label: "Pos X", group: "world", color: "#fda4af", span: 80, unit: "m" },
  { id: "py", label: "Pos Y", group: "world", color: "#86efac", span: 12, unit: "m" },
  { id: "pz", label: "Pos Z", group: "world", color: "#93c5fd", span: 80, unit: "m" },
  { id: "vx", label: "Vel X", group: "world", color: "#fb7185", span: 20, unit: "m/s" },
  { id: "vy", label: "Vel Y", group: "world", color: "#4ade80", span: 12, unit: "m/s" },
  { id: "vz", label: "Vel Z", group: "world", color: "#38bdf8", span: 30, unit: "m/s" },
  { id: "suspF", label: "Susp F", group: "suspension", color: "#c4b5fd", span: 0.35, unit: "m" },
  { id: "suspR", label: "Susp R", group: "suspension", color: "#818cf8", span: 0.35, unit: "m" },
  { id: "suspVelF", label: "SuspVf", group: "suspension", color: "#d8b4fe", span: 3, unit: "m/s" },
  { id: "suspVelR", label: "SuspVr", group: "suspension", color: "#a5b4fc", span: 3, unit: "m/s" },
  { id: "wheelF", label: "Whl F", group: "suspension", color: "#fdba74", span: 30, unit: "m/s" },
  { id: "wheelR", label: "Whl R", group: "suspension", color: "#f59e0b", span: 30, unit: "m/s" },
  { id: "matF", label: "Mat F", group: "suspension", color: "#a8a29e", span: 6, unit: "" },
  { id: "matR", label: "Mat R", group: "suspension", color: "#78716c", span: 6, unit: "" },
  { id: "brkF", label: "P F", group: "inputs", color: "#e11d48", span: 1800, unit: "kPa" },
  { id: "brkR", label: "P R", group: "inputs", color: "#9f1239", span: 1200, unit: "kPa" },
  { id: "steerNm", label: "Str Nm", group: "inputs", color: "#c084fc", span: 40, unit: "Nm" },
  { id: "trackPos", label: "Track", group: "world", color: "#fde047", span: 1, unit: "" },
  { id: "crashed", label: "Crash", group: "attitude", color: "#ef4444", span: 1, unit: "" },
];

export const DEFAULT_TRACE_IDS = [
  "padThr",
  "throttle",
  "padFbrk",
  "frontBrake",
  "padRbrk",
  "rearBrake",
  "padLX",
  "padRX",
];

export const TRACE_OPEN_KEY = "mxb-force-studio.graph";
export const TRACE_IDS_KEY = "mxb-force-studio.graph-ids-v2";

const CHANNEL_BY_ID = new Map(TRACE_CHANNELS.map((c) => [c.id, c]));

export function traceChannel(id: string): TraceChannel | undefined {
  return CHANNEL_BY_ID.get(id);
}

export function flattenTelemetry(tel: Telemetry, pad?: PadTrace): Record<string, number> {
  return {
    padThr: pad?.throttle ?? 0,
    padFbrk: pad?.frontBrake ?? 0,
    padRbrk: pad?.rearBrake ?? 0,
    padClh: pad?.clutch ?? 0,
    padLX: pad?.lx ?? 0,
    padLY: pad?.ly ?? 0,
    padRX: pad?.rx ?? 0,
    padRY: pad?.ry ?? 0,
    throttle: tel.throttle,
    frontBrake: tel.frontBrake,
    rearBrake: tel.rearBrake,
    clutch: tel.clutch,
    steer: tel.steer,
    roll: tel.roll,
    pitch: tel.pitch,
    yaw: tel.yaw,
    yawRate: tel.yawRate,
    pitchRate: tel.pitchRate,
    rollRate: tel.rollRate,
    gx: tel.accelG.x,
    gy: tel.accelG.y,
    gz: tel.accelG.z,
    speed: tel.speedMs * 3.6,
    rpm: tel.rpm,
    gear: tel.gear,
    fuel: tel.fuel,
    engineTemp: tel.engineTemp,
    waterTemp: tel.waterTemp,
    px: tel.position.x,
    py: tel.position.y,
    pz: tel.position.z,
    vx: tel.velocity.x,
    vy: tel.velocity.y,
    vz: tel.velocity.z,
    suspF: tel.suspLength[0],
    suspR: tel.suspLength[1],
    suspVelF: tel.suspVelocity[0],
    suspVelR: tel.suspVelocity[1],
    wheelF: tel.wheelSpeed[0],
    wheelR: tel.wheelSpeed[1],
    matF: tel.wheelMaterial[0],
    matR: tel.wheelMaterial[1],
    brkF: tel.brakePressureKpa[0],
    brkR: tel.brakePressureKpa[1],
    steerNm: tel.steerTorqueNm,
    trackPos: tel.trackPos,
    crashed: tel.crashed ? 1 : 0,
  };
}

export type TraceBuffer = {
  cap: number;
  len: number;
  head: number;
  times: Float64Array;
  values: Record<string, Float32Array>;
};

export function createTraceBuffer(cap = 480): TraceBuffer {
  const values: Record<string, Float32Array> = {};
  for (const ch of TRACE_CHANNELS) values[ch.id] = new Float32Array(cap);
  return { cap, len: 0, head: 0, times: new Float64Array(cap), values };
}

export function clearTraceBuffer(buf: TraceBuffer) {
  buf.len = 0;
  buf.head = 0;
}

export function pushTraceSample(buf: TraceBuffer, tel: Telemetry, timeMs: number, pad?: PadTrace) {
  const flat = flattenTelemetry(tel, pad);
  const i = buf.head;
  buf.times[i] = timeMs;
  for (const ch of TRACE_CHANNELS) {
    const n = flat[ch.id];
    buf.values[ch.id][i] = Number.isFinite(n) ? n : 0;
  }
  buf.head = (i + 1) % buf.cap;
  if (buf.len < buf.cap) buf.len += 1;
}

export function traceIndex(buf: TraceBuffer, age: number) {
  return (buf.head - buf.len + age + buf.cap * 4) % buf.cap;
}

export function newestTraceValue(buf: TraceBuffer, id: string): number {
  if (buf.len <= 0) return 0;
  return buf.values[id]?.[traceIndex(buf, buf.len - 1)] ?? 0;
}

export function toggleTraceId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function toggleTraceGroup(ids: string[], group: TraceGroup): string[] {
  const members = TRACE_CHANNELS.filter((c) => c.group === group).map((c) => c.id);
  const allOn = members.every((id) => ids.includes(id));
  if (allOn) return ids.filter((id) => !members.includes(id));
  return [...new Set([...ids, ...members])];
}

export function formatTraceValue(id: string, value: number): string {
  const ch = CHANNEL_BY_ID.get(id);
  if (!ch) return value.toFixed(2);
  const abs = Math.abs(value);
  let n: string;
  if (ch.span >= 100) n = value.toFixed(0);
  else if (ch.span >= 10) n = value.toFixed(1);
  else if (ch.span >= 1) n = value.toFixed(2);
  else n = value.toFixed(3);
  if (abs < 1e-9) n = ch.span >= 10 ? "0" : ch.span >= 1 ? "0.00" : "0.000";
  return ch.unit ? `${n}${ch.unit}` : n;
}

export function loadTraceOpen(fallback = false): boolean {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(TRACE_OPEN_KEY);
    if (raw == null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

export function saveTraceOpen(open: boolean) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(TRACE_OPEN_KEY, open ? "1" : "0");
  } catch {
    // quota / private mode
  }
}

export function loadTraceIds(fallback: string[] = DEFAULT_TRACE_IDS): string[] {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(TRACE_IDS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const ids = parsed.filter((id): id is string => typeof id === "string" && CHANNEL_BY_ID.has(id));
    return ids.length ? ids : fallback;
  } catch {
    return fallback;
  }
}

export function saveTraceIds(ids: string[]) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(TRACE_IDS_KEY, JSON.stringify(ids));
  } catch {
    // quota / private mode
  }
}
