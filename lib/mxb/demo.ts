import { DEFAULT_EVENT, restTelemetry } from "./defaults.ts";
import type { SandboxInputs, Telemetry } from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Motorcycle specific force in the chassis frame.
 * Parked / slow: gravity components (−sin θ, cos θ).
 * At speed: coordinated (ax ≈ 0, ay ≈ 1 / cos(lean)).
 */
function motorcycleSpecificForce(leanDeg: number, speedMs: number) {
  const leanRad = (leanDeg * Math.PI) / 180;
  const coord = clamp(speedMs / 8, 0, 1);
  const uncoordX = -Math.sin(leanRad);
  const uncoordY = Math.cos(leanRad);
  const coordY = 1 / Math.max(0.38, Math.cos(leanRad));
  return {
    x: uncoordX * (1 - coord),
    y: uncoordY * (1 - coord) + coordY * coord,
  };
}

/** Map Xbox / sandbox sticks into MX Bikes-shaped telemetry for the 6DOF filter. */
export function telemetryFromSandbox(inputs: SandboxInputs, time: number): Telemetry {
  const speedMs = inputs.speedKph / 3.6;
  const maxF = DEFAULT_EVENT.suspMaxTravel[0];
  const maxR = DEFAULT_EVENT.suspMaxTravel[1];
  const frontLen = maxF * (1 - clamp(inputs.frontTravel, 0, 0.95));
  const rearLen = maxR * (1 - clamp(inputs.rearTravel, 0, 0.95));
  const frontContact = inputs.pitch < 18;
  const rearContact = inputs.pitch > -14;
  const longG =
    inputs.throttle * 0.72 * (inputs.gear > 0 ? 1 : 0.15) -
    inputs.frontBrake * 1.05 -
    inputs.rearBrake * 0.35;
  const spec = motorcycleSpecificForce(inputs.lean, speedMs);
  const latG = spec.x;
  const vertG =
    frontContact || rearContact ? spec.y + inputs.frontTravel * 0.25 + inputs.rearTravel * 0.2 : 0.08;
  const wheelie = inputs.pitch > 12;
  const stoppie = inputs.pitch < -8;

  return restTelemetry({
    rpm: inputs.rpm,
    gear: inputs.gear,
    speedMs,
    accelG: {
      x: latG,
      y: vertG,
      z: longG,
    },
    pitch: -inputs.pitch,
    roll: inputs.lean,
    yawRate: inputs.steer * 0.4,
    rollRate: inputs.lean * 0.15,
    pitchRate: 0,
    suspLength: [frontLen, rearLen],
    suspVelocity: [0, 0],
    steer: inputs.steer,
    throttle: inputs.throttle,
    frontBrake: inputs.frontBrake,
    rearBrake: inputs.rearBrake,
    clutch: inputs.clutch > 0 ? inputs.clutch : inputs.gear === 0 ? 0.85 : 0,
    wheelSpeed: [
      speedMs * (stoppie ? 0.2 : 1) * (1 - inputs.frontBrake * 0.35),
      speedMs * (1 + inputs.throttle * 0.28) * (wheelie ? 1.15 : 1),
    ],
    wheelMaterial: [frontContact ? 3 : 0, rearContact ? 3 : 0],
    brakePressureKpa: [inputs.frontBrake * 1650, inputs.rearBrake * 980],
    steerTorqueNm: inputs.steer * 0.55 + latG * 8,
    time,
    trackPos: (time * 0.02) % 1,
  });
}
