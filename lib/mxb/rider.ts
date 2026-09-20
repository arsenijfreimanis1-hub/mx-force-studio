import type { Telemetry } from "./types";

/** Rider body on the chassis: 0 sit / 1 stand, extra lean, fore-aft in meters. */
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

/**
 * Infer sit/stand / hang-off from public MX Bikes channels.
 * The plugin does not export a rider skeleton; this matches how the
 * in-game dummy moves with jumps, whoops, brakes, and lean.
 */
export function riderFromTelemetry(tel: Telemetry): RiderPose {
  const airborne = tel.wheelMaterial[0] === 0 && tel.wheelMaterial[1] === 0;
  const suspV = (tel.suspVelocity[0] + tel.suspVelocity[1]) * 0.5;
  const ay = tel.accelG.y;
  const whoops = tel.speedMs > 10 && Math.abs(suspV) > 0.55;
  const jumping = airborne || ay < 0.42;
  let stand = 0;
  if (jumping) stand = 0.92;
  else if (whoops) stand = 0.7;
  else if (tel.speedMs > 14 && tel.throttle > 0.55 && tel.frontBrake < 0.1) stand = 0.35;
  if (tel.speedMs < 2.2) stand = 0;
  if (tel.frontBrake > 0.55) stand *= 0.25;

  const lean = clamp((-tel.roll * Math.PI) / 180 * 0.42 + (tel.steer * Math.PI) / 180 * 0.1, -0.7, 0.7);
  const brakeBack = tel.frontBrake * 0.09 + tel.rearBrake * 0.04;
  const throttleFwd = tel.throttle * 0.05 - (tel.pitch > 8 ? 0.04 : 0);
  const pitchShift = clamp(-tel.pitch * 0.004, -0.08, 0.08);
  const foreAft = clamp(throttleFwd - brakeBack + pitchShift, -0.12, 0.1);

  return { stand, lean, foreAft };
}
