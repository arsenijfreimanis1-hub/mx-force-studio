import type { Telemetry } from "./types.ts";

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
 * Resting on the pegs: no jump, no crash, no real lean.
 * IMU / Euler noise here is what made the parked bike jitter.
 */
export function isStopped(tel: Telemetry): boolean {
  if (detectCrash(tel)) return false;
  const air = tel.wheelMaterial[0] === 0 && tel.wheelMaterial[1] === 0;
  if (air) return false;
  if (tel.speedMs > 0.55 || tel.throttle > 0.05) return false;
  if (Math.abs(tel.velocity.y) > 0.85) return false;
  if (Math.abs(tel.roll) > 6 || Math.abs(tel.pitch) > 6 || Math.abs(tel.steer) > 8) return false;
  if (Math.abs(tel.accelG.x) > 0.18 || Math.abs(tel.accelG.z) > 0.18) return false;
  if (Math.abs(tel.accelG.y - 1) > 0.28) return false;
  if (Math.abs(tel.yawRate) > 18) return false;
  return true;
}
