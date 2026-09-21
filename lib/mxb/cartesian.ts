/**
 * Cartesian bike pose from MX Bikes / PiBoSo world coordinates.
 *
 * World: +Y up, XZ the track plane (`m_fPosX/Y/Z`).
 * Chassis (garage): +X right, +Y up, +Z forward — same as MaxTM.
 *
 * The deck cannot walk a whole lap, so the origin is a drifting Cartesian
 * reference: it tracks steady speed (so we do not pin the travel limit) and
 * freezes in the air so a jump is just ΔY from the lip.
 */

import type { Vec3 } from "./types.ts";

/** World XZ meters that fill ±sway / ±surge travel. */
export const CART_XZ_M = 5;
/** World Y meters that fill ±heave — typical MX table. */
export const CART_Y_M = 4.5;

export type CartesianState = {
  primed: boolean;
  ox: number;
  oy: number;
  oz: number;
  px: number;
  py: number;
  pz: number;
  /** Low-passed world velocity used to walk the origin. */
  ovx: number;
  ovy: number;
  ovz: number;
};

export type CartesianMode = "stop" | "ground" | "air" | "crash";

export function createCartesianState(): CartesianState {
  return {
    primed: false,
    ox: 0,
    oy: 0,
    oz: 0,
    px: 0,
    py: 0,
    pz: 0,
    ovx: 0,
    ovy: 0,
    ovz: 0,
  };
}

function follow(current: number, target: number, dt: number, tau: number) {
  if (tau <= 1e-4) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/** Heading 0 faces world +Z. +yaw turns toward +X. */
export function worldToChassis(wx: number, wz: number, yawDeg: number) {
  const yaw = (yawDeg * Math.PI) / 180;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return {
    right: wx * c - wz * s,
    fwd: wx * s + wz * c,
  };
}

export function chassisFromWorldDelta(dx: number, dy: number, dz: number, yawDeg: number): Vec3 {
  const xz = worldToChassis(dx, dz, yawDeg);
  return { x: xz.right, y: dy, z: xz.fwd };
}

export function isFiniteVec(v: Vec3 | undefined): v is Vec3 {
  return v != null && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/**
 * Drive the deck from world XYZ only when the bike is actually moving.
 * A parked point like (80, 4, −20) is real, but using it as travel makes
 * centimeter physics noise twitch the garage.
 */
export function cartesianUseful(world: Vec3, speedMs: number, airborne: boolean): boolean {
  if (!isFiniteVec(world)) return false;
  const mag = Math.hypot(world.x, world.y, world.z);
  // Plugin/demo rest pose is (0,0,0). That is not a track point — using it as
  // Cartesian travel zeros surge/sway and the 6DOF deck looks frozen.
  if (mag < 0.05 && !airborne) return false;
  if (airborne) return true;
  return speedMs > 0.8;
}

/**
 * Chassis-frame meters from the drifting origin.
 * Call once per physics step with the live world point and world velocity.
 */
export function stepCartesian(
  state: CartesianState,
  world: Vec3,
  velocity: Vec3,
  yawDeg: number,
  dt: number,
  mode: CartesianMode,
): Vec3 {
  const step = Math.min(0.05, Math.max(0.0005, dt));
  const vx = Number.isFinite(velocity.x) ? velocity.x : 0;
  const vy = Number.isFinite(velocity.y) ? velocity.y : 0;
  const vz = Number.isFinite(velocity.z) ? velocity.z : 0;

  if (!state.primed) {
    state.primed = true;
    state.ox = world.x;
    state.oy = world.y;
    state.oz = world.z;
    state.px = world.x;
    state.py = world.y;
    state.pz = world.z;
    state.ovx = vx;
    state.ovy = vy;
    state.ovz = vz;
    return { x: 0, y: 0, z: 0 };
  }

  const movedXZ = Math.hypot(world.x - state.px, world.z - state.pz) > 0.0008;
  const movedY = Math.abs(world.y - state.py) > 0.0008;

  if (mode === "air") {
    // Lip Y stays put so the jump is Cartesian ΔY. Walk XZ with speed so a
    // 20 m table does not pin surge at the travel limit.
    if (movedXZ) {
      state.ovx = follow(state.ovx, vx, step, 0.16);
      state.ovz = follow(state.ovz, vz, step, 0.16);
      state.ox += state.ovx * step;
      state.oz += state.ovz * step;
      const velErr = Math.hypot(vx - state.ovx, vz - state.ovz);
      const snap = velErr < 0.85 ? 0.12 : 0.48;
      state.ox = follow(state.ox, world.x, step, snap);
      state.oz = follow(state.oz, world.z, step, snap);
    }
  } else if (mode === "stop" || mode === "crash") {
    state.ovx = follow(state.ovx, 0, step, 0.16);
    state.ovy = follow(state.ovy, 0, step, 0.16);
    state.ovz = follow(state.ovz, 0, step, 0.16);
    state.ox = follow(state.ox, world.x, step, 0.28);
    state.oy = follow(state.oy, world.y, step, 0.28);
    state.oz = follow(state.oz, world.z, step, 0.28);
  } else if (movedXZ || movedY) {
    // Walk the origin at low-passed velocity so constant speed does not pin,
    // but a burst still leaves a Cartesian surge / sway / whoop.
    if (movedXZ) {
      state.ovx = follow(state.ovx, vx, step, 0.16);
      state.ovz = follow(state.ovz, vz, step, 0.16);
      state.ox += state.ovx * step;
      state.oz += state.ovz * step;
      const velErr = Math.hypot(vx - state.ovx, vz - state.ovz);
      // Accel used to snap at 1.05s — origin lagged and the deck sat on +Z.
      const snap = velErr < 0.85 ? 0.12 : 0.48;
      state.ox = follow(state.ox, world.x, step, snap);
      state.oz = follow(state.oz, world.z, step, snap);
    }
    if (movedY) {
      state.ovy = follow(state.ovy, vy, step, 0.4);
      state.oy += state.ovy * step;
      const yErr = Math.abs(vy - state.ovy);
      state.oy = follow(state.oy, world.y, step, yErr < 0.6 ? 0.35 : 1.2);
    }
  } else {
    // Frozen world sample (paused game / unit tests). Glue so we do not invent travel.
    state.ovx = follow(state.ovx, 0, step, 0.2);
    state.ovy = follow(state.ovy, 0, step, 0.2);
    state.ovz = follow(state.ovz, 0, step, 0.2);
    state.ox = follow(state.ox, world.x, step, 0.28);
    state.oy = follow(state.oy, world.y, step, 0.28);
    state.oz = follow(state.oz, world.z, step, 0.28);
  }

  state.px = world.x;
  state.py = world.y;
  state.pz = world.z;

  return chassisFromWorldDelta(world.x - state.ox, world.y - state.oy, world.z - state.oz, yawDeg);
}
