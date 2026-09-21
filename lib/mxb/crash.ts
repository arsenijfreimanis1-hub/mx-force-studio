import type { Telemetry, Vec3 } from "./types.ts";

const GRAVITY = 9.80665;

/** Plugin accel is G or m/s² — parked 1 G vs ~9.8. */
export function accelAsG(raw: Vec3): Vec3 {
  const mag = Math.hypot(raw.x, raw.y, raw.z);
  if (mag > 4.2) {
    return { x: raw.x / GRAVITY, y: raw.y / GRAVITY, z: raw.z / GRAVITY };
  }
  return raw;
}

/** Plugin flag plus a physics fallback when m_iCrashed lags a high-side. */
export function detectCrash(tel: Telemetry): boolean {
  if (tel.crashed) return true;
  const roll = Math.abs(tel.roll);
  const pitch = Math.abs(tel.pitch);
  const rollRate = Math.abs(tel.rollRate);
  const g = accelAsG(tel.accelG);
  const gMag = Math.hypot(g.x, g.y, g.z);
  if (roll > 62) return true;
  if (pitch > 76) return true;
  if (rollRate > 210 && roll > 30) return true;
  if (gMag > 4.8 && roll > 40 && tel.speedMs < 7) return true;
  if (tel.speedMs < 2.8 && roll > 46 && g.y < 0.5) return true;
  if (
    tel.wheelMaterial[0] === 0 &&
    tel.wheelMaterial[1] === 0 &&
    roll > 50 &&
    Math.abs(tel.velocity.y) < 1.6 &&
    tel.speedMs < 10
  ) {
    return true;
  }
  return false;
}

/** Bike is back on its wheels after a crash — safe to leave the crash pose. */
export function crashRecovered(tel: Telemetry): boolean {
  if (tel.crashed) return false;
  if (detectCrash(tel)) return false;
  return Math.abs(tel.roll) < 24 && Math.abs(tel.pitch) < 20 && tel.speedMs < 8;
}

/**
 * Both wheels off the ground, and the bike is actually leaving the dirt.
 * Some surfaces report material 0 while parked — that is not a jump.
 */
export function isAirborne(tel: Telemetry): boolean {
  if (tel.wheelMaterial[0] !== 0 || tel.wheelMaterial[1] !== 0) return false;
  const g = accelAsG(tel.accelG);
  if (g.y < 0.45) return true;
  if (Math.abs(tel.velocity.y) > 0.45) return true;
  if (tel.speedMs > 1.2) return true;
  return false;
}

/** Parked / rolling / jump / landing / crash — same idea as detectCrash. */
export type RidePhase = "parked" | "ground" | "air" | "land" | "crash";

export type RidePhaseFilter = {
  phase: RidePhase;
  landT: number;
};

export function createRidePhaseFilter(): RidePhaseFilter {
  return { phase: "parked", landT: 0 };
}

export function stepRidePhase(filter: RidePhaseFilter, tel: Telemetry, dt: number): RidePhase {
  if (detectCrash(tel)) {
    filter.phase = "crash";
    filter.landT = 0.75;
    return filter.phase;
  }
  if (filter.phase === "crash") {
    filter.landT -= dt;
    if (!crashRecovered(tel)) filter.landT = Math.max(filter.landT, 0.2);
    if (filter.landT > 0) return "crash";
  }
  if (isAirborne(tel)) {
    filter.phase = "air";
    filter.landT = 0;
    return filter.phase;
  }
  if (filter.phase === "air") {
    filter.phase = "land";
    filter.landT = 0.55;
  }
  if (filter.phase === "land") {
    const slam = accelAsG(tel.accelG).y > 1.45;
    filter.landT -= dt;
    if (slam) filter.landT = Math.max(filter.landT, 0.35);
    if (filter.landT > 0) return "land";
  }
  if (isParked(tel) || isStopped(tel)) {
    filter.phase = "parked";
    return filter.phase;
  }
  filter.phase = "ground";
  return filter.phase;
}

export function describeRidePhase(phase: RidePhase): string {
  if (phase === "crash") return "Crash";
  if (phase === "air") return "In air";
  if (phase === "land") return "Landing";
  if (phase === "ground") return "On ground";
  return "Parked";
}

/** Below this, brake / gas / IMU must not invent deck tilt. */
export const PARKED_SPEED_MS = 0.8;

/**
 * Crawl or standstill: ignore pedals and IMU G. A berm at speed still tilts.
 */
export function isParked(tel: Telemetry): boolean {
  if (detectCrash(tel)) return false;
  if (isAirborne(tel)) return false;
  return tel.speedMs < PARKED_SPEED_MS;
}

/**
 * Resting on the pegs: no jump, no crash, no real lean.
 * IMU / Euler noise here is what made the parked bike jitter.
 */
export function isStopped(tel: Telemetry): boolean {
  if (detectCrash(tel)) return false;
  if (isAirborne(tel)) return false;
  if (tel.speedMs > 0.7 || tel.throttle > 0.08) return false;
  if (Math.abs(tel.velocity.y) > 0.85) return false;
  if (Math.abs(tel.roll) > 16 || Math.abs(tel.pitch) > 14 || Math.abs(tel.steer) > 16) return false;
  const g = accelAsG(tel.accelG);
  if (Math.abs(g.x) > 0.22 || Math.abs(g.z) > 0.22) return false;
  if (Math.abs(g.y - 1) > 0.35) return false;
  if (Math.abs(tel.yawRate) > 22) return false;
  return true;
}
