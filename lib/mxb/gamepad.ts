import type { SandboxInputs } from "./types.ts";
import { DEFAULT_PAD_MAP, type PadMap } from "./mxb-binds.ts";

let activePadMap: PadMap = { ...DEFAULT_PAD_MAP };

export function setActivePadMap(map: PadMap | null) {
  activePadMap = map ? { ...DEFAULT_PAD_MAP, ...map } : { ...DEFAULT_PAD_MAP };
}

export function getActivePadMap(): PadMap {
  return activePadMap;
}

/** Pedal 0–1 from the Standard Gamepad button, or a dedicated trigger axis. */
export function trigger(gp: Gamepad, button: number, axis: number) {
  const btn = gp.buttons[button]?.value ?? 0;
  const ax = gp.axes[axis];
  let fromAxis = 0;
  if (typeof ax === "number" && Number.isFinite(ax)) {
    if (ax >= 0 && ax <= 1.05) fromAxis = ax;
    else if (ax >= -1.05 && ax <= 1.05) fromAxis = (ax + 1) / 2;
  }
  const v = Math.max(btn, fromAxis);
  return v < 0.02 ? 0 : Math.min(1, v);
}

function stick(gp: Gamepad, axis: number, dead = 0.2) {
  const v = gp.axes[axis] ?? 0;
  return Math.abs(v) < dead ? 0 : v;
}

export type BodyStick = {
  lean: number;
  foreAft: number;
  stand: number;
};

export function idleBodyStick(): BodyStick {
  return { lean: 0, foreAft: 0, stand: 0 };
}

/** MX Bikes body-weight — right stick only. Left stick is steer. Click-in (R3) sits. */
export function readBodyStick(gp: Gamepad | null, map: PadMap = activePadMap): BodyStick {
  if (!gp) return idleBodyStick();
  const leanRaw = stick(gp, map.leanAxis, 0.12) * (map.invertLean ? 1 : -1);
  const sitRaw = stick(gp, map.sitAxis, 0.12) * (map.invertSit ? -1 : 1);
  const clickSit = map.sitButton != null && gp.buttons[map.sitButton]?.pressed;
  const analogSit = sitRaw > 0.28;
  const analogStand = sitRaw < -0.28 ? Math.min(1, (-sitRaw - 0.28) * 1.5) : 0;
  return {
    lean: leanRaw * 0.55,
    foreAft: clamp(-sitRaw * 0.11, -0.12, 0.1),
    stand: clickSit || analogSit ? 0 : analogStand,
  };
}

