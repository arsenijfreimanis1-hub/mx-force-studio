import { resolveAttitude } from "./attitude.ts";
import {
  CART_XZ_M,
  CART_Y_M,
  cartesianUseful,
  createCartesianState,
  stepCartesian,
  type CartesianState,
} from "./cartesian.ts";
import { chassisCues, heaveFromCues } from "./channels.ts";
import { detectCrash, isAirborne, isParked, isStopped } from "./crash.ts";
import { clampDof, dofAxes, maskPose, type DofLevel } from "./dof.ts";
import type { Telemetry, Vec3 } from "./types";

export { worldToChassis } from "./cartesian.ts";
export { CART_XZ_M, CART_Y_M };

/** Bottom-middle of the main cradle, bike-local meters. */
export const FRAME_BOTTOM: Vec3 = { x: 0, y: 0.09, z: 0.02 };

/**
 * Stewart-platform mid-stroke. ±1 m heave then still clears the garage floor.
 * Rider-head washout (Barbagli / MORIS) is computed about this deck height.
 */
export const PLATFORM_HOME_Y = 0.38;
/** Visual bike scale vs the original 1:1 tube drawing. */
export const BIKE_SCALE = 0.48;
/** Rest actuator length (m) at ~45° with the current deck height. */
export const DEFAULT_ROD_LENGTH = 0.98;

/** Lowest remaining frame tube vs the rig origin (after FRAME_CENTER_Y pin). */
export const FRAME_LOW_Y = (0.28 + 0.55) * BIKE_SCALE;
/** Half-length used to keep rolled/pitched tubes off the pad. */
export const FRAME_HALF_SPAN = 0.72 * BIKE_SCALE;
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
  /** Always 6. Kept so older travel JSON still sanitizes. */
  dof: DofLevel;
  /** Max deck m/s. */
  rateLin: number;
  /** Max deck rad/s. */
  rateAng: number;
  /** Visual slerp seconds. */
  visualTau: number;
  /** Live: ignore Euler/pedal tilt while parked. Pad demo turns this off. */
  parkLock: boolean;
  /** +1 = Three.js X matches pose pitch (nose down). −1 = wheelie goes nose-up. */
  visualPitch: number;
  /** Deck roll vs plugin Euler. Default −1 so in-game left is camera-left. */
  leanSign: number;
  /** Rest support-rod length in meters. Wider splay as the rods grow. */
  rodLength: number;
};

/**
 * Three.js +X with +Z-forward is nose-down. Plugin Euler +pitch is also
 * nose-down; `PITCH_FOLLOW` already maps a wheelie to pose.pitch > 0
 * (lean back). Multiply by −1 so that lean-back draws nose-up in the garage.
 */
export const VISUAL_PITCH_SIGN = -1;

export function visualPitch(posePitch: number, sign: number = VISUAL_PITCH_SIGN) {
  return posePitch * (sign < 0 ? -1 : 1);
}

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
/** Follow plugin Euler. Rest uses a longer tau so parked IMU noise dies. */
const ATTITUDE_TAU = 0.032;
const ATTITUDE_TAU_REST = 0.22;
/** Linear m/s a strapped rider can take without being thrown. */
export const HUMAN_LIN_MS = 1.15;
/** Angular rad/s. ~77°/s — a berm lean, not a twitch. */
export const HUMAN_ANG_RS = 1.35;
/** Grounded whoops stay on the shocks. Air tracks the ballistic arc. */
const HEAVE_TAU_GROUND = 0.22;
const HEAVE_TAU_AIR = 0.08;
/**
 * Chase-cam deck roll. Plugin m_fRoll negative is in-game left, but that
 * Euler draws the opposite way on the +Z-forward garage.
 */
export const LEAN_FOLLOW = -1;
/**
 * Plugin / rxPitch positive is nose-down (front drops). An in-game wheelie
 * is negative m_fPitch. Flip so pose.pitch > 0 leans the garage back.
 */
