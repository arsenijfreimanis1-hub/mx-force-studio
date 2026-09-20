import type { Telemetry, Vec3 } from "./types";

/** Bottom-middle of the main cradle, bike-local meters. */
export const FRAME_BOTTOM: Vec3 = { x: 0, y: 0.09, z: 0.02 };

export type FrameTravel = {
  /** Half-range in meters. Default 1 = ±1 m left/right. */
  limitX: number;
  /** Half-range in meters. Default 1 = ±1 m up/down. */
  limitY: number;
  /** Half-range in meters. Default 1 = ±1 m forward/back. */
  limitZ: number;
  /** 1 = default cue strength. */
  response: number;
};

export const DEFAULT_FRAME_TRAVEL: FrameTravel = {
  limitX: 1,
  limitY: 1,
  limitZ: 1,
  response: 1,
};

/** Standard gravity (m/s²). Must match `GRAVITY` in bike.ts. */
const GRAVITY = 9.80665;

/**
 * Classical translational washout:
 *   ẍ + 2 ζω ẋ + ω² x = a
 * ω² = g so a constant 1 G specific force settles at 1 m, then the travel
 * limits clamp. Critically damped so the 1 m/G mapping does not ring.
 */
export const WASH_OMEGA = Math.sqrt(GRAVITY);
export const WASH_ZETA = 1;
const INTEGRATOR_HZ = 120;
const HEIGHT_EPS = 0.08;

/** 6DOF pose. Rider will reuse this later. Yaw is stored but the garage heading stays fixed. */
export type Pose6 = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
};

export function identityPose(): Pose6 {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
}

export type MotionFilter = {
  x: number;
  vx: number;
  y: number;
  vy: number;
  z: number;
  vz: number;
  /** World Y of the last contact sample. Frozen in the air. */
  groundY: number;
  hadContact: boolean;
  primed: boolean;
  shown: Pose6;
};

export function createMotionFilter(): MotionFilter {
  return {
    x: 0,
    vx: 0,
    y: 0,
    vy: 0,
    z: 0,
    vz: 0,
    groundY: 0,
    hadContact: false,
    primed: false,
    shown: identityPose(),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function deg(n: number) {
  return (n * Math.PI) / 180;
}

/**
 * Map MX Bikes world XZ into chassis right/forward using yaw (degrees).
 * Heading 0 faces +Z (bike forward in the garage).
 */
export function worldToChassis(wx: number, wz: number, yawDeg: number) {
  const yaw = deg(yawDeg);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return {
    right: wx * c - wz * s,
    fwd: wx * s + wz * c,
  };
}

/** Closed-form critically damped step to `a / ω²` meters. */
export function washoutStepResponse(accelMs2: number, t: number) {
  const ss = accelMs2 / (WASH_OMEGA * WASH_OMEGA);
  const wt = WASH_OMEGA * t;
  return ss * (1 - Math.exp(-wt) * (1 + wt));
}

function stepAxis(
  pos: number,
  vel: number,
  accelMs2: number,
  dt: number,
  limit: number,
): { pos: number; vel: number } {
  const w = WASH_OMEGA;
  const z = WASH_ZETA;
  let x = pos;
  let v = vel;
  const steps = Math.max(1, Math.ceil(dt * INTEGRATOR_HZ));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    v += (accelMs2 - 2 * z * w * v - w * w * x) * h;
    x += v * h;
  }
  if (x > limit) {
    x = limit;
    if (v > 0) v = 0;
  } else if (x < -limit) {
    x = -limit;
    if (v < 0) v = 0;
  }
  return { pos: x, vel: v };
}

export function stepMotion(
  filter: MotionFilter,
  telemetry: Telemetry,
  dt: number,
  travel: FrameTravel = DEFAULT_FRAME_TRAVEL,
): Pose6 {
  const step = Math.min(0.05, Math.max(0.0005, dt));
  const response = clamp(travel.response, 0.05, 3);
  const limX = Math.max(0, travel.limitX);
  const limY = Math.max(0, travel.limitY);
  const limZ = Math.max(0, travel.limitZ);
  const airborne = telemetry.wheelMaterial[0] <= 0 && telemetry.wheelMaterial[1] <= 0;

  if (!filter.primed) {
    filter.primed = true;
    if (!airborne) {
      filter.groundY = telemetry.position.y;
      filter.hadContact = true;
    }
  }

  if (telemetry.crashed) {
    filter.x = 0;
    filter.vx = 0;
    filter.y = 0;
    filter.vy = 0;
    filter.z = 0;
    filter.vz = 0;
    filter.shown = identityPose();
    return filter.shown;
  }

  const scale = GRAVITY * response;
  const aSway = telemetry.accelG.x * scale;
  const aSurge = telemetry.accelG.z * scale;
  const aHeave = (1 - telemetry.accelG.y) * scale;

  const sway = stepAxis(filter.x, filter.vx, aSway, step, limX);
  filter.x = sway.pos;
  filter.vx = sway.vel;

  const surge = stepAxis(filter.z, filter.vz, aSurge, step, limZ);
  filter.z = surge.pos;
  filter.vz = surge.vel;

  if (!airborne) {
    filter.groundY = telemetry.position.y;
    filter.hadContact = true;
    const heave = stepAxis(filter.y, filter.vy, aHeave, step, limY);
    filter.y = heave.pos;
    filter.vy = heave.vel;
  } else {
    const offGround = (filter.hadContact ? telemetry.position.y - filter.groundY : telemetry.position.y) * response;
    if (Math.abs(offGround) > HEIGHT_EPS) {
      filter.y = clamp(offGround, -limY, limY);
      filter.vy = 0;
    } else {
      const heave = stepAxis(filter.y, filter.vy, aHeave, step, limY);
      filter.y = heave.pos;
      filter.vy = heave.vel;
    }
  }

  filter.shown = {
    x: filter.x,
    y: filter.y,
    z: filter.z,
    yaw: 0,
    pitch: deg(telemetry.pitch),
    roll: deg(telemetry.roll),
  };

  return filter.shown;
}