export function bodyStickActive(stickPose: BodyStick) {
  return Math.abs(stickPose.lean) > 0.04 || Math.abs(stickPose.foreAft) > 0.012 || stickPose.stand > 0.08;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * True only when the rider is clearly on the sticks/triggers.
 * Rest noise and a connected-but-idle pad must not drive the frame.
 */
export function gamepadActive(gp: Gamepad, map: PadMap = activePadMap) {
  if (trigger(gp, map.throttleBtn, 5) > 0.22 || trigger(gp, map.frontBrakeBtn, 4) > 0.22) return true;
  if (Math.abs(stick(gp, map.steerAxis)) > 0.28) return true;
  if (Math.abs(stick(gp, map.leanAxis)) > 0.28 || Math.abs(stick(gp, map.sitAxis)) > 0.28) return true;
  if (gp.buttons[map.rearBrakeBtn]?.pressed) return true;
  if (gp.buttons[map.clutchBtn]?.pressed) return true;
  if (map.sitButton != null && gp.buttons[map.sitButton]?.pressed) return true;
  return false;
}

/**
 * Xbox / Standard Gamepad mapping used by MX Bikes:
 * RT throttle, LT front brake, LB rear brake, A clutch,
 * left stick steer only, right stick body weight (lean / sit / stand).
 */
export function sandboxFromGamepad(
  gp: Gamepad,
  prev: SandboxInputs,
  dt: number,
  steerLock = 40,
  map: PadMap = activePadMap,
): SandboxInputs {
  const throttle = trigger(gp, map.throttleBtn, 5);
  const frontBrake = trigger(gp, map.frontBrakeBtn, 4);
  const rearBrake = gp.buttons[map.rearBrakeBtn]?.pressed ? 0.7 : 0;
  const clutch = gp.buttons[map.clutchBtn]?.pressed ? 1 : 0;
  const steer = -stick(gp, map.steerAxis) * steerLock;
  const lean = stick(gp, map.leanAxis) * 38 * (map.invertLean ? -1 : 1);
  const pitch = stick(gp, map.sitAxis) * 28 * (map.invertSit ? -1 : 1);
  const accel = throttle * 38 - frontBrake * 42 - rearBrake * 18;
  const speedKph = clamp(prev.speedKph + accel * dt, 0, 95);
  const rpm = clamp(1800 + throttle * 11000 + speedKph * 40, 900, 13200);
  const gear = speedKph < 1 ? 0 : speedKph < 18 ? 1 : speedKph < 32 ? 2 : speedKph < 48 ? 3 : 4;
  return {
    ...prev,
    throttle,
    frontBrake,
    rearBrake,
    clutch,
    steer,
    lean,
    pitch,
    speedKph,
    rpm,
    gear,
  };
}

export type PadTrace = {
  throttle: number;
  frontBrake: number;
  rearBrake: number;
  clutch: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  sit: number;
  lean: number;
  stand: number;
  connected: boolean;
};

export function idlePadTrace(): PadTrace {
  return {
    throttle: 0,
    frontBrake: 0,
    rearBrake: 0,
    clutch: 0,
    lx: 0,
    ly: 0,
    rx: 0,
    ry: 0,
    sit: 0,
    lean: 0,
    stand: 0,
    connected: false,
  };
}

function rawAxis(gp: Gamepad, axis: number) {
  const v = gp.axes[axis];
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.abs(v) < 0.015 ? 0 : Math.max(-1, Math.min(1, v));
}

/** Live analog snapshot. Does not drive the deck — graph / log only. */
export function readPadTrace(gp: Gamepad | null, map: PadMap = activePadMap): PadTrace {
  if (!gp) return idlePadTrace();
  const body = readBodyStick(gp, map);
  const sitAxis = rawAxis(gp, map.sitAxis) * (map.invertSit ? -1 : 1);
  return {
    throttle: trigger(gp, map.throttleBtn, 5),
    frontBrake: trigger(gp, map.frontBrakeBtn, 4),
    rearBrake: gp.buttons[map.rearBrakeBtn]?.pressed || (gp.buttons[map.rearBrakeBtn]?.value ?? 0) > 0.35 ? 1 : 0,
    clutch: (gp.buttons[map.clutchBtn]?.value ?? 0) > 0.02 ? Math.min(1, gp.buttons[map.clutchBtn]!.value) : 0,
    lx: rawAxis(gp, map.steerAxis),
    ly: rawAxis(gp, 1),
    rx: rawAxis(gp, map.leanAxis),
    ry: rawAxis(gp, map.sitAxis),
    sit: sitAxis,
    lean: body.lean,
    stand: body.stand,
    connected: Boolean(gp.connected),
  };
}

export function padTraceActive(pad: PadTrace) {
  return (
    pad.connected ||
    pad.throttle > 0.04 ||
    pad.frontBrake > 0.04 ||
    pad.rearBrake > 0.04 ||
    pad.clutch > 0.04 ||
    Math.abs(pad.lx) > 0.08 ||
    Math.abs(pad.ly) > 0.08 ||
    Math.abs(pad.rx) > 0.08 ||
    Math.abs(pad.ry) > 0.08 ||
    Math.abs(pad.lean) > 0.04 ||
    pad.stand > 0.08
  );
}

export type PadKind = "xbox" | "standard" | "wheel" | "other";

const LAST_PAD_KEY = "mxfs-last-pad-id";
let stickyPadId: string | null = null;

export function classifyPad(id: string, mapping = ""): PadKind {
  const n = id.toLowerCase();
  if (
    /wheel|g27|g29|g920|g923|t150|t248|t300|tx racing|fanatec|thrustmaster|simagic|moza|csl.?dd|logitech.*racing|racing wheel|steering/.test(
      n,
    )
  ) {
    return "wheel";
  }
  if (/xbox|xinput|045e-|microsoft.*controller/.test(n)) return "xbox";
  if (mapping === "standard" || /standard gamepad/.test(n)) return "standard";
  return "other";
}

export function isRiderPad(gp: Gamepad | null): boolean {
  return Boolean(gp && classifyPad(gp.id, gp.mapping) !== "wheel");
}

export function describePad(gp: Pick<Gamepad, "id" | "mapping">): string {
  const kind = classifyPad(gp.id, gp.mapping);
  const n = gp.id.toLowerCase();
  if (kind === "xbox") return "Xbox";
  if (kind === "wheel") return "Wheel";
  if (kind === "standard") {
    if (/dualsense|dualshock|wireless controller|playstation|ps5|ps4/.test(n)) return "PlayStation";
    if (/switch|pro controller/.test(n)) return "Switch";
    return "Gamepad";
  }
  const short = gp.id.split("(")[0]?.trim() ?? "";
  return short.slice(0, 22) || "Controller";
}

export function scorePad(gp: Gamepad, lastId: string | null): number {
  if (!gp.connected) return -1000;
  const kind = classifyPad(gp.id, gp.mapping);
  if (kind === "wheel") return -80;
  let score = 1;
  if (kind === "xbox") score += 50;
  else if (kind === "standard") score += 32;
  if (gp.mapping === "standard") score += 8;
  if (lastId && gp.id === lastId) score += 20;
  if (gamepadActive(gp)) score += 40;
  if (/steam virtual|online/.test(gp.id.toLowerCase())) score -= 6;
  return score;
}

export function pickRiderGamepadFrom(
  pads: Array<Gamepad | null | undefined>,
  lastId: string | null = null,
): Gamepad | null {
  const connected = pads.filter((p): p is Gamepad => Boolean(p && p.connected));
  if (connected.length === 0) return null;
  const ranked = connected
    .map((p) => ({ p, score: scorePad(p, lastId) }))
    .sort((a, b) => b.score - a.score || a.p.index - b.p.index);
  const best = ranked[0];
  if (classifyPad(best.p.id, best.p.mapping) === "wheel") {
    const rider = ranked.find((row) => classifyPad(row.p.id, row.p.mapping) !== "wheel");
    if (rider) return rider.p;
  }
  return best.p;
}

function loadLastPadId(): string | null {
  if (stickyPadId) return stickyPadId;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_PAD_KEY);
  } catch {
    return null;
  }
}

function saveLastPadId(id: string) {
  stickyPadId = id;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_PAD_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function rememberPadId(id: string | null) {
  stickyPadId = id;
}

export function readFirstGamepad(): Gamepad | null {
  if (typeof window !== "undefined") {
    const fake = (window as Window & { __mxbFakePad?: Gamepad | null }).__mxbFakePad;
    if (fake) return fake;
  }
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pick = pickRiderGamepadFrom([...navigator.getGamepads()], loadLastPadId());
  if (pick) saveLastPadId(pick.id);
  return pick;
}
