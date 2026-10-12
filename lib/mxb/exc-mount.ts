/**
 * Where the rig is allowed to grab the EXC chassis.
 *
 * The numbers below are measured off the GLB's Orange_Metal frame in the same
 * space prepareExcBike leaves the bike in: leaned upright, yawed to face +Z,
 * and dropped until the lowest frame point is y = 0. Each entry is the lowest
 * vertex of the paired outer rails (|x| >= 0.08) in a 0.05 m slice of z.
 *
 * Read it as the underside of the bike. The rails only exist in two stretches —
 * roughly z -0.20..-0.10 at the rear and z 0.05..0.10 ahead of the engine, with
 * a gap between where the skid area hangs down. A clamp has to land in one of
 * those stretches, and because the rails taper and climb toward the front, no
 * two clamps are the same width or the same height.
 *
 * If the model is ever re-exported these stop matching and the test fails,
 * which is the point.
 */
export const FRAME_RAIL_PROFILE = [
  { z: -0.2, x: 0.157, y: 0.049 },
  { z: -0.15, x: 0.146, y: 0.024 },
  { z: -0.1, x: 0.13, y: 0.01 },
  { z: 0.05, x: 0.101, y: 0.009 },
  { z: 0.1, x: 0.1, y: 0.016 },
] as const;

/** Height of the bike's lowest frame point above the cradle group origin. */
export const CRADLE_PAD_Y = 0.128;

/** The two clamps, each sitting on a measured stretch of rail. */
export const FRAME_CLAMPS = [
  { id: "rear", z: -0.15, x: 0.146, lift: 0.024 },
  { id: "front", z: 0.08, x: 0.1, lift: 0.012 },
] as const;

/** Rail width and height at a z, interpolated between measured slices. */
export function railAt(z: number): { x: number; y: number } | null {
  const pts = FRAME_RAIL_PROFILE;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (z < a.z || z > b.z) continue;
    // Do not interpolate across the gap between the two stretches.
    if (b.z - a.z > 0.06) continue;
    const t = b.z === a.z ? 0 : (z - a.z) / (b.z - a.z);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return null;
}
