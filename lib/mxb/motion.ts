import { resolveAttitude } from "./attitude.ts";
import { chassisCues, heaveFromCues } from "./channels.ts";
import type { Telemetry, Vec3 } from "./types";

/** Bottom-middle of the main cradle, bike-local meters. */
export const FRAME_BOTTOM: Vec3 = { x: 0, y: 0.09, z: 0.02 };

/**
 * Stewart-platform mid-stroke. ±1 m heave then still clears the garage floor.
 * Rider-head washout (Barbagli / MORIS) is computed about this deck height.
 */
export const PLATFORM_HOME_Y = 1.75;

/** Lowest remaining frame tube vs the rig origin (after FRAME_CENTER_Y pin). */
export const FRAME_LOW_Y = 0.28 + 0.55;
/** Half-length used to keep rolled/pitched tubes off the pad. */
export const FRAME_HALF_SPAN = 0.72;
export const FLOOR_CLEAR_Y = 0.12;

/** Rider vestibular point above the cradle, bike-local meters (seat → inner ear). */
export const RIDER_HEAD: Vec3 = { x: 0, y: 0.95, z: 0.04 };

export type FrameTravel = {
  /** Half-range in meters. Default 1 = ±1 m left/right. */
  limitX: number;
  /** Half-range in meters. Default 1 = ±1 m up/down. */
  limitY: number;
  /** Half-range in meters. Default 1 = ±1 m forward/back. */
  limitZ: number;
  /** Half-range in radians. Default ≈ 40° so a berm lean is visible. */
  limitRoll: number;
  /** Half-range in radians. Default ≈ 28°. */
  limitPitch: number;
  /** Half-range in radians. Default ≈ 15°. */
  limitYaw: number;
  /** Extra live smoothing seconds for noisy IMU channels. */
  smoothTau: number;
  /** 1 = default cue strength. */
  response: number;
};

export const DEFAULT_FRAME_TRAVEL: FrameTravel = {
  limitX: 1,
  limitY: 1,
  limitZ: 1,
  limitRoll: (40 * Math.PI) / 180,
  limitPitch: (28 * Math.PI) / 180,
  limitYaw: (15 * Math.PI) / 180,
  smoothTau: 0.08,
  response: 1,
};

/** Standard gravity (m/s²). Must match `GRAVITY` in bike.ts. */
const GRAVITY = 9.80665;

/**
 * Classical translational washout (Nahon & Reid / MORIS motorcycle WF):
 *   ẍ + 2 ζω ẋ + ω² x = a
 * ω² = g so 1 G of specific force settles at 1 m, then travel clamps.
 */
export const WASH_OMEGA = Math.sqrt(GRAVITY);
export const WASH_ZETA = 1;
/** Faster rotational washout — MX rates are much quicker than aircraft. */
export const WASH_OMEGA_ANG = 6.4;
const INTEGRATOR_HZ = 120;
/**
 * Motorcycle tilt-coordination. Cars use ~3°/s so the otoliths don't see the
 * tilt; MX needs a faster channel or brake/accel cues arrive after the jump.
 */
const TILT_RATE_LIMIT = (55 * Math.PI) / 180;
const TILT_TAU = 0.22;
/** Follow plugin Euler directly — do not wait on the IMU smoother. */
const ATTITUDE_TAU = 0.03;
/** Grounded whoops stay on the shocks. Air tracks the ballistic arc. */
const HEAVE_TAU_GROUND = 0.1;
const HEAVE_TAU_AIR = 0.035;
/**
 * Chase-cam deck roll. Plugin m_fRoll negative is in-game left, but that
 * Euler draws the opposite way on the +Z-forward garage.
 */
export const LEAN_FOLLOW = -1;
const PITCH_FOLLOW = 1;
/** World jump height (m) that fills ±heave travel — typical MX table. */
const JUMP_WORLD_M = 4.5;
const REST_SUSP_F = 0.205;
const REST_SUSP_R = 0.208;
const SAG_TAU_QUIET = 3.5;
const SAG_TAU_BUSY = 8;
/** Residual lateral tilt only — lean-follow owns the berm. */
const TILT_ROLL_BLEND = 0.04;
/** Brake / accel pitch so gas lifts the front and the brakes drop it. */
const TILT_PITCH_BLEND = 0.42;
const HEAD_ACCEL_CLAMP = 14;