const PITCH_FOLLOW = -1;
/** World jump height (m) that fills ±heave travel — typical MX table. */
const JUMP_WORLD_M = CART_Y_M;
const REST_SUSP_F = 0.205;
const REST_SUSP_R = 0.208;
const SAG_TAU_QUIET = 3.5;
const SAG_TAU_BUSY = 8;
/** Residual lateral tilt only — lean-follow owns the berm. */
const TILT_ROLL_BLEND = 0.04;
const GAME_PITCH_DEG = 1.5;
const HEAD_ACCEL_CLAMP = 14;

export const DEFAULT_FRAME_TRAVEL: FrameTravel = {
  limitX: 1,
  limitY: 1,
  limitZ: 1,
  limitRoll: (40 * Math.PI) / 180,
  limitPitch: (28 * Math.PI) / 180,
  limitYaw: (15 * Math.PI) / 180,
  smoothTau: 0.08,
  response: 1,
  dof: 6,
  rateLin: HUMAN_LIN_MS,
  rateAng: HUMAN_ANG_RS,
  visualTau: 0.04,
  parkLock: true,
  visualPitch: VISUAL_PITCH_SIGN,
  leanSign: LEAN_FOLLOW,
  rodLength: DEFAULT_ROD_LENGTH,
};

/** Garage rig — 6DOF with calmer follow so the deck tracks the live bike. */
export const STUDIO_TRAVEL: FrameTravel = {
  limitX: 0.7,
  limitY: 0.55,
  limitZ: 0.7,
  limitRoll: (40 * Math.PI) / 180,
  limitPitch: (32 * Math.PI) / 180,
  limitYaw: (16 * Math.PI) / 180,
  smoothTau: 0.07,
  response: 1,
  dof: 6,
  rateLin: 1.4,
  rateAng: 1.55,
  visualTau: 0.055,
  parkLock: true,
  visualPitch: VISUAL_PITCH_SIGN,
  leanSign: LEAN_FOLLOW,
  rodLength: DEFAULT_ROD_LENGTH,
};

export const TRAVEL_STORAGE_KEY = "mxb-force-studio.travel.v3";

function finiteOr(n: unknown, fallback: number) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function sanitizeTravel(
  raw: Partial<FrameTravel> | null | undefined,
  fallback: FrameTravel = STUDIO_TRAVEL,
): FrameTravel {
  const src = raw ?? {};
  return {
    limitX: clamp(finiteOr(src.limitX, fallback.limitX), 0, 2.5),
    limitY: clamp(finiteOr(src.limitY, fallback.limitY), 0, 2.5),
    limitZ: clamp(finiteOr(src.limitZ, fallback.limitZ), 0, 2.5),
    limitRoll: clamp(finiteOr(src.limitRoll, fallback.limitRoll), 0, (80 * Math.PI) / 180),
    limitPitch: clamp(finiteOr(src.limitPitch, fallback.limitPitch), 0, (80 * Math.PI) / 180),
    limitYaw: clamp(finiteOr(src.limitYaw, fallback.limitYaw), 0, (80 * Math.PI) / 180),
    smoothTau: clamp(finiteOr(src.smoothTau, fallback.smoothTau), 0.008, 0.4),
    response: clamp(finiteOr(src.response, fallback.response), 0.05, 4),
    dof: clampDof(src.dof ?? fallback.dof),
    rateLin: clamp(finiteOr(src.rateLin, fallback.rateLin), 0.15, 8),
    rateAng: clamp(finiteOr(src.rateAng, fallback.rateAng), 0.15, 8),
    visualTau: clamp(finiteOr(src.visualTau, fallback.visualTau), 0.008, 0.25),
    parkLock: src.parkLock !== false,
    visualPitch: finiteOr(src.visualPitch, fallback.visualPitch) < 0 ? -1 : 1,
    leanSign: finiteOr(src.leanSign, fallback.leanSign) < 0 ? -1 : 1,
    rodLength: clamp(finiteOr(src.rodLength, fallback.rodLength), 0.35, 2.2),
  };
}

