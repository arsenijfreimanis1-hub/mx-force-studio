import { BIKE_SCALE, PLATFORM_HOME_Y } from "./motion.ts";

/** Matches MotionDeck under the lowest tubes (FRAME_CENTER_Y = 0.55). */
export const DECK_ATTACH_Y = (0.55 + 0.26) * BIKE_SCALE;
export const DECK_HALF_W = 0.21 * BIKE_SCALE;
export const DECK_HALF_L = 0.36 * BIKE_SCALE;
export const ROD_BASE_Y = 0.075;

function restRise(homeY = PLATFORM_HOME_Y) {
  return homeY + DECK_ATTACH_Y - ROD_BASE_Y;
}

/** Horizontal splay so rest rods sit near 45° to the dirt. */
export const ROD_BASE_OUT = restRise() / Math.SQRT2;

export const ROD_CORNERS = [
  { id: "fl", x: -1, z: 1 },
  { id: "fr", x: 1, z: 1 },
  { id: "rl", x: -1, z: -1 },
  { id: "rr", x: 1, z: -1 },
] as const;

export function rodBaseCorner(signX: number, signZ: number): { x: number; y: number; z: number } {
  return {
    x: signX * (DECK_HALF_W + ROD_BASE_OUT),
    y: ROD_BASE_Y,
    z: signZ * (DECK_HALF_L + ROD_BASE_OUT),
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
  const base = rodBaseCorner(-1, 1);
  const local = rodDeckLocal(-1, 1);
  const rise = homeY + local.y - base.y;
  const run = Math.hypot(local.x - base.x, local.z - base.z);
  return (Math.atan2(rise, run) * 180) / Math.PI;
}