/** 6DOF pose of the motion base (radians). */
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
  z: number;
  vz: number;
  yaw: number;
  vyaw: number;
  pitchHp: number;
  vpitch: number;
  rollHp: number;
  vroll: number;
  tiltPitch: number;
  tiltRoll: number;
  followPitch: number;
  followRoll: number;
  wx: number;
  wy: number;
  wz: number;
  sAx: number;
  sAy: number;
  sAz: number;
  sRoll: number;
  sPitch: number;
  sYawRate: number;
  sPitchRate: number;
  sRollRate: number;
  sagF: number;
  sagR: number;
  wasAir: boolean;
  airY: number;
  airVy: number;
  landSink: number;
  landSinkV: number;
  /** null until parked / high-mag sample locks G vs m/s² for the session. */
  unitsMs2: boolean | null;
  primed: boolean;
  shown: Pose6;
};

export function createMotionFilter(): MotionFilter {
  return {
    x: 0,
    vx: 0,
    y: 0,
    z: 0,
    vz: 0,
    yaw: 0,
    vyaw: 0,
    pitchHp: 0,
    vpitch: 0,
    rollHp: 0,
    vroll: 0,
    tiltPitch: 0,
    tiltRoll: 0,
    followPitch: 0,
    followRoll: 0,
    wx: 0,
    wy: 0,
    wz: 0,
    sAx: 0,
    sAy: 1,
    sAz: 0,
    sRoll: 0,
    sPitch: 0,
    sYawRate: 0,
    sPitchRate: 0,
    sRollRate: 0,
    sagF: REST_SUSP_F,
    sagR: REST_SUSP_R,
    wasAir: false,
    airY: 0,
    airVy: 0,
    landSink: 0,
    landSinkV: 0,
    unitsMs2: null,
    primed: false,
    shown: identityPose(),
  };
}

