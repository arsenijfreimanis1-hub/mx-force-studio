import {
  BIKE_SCALE,
  DECK_HALF_L_DRAW,
  DECK_HALF_W_DRAW,
  DECK_PLATE_Y,
  DEFAULT_ROD_LENGTH,
  DEFAULT_ROD_STROKE,
  FRAME_ORIGIN_Y,
  PLATFORM_HOME_Y,
} from "./dims.ts";

type Pose6 = { x: number; y: number; z: number; yaw: number; pitch: number; roll: number };

/** Where the rod ends meet the load plate, above the chassis origin. */
export const DECK_ATTACH_Y = (FRAME_ORIGIN_Y + DECK_PLATE_Y) * BIKE_SCALE;
export const DECK_HALF_W = DECK_HALF_W_DRAW * BIKE_SCALE;
export const DECK_HALF_L = DECK_HALF_L_DRAW * BIKE_SCALE;
/** Foot pivot height. Low feet keep the plinth thin. */
export const ROD_BASE_Y = 0.07;

export function restRise(homeY = PLATFORM_HOME_Y) {
  return homeY + DECK_ATTACH_Y - ROD_BASE_Y;
}

/** Rest length that sits near 45° at the current deck height. */
export function defaultRestRodLength(homeY = PLATFORM_HOME_Y) {
  return restRise(homeY) * Math.SQRT2;
}

/** Horizontal splay so rest rods sit near 45° to the dirt. Base does not move with stroke. */
export function rodBaseOut(homeY = PLATFORM_HOME_Y) {
  return restRise(homeY) / Math.SQRT2;
}

export const ROD_BASE_OUT = rodBaseOut();

export const ROD_CORNERS = [
  { id: "fl", x: -1, z: 1 },
  { id: "fr", x: 1, z: 1 },
  { id: "rl", x: -1, z: -1 },
  { id: "rr", x: 1, z: -1 },
] as const;

export function rodBaseCorner(signX: number, signZ: number, homeY = PLATFORM_HOME_Y): { x: number; y: number; z: number } {
  const out = rodBaseOut(homeY);
  return {
    x: signX * (DECK_HALF_W + out),
    y: ROD_BASE_Y,
    z: signZ * (DECK_HALF_L + out),
  };
}

export function rodDeckLocal(signX: number, signZ: number) {
  return { x: signX * DECK_HALF_W, y: DECK_ATTACH_Y, z: signZ * DECK_HALF_L };
}

export function rodLength(base: { x: number; y: number; z: number }, deck: { x: number; y: number; z: number }) {
  return Math.hypot(deck.x - base.x, deck.y - base.y, deck.z - base.z);
}

/** Rest angle from the base plane, degrees. ~45° is the IRL splay. */
export function restRodAngleDeg(homeY = PLATFORM_HOME_Y) {
  const base = rodBaseCorner(-1, 1, homeY);
  const local = rodDeckLocal(-1, 1);
  const rise = homeY + local.y - base.y;
  const run = Math.hypot(local.x - base.x, local.z - base.z);
  return (Math.atan2(rise, run) * 180) / Math.PI;
}

/** Same matrix as Three.js Euler(pitch, yaw, roll, "YXZ") applied to a local point. */
function rotateYxz(local: { x: number; y: number; z: number }, pitch: number, yaw: number, roll: number) {
  const a = Math.cos(pitch);
  const b = Math.sin(pitch);
  const c = Math.cos(yaw);
  const d = Math.sin(yaw);
  const e = Math.cos(roll);
  const f = Math.sin(roll);
  const ce = c * e;
  const cf = c * f;
  const de = d * e;
  const df = d * f;
  const m00 = ce + df * b;
  const m10 = a * f;
  const m20 = cf * b - de;
  const m01 = de * b - cf;
  const m11 = a * e;
  const m21 = df + ce * b;
  const m02 = a * d;
  const m12 = -b;
  const m22 = a * c;
  return {
    x: m00 * local.x + m01 * local.y + m02 * local.z,
    y: m10 * local.x + m11 * local.y + m12 * local.z,
    z: m20 * local.x + m21 * local.y + m22 * local.z,
  };
}

/** Four vertical actuators only. Surge, sway, and yaw belong to the inner stage. */
function pistonPose(pose: Pose6): Pose6 {
  return { x: 0, y: pose.y, z: 0, yaw: 0, pitch: pose.pitch, roll: pose.roll };
}

export function poseRodLengths(pose: Pose6, homeY = PLATFORM_HOME_Y, pitchSign = -1): number[] {
  const use = pistonPose(pose);
  const pitch = use.pitch * (pitchSign < 0 ? -1 : 1);
  const out: number[] = [];
  for (const c of ROD_CORNERS) {
    const base = rodBaseCorner(c.x, c.z, homeY);
    const local = rodDeckLocal(c.x, c.z);
    const rot = rotateYxz(local, pitch, use.yaw, use.roll);
    const deck = {
      x: rot.x + use.x,
      y: rot.y + homeY + use.y,
      z: rot.z + use.z,
    };
    out.push(rodLength(base, deck));
  }
  return out;
}

export function rodsInStroke(lengths: number[], stroke = DEFAULT_ROD_STROKE, homeY = PLATFORM_HOME_Y) {
  const rest = defaultRestRodLength(homeY);
  const min = Math.max(0.12, rest - stroke);
  const max = rest + stroke;
  return lengths.every((len) => len >= min - 1e-4 && len <= max + 1e-4);
}

function scalePistons(pose: Pose6, s: number): Pose6 {
  return { ...pose, y: pose.y * s, pitch: pose.pitch * s, roll: pose.roll * s };
}

/**
 * Shrink heave, pitch, and roll until every piston is inside [L0−stroke, L0+stroke].
 * Surge, sway, and yaw stay put — the inner stage carries those.
 */
export function clampPoseToRodStroke(
  pose: Pose6,
  stroke = DEFAULT_ROD_STROKE,
  homeY = PLATFORM_HOME_Y,
  pitchSign = -1,
): Pose6 {
  const band = Math.max(0.04, stroke);
  if (rodsInStroke(poseRodLengths(pose, homeY, pitchSign), band, homeY)) return pose;
  let lo = 0;
  let hi = 1;
  let best = scalePistons(pose, 0);
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) * 0.5;
    const scaled = scalePistons(pose, mid);
    if (rodsInStroke(poseRodLengths(scaled, homeY, pitchSign), band, homeY)) {
      best = scaled;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

export { DEFAULT_ROD_LENGTH, DEFAULT_ROD_STROKE };
