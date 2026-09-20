import { detectCrash, isAirborne, isStopped } from "./crash.ts";
import { idleBodyStick, type BodyStick } from "./gamepad.ts";
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

export function riderFromTelemetry(tel: Telemetry, stick: BodyStick = idleBodyStick()): RiderPose {
  if (detectCrash(tel)) {
    return {
      stand: 0,
      lean: clamp(((tel.roll * Math.PI) / 180) * LEAN_FOLLOW, -1.15, 1.15),
      foreAft: 0.03,
    };
  }
  const airborne = isAirborne(tel);
  const suspV = (tel.suspVelocity[0] + tel.suspVelocity[1]) * 0.5;
  const jumping = airborne || tel.accelG.y < 0.42;
  let stand = 0;
  if (jumping) stand = 0.9;
  else if (tel.speedMs > 10 && Math.abs(suspV) > 0.55) stand = 0.55;
  if (tel.speedMs < 2.2 || tel.frontBrake > 0.55) stand = 0;

  const lean = clamp(
    (isStopped(tel) ? 0 : (tel.roll * Math.PI) / 180 * LEAN_FOLLOW) + stick.lean,
    -0.7,
    0.7,
  );
  const foreAft = clamp(
    tel.throttle * 0.06 - tel.frontBrake * 0.1 - tel.rearBrake * 0.04 - tel.pitch * 0.004 + stick.foreAft,
    -0.12,
    0.1,
  );
  return { stand: Math.max(stand, stick.stand), lean, foreAft };
}
