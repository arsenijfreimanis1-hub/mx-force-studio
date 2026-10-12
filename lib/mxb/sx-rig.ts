/**
 * Motion map for the mx-hub KTM 250 SX (2023) model.
 * Blender forward is -Y and up is +Z. The glTF is three.js: +X left, +Y up, +Z forward.
 * The mesh is the published static pose, so suspension motion is the delta from rest length.
 */

export const SX_ASSEMBLIES = [
  "Frame",
  "Subframe",
  "Bodywork",
  "Engine",
  "Front end",
  "Front wheel",
  "Rear suspension",
  "Drive",
  "Rear wheel",
] as const;

export const SX_RAKE_RAD = (26.1 * Math.PI) / 180;
export const SX_WHEELBASE_M = 1.493;
/** 80/100-21 carcass plus the generator's tread. */
export const SX_FRONT_RADIUS_M = 0.5334 / 2 + 0.08;
/** 110/90-19 carcass plus the generator's tread. */
export const SX_REAR_RADIUS_M = 0.4826 / 2 + 0.11 * 0.9;
/** Swingarm pivot in three.js meters (wheelbase center, ground y = 0). */
export const SX_SWING_PIVOT_Y = 0.44;
export const SX_SWING_PIVOT_Z = -0.17;
/** Horizontal pivot-to-axle distance used to turn shock compression into swingarm pitch. */
export const SX_SWING_ARM_Z = SX_WHEELBASE_M / 2 + SX_SWING_PIVOT_Z;

export type SxRole = "chassis" | "steer" | "fork" | "front-wheel" | "swing" | "rear-wheel";

const STEER_IDS = new Set([
  "upper_triple_clamp",
  "lower_triple_clamp",
  "steering_stem",
  "bar_mount",
  "handlebar",
  "grip_l",
  "grip_r",
  "lever_assembly_l",
  "lever_assembly_r",
  "front_fender",
  "front_number_plate",
  "front_brake_hose",
  "fork_outer_tube_l",
  "fork_outer_tube_r",
]);

const FORK_IDS = new Set([
  "fork_inner_tube_l",
  "fork_inner_tube_r",
  "fork_guard_l",
  "fork_guard_r",
  "front_axle",
]);

const CHASSIS_IDS = new Set(["shock_absorber", "shock_spring", "linkage_pull_rod", "front_sprocket"]);

/** Fork axis pointing from the axle toward the steering head, in three.js space. */
export function forkAxis() {
  return { x: 0, y: Math.cos(SX_RAKE_RAD), z: -Math.sin(SX_RAKE_RAD) };
}

export function sxRole(partId: string, assembly: string): SxRole {
  if (CHASSIS_IDS.has(partId)) return "chassis";
  if (assembly === "Front wheel") return "front-wheel";
  if (assembly === "Rear wheel") return "rear-wheel";
  if (STEER_IDS.has(partId)) return "steer";
  if (FORK_IDS.has(partId)) return "fork";
  if (assembly === "Rear suspension") return "swing";
  return "chassis";
}

/** Meters to slide the lower fork toward the crown. Positive shortens the fork. */
export function forkSlideM(lengthM: number, restM = 0.205) {
  if (!Number.isFinite(lengthM) || !Number.isFinite(restM)) return 0;
  return clamp(restM - lengthM, -0.16, 0.22);
}

/** Radians of swingarm pitch. Positive lifts the rear axle (compression). */
export function swingPitchRad(lengthM: number, restM = 0.208) {
  if (!Number.isFinite(lengthM) || !Number.isFinite(restM) || SX_SWING_ARM_Z < 1e-4) return 0;
  return clamp((restM - lengthM) / SX_SWING_ARM_Z, -0.35, 0.45);
}

export function parseHiddenParts(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export const HIDDEN_PARTS_KEY = "mxb-sx-parts-hidden";

export function loadHiddenParts(): string[] {
  if (typeof localStorage === "undefined") return [];
  return parseHiddenParts(localStorage.getItem(HIDDEN_PARTS_KEY));
}

export function saveHiddenParts(ids: string[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(HIDDEN_PARTS_KEY, JSON.stringify(ids));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
