type StagePose = { x: number; y: number; z: number; yaw: number; pitch: number; roll: number };

/**
 * Carriage travel on the plate. These match STUDIO_TRAVEL limitX / limitZ, so
 * what the cue asks for is what the rails actually do — a spec a manufacturer
 * can quote, not a cosmetic nudge.
 */
export const STAGE_TRAVEL_X = 0.14;
export const STAGE_TRAVEL_Z = 0.16;

/**
 * Surge, sway, and yaw live on the small machine. The four pistons only
 * heave, pitch, and roll — horizontal slide and twist would use up their stroke.
 */
export function stageOffset(
  pose: StagePose,
  travel: { limitX: number; limitZ: number },
): { x: number; z: number; yaw: number } {
  const limitX = Math.max(0.05, travel.limitX);
  const limitZ = Math.max(0.05, travel.limitZ);
  const x = Math.max(-1, Math.min(1, pose.x / limitX)) * STAGE_TRAVEL_X;
  const z = Math.max(-1, Math.min(1, pose.z / limitZ)) * STAGE_TRAVEL_Z;
  return { x, z, yaw: pose.yaw };
}