export function loadStoredTravel(fallback: FrameTravel = STUDIO_TRAVEL): FrameTravel {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(TRAVEL_STORAGE_KEY);
    if (!raw) return fallback;
    return sanitizeTravel(JSON.parse(raw) as Partial<FrameTravel>, fallback);
  } catch {
    return fallback;
  }
}

export function saveStoredTravel(travel: FrameTravel) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(TRAVEL_STORAGE_KEY, JSON.stringify(sanitizeTravel(travel)));
  } catch {
    // quota / private mode
  }
}

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
  /** Slow EMA of on-track world Y — the surface the game is actually on. */
  groundY: number;
  groundPrimed: boolean;
  prevWorldY: number;
  /** Drifting Cartesian origin for live world XYZ. */
  cart: CartesianState;
  /** Hysteresis so cart does not flicker on/off around walking speed. */
  cartOn: boolean;
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
    groundY: 0,
    groundPrimed: false,
    prevWorldY: 0,
    cart: createCartesianState(),
    cartOn: false,
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
  const travelUse = sanitizeTravel(travel, DEFAULT_FRAME_TRAVEL);
  const dof = clampDof(travelUse.dof ?? 6);
  const axes = dofAxes(dof);
  const response = clamp(travelUse.response, 0.05, 4);
  const leanFollow = travelUse.leanSign < 0 ? -1 : 1;
  const parkLock = travelUse.parkLock !== false;
  const limX = Math.max(0, travelUse.limitX);
  const limY = Math.max(0, travelUse.limitY);
  const limZ = Math.max(0, travelUse.limitZ);
  const limRoll = Math.max(0, travelUse.limitRoll);
  const limPitch = Math.max(0, travelUse.limitPitch);
  const limYaw = Math.max(0, travelUse.limitYaw);
  const smoothTau = Math.max(0.06, travelUse.smoothTau);

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
    filter.followRoll = deg(attitude.roll) * leanFollow;
    filter.followPitch = deg(attitude.pitch) * PITCH_FOLLOW;
    filter.wx = deg(telemetry.pitchRate);
    filter.wy = deg(telemetry.yawRate);
    filter.wz = deg(telemetry.rollRate);
  }

  const crashed = detectCrash(telemetry);
  const airborne = isAirborne(telemetry);
  const parked = !crashed && isParked(telemetry);
  const stopped = !crashed && isStopped(telemetry);
  const restDeck = parkLock && (stopped || parked);
  const cartMode = crashed ? "crash" : airborne ? "air" : stopped ? "stop" : "ground";
  if (airborne || telemetry.speedMs > 1.2) filter.cartOn = true;
  else if (!airborne && telemetry.speedMs < 0.35) filter.cartOn = false;
  const wantCart = true;
  const useCart =
    wantCart && filter.cartOn && cartesianUseful(telemetry.position, telemetry.speedMs, airborne);
  const cart = useCart
    ? stepCartesian(filter.cart, telemetry.position, telemetry.velocity, attitude.yaw, step, cartMode)
    : { x: 0, y: 0, z: 0 };
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
  const gForce = stopped
    ? { x: 0, y: 1, z: 0 }
    : { x: cues.swayG, y: cues.vertG, z: cues.surgeG };
  const scale = GRAVITY * response;

  const aSway = crashed ? 0 : gForce.x * scale;
  const aSurge = crashed ? 0 : gForce.z * scale;
  let heaveTarget: number;
  let heaveTau = HEAVE_TAU_GROUND;
  const climb = Number.isFinite(telemetry.velocity.y) ? telemetry.velocity.y : filter.airVy;
  const worldY = telemetry.position.y;
  const hasWorld = Number.isFinite(worldY);

  if (hasWorld && !filter.groundPrimed) {
    filter.groundY = worldY;
    filter.groundPrimed = true;
  }

  if (crashed) {
    filter.airY = 0;
    filter.airVy = 0;
    filter.landSink = follow(filter.landSink, -0.28 * response, step, 0.08);
    heaveTarget = filter.landSink;
    heaveTau = HEAVE_TAU_AIR;
  } else if (airborne) {
    if (!filter.wasAir) {
      filter.airY = 0;
      filter.airVy = climb;
      filter.landSink = 0;
      filter.landSinkV = 0;
    } else {
      filter.airVy = follow(filter.airVy, climb, step, 0.04);
      filter.airY += filter.airVy * step;
    }
    const worldRel = hasWorld && filter.groundPrimed ? worldY - filter.groundY : filter.airY;
    const worldMoved = hasWorld && Math.abs(worldY - filter.prevWorldY) > 0.003;
    if (useCart && worldMoved) filter.airY = follow(filter.airY, cart.y, step, 0.05);
    else if (worldMoved) filter.airY = follow(filter.airY, worldRel, step, 0.06);
    heaveTarget = clamp((filter.airY / JUMP_WORLD_M) * limY * response, -limY, limY);
    heaveTau = HEAVE_TAU_AIR;
  } else if (stopped) {
    filter.airY = 0;
    filter.airVy = 0;
    filter.landSink = follow(filter.landSink, 0, step, 0.12);
    filter.landSinkV = 0;
    if (hasWorld) filter.groundY = follow(filter.groundY, worldY, step, 0.35);
    heaveTarget = 0;
    heaveTau = ATTITUDE_TAU_REST;
  } else {
    if (filter.wasAir) {
      const impact = Math.max(0, -filter.airVy, -climb);
      filter.landSink = -clamp(0.08 + impact * 0.04, 0.06, 0.28) * response;
      filter.landSinkV = 0;
      filter.airY = 0;
      filter.y = Math.min(0, filter.y);
    }
    filter.airVy = follow(filter.airVy, 0, step, 0.06);
    if (hasWorld) filter.groundY = follow(filter.groundY, worldY, step, 0.85);
    const sink = stepAxis(filter.landSink, filter.landSinkV, 0, step, limY, WASH_OMEGA * 1.05);
    filter.landSink = sink.pos;
    filter.landSinkV = sink.vel;
    const ride = useCart
      ? clamp(cart.y / JUMP_WORLD_M, -1, 1) * limY * 0.22
      : hasWorld && filter.groundPrimed
        ? clamp((worldY - filter.groundY) / JUMP_WORLD_M, -1, 1) * limY * 0.22
        : 0;
    const whoop = heaveFromCues(cues, response) * limY * 0.38;
    heaveTarget = ride + whoop + filter.landSink;
    if (Math.abs(filter.landSink) > 0.03) heaveTau = 0.1;
  }
  filter.wasAir = airborne;

  if (!axes.x && !axes.z) {
    filter.x = follow(filter.x, 0, step, 0.06);
    filter.vx = follow(filter.vx, 0, step, 0.05);
    filter.z = follow(filter.z, 0, step, 0.06);
    filter.vz = follow(filter.vz, 0, step, 0.05);
  } else if (useCart && !stopped && !crashed) {
    const tx = clamp(cart.x / CART_XZ_M, -1, 1) * limX * response;
    const tz = clamp(cart.z / CART_XZ_M, -1, 1) * limZ * response;
    filter.x = follow(filter.x, tx, step, 0.18);
    filter.z = follow(filter.z, tz, step, 0.18);
    filter.vx = follow(filter.vx, 0, step, 0.1);
    filter.vz = follow(filter.vz, 0, step, 0.1);
  } else {
    const sway = stepAxis(filter.x, filter.vx, aSway, step, limX, WASH_OMEGA);
    filter.x = sway.pos;
    filter.vx = sway.vel;

    const surge = stepAxis(filter.z, filter.vz, aSurge, step, limZ, WASH_OMEGA);
    filter.z = surge.pos;
    filter.vz = surge.vel;
  }

  if (stopped || crashed) {
    filter.x = follow(filter.x, 0, step, 0.14);
    filter.vx = follow(filter.vx, 0, step, 0.1);
    filter.z = follow(filter.z, 0, step, 0.14);
    filter.vz = follow(filter.vz, 0, step, 0.1);
  }

  if (!axes.y) {
    filter.y = follow(filter.y, 0, step, 0.06);
    filter.landSink = follow(filter.landSink, 0, step, 0.06);
    heaveTarget = 0;
  }
  filter.y = clamp(follow(filter.y, heaveTarget, step, heaveTau), -limY, limY);

  const yawAccel = stopped || crashed ? 0 : (deg(filter.sYawRate) * 1.4 + deg(cues.steerDeg) * 0.12) * response;
  const yaw = stepAxis(filter.yaw, filter.vyaw, yawAccel, step, limYaw, WASH_OMEGA_ANG);
  filter.yaw = yaw.pos;
  filter.vyaw = yaw.vel;

  filter.rollHp = follow(filter.rollHp, 0, step, 0.12);
  filter.vroll = 0;
  filter.pitchHp = follow(filter.pitchHp, 0, step, 0.12);
  filter.vpitch = 0;

  const gameOwnsPitch = Math.abs(attitude.pitch) >= GAME_PITCH_DEG;
  const inputPitch =
    restDeck || gameOwnsPitch
      ? 0
      : (cues.throttle * 0.16 - cues.frontBrake * 0.22 - cues.rearBrake * 0.06) * response;
  // Game Euler already has the wheelie. Do not add IMU G nod on top of it.
  const tiltPitchTarget = restDeck ? 0 : inputPitch;
  const tiltRollTarget = restDeck ? 0 : Math.atan(-gForce.x) * TILT_ROLL_BLEND * response;
  const tiltRate = (70 * Math.PI) / 180;
  const tiltTau = 0.1;
  filter.tiltPitch = rateLimit(filter.tiltPitch, tiltPitchTarget, step, tiltRate);
  filter.tiltRoll = rateLimit(filter.tiltRoll, tiltRollTarget, step, tiltRate);
  filter.tiltPitch = follow(filter.tiltPitch, tiltPitchTarget, step, tiltTau);
  filter.tiltRoll = follow(filter.tiltRoll, tiltRollTarget, step, tiltTau);

  const rollCmd = restDeck ? 0 : attitude.roll;
  const pitchCmd = restDeck ? 0 : attitude.pitch;
  const attitudeTau = restDeck ? ATTITUDE_TAU_REST : ATTITUDE_TAU;
  filter.followRoll = follow(filter.followRoll, deg(rollCmd) * leanFollow, step, attitudeTau);
  filter.followPitch = follow(filter.followPitch, deg(pitchCmd) * PITCH_FOLLOW, step, attitudeTau);

  const rollLimit = crashed ? Math.max(limRoll, (82 * Math.PI) / 180) : limRoll;
  const pitchLimit = crashed ? Math.max(limPitch, (70 * Math.PI) / 180) : limPitch;

  if (hasWorld) filter.prevWorldY = worldY;

  const rawShown = maskPose(
    clearPoseFromFloor({
      x: filter.x,
      y: filter.y,
      z: filter.z,
      yaw: clamp(filter.yaw, -limYaw, limYaw),
      pitch: clamp(filter.followPitch + filter.tiltPitch, -pitchLimit, pitchLimit),
      roll: clamp(filter.followRoll + filter.tiltRoll, -rollLimit, rollLimit),
    }),
    dof,
  );
  filter.shown = limitShownPose(filter.shown, rawShown, step, dof, travelUse);

  return filter.shown;
}

/** Cap deck velocity so a human on the frame is not thrown by a twitch. */
export function limitShownPose(
  prev: Pose6,
  next: Pose6,
  dt: number,
  _dof: DofLevel = 6,
  travel?: Pick<FrameTravel, "rateLin" | "rateAng">,
): Pose6 {
  const lin = travel?.rateLin ?? HUMAN_LIN_MS;
  const ang = travel?.rateAng ?? HUMAN_ANG_RS;
  return {
    x: rateLimit(prev.x, next.x, dt, lin),
    y: rateLimit(prev.y, next.y, dt, lin),
    z: rateLimit(prev.z, next.z, dt, lin),
    yaw: rateLimit(prev.yaw, next.yaw, dt, ang),
    pitch: rateLimit(prev.pitch, next.pitch, dt, ang),
    roll: rateLimit(prev.roll, next.roll, dt, ang),
  };
}
