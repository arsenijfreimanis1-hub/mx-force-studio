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
  if (roll > 72 || pitch > 82) return true;
  const g = Math.hypot(tel.accelG.x, tel.accelG.y, tel.accelG.z);
  if (g > 7.5 && tel.speedMs < 4 && roll > 38) return true;
  return false;
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
