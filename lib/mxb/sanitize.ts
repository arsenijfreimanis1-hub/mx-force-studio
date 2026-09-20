import type { Telemetry, Vec3 } from "./types.ts";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Pedals are 0–1. Anything outside that is uninitialized plugin junk. */
export function unit01(n: number, fallback = 0): number {
  if (!Number.isFinite(n)) return fallback;
  if (n < -0.02 || n > 1.12) return fallback;
  if (n < 0.02) return 0;
  return clamp(n, 0, 1);
}

export function saneNumber(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

function saneVec(v: Vec3, maxAbs: number, fallback: Vec3): Vec3 {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) return fallback;
  if (Math.abs(v.x) > maxAbs || Math.abs(v.y) > maxAbs || Math.abs(v.z) > maxAbs) return fallback;
  return v;
}

/**
 * Drop garbage from a short or uninit PiBoSo struct so the HUD cannot
 * flash random throttle/brake and the deck cannot follow it.
 */
export function sanitizeTelemetry(tel: Telemetry, prev?: Telemetry): Telemetry {
  const p = prev;
  return {
    ...tel,
    rpm: saneNumber(tel.rpm, 0, 22000, p?.rpm ?? 0),
    gear: saneNumber(tel.gear, -1, 8, p?.gear ?? 0),
    fuel: saneNumber(tel.fuel, 0, 40, p?.fuel ?? 0),
    speedMs: saneNumber(tel.speedMs, 0, 80, p?.speedMs ?? 0),
    position: saneVec(tel.position, 20000, p?.position ?? { x: 0, y: 0, z: 0 }),
    velocity: saneVec(tel.velocity, 80, p?.velocity ?? { x: 0, y: 0, z: 0 }),
    accelG: saneVec(tel.accelG, 40, p?.accelG ?? { x: 0, y: 1, z: 0 }),
    yaw: saneNumber(tel.yaw, -400, 400, p?.yaw ?? 0),
    pitch: saneNumber(tel.pitch, -90, 90, p?.pitch ?? 0),
    roll: saneNumber(tel.roll, -120, 120, p?.roll ?? 0),
    yawRate: saneNumber(tel.yawRate, -720, 720, p?.yawRate ?? 0),
    pitchRate: saneNumber(tel.pitchRate, -720, 720, p?.pitchRate ?? 0),
    rollRate: saneNumber(tel.rollRate, -720, 720, p?.rollRate ?? 0),
    steer: saneNumber(tel.steer, -70, 70, p?.steer ?? 0),
    throttle: unit01(tel.throttle, p?.throttle ?? 0),
    frontBrake: unit01(tel.frontBrake, p?.frontBrake ?? 0),
    rearBrake: unit01(tel.rearBrake, p?.rearBrake ?? 0),
    clutch: unit01(tel.clutch, p?.clutch ?? 0),
    suspLength: [
      saneNumber(tel.suspLength[0], 0.02, 0.8, p?.suspLength[0] ?? 0.2),
      saneNumber(tel.suspLength[1], 0.02, 0.8, p?.suspLength[1] ?? 0.2),
    ],
    suspVelocity: [
      saneNumber(tel.suspVelocity[0], -8, 8, p?.suspVelocity[0] ?? 0),
      saneNumber(tel.suspVelocity[1], -8, 8, p?.suspVelocity[1] ?? 0),
    ],
  };
}
