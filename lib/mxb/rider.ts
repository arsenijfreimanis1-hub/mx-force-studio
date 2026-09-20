import { LEAN_FOLLOW } from "./motion.ts";
import type { Telemetry } from "./types";

/** Seat bean: 0 sit / 1 stand, extra lean, fore-aft in meters. */
export type RiderPose = {
  stand: number;
  lean: number;
  foreAft: number;
};

export function idleRider(): RiderPose {
  return { stand: 0, lean: 0, foreAft: 0 };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function riderFromTelemetry(tel: Telemetry): RiderPose {
  const airborne = tel.wheelMaterial[0] === 0 && tel.wheelMaterial[1] === 0;
  const suspV = (tel.suspVelocity[0] + tel.suspVelocity[1]) * 0.5;
  const jumping = airborne || tel.accelG.y < 0.42;
  let stand = 0;
  if (jumping) stand = 0.9;
  else if (tel.speedMs > 10 && Math.abs(suspV) > 0.55) stand = 0.55;
  if (tel.speedMs < 2.2 || tel.frontBrake > 0.55) stand = 0;

  const lean = clamp((tel.roll * Math.PI) / 180 * LEAN_FOLLOW, -0.55, 0.55);
  const foreAft = clamp(
    tel.throttle * 0.06 - tel.frontBrake * 0.1 - tel.rearBrake * 0.04 - tel.pitch * 0.004,
    -0.12,
    0.1,
  );
  return { stand, lean, foreAft };
}
