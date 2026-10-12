import { STAGE_TRAVEL_X, STAGE_TRAVEL_Z } from "./dims.ts";

type StagePose = { x: number; y: number; z: number; yaw: number; pitch: number; roll: number };

export { STAGE_TRAVEL_X, STAGE_TRAVEL_Z };

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
