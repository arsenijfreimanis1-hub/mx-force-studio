/** Standard Gamepad indices used by MX Bikes Xbox defaults. */
export type PadMap = {
  throttleBtn: number;
  frontBrakeBtn: number;
  rearBrakeBtn: number;
  clutchBtn: number;
  steerAxis: number;
  leanAxis: number;
  sitAxis: number;
  sitButton: number | null;
  invertLean: boolean;
  invertSit: boolean;
  source: string;
};

export const DEFAULT_PAD_MAP: PadMap = {
  throttleBtn: 7,
  frontBrakeBtn: 6,
  rearBrakeBtn: 4,
  clutchBtn: 0,
  steerAxis: 0,
  leanAxis: 2,
  sitAxis: 3,
  sitButton: 11,
  invertLean: false,
  invertSit: false,
  source: "Xbox / Standard Gamepad defaults (MX Bikes)",
};

function parseAxisIndex(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 7) return null;
  return n;
}

function parseButtonIndex(raw: string, oneBased = false): number | null {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  const idx = oneBased && n >= 1 ? n - 1 : n;
  if (idx < 0 || idx > 19) return null;
  return idx;
}

function namedAxis(token: string): number | null {
  const t = token.toLowerCase().replace(/\s+/g, "");
  if (/^x(axis)?$/.test(t) || t === "lx") return 0;
  if (/^y(axis)?$/.test(t) || t === "ly") return 1;
  if (/^z(axis)?$/.test(t) || /^r(ot)?x(axis)?$/.test(t) || t === "rx") return 2;
  if (/^r(ot)?y(axis)?$/.test(t) || t === "ry") return 3;
  if (/^r(ot)?z(axis)?$/.test(t)) return 5;
  return null;
}

function controlKind(lower: string) {
  const isLean = /rider.?lean|body.?lean|\blean\b|hang.?off|weight.?shift/.test(lower);
  const isSit = /\bsit\b|\bstand\b|seat.?pos|rider.?pos|body.?up|rider.?height|\br3\b|stick.?click|rs.?click|right.?stick.?button|click.?stick/.test(lower);
  const isSteer = /\bsteer\b|steering/.test(lower) && !/steer.?torque/.test(lower);
  const isThrottle = /throttle|accelerator|\bgas\b/.test(lower);
  const isFrontBrake = /front.?brake|brake.?front/.test(lower);
  const isRearBrake = /rear.?brake|brake.?rear/.test(lower);
  const isClutch = /\bclutch\b/.test(lower);
  return { isLean, isSit, isSteer, isThrottle, isFrontBrake, isRearBrake, isClutch };
}

function applyControl(map: PadMap, kind: ReturnType<typeof controlKind>, axisIdx: number | null, buttonIdx: number | null) {
  if (axisIdx != null) {
    if (kind.isLean) map.leanAxis = axisIdx;
    else if (kind.isSit) map.sitAxis = axisIdx;
    else if (kind.isSteer) map.steerAxis = axisIdx;
  }
  if (buttonIdx != null) {
    if (kind.isThrottle) map.throttleBtn = buttonIdx;
    else if (kind.isFrontBrake) map.frontBrakeBtn = buttonIdx;
    else if (kind.isRearBrake) map.rearBrakeBtn = buttonIdx;
    else if (kind.isClutch) map.clutchBtn = buttonIdx;
    else if (kind.isSit) map.sitButton = buttonIdx;
  }
}

export function applyBindLine(map: PadMap, line: string) {
  const t = line.replace(/[#;].*$/, "").trim();
  if (!t || t.startsWith("[")) return;
  const lower = t.toLowerCase();
  const kind = controlKind(lower);
  if (!kind.isLean && !kind.isSit && !kind.isSteer && !kind.isThrottle && !kind.isFrontBrake && !kind.isRearBrake && !kind.isClutch) {
    return;
  }

  const joyBtn = t.match(/joy\s*\d*\s*button\s*(\d+)/i) ?? t.match(/\bbutton(\d+)\b/i);
  const genericBtn = t.match(/\bbutton\s*[:=]?\s*(-?\d+)/i) ?? t.match(/\bbtn\s*[:=]?\s*(-?\d+)/i);
  const axisNum = t.match(/axis\s*[:=]?\s*(-?\d+)/i) ?? t.match(/joy\w*\s*axis\s*(-?\d+)/i);
  const named = t.match(/\b(r(?:ot)?[xyz]|[xyz])(?:axis)?\b/i);

  const axisIdx = axisNum ? parseAxisIndex(axisNum[1]) : named ? namedAxis(named[1]) : null;
  let buttonIdx: number | null = null;
  if (joyBtn) buttonIdx = parseButtonIndex(joyBtn[1], true);
  else if (genericBtn) buttonIdx = parseButtonIndex(genericBtn[1], false);

  applyControl(map, kind, axisIdx, buttonIdx);
  if (kind.isLean && /invert|flip/.test(lower)) map.invertLean = true;
  if (kind.isSit && /invert|flip/.test(lower)) map.invertSit = true;
}

export function parseBindsText(text: string, source: string): PadMap {
  const map: PadMap = { ...DEFAULT_PAD_MAP, source };
  for (const line of text.split(/\r?\n/)) applyBindLine(map, line);
  return map;
}
