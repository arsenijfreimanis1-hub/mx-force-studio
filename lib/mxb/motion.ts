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
  lpX: number;
  lpY: number;
  lpZ: number;
  primed: boolean;
  shown: Pose6;
};

export function createMotionFilter(): MotionFilter {
  return {
    lpX: 0,
    lpY: 0,
    lpZ: 0,
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

function follow(current: number, target: number, dt: number, tau: number) {
  if (tau <= 1e-4) return target;
  const a = 1 - Math.exp(-dt / tau);
  return current + (target - current) * a;
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

const WASH_TAU = 0.9;
const SMOOTH_TAU = 0.028;
const POS_GAIN = 0.42;
const ACCEL_GAIN = 0.24;
const VEL_GAIN = 0.03;
const RATE_GAIN = 0.008;

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

  if (!filter.primed) {
    filter.lpX = telemetry.position.x;
    filter.lpY = telemetry.position.y;
    filter.lpZ = telemetry.position.z;
    filter.primed = true;
  }

  filter.lpX = follow(filter.lpX, telemetry.position.x, step, WASH_TAU);
  filter.lpY = follow(filter.lpY, telemetry.position.y, step, WASH_TAU);
  filter.lpZ = follow(filter.lpZ, telemetry.position.z, step, WASH_TAU);

  const hpX = telemetry.position.x - filter.lpX;
  const hpY = telemetry.position.y - filter.lpY;
  const hpZ = telemetry.position.z - filter.lpZ;
  const localPos = worldToChassis(hpX, hpZ, telemetry.yaw);
  const localVel = worldToChassis(telemetry.velocity.x, telemetry.velocity.z, telemetry.yaw);

  const suspVel = (telemetry.suspVelocity[0] + telemetry.suspVelocity[1]) * 0.5;

  const targetX =
    (localPos.right * POS_GAIN +
      telemetry.accelG.x * ACCEL_GAIN +
      localVel.right * VEL_GAIN +
      telemetry.rollRate * RATE_GAIN) *
    response;
  const targetY =
    (hpY * POS_GAIN +
      (1 - telemetry.accelG.y) * ACCEL_GAIN +
      telemetry.velocity.y * VEL_GAIN +
      -suspVel * 0.05) *
    response;
  const targetZ =
    (localPos.fwd * POS_GAIN +
      telemetry.accelG.z * ACCEL_GAIN +
      localVel.fwd * VEL_GAIN +
      telemetry.pitchRate * RATE_GAIN) *
    response;

  const target: Pose6 = {
    x: clamp(targetX, -limX, limX),
    y: clamp(targetY, -limY, limY),
    z: clamp(targetZ, -limZ, limZ),
    yaw: 0,
    pitch: deg(telemetry.pitch),
    roll: deg(telemetry.roll),
  };

  if (telemetry.crashed) {
    target.x = 0;
    target.y = 0;
    target.z = 0;
  }

  filter.shown = {
    x: follow(filter.shown.x, target.x, step, SMOOTH_TAU),
    y: follow(filter.shown.y, target.y, step, SMOOTH_TAU),
    z: follow(filter.shown.z, target.z, step, SMOOTH_TAU),
    yaw: 0,
    pitch: target.pitch,
    roll: target.roll,
  };

  return filter.shown;
}