export function resetMotionFilter(filter: MotionFilter) {
  Object.assign(filter, createMotionFilter());
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
 * MX Bikes documents chassis accel in G, but some builds emit m/s².
 * Parked specific force is ~1 G; m/s² parked is ~9.8.
 * Pass a locked unit flag so whoops/jumps cannot flicker across the 4.2 edge.
 */
export function detectForceUnitsMs2(mag: number, prev: boolean | null): boolean | null {
  if (prev != null) return prev;
  if (mag > 6.5) return true;
  if (mag > 0.55 && mag < 1.8) return false;
  return null;
}

export function specificForceG(raw: Vec3, forceIsMs2: boolean | null = null): Vec3 {
  if (forceIsMs2 === true) {
    return { x: raw.x / GRAVITY, y: raw.y / GRAVITY, z: raw.z / GRAVITY };
  }
  if (forceIsMs2 === false) return raw;
  const mag = Math.hypot(raw.x, raw.y, raw.z);
  if (mag > 4.2) {
    return { x: raw.x / GRAVITY, y: raw.y / GRAVITY, z: raw.z / GRAVITY };
  }
  return raw;
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
  accel: number,
  dt: number,
  limit: number,
  omega: number,
): { pos: number; vel: number } {
  const z = WASH_ZETA;
  let x = pos;
  let v = vel;
  const steps = Math.max(1, Math.ceil(dt * INTEGRATOR_HZ));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    v += (accel - 2 * z * omega * v - omega * omega * x) * h;
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

function rateLimit(current: number, target: number, dt: number, limit: number) {
  const maxDelta = limit * dt;
  return current + clamp(target - current, -maxDelta, maxDelta);
}

/** Lift heave so a leaned/pitched frame stays above the garage floor. */
export function clearPoseFromFloor(pose: Pose6, homeY = PLATFORM_HOME_Y): Pose6 {
  const drop =
    FRAME_HALF_SPAN * Math.abs(Math.sin(pose.roll)) +
    FRAME_HALF_SPAN * 0.65 * Math.abs(Math.sin(pose.pitch));
  const lowest = homeY + pose.y + FRAME_LOW_Y - drop;
  if (lowest >= FLOOR_CLEAR_Y) return pose;
  return { ...pose, y: pose.y + (FLOOR_CLEAR_Y - lowest) };
}

/**
 * Specific force at the rider's head (Barbagli washout location).
 * a_head = a_seat + α×r + ω×(ω×r), then converted back to G.
 */
export function riderHeadSpecificForceG(
  gForce: Vec3,
  telemetry: Telemetry,
  prevW: Vec3,
  dt: number,
): { g: Vec3; w: Vec3 } {
  const wx = deg(telemetry.pitchRate);
  const wy = deg(telemetry.yawRate);
  const wz = deg(telemetry.rollRate);
  const h = Math.max(0.0008, dt);
  const ax = (wx - prevW.x) / h;
  const ay = (wy - prevW.y) / h;
  const az = (wz - prevW.z) / h;
  const rx = RIDER_HEAD.x;
  const ry = RIDER_HEAD.y;
  const rz = RIDER_HEAD.z;

  const tx = ay * rz - az * ry;
  const ty = az * rx - ax * rz;
  const tz = ax * ry - ay * rx;

  const cx = wy * rz - wz * ry;
  const cy = wz * rx - wx * rz;
  const cz = wx * ry - wy * rx;
  const nx = wy * cz - wz * cy;
  const ny = wz * cx - wx * cz;
  const nz = wx * cy - wy * cx;

  return {
    g: {
      x: gForce.x + clamp(tx + nx, -HEAD_ACCEL_CLAMP, HEAD_ACCEL_CLAMP) / GRAVITY,
      y: gForce.y + clamp(ty + ny, -HEAD_ACCEL_CLAMP, HEAD_ACCEL_CLAMP) / GRAVITY,
      z: gForce.z + clamp(tz + nz, -HEAD_ACCEL_CLAMP, HEAD_ACCEL_CLAMP) / GRAVITY,
    },
    w: { x: wx, y: wy, z: wz },
  };
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
  const limRoll = Math.max(0, travel.limitRoll);
  const limPitch = Math.max(0, travel.limitPitch);
  const limYaw = Math.max(0, travel.limitYaw);
  const smoothTau = Math.max(0.08, travel.smoothTau);

  const mag = Math.hypot(telemetry.accelG.x, telemetry.accelG.y, telemetry.accelG.z);
  filter.unitsMs2 = detectForceUnitsMs2(mag, filter.unitsMs2);
  const rawG = specificForceG(telemetry.accelG, filter.unitsMs2);
  const attitude = resolveAttitude(telemetry);

  if (!filter.primed) {
    filter.primed = true;
    filter.sAx = rawG.x;
    filter.sAy = rawG.y;
    filter.sAz = rawG.z;
    filter.sRoll = attitude.roll;
    filter.sPitch = attitude.pitch;
    filter.sYawRate = telemetry.yawRate;
    filter.sPitchRate = telemetry.pitchRate;
    filter.sRollRate = telemetry.rollRate;
    filter.followRoll = deg(attitude.roll) * LEAN_FOLLOW;
    filter.followPitch = deg(attitude.pitch) * PITCH_FOLLOW;
    filter.wx = deg(telemetry.pitchRate);
    filter.wy = deg(telemetry.yawRate);
    filter.wz = deg(telemetry.rollRate);
  }

  if (telemetry.crashed) {
    filter.x = 0;
    filter.vx = 0;
    filter.y = 0;
    filter.z = 0;
    filter.vz = 0;
    filter.yaw = 0;
    filter.vyaw = 0;
    filter.pitchHp = 0;
    filter.vpitch = 0;
    filter.rollHp = 0;
    filter.vroll = 0;
    filter.tiltPitch = 0;
    filter.tiltRoll = 0;
    filter.followPitch = 0;
    filter.followRoll = 0;
    filter.wx = 0;
    filter.wy = 0;
    filter.wz = 0;
    filter.sAx = 0;
    filter.sAy = 1;
    filter.sAz = 0;
    filter.sRoll = 0;
    filter.sPitch = 0;
    filter.sYawRate = 0;
    filter.sPitchRate = 0;
    filter.sRollRate = 0;
    filter.sagF = REST_SUSP_F;
    filter.sagR = REST_SUSP_R;
    filter.wasAir = false;
    filter.airY = 0;
    filter.airVy = 0;
    filter.landSink = 0;
    filter.landSinkV = 0;
    filter.shown = identityPose();
    return filter.shown;
  }

  const airborne = telemetry.wheelMaterial[0] === 0 && telemetry.wheelMaterial[1] === 0;
  const gTau = airborne ? 0.07 : smoothTau;

  filter.sAx = follow(filter.sAx, rawG.x, step, smoothTau);
  filter.sAy = follow(filter.sAy, rawG.y, step, gTau);
  filter.sAz = follow(filter.sAz, rawG.z, step, smoothTau);
  filter.sRoll = follow(filter.sRoll, attitude.roll, step, smoothTau);
  filter.sPitch = follow(filter.sPitch, attitude.pitch, step, smoothTau);
  filter.sYawRate = follow(filter.sYawRate, telemetry.yawRate, step, smoothTau);
  filter.sPitchRate = follow(filter.sPitchRate, telemetry.pitchRate, step, smoothTau);
  filter.sRollRate = follow(filter.sRollRate, telemetry.rollRate, step, smoothTau);

  if (!airborne) {
    const shaft = Math.abs(telemetry.suspVelocity[0]) + Math.abs(telemetry.suspVelocity[1]);
    const sagTau = shaft < 0.9 ? SAG_TAU_QUIET : SAG_TAU_BUSY;
    filter.sagF = follow(filter.sagF, telemetry.suspLength[0], step, sagTau);
    filter.sagR = follow(filter.sagR, telemetry.suspLength[1], step, sagTau);
  }

  const cues = chassisCues(
    {
      ...telemetry,
      accelG: { x: filter.sAx, y: filter.sAy, z: filter.sAz },
      roll: filter.sRoll,
      pitch: filter.sPitch,
      yawRate: filter.sYawRate,
    },
    filter.sagF,
    filter.sagR,
  );
  const gForce = { x: cues.swayG, y: cues.vertG, z: cues.surgeG };
  const scale = GRAVITY * response;

  const aSway = gForce.x * scale;
  const aSurge = gForce.z * scale;
  let heaveTarget: number;
  let heaveTau = HEAVE_TAU_GROUND;
  const climb = Number.isFinite(telemetry.velocity.y) ? telemetry.velocity.y : filter.airVy;

  if (airborne) {
    if (!filter.wasAir) {
      filter.airY = 0;
      filter.airVy = climb;
      filter.landSink = 0;
      filter.landSinkV = 0;
    } else {
      filter.airVy = follow(filter.airVy, climb, step, 0.04);
      filter.airY += filter.airVy * step;
    }
    heaveTarget = clamp((filter.airY / JUMP_WORLD_M) * limY * response, -limY, limY);
    heaveTau = HEAVE_TAU_AIR;
  } else {
    if (filter.wasAir) {
      const impact = Math.max(0, -filter.airVy, -climb);
      filter.landSink = -clamp(0.12 + impact * 0.06, 0.1, 0.55) * response;
      filter.landSinkV = 0;
      filter.airY = 0;
      filter.y = Math.min(0, filter.y);
    }
    filter.airVy = follow(filter.airVy, 0, step, 0.06);
    const sink = stepAxis(filter.landSink, filter.landSinkV, 0, step, limY, WASH_OMEGA * 1.35);
    filter.landSink = sink.pos;
    filter.landSinkV = sink.vel;
    const ground = Math.abs(filter.landSink) > 0.03 ? 0 : heaveFromCues(cues, response) * limY;
    heaveTarget = ground + filter.landSink;
    if (Math.abs(filter.landSink) > 0.03) heaveTau = HEAVE_TAU_AIR;
  }
  filter.wasAir = airborne;

  const sway = stepAxis(filter.x, filter.vx, aSway, step, limX, WASH_OMEGA);
  filter.x = sway.pos;
  filter.vx = sway.vel;

  const surge = stepAxis(filter.z, filter.vz, aSurge, step, limZ, WASH_OMEGA);
  filter.z = surge.pos;
  filter.vz = surge.vel;

  filter.y = clamp(follow(filter.y, heaveTarget, step, heaveTau), -limY, limY);

  const yawAccel = (deg(filter.sYawRate) * 1.4 + deg(cues.steerDeg) * 0.12) * response;
  const yaw = stepAxis(filter.yaw, filter.vyaw, yawAccel, step, limYaw, WASH_OMEGA_ANG);
  filter.yaw = yaw.pos;
  filter.vyaw = yaw.vel;

  filter.rollHp = follow(filter.rollHp, 0, step, 0.12);
  filter.vroll = 0;
  filter.pitchHp = follow(filter.pitchHp, 0, step, 0.12);
  filter.vpitch = 0;

  const inputPitch =
    (cues.throttle * 0.18 - cues.frontBrake * 0.26 - cues.rearBrake * 0.08) * response;
  const tiltPitchTarget = Math.atan(gForce.z) * TILT_PITCH_BLEND * response + inputPitch;
  const tiltRollTarget = Math.atan(-gForce.x) * TILT_ROLL_BLEND * response;
  filter.tiltPitch = rateLimit(filter.tiltPitch, tiltPitchTarget, step, TILT_RATE_LIMIT);
  filter.tiltRoll = rateLimit(filter.tiltRoll, tiltRollTarget, step, TILT_RATE_LIMIT);
  filter.tiltPitch = follow(filter.tiltPitch, tiltPitchTarget, step, TILT_TAU);
  filter.tiltRoll = follow(filter.tiltRoll, tiltRollTarget, step, TILT_TAU);

  filter.followRoll = follow(filter.followRoll, deg(attitude.roll) * LEAN_FOLLOW, step, ATTITUDE_TAU);
  filter.followPitch = follow(filter.followPitch, deg(attitude.pitch) * PITCH_FOLLOW, step, ATTITUDE_TAU);

  filter.shown = clearPoseFromFloor({
    x: filter.x,
    y: filter.y,
    z: filter.z,
    yaw: clamp(filter.yaw, -limYaw, limYaw),
    pitch: clamp(filter.followPitch + filter.tiltPitch, -limPitch, limPitch),
    roll: clamp(filter.followRoll + filter.tiltRoll, -limRoll, limRoll),
  });

  return filter.shown;
}
