import type { SandboxInputs } from "./types";

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

/** MX Bikes body-weight / rider hang — right stick, plus left-stick Y. */
export type BodyStick = {
  lean: number;
  foreAft: number;
  stand: number;
};

export function idleBodyStick(): BodyStick {
  return { lean: 0, foreAft: 0, stand: 0 };
}

export function readBodyStick(gp: Gamepad | null): BodyStick {
  if (!gp) return idleBodyStick();
  const rx = stick(gp, 2, 0.12);
  const ry = stick(gp, 3, 0.12);
  const ly = stick(gp, 1, 0.18);
  return {
    lean: -rx * 0.55,
    foreAft: clamp(-ry * 0.11 - ly * 0.04, -0.12, 0.1),
    stand: ry < -0.35 ? Math.min(1, (-ry - 0.35) * 1.45) : 0,
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
export function gamepadActive(gp: Gamepad) {
  if (trigger(gp, 7, 5) > 0.22 || trigger(gp, 6, 2) > 0.22) return true;
  if (Math.abs(stick(gp, 0)) > 0.28 || Math.abs(stick(gp, 1)) > 0.28) return true;
  if (Math.abs(stick(gp, 2)) > 0.28 || Math.abs(stick(gp, 3)) > 0.28) return true;
  if (gp.buttons[4]?.pressed) return true;
  if (gp.buttons[0]?.pressed) return true;
  return false;
}

/**
 * Xbox / Standard Gamepad mapping used by MX Bikes:
 * RT throttle, LT front brake, LB rear brake, A clutch,
 * left stick steer + lean, right stick extra lean / pitch.
 */
export function sandboxFromGamepad(
  gp: Gamepad,
  prev: SandboxInputs,
  dt: number,
  steerLock = 40,
): SandboxInputs {
  const throttle = trigger(gp, 7, 5);
  const frontBrake = trigger(gp, 6, 4);
  const rearBrake = gp.buttons[4]?.pressed ? 0.7 : 0;
  const clutch = gp.buttons[0]?.pressed ? 1 : 0;
  const steer = -stick(gp, 0) * steerLock;
  const lean = stick(gp, 0) * 38 + stick(gp, 2) * 28;
  const pitch = -stick(gp, 1) * 12 - stick(gp, 3) * 18;
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
  };
}

function rawAxis(gp: Gamepad, axis: number) {
  const v = gp.axes[axis];
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.abs(v) < 0.015 ? 0 : Math.max(-1, Math.min(1, v));
}

/** Live analog snapshot. Does not drive the deck — graph / log only. */
export function readPadTrace(gp: Gamepad | null): PadTrace {
  if (!gp) return idlePadTrace();
  return {
    throttle: trigger(gp, 7, 5),
    frontBrake: trigger(gp, 6, 4),
    rearBrake: gp.buttons[4]?.pressed || (gp.buttons[4]?.value ?? 0) > 0.35 ? 1 : 0,
    clutch: (gp.buttons[0]?.value ?? 0) > 0.02 ? Math.min(1, gp.buttons[0]!.value) : 0,
    lx: rawAxis(gp, 0),
    ly: rawAxis(gp, 1),
    rx: rawAxis(gp, 2),
    ry: rawAxis(gp, 3),
  };
}

export function padTraceActive(pad: PadTrace) {
  return (
    pad.throttle > 0.04 ||
    pad.frontBrake > 0.04 ||
    pad.rearBrake > 0.04 ||
    pad.clutch > 0.04 ||
    Math.abs(pad.lx) > 0.08 ||
    Math.abs(pad.ly) > 0.08 ||
    Math.abs(pad.rx) > 0.08 ||
    Math.abs(pad.ry) > 0.08
  );
}

export function readFirstGamepad(): Gamepad | null {
  if (typeof window !== "undefined") {
    const fake = (window as Window & { __mxbFakePad?: Gamepad | null }).__mxbFakePad;
    if (fake) return fake;
  }
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (pad && pad.connected) return pad;
  }
  return null;
}
