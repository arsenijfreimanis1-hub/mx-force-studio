import { accelAsG, detectCrash, isAirborne, isStopped } from "./crash.ts";
import { idleBodyStick, type BodyStick } from "./gamepad.ts";
import { LEAN_FOLLOW } from "./motion.ts";
import type { Telemetry } from "./types";

/** Seat bean: 0 sit / 1 stand, extra lean, fore-aft in meters (+Z is the bars). */
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

/** 0 sit → 1 stand, from live chassis cues plus the body stick. */
export function standFromTelemetry(tel: Telemetry, stick: BodyStick = idleBodyStick()): number {
  if (detectCrash(tel)) return 0;
  if (tel.speedMs < 1.5 && stick.stand < 0.08) return 0;
  const airborne = isAirborne(tel);
  const suspV = (Math.abs(tel.suspVelocity[0]) + Math.abs(tel.suspVelocity[1])) * 0.5;
  let stand = 0;
  if (airborne) stand = 0.95;
  else {
    // Whoops and high speed still raise the rider. Throttle alone does not —
    // gas sits the hips back while staying on the seat.
    if (tel.speedMs > 6 && Math.abs(suspV) > 0.22) {
      stand = clamp(0.32 + Math.abs(suspV) * 0.6, 0, 0.95);
    }
    if (tel.speedMs > 13 && Math.abs(tel.roll) < 16) {
      stand = Math.max(stand, 0.42);
    }
    if (Math.abs(tel.roll) > 24 && tel.speedMs > 3.5) stand *= 0.32;
    if (tel.frontBrake > 0.72) stand *= 0.2;
  }
  return clamp(Math.max(stand, stick.stand), 0, 1);
}

export function riderFromTelemetry(tel: Telemetry, stick: BodyStick = idleBodyStick()): RiderPose {
  if (detectCrash(tel)) {
    return {
      stand: 0,
      lean: clamp(((tel.roll * Math.PI) / 180) * LEAN_FOLLOW, -1.15, 1.15),
      foreAft: 0.02,
    };
  }
  const g = accelAsG(tel.accelG);
  const stand = standFromTelemetry(tel, stick);
  const lean = clamp(
    (isStopped(tel) ? 0 : (tel.roll * Math.PI) / 180 * LEAN_FOLLOW) + stick.lean,
    -0.7,
    0.7,
  );
  // +Z is the bars. Gas / +surge slides the hips BACK a few centimetres.
  // Brake slides them FORWARD. No stand-up from throttle alone.
  const foreAft = clamp(
    -tel.throttle * 0.05 -
      Math.max(0, g.z) * 0.04 +
      tel.frontBrake * 0.1 +
      tel.rearBrake * 0.04 +
      Math.max(0, tel.pitch) * 0.003 +
      stick.foreAft,
    -0.1,
    0.1,
  );
  return { stand, lean, foreAft };
}
