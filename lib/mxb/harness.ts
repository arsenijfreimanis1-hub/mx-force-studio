/**
 * Chest-protector belts on the MX Squid frame.
 * Front and rear centerline mounts at chest height. No mesh yet — tension only.
 */

import { detectCrash, isAirborne, isParked, isStopped } from "./crash.ts";
import { riderFromTelemetry, type RiderPose } from "./rider.ts";
import type { Telemetry, Vec3 } from "./types.ts";

export type HarnessSensors = {
  /** Cable payout from the front chest mount, millimetres. */
  frontMm?: number;
  /** Cable payout from the rear chest mount, millimetres. */
  rearMm?: number;
  imu?: { roll: number; pitch: number; ax: number; ay: number; az: number };
};

export type HarnessMode = "idle" | "ride" | "air" | "land" | "crash";

export type HarnessState = {
  chest: Vec3;
  frontBelt: number;
  rearBelt: number;
  inward: number;
  landBoost: number;
  mode: HarnessMode;
};

/** Bike-frame chest-height attachment, meters, +Z forward. */
export const BIKE_CHEST_FRONT: Vec3 = { x: 0, y: 0.92, z: 0.22 };
export const BIKE_CHEST_REAR: Vec3 = { x: 0, y: 0.92, z: -0.12 };

export function idleHarness(): HarnessState {
  return {
    chest: { x: 0, y: 0.9, z: 0.04 },
    frontBelt: 0.12,
    rearBelt: 0.12,
    inward: 0,
    landBoost: 0,
    mode: "idle",
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function follow(current: number, target: number, dt: number, tau: number) {
  if (tau <= 1e-4) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

function sensorTension(payoutMm: number | undefined, slackMm: number, tightMm: number) {
  if (payoutMm == null || !Number.isFinite(payoutMm)) return null;
  return clamp((slackMm - payoutMm) / Math.max(1, slackMm - tightMm), 0, 1);
}

export function stepHarness(
  tel: Telemetry,
  rider: RiderPose = riderFromTelemetry(tel),
  sensors?: HarnessSensors,
  prev: HarnessState = idleHarness(),
  dt = 1 / 60,
): HarnessState {
  const crash = detectCrash(tel);
  const airborne = isAirborne(tel);
  const parked = isParked(tel) || isStopped(tel);
  const step = Math.min(0.05, Math.max(0.0005, dt));

  let landBoost = prev.landBoost;
  if (crash) landBoost = 0;
  else if (prev.mode === "air" && !airborne) landBoost = 1;
  else landBoost = follow(landBoost, 0, step, 0.85);

  let mode: HarnessMode;
  if (crash) mode = "crash";
  else if (airborne || tel.accelG.y < 0.32) mode = "air";
  else if (landBoost > 0.18) mode = "land";
  else if (parked) mode = "idle";
  else mode = "ride";

  let front = 0.12;
  let rear = 0.12;
  let inward = 0;

  if (mode === "air") {
    front = 0.02;
    rear = 0.02;
    inward = 0;
  } else if (mode === "land") {
    const down = 0.55 + landBoost * 0.4;
    front = down;
    rear = down;
    inward = 0.35 + landBoost * 0.25;
  } else if (mode === "crash") {
    front = 0.2;
    rear = 0.2;
    inward = 0;
  } else if (mode === "ride") {
    const wheelie = Math.max(0, -tel.pitch) / 28;
    const stoppie = Math.max(0, tel.pitch) / 22;
    rear = clamp(tel.throttle * 0.55 + wheelie * 0.45 + Math.max(0, rider.foreAft) * 4, 0, 1);
    front = clamp(tel.frontBrake * 0.7 + tel.rearBrake * 0.22 + stoppie * 0.5 + Math.max(0, -rider.foreAft) * 4, 0, 1);
    const leanMag = Math.min(1, Math.abs(tel.roll) / 38 + Math.abs(rider.lean) * 0.85);
    inward = leanMag * 0.82;
    front = clamp(front + inward * 0.22, 0, 1);
    rear = clamp(rear + inward * 0.22, 0, 1);
  }

  const senseF = sensorTension(sensors?.frontMm, 80, 12);
  const senseR = sensorTension(sensors?.rearMm, 80, 12);
  if (senseF != null) front = follow(front, senseF, step, 0.05);
  if (senseR != null) rear = follow(rear, senseR, step, 0.05);

  const hug = 1 - inward * 0.55;
  const chest: Vec3 = {
    x: rider.lean * 0.12 * hug,
    y: 0.88 + rider.stand * 0.08 - (mode === "land" ? landBoost * 0.06 : 0) - (mode === "air" ? 0.02 : 0),
    z: 0.04 + rider.foreAft * hug,
  };

  return {
    chest,
    frontBelt: clamp(front, 0, 1),
    rearBelt: clamp(rear, 0, 1),
    inward: clamp(inward, 0, 1),
    landBoost,
    mode,
  };
}

export function describeHarness(h: HarnessState) {
  const f = Math.round(h.frontBelt * 100);
  const r = Math.round(h.rearBelt * 100);
  const hug = Math.round(h.inward * 100);
  return `Harness ${h.mode} · F ${f}% · R ${r}% · hug ${hug}%`;
}
