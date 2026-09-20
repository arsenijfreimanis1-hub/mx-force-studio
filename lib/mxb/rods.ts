import { PLATFORM_HOME_Y } from "./motion.ts";

/** Deck half-size so four 45° rods meet the plate corners. */
export const DECK_HALF_W = 0.21;
export const DECK_HALF_L = 0.36;
/** Extra run on the dirt so rest rods sit near 45° to the base. */
export const ROD_BASE_OUT = 0.46;
export const ROD_BASE_Y = 0.075;

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
  return { x: signX * DECK_HALF_W, y: 0.02, z: signZ * DECK_HALF_L };
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
