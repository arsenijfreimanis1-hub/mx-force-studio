/**
 * Every public MX Bikes chassis cue → Force Studio motion / rider.
 *
 * Source fields are SPluginsBikeData_t from PiBoSo `mxb_example.c` /
 * MaxTM-v2.7 (same layout the .dlo posts). Windows player bindings
 * live in `inputs.ts` (stock Xbox map + setup .ssx name).
 *
 *   accelG        G, chassis X right / Y up / Z forward
 *   roll          deg, negative = left (same family as RaceVehicleData m_fLean)
 *   pitch         deg, positive = nose up
 *   yaw / yawRate heading + deg/s
 *   rot[9]        row-major 3×3, preferred over Euler when valid
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
 * Seat heave in −1…+1 of travel.
 * Ground: shocks own the whoops (vs rolling sag) + filtered G for landings.
 * Air: vertical G (0 G → drop) + a little world-Y so the crest isn't a step.
 */
export function heaveFromCues(cues: ChassisCues, response: number): number {
  const g = cues.heaveG;
  const land = g > 0 ? g : 0;
  let n: number;
  if (cues.airborne) {
    n = g * 0.95 + clamp(cues.climbMs, -8, 8) * 0.03;
  } else {
    const bump = clamp(cues.bumpM * 1.55 + cues.suspV * 0.07, -0.4, 0.5);
    n = g * 0.52 + bump + land * 0.38;
  }
  return clamp(n * response, -1, 1);
}
