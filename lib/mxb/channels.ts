/**
 * Every public MX Bikes chassis cue → Force Studio motion / rider.
 *
 * Source fields are SPluginsBikeData_t from PiBoSo `mxb_example.c` /
 * MaxTM-v2.7 (same layout the .dlo posts). Windows player bindings
 * live in `inputs.ts` (stock Xbox map + setup .ssx name).
 *
 *   accelG        G, chassis X right / Y up / Z forward
 *   roll          deg, plugin negative = in-game left (deck mirrors it)
 *   pitch         deg, positive = nose down / stoppie, negative = wheelie
 *   yaw / yawRate heading + deg/s
 *   rot[9]        row-major 3×3 (heading lives here; lean uses Euler)
 *   suspLength    m, longer = more extended (0 front, 1 rear)
 *   suspVelocity  m/s, + extending
 *   velocity.y    m/s world climb (jump crest / free fall)
 *   wheelMaterial 0 = that wheel is in the air
 *   steer         deg, negative = right
 *   throttle / frontBrake / rearBrake / clutch   0–1
 */

import type { Telemetry } from "./types.ts";

export type ChassisCues = {
  airborne: boolean;
  frontContact: boolean;
  rearContact: boolean;
  swayG: number;
  surgeG: number;
  vertG: number;
  heaveG: number;
  bumpM: number;
  suspV: number;
  climbMs: number;
  rollDeg: number;
  pitchDeg: number;
  yawRateDeg: number;
  steerDeg: number;
  throttle: number;
  frontBrake: number;
  rearBrake: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function chassisCues(tel: Telemetry, sagF: number, sagR: number): ChassisCues {
  const frontContact = tel.wheelMaterial[0] > 0;
  const rearContact = tel.wheelMaterial[1] > 0;
  return {
    airborne: !frontContact && !rearContact,
    frontContact,
    rearContact,
    swayG: tel.accelG.x,
    surgeG: tel.accelG.z,
    vertG: tel.accelG.y,
    heaveG: tel.accelG.y - 1,
    bumpM: (sagF - tel.suspLength[0] + (sagR - tel.suspLength[1])) * 0.5,
    suspV: (tel.suspVelocity[0] + tel.suspVelocity[1]) * 0.5,
    climbMs: tel.velocity.y,
    rollDeg: tel.roll,
    pitchDeg: tel.pitch,
    yawRateDeg: tel.yawRate,
    steerDeg: tel.steer,
    throttle: tel.throttle,
    frontBrake: tel.frontBrake,
    rearBrake: tel.rearBrake,
  };
}

/**
 * Grounded seat heave in −1…+1 of travel.
 * Whoops come from the forks/shock (damping). Landing G is not an upward
 * punch — the damper turns that impact into heat, so the deck sinks instead.
 * Airborne height is a ballistic parabola in `stepMotion`, not this cue.
 */
export function heaveFromCues(cues: ChassisCues, response: number): number {
  if (cues.airborne) return 0;
  const bump = clamp(cues.bumpM * 0.9 + cues.suspV * 0.04, -0.25, 0.3);
  const unload = cues.heaveG < 0 ? cues.heaveG * 0.18 : 0;
  return clamp((bump + unload) * response, -1, 1);
}
