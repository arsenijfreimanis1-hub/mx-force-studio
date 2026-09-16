import {
  DEFAULT_CG_HEIGHT_M,
  DEFAULT_MASS_KG,
  DEFAULT_WHEELBASE_M,
  FRONT_Z,
  GRAVITY,
  REAR_Z,
} from "./defaults";
import type { BikeEvent, ForceId, ForceModel, ForceVector, Telemetry, Vec3 } from "./types";

const WHEEL_Y = 0.35;

function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function mag(v: Vec3) {
  return Math.hypot(v.x, v.y, v.z);
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function normOr(v: Vec3, fallback: Vec3): Vec3 {
  const m = mag(v);
  if (m < 1e-6) return fallback;
  return scale(v, 1 / m);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function slipRatio(wheelMs: number, chassisMs: number) {
  const denom = Math.max(Math.abs(chassisMs), 1.2);
  return clamp((wheelMs - chassisMs) / denom, -1.5, 2.5);
}

export const FORCE_META: Record<
  ForceId,
  Pick<ForceVector, "name" | "shortName" | "description" | "color">
> = {
  gravity: {
    name: "Gravity",
    shortName: "Weight",
    description: "mg straight down. Always on, even in the air.",
    color: "#94a3b8",
  },
  frontNormal: {
    name: "Front tire normal",
    shortName: "Front N",
    description: "Ground pushing up through the front tire. Drops to zero off jumps.",
    color: "#f8fafc",
  },
  rearNormal: {
    name: "Rear tire normal",
    shortName: "Rear N",
    description: "Ground pushing up through the rear tire. Grows on launches and wheelies.",
    color: "#e2e8f0",
  },
  drive: {
    name: "Rear drive / chain pull",
    shortName: "Drive",
    description: "Engine torque through the chain, pushing the bike forward at the rear contact patch.",
    color: "#fbbf24",
  },
  frontBrake: {
    name: "Front brake",
    shortName: "F-brake",
    description: "Longitudinal grip at the front tire. Shifts load onto the front wheel.",
    color: "#f43f5e",
  },
  rearBrake: {
    name: "Rear brake",
    shortName: "R-brake",
    description: "Longitudinal grip at the rear tire. Settles the chassis and can slide the rear.",
    color: "#fb7185",
  },
  longitudinal: {
    name: "Longitudinal G",
    shortName: "G long",
    description: "Measured chassis accel along the bike. Forward on throttle, rearward on the brakes.",
    color: "#fb923c",
  },
  lateral: {
    name: "Lateral G",
    shortName: "G lat",
    description: "Cornering force from lean and tire camber thrust. Points into the turn.",
    color: "#22d3ee",
  },
  vertical: {
    name: "Vertical G",
    shortName: "G vert",
    description: "Measured up/down accel. Near 1G parked, below 1G in the air, spikes on landings.",
    color: "#a3e635",
  },
  fork: {
    name: "Fork spring + damper",
    shortName: "Forks",
    description: "Front suspension force from travel and shaft speed. Compression is positive up.",
    color: "#4ade80",
  },
  shock: {
    name: "Rear shock",
    shortName: "Shock",
    description: "Rear suspension force from the shock and linkage. Handles whoops and landings.",
    color: "#34d399",
  },
  aero: {
    name: "Aero drag",
    shortName: "Drag",
    description: "Air resistance opposite the motion. Tiny at trail speed, noticeable on a fast start.",
    color: "#60a5fa",
  },
  steer: {
    name: "Steer torque",
    shortName: "Steer",
    description: "Handlebar torque the rider feels. Counter-steer spikes when you snap the bike in.",
    color: "#c4b5fd",
  },
  gyro: {
    name: "Gyroscopic couple",
    shortName: "Gyro",
    description: "Spinning wheels resist lean change. Stronger the faster the wheels turn.",
    color: "#f0abfc",
  },
};

function force(
  id: ForceId,
  magnitude: number,
  direction: Vec3,
  origin: Vec3,
  kind: ForceVector["kind"] = "force",
): ForceVector {
  const meta = FORCE_META[id];
  return {
    id,
    ...meta,
    magnitude,
    direction: normOr(direction, vec(0, 1, 0)),
    origin,
    kind,
    unit: kind === "moment" ? "Nm" : "N",
  };
}

export function buildForceModel(
  telemetry: Telemetry,
  event: BikeEvent,
  massKg = DEFAULT_MASS_KG,
): ForceModel {
  const wheelbase = DEFAULT_WHEELBASE_M;
  const cgHeight = DEFAULT_CG_HEIGHT_M;
  const frontContact = telemetry.wheelMaterial[0] > 0;
  const rearContact = telemetry.wheelMaterial[1] > 0;
  const airborne = !frontContact && !rearContact;

  const weight = massKg * GRAVITY;
  const verticalLoad = Math.max(0, telemetry.accelG.y) * weight;
  const longG = telemetry.accelG.z;
  const transfer = clamp((massKg * longG * GRAVITY * cgHeight) / wheelbase, -weight, weight);

  let loadFront = verticalLoad * 0.46 - transfer;
  let loadRear = verticalLoad - loadFront;
  if (!frontContact) {
    loadRear += Math.max(0, loadFront);
    loadFront = 0;
  }
  if (!rearContact) {
    loadFront += Math.max(0, loadRear);
    loadRear = 0;
  }
  loadFront = Math.max(0, loadFront);
  loadRear = Math.max(0, loadRear);

  const frontSlip = slipRatio(telemetry.wheelSpeed[0], telemetry.speedMs);
  const rearSlip = slipRatio(telemetry.wheelSpeed[1], telemetry.speedMs);

  const driveCap = loadRear * 1.15;
  const driveN =
    rearContact && telemetry.gear > 0
      ? clamp(telemetry.throttle * (1 - telemetry.clutch) * driveCap, 0, driveCap)
      : 0;

  const frontBrakeCap = loadFront * 1.35;
  const rearBrakeCap = loadRear * 0.95;
  const frontBrakeN = frontContact
    ? clamp(
        Math.max(telemetry.frontBrake, telemetry.brakePressureKpa[0] / 1800) * frontBrakeCap,
        0,
        frontBrakeCap,
      )
    : 0;
  const rearBrakeN = rearContact
    ? clamp(
        Math.max(telemetry.rearBrake, telemetry.brakePressureKpa[1] / 1400) * rearBrakeCap,
        0,
        rearBrakeCap,
      )
    : 0;

  const maxF = event.suspMaxTravel[0] || 0.31;
  const maxR = event.suspMaxTravel[1] || 0.315;
  const sagF = 0.34 * maxF;
  const sagR = 0.33 * maxR;
  const travelF = clamp(maxF - telemetry.suspLength[0], 0, maxF);
  const travelR = clamp(maxR - telemetry.suspLength[1], 0, maxR);
  const kF = weight * 0.48 / Math.max(sagF, 0.04);
  const kR = weight * 0.52 / Math.max(sagR, 0.04);
  const cF = 1400;
  const cR = 1600;
  const forkN = frontContact
    ? kF * travelF + cF * telemetry.suspVelocity[0]
    : 0;
  const shockN = rearContact
    ? kR * travelR + cR * telemetry.suspVelocity[1]
    : 0;

  const aeroN = 0.42 * telemetry.speedMs * Math.abs(telemetry.speedMs);
  const longN = Math.abs(telemetry.accelG.z) * weight;
  const latN = Math.abs(telemetry.accelG.x) * weight;
  const vertN = Math.abs(telemetry.accelG.y) * weight;
  const gyroNm =
    0.018 *
    (Math.abs(telemetry.wheelSpeed[0]) + Math.abs(telemetry.wheelSpeed[1])) *
    Math.abs(telemetry.rollRate);

  const cg = vec(0, cgHeight, -0.08);
  const frontPatch = vec(0, 0.02, FRONT_Z);
  const rearPatch = vec(0, 0.02, REAR_Z);
  const forkCrown = vec(0, 0.92, 0.58);
  const shockBody = vec(0, 0.62, -0.22);
  const bars = vec(0, 1.04, 0.42);

  const forces: ForceVector[] = [
    force("gravity", weight, vec(0, -1, 0), cg),
    force("frontNormal", loadFront, vec(0, 1, 0), frontPatch),
    force("rearNormal", loadRear, vec(0, 1, 0), rearPatch),
    force("drive", driveN, vec(0, 0, 1), rearPatch),
    force("frontBrake", frontBrakeN, vec(0, 0, -1), frontPatch),
    force("rearBrake", rearBrakeN, vec(0, 0, -1), rearPatch),
    force(
      "longitudinal",
      longN,
      vec(0, 0, Math.sign(telemetry.accelG.z) || 1),
      cg,
    ),
    force(
      "lateral",
      latN,
      vec(Math.sign(telemetry.accelG.x) || 1, 0, 0),
      cg,
    ),
    force(
      "vertical",
      vertN,
      vec(0, Math.sign(telemetry.accelG.y) || 1, 0),
      cg,
    ),
    force("fork", Math.abs(forkN), vec(0, Math.sign(forkN) || 1, 0), forkCrown),
    force("shock", Math.abs(shockN), vec(0, Math.sign(shockN) || 1, 0), shockBody),
    force("aero", aeroN, vec(0, 0, -1), vec(0, 0.78, 0.2)),
    force("steer", Math.abs(telemetry.steerTorqueNm), vec(Math.sign(telemetry.steerTorqueNm) || 1, 0, 0), bars, "moment"),
    force("gyro", gyroNm, vec(0, 0, 1), vec(0, WHEEL_Y, 0.02), "moment"),
  ];

  return {
    massKg,
    wheelbaseM: wheelbase,
    cgHeightM: cgHeight,
    airborne,
    frontContact,
    rearContact,
    frontSlip,
    rearSlip,
    loadFrontN: loadFront,
    loadRearN: loadRear,
    forces,
  };
}

export function formatNewtons(n: number) {
  if (n < 10) return `${n.toFixed(1)} N`;
  if (n < 1000) return `${Math.round(n)} N`;
  return `${(n / 1000).toFixed(2)} kN`;
}

export function formatG(g: number) {
  return `${g >= 0 ? "+" : ""}${g.toFixed(2)} G`;
}

export function speedKph(ms: number) {
  return ms * 3.6;
}
