import { BIKE_SCALE, DEFAULT_ROD_LENGTH, PLATFORM_HOME_Y } from "./motion.ts";

/** Matches MotionDeck under the lowest tubes (FRAME_CENTER_Y = 0.55). */
export const DECK_ATTACH_Y = (0.55 + 0.26) * BIKE_SCALE;
export const DECK_HALF_W = 0.21 * BIKE_SCALE;
export const DECK_HALF_L = 0.36 * BIKE_SCALE;
export const ROD_BASE_Y = 0.075;

export function restRise(homeY = PLATFORM_HOME_Y) {
  return homeY + DECK_ATTACH_Y - ROD_BASE_Y;
}

/** Rest length that sits near 45° at the current deck height. */
export function defaultRestRodLength(homeY = PLATFORM_HOME_Y) {
  return restRise(homeY) * Math.SQRT2;
}

function clampRestLength(restLen: number, homeY = PLATFORM_HOME_Y) {
  const rise = restRise(homeY);
  return Math.min(2.2, Math.max(rise + 0.04, restLen));
}

/** Horizontal splay so rest rods sit near 45° to the dirt at the given rest length. */
export function rodBaseOut(restLen = DEFAULT_ROD_LENGTH, homeY = PLATFORM_HOME_Y) {
  const rise = restRise(homeY);
  const len = clampRestLength(restLen, homeY);
  const run = Math.sqrt(Math.max(0, len * len - rise * rise));
  return run / Math.SQRT2;
}

export const ROD_BASE_OUT = rodBaseOut();

export const ROD_CORNERS = [
  { id: "fl", x: -1, z: 1 },
  { id: "fr", x: 1, z: 1 },
  { id: "rl", x: -1, z: -1 },
  { id: "rr", x: 1, z: -1 },
] as const;

export function rodBaseCorner(
  signX: number,
  signZ: number,
  restLen = DEFAULT_ROD_LENGTH,
): { x: number; y: number; z: number } {
  const out = rodBaseOut(restLen);
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
export function restRodAngleDeg(homeY = PLATFORM_HOME_Y, restLen = DEFAULT_ROD_LENGTH) {
  const base = rodBaseCorner(-1, 1, restLen);
  const local = rodDeckLocal(-1, 1);
  const rise = homeY + local.y - base.y;
  const run = Math.hypot(local.x - base.x, local.z - base.z);
  return (Math.atan2(rise, run) * 180) / Math.PI;
}
