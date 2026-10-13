/** Shared garage-rig dimensions. Keep motion/rods importing this — not each other. */

/**
 * Plate carrier mid-stroke above the floor. With DECK_ATTACH_Y the load plate
 * rests 0.56 m up: one step to swing a leg over, and low enough that the four
 * actuators under it stay stubby instead of stilt-like.
 */
export const PLATFORM_HOME_Y = 0.38;
/**
 * 1 = the tube drawing in meters. 0.48 was a desktop miniature.
 * Frame spars, bars, and the top plate all follow this.
 */
export const BIKE_SCALE = 1;
/** Chassis origin above the plate carrier. */
export const FRAME_ORIGIN_Y = 0.12;
/** Load-plate top above the chassis origin. */
export const DECK_PLATE_Y = 0.06;
/**
 * Top-plate half width and half length. Deliberately small and near-square:
 * every centimetre out from the centre is leverage the actuators have to buy
 * back with stroke, so a tight plate is what turns a short cylinder into a
 * big lean angle. The plate only has to carry the stage and the frame clamps —
 * the bike itself overhangs it at both ends, the same as on a shop stand.
 */
export const DECK_HALF_W_DRAW = 0.252;
export const DECK_HALF_L_DRAW = 0.272;
/**
 * Rest actuator length (m) at 45° with the current plate height:
 * restRise (0.43) × √2 — see rods.ts.
 */
export const DEFAULT_ROD_LENGTH = 0.69;
/**
 * Half-range each actuator may grow or shrink from rest, so 0.38 m of total
 * stroke. Retracted the strut is 0.50 m pivot-to-pivot, which still houses
 * that stroke plus end caps — i.e. a cylinder a supplier can actually quote
 * rather than one that has to be shorter than its own barrel.
 */
export const DEFAULT_ROD_STROKE = 0.19;
/**
 * Carriage travel on the plate for sway and surge. STUDIO_TRAVEL quotes these
 * directly, so what a cue asks for is what the rails actually do — a spec a
 * manufacturer can hold you to, not a cosmetic nudge. They live here rather
 * than in stage.ts so motion.ts can read them without an import cycle.
 */
export const STAGE_TRAVEL_X = 0.14;
export const STAGE_TRAVEL_Z = 0.16;
