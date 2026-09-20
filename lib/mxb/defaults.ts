import type { SandboxInputs, SessionInfo, Telemetry } from "./types";

export {
  DEFAULT_CG_HEIGHT_M,
  DEFAULT_EVENT,
  DEFAULT_MASS_KG,
  DEFAULT_WHEELBASE_M,
  FRONT_R,
  FRONT_Z,
  GRAVITY,
  REAR_R,
  REAR_Z,
} from "./bike";

export const DEFAULT_SESSION: SessionInfo = {
  session: 1,
  conditions: 0,
  airTemperature: 21,
  setupFileName: "stock.ssx",
};

export const REST_SUSP: [number, number] = [0.205, 0.208];

export function restTelemetry(partial: Partial<Telemetry> = {}): Telemetry {
  return {
    rpm: 1950,
    engineTemp: 78,
    waterTemp: 72,
    gear: 0,
    fuel: 3.8,
    speedMs: 0,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    accelG: { x: 0, y: 1, z: 0 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    yawRate: 0,
    pitchRate: 0,
    rollRate: 0,
    suspLength: [...REST_SUSP],
    suspVelocity: [0, 0],
    crashed: false,
    steer: 0,
    throttle: 0,
    frontBrake: 0,
    rearBrake: 0,
    clutch: 0,
    wheelSpeed: [0, 0],
    wheelMaterial: [3, 3],
    brakePressureKpa: [0, 0],
    steerTorqueNm: 0,
    time: 0,
    trackPos: 0,
    ...partial,
  };
}

export const DEFAULT_SANDBOX: SandboxInputs = {
  throttle: 0,
  frontBrake: 0,
  rearBrake: 0,
  clutch: 0,
  steer: 0,
  lean: 0,
  pitch: 0,
  speedKph: 0,
  frontTravel: 0.34,
  rearTravel: 0.33,
  rpm: 1950,
  gear: 0,
};
